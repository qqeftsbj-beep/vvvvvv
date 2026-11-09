import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type {
  OwnerNotificationFeed,
  OwnerNotificationFilter,
  OwnerNotificationItem,
  OwnerNotificationPreferences,
} from "@shared/ownerNotifications";
import {
  ownerNotificationPreferences,
  ownerNotificationReads,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

const PREFERENCES_ID = 1;
const DEFAULT_PREFERENCES: OwnerNotificationPreferences = {
  showSubmissions: true,
  showRequests: true,
  showToast: true,
};

const listInput = z.object({
  ownerPin: z.string().min(4).max(32),
  filter: z.enum(["all", "unread", "submission", "request"]).default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});
const ownerPinInput = z.object({ ownerPin: z.string().min(4).max(32) });

export function verifyOwnerPin(ownerPin: string): void {
  if (ownerPin !== ENV.ownerPin)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "كلمة مرور المالك غير صحيحة.",
    });
}

function numberDate(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = new Date(String(value || 0)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowsFromExecute(result: unknown): any[] {
  if (Array.isArray(result) && Array.isArray(result[0]))
    return result[0] as any[];
  return Array.isArray(result) ? (result as any[]) : [];
}

async function executeRows(
  db: any,
  query: ReturnType<typeof sql>
): Promise<any[]> {
  return rowsFromExecute(await db.execute(query));
}

function preferencesFromRow(row: any): OwnerNotificationPreferences {
  if (!row) return { ...DEFAULT_PREFERENCES };
  return {
    showSubmissions: Number(row.showSubmissions) === 1,
    showRequests: Number(row.showRequests) === 1,
    showToast: Number(row.showToast) === 1,
  };
}

async function readPreferences(db: any): Promise<OwnerNotificationPreferences> {
  const rows = await executeRows(
    db,
    sql`SELECT showSubmissions, showRequests, showToast FROM owner_notification_preferences WHERE id = ${PREFERENCES_ID} LIMIT 1`
  );
  return preferencesFromRow(rows[0]);
}

function enabledSources(
  filter: OwnerNotificationFilter,
  preferences: OwnerNotificationPreferences
) {
  return {
    showSubmissions:
      preferences.showSubmissions &&
      (filter === "all" || filter === "unread" || filter === "submission"),
    showRequests:
      preferences.showRequests &&
      (filter === "all" || filter === "unread" || filter === "request"),
    unread: filter === "unread",
  };
}

function projection(
  showSubmissions: boolean,
  showRequests: boolean,
  unread: boolean,
  limit: number,
  offset: number
) {
  const submissionQuery = sql`
    SELECT
      CONCAT('submission:', CAST(cs.id AS CHAR)) AS notificationKey,
      'submission' AS type,
      CAST(cs.id AS CHAR) AS sourceId,
      LEFT(COALESCE(NULLIF(cs.projectName, ''), 'مشاركة إبداعية'), 150) AS title,
      LEFT(COALESCE(NULLIF(cs.description, ''), cs.category, ''), 200) AS body,
      CAST(UNIX_TIMESTAMP(cs.createdAt) * 1000 AS UNSIGNED) AS createdAt,
      reads.readAt AS readAt,
      '/owner' AS href
    FROM creative_submissions cs
    LEFT JOIN owner_notification_reads reads ON reads.notificationKey = CONCAT('submission:', CAST(cs.id AS CHAR))
    WHERE ${showSubmissions ? sql`1 = 1` : sql`1 = 0`}
      AND cs.createdAt IS NOT NULL
      ${unread ? sql`AND reads.notificationKey IS NULL` : sql``}
  `;
  const requestQuery = sql`
    SELECT
      CONCAT('request:', cr.id) AS notificationKey,
      'request' AS type,
      cr.id AS sourceId,
      LEFT(cr.name, 150) AS title,
      LEFT(cr.request, 200) AS body,
      cr.createdAt AS createdAt,
      reads.readAt AS readAt,
      '/owner/inbox' AS href
    FROM customer_requests cr
    LEFT JOIN owner_notification_reads reads ON reads.notificationKey = CONCAT('request:', cr.id)
    WHERE ${showRequests ? sql`1 = 1` : sql`1 = 0`}
      ${unread ? sql`AND reads.notificationKey IS NULL` : sql``}
  `;
  return sql`
    SELECT notificationKey, type, sourceId, title, body, createdAt, readAt, href
    FROM (${submissionQuery} UNION ALL ${requestQuery}) AS notifications
    ORDER BY createdAt DESC, notificationKey DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

function itemFromRow(row: any): OwnerNotificationItem {
  return {
    id: String(row.notificationKey),
    type: row.type === "request" ? "request" : "submission",
    sourceId: String(row.sourceId),
    title: String(row.title || "").slice(0, 150),
    body: String(row.body || "").slice(0, 200),
    createdAt: numberDate(row.createdAt),
    readAt:
      row.readAt === null || row.readAt === undefined
        ? null
        : numberDate(row.readAt),
    href: row.type === "request" ? "/owner/inbox" : "/owner",
  };
}

async function count(
  db: any,
  kind: "submission" | "request",
  unread: boolean
): Promise<number> {
  const table =
    kind === "submission" ? sql`creative_submissions` : sql`customer_requests`;
  const id =
    kind === "submission" ? sql`CAST(source.id AS CHAR)` : sql`source.id`;
  const prefix = kind === "submission" ? "submission:" : "request:";
  const created =
    kind === "submission"
      ? sql`source.createdAt IS NOT NULL`
      : sql`source.createdAt IS NOT NULL`;
  const readCondition = unread ? sql`AND reads.notificationKey IS NULL` : sql``;
  const rows = await executeRows(
    db,
    sql`
    SELECT COUNT(*) AS count
    FROM ${table} source
    LEFT JOIN owner_notification_reads reads ON reads.notificationKey = CONCAT(${prefix}, ${id})
    WHERE ${created} ${readCondition}
  `
  );
  return Number(rows[0]?.count || 0);
}

export async function listOwnerNotifications(
  input: z.infer<typeof listInput>
): Promise<OwnerNotificationFeed> {
  verifyOwnerPin(input.ownerPin);
  const db: any = await getDb();
  if (!db) throw new Error("Database unavailable");
  const preferences = await readPreferences(db);
  const enabled = enabledSources(input.filter, preferences);
  const offset = (input.page - 1) * input.pageSize;
  const rows = await executeRows(
    db,
    projection(
      enabled.showSubmissions,
      enabled.showRequests,
      enabled.unread,
      input.pageSize + 1,
      offset
    )
  );
  const [submissionCount, requestCount, submissionUnread, requestUnread] =
    await Promise.all([
      preferences.showSubmissions
        ? count(db, "submission", false)
        : Promise.resolve(0),
      preferences.showRequests ? count(db, "request", false) : Promise.resolve(0),
      preferences.showSubmissions
        ? count(db, "submission", true)
        : Promise.resolve(0),
      preferences.showRequests ? count(db, "request", true) : Promise.resolve(0),
    ]);
  return {
    items: rows.slice(0, input.pageSize).map(itemFromRow),
    unreadCount: submissionUnread + requestUnread,
    counts: { submission: submissionCount, request: requestCount },
    page: input.page,
    hasMore: rows.length > input.pageSize,
    preferences,
  };
}

export async function markOwnerNotificationsRead(
  ownerPin: string,
  ids: string[]
): Promise<{ success: true }> {
  verifyOwnerPin(ownerPin);
  const db: any = await getDb();
  if (!db) throw new Error("Database unavailable");
  const keys = Array.from(new Set(ids))
    .slice(0, 50)
    .filter(id => /^(submission|request):[^:]{1,128}$/.test(id));
  const now = Date.now();
  await db.transaction(async (tx: any) => {
    for (const notificationKey of keys) {
      await tx
        .insert(ownerNotificationReads)
        .values({ notificationKey, readAt: now })
        .onDuplicateKeyUpdate({ set: { readAt: now } });
    }
  });
  return { success: true };
}

export async function markAllOwnerNotificationsRead(
  ownerPin: string
): Promise<{ success: true }> {
  verifyOwnerPin(ownerPin);
  const db: any = await getDb();
  if (!db) throw new Error("Database unavailable");
  const cutoff = Date.now();
  await db.transaction(async (tx: any) => {
    await tx.execute(sql`
      INSERT INTO owner_notification_reads (notificationKey, readAt)
      SELECT CONCAT('submission:', CAST(id AS CHAR)), ${cutoff}
      FROM creative_submissions
      WHERE createdAt <= FROM_UNIXTIME(${cutoff} / 1000)
      ON DUPLICATE KEY UPDATE readAt = VALUES(readAt)
    `);
    await tx.execute(sql`
      INSERT INTO owner_notification_reads (notificationKey, readAt)
      SELECT CONCAT('request:', id), ${cutoff}
      FROM customer_requests
      WHERE createdAt <= ${cutoff}
      ON DUPLICATE KEY UPDATE readAt = VALUES(readAt)
    `);
  });
  return { success: true };
}

export async function saveOwnerNotificationPreferences(
  ownerPin: string,
  preferences: OwnerNotificationPreferences
): Promise<OwnerNotificationPreferences> {
  verifyOwnerPin(ownerPin);
  const db: any = await getDb();
  if (!db) throw new Error("Database unavailable");
  const updatedAt = Date.now();
  await db
    .insert(ownerNotificationPreferences)
    .values({
      id: PREFERENCES_ID,
      showSubmissions: preferences.showSubmissions ? 1 : 0,
      showRequests: preferences.showRequests ? 1 : 0,
      showToast: preferences.showToast ? 1 : 0,
      updatedAt,
    })
    .onDuplicateKeyUpdate({
      set: {
        showSubmissions: preferences.showSubmissions ? 1 : 0,
        showRequests: preferences.showRequests ? 1 : 0,
        showToast: preferences.showToast ? 1 : 0,
        updatedAt,
      },
    });
  return preferences;
}

export const ownerNotificationsRouter = router({
  list: publicProcedure
    .input(listInput)
    .mutation(({ input }) => listOwnerNotifications(input)),
  markRead: publicProcedure
    .input(
      z.object({
        ownerPin: z.string().min(4).max(32),
        ids: z.array(z.string().min(1).max(191)).max(50),
      })
    )
    .mutation(({ input }) =>
      markOwnerNotificationsRead(input.ownerPin, input.ids)
    ),
  markAllRead: publicProcedure
    .input(ownerPinInput)
    .mutation(({ input }) => markAllOwnerNotificationsRead(input.ownerPin)),
  savePreferences: publicProcedure
    .input(
      z.object({
        ownerPin: z.string().min(4).max(32),
        preferences: z.object({
          showSubmissions: z.boolean(),
          showRequests: z.boolean(),
          showToast: z.boolean(),
        }),
      })
    )
    .mutation(({ input }) =>
      saveOwnerNotificationPreferences(input.ownerPin, input.preferences)
    ),
});
