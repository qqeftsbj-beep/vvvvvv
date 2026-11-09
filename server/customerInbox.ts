import { TRPCError } from "@trpc/server";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import type {
  CustomerRequest,
  CustomerRequestPage,
  CustomerRequestStatus,
} from "@shared/ownerNotifications";
import { customerRequests } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { publicProcedure, router } from "./_core/trpc";

const PHONE_PATTERN = /^\+?[0-9\s-]{8,20}$/;
const STATUS_VALUES = ["new", "contacted", "completed"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sendInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(150),
  phone: z.string().regex(PHONE_PATTERN, "رقم الهاتف غير صحيح."),
  request: z.string().min(1).max(10000),
  source: z.string().trim().min(1).max(150).default("المحادثة"),
});
const privatePin = z.string().min(4).max(32);
const listInput = z.object({
  ownerPin: privatePin,
  search: z.string().max(150).default(""),
  status: z.enum(["all", ...STATUS_VALUES]).default("all"),
  date: z.enum(["all", "today", "7d", "30d"]).default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export function verifyCustomerInboxOwnerPin(ownerPin: string): void {
  if (ownerPin !== ENV.ownerPin)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "كلمة مرور المالك غير صحيحة.",
    });
}

function timestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.trunc(value);
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value || "")).getTime();
  if (!Number.isFinite(parsed))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "تاريخ الطلب غير صحيح.",
    });
  return parsed;
}

function apiRow(row: any): CustomerRequest {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: String(row.phone),
    request: String(row.request),
    source: String(row.source),
    status: STATUS_VALUES.includes(row.status) ? row.status : "new",
    createdAt: timestamp(row.createdAt),
  };
}

function stableLegacyId(id: string): string {
  const clean = id.trim();
  if (UUID_PATTERN.test(clean)) return clean;
  const encoded = Buffer.from(clean || "legacy-item", "utf8")
    .toString("base64url")
    .slice(0, 100);
  return `legacy:${encoded}`;
}

function isDuplicateEntry(error: unknown): boolean {
  let value: any = error;
  for (let depth = 0; depth < 5 && value; depth++, value = value.cause) {
    if (value.code === "ER_DUP_ENTRY" || Number(value.errno) === 1062 || /duplicate entry/i.test(String(value.message || ""))) return true;
  }
  return false;
}

async function dbOrThrow(): Promise<any> {
  const db: any = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

export async function sendCustomerRequest(
  input: z.infer<typeof sendInput>
): Promise<{ success: true; id: string }> {
  input = sendInput.parse(input);
  const db = await dbOrThrow();
  const id = input.id || crypto.randomUUID();
  const now = Date.now();
  try {
    await db.insert(customerRequests).values({
      id,
      name: input.name,
      phone: input.phone,
      request: input.request,
      source: input.source,
      status: "new",
      createdAt: now,
      updatedAt: now,
    });
  } catch (error: any) {
    // Idempotent retries return the original record and never overwrite its payload.
    const duplicate = isDuplicateEntry(error);
    if (!duplicate) throw error;
    const existing = await db
      .select({ id: customerRequests.id })
      .from(customerRequests)
      .where(eq(customerRequests.id, id))
      .limit(1);
    if (!existing[0]) throw error;
  }
  return { success: true, id };
}

export async function listCustomerRequests(
  input: z.infer<typeof listInput>
): Promise<CustomerRequestPage> {
  verifyCustomerInboxOwnerPin(input.ownerPin);
  const db = await dbOrThrow();
  const conditions: any[] = [];
  const search = input.search.trim().slice(0, 150);
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(customerRequests.name, pattern),
        like(customerRequests.phone, pattern),
        like(customerRequests.request, pattern),
        like(customerRequests.source, pattern)
      )
    );
  }
  if (input.status !== "all")
    conditions.push(eq(customerRequests.status, input.status));
  if (input.date !== "all") {
    const days = input.date === "today" ? 1 : input.date === "7d" ? 7 : 30;
    const start = Date.now() - days * 24 * 60 * 60 * 1000;
    conditions.push(sql`${customerRequests.createdAt} >= ${start}`);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(customerRequests)
      .where(where)
      .orderBy(desc(customerRequests.createdAt), desc(customerRequests.id))
      .limit(input.pageSize + 1)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(customerRequests)
      .where(where),
  ]);
  return {
    items: rows.slice(0, input.pageSize).map(apiRow),
    total: Number(totalRows[0]?.count || 0),
    hasMore: rows.length > input.pageSize,
    page: input.page,
  };
}

export async function setCustomerRequestStatus(
  ownerPin: string,
  id: string,
  status: CustomerRequestStatus
): Promise<{ success: true }> {
  verifyCustomerInboxOwnerPin(ownerPin);
  const db = await dbOrThrow();
  await db
    .update(customerRequests)
    .set({ status, updatedAt: Date.now() })
    .where(eq(customerRequests.id, id));
  return { success: true };
}

export async function removeCustomerRequest(
  ownerPin: string,
  id: string,
  confirm: true
): Promise<{ success: true }> {
  verifyCustomerInboxOwnerPin(ownerPin);
  if (confirm !== true)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "يتطلب الحذف تأكيدًا صريحًا.",
    });
  const db = await dbOrThrow();
  await db.delete(customerRequests).where(eq(customerRequests.id, id));
  return { success: true };
}

const legacyItem = z.object({
  id: z.string().min(1).max(255),
  name: z.string().trim().min(1).max(150),
  phone: z.string().max(20),
  request: z.string().max(10000),
  source: z.string().max(150),
  status: z.enum(STATUS_VALUES),
  createdAt: z.string().min(1),
});

export async function importLegacyCustomerRequests(
  ownerPin: string,
  items: Array<z.infer<typeof legacyItem>>
): Promise<{ success: true; imported: number }> {
  verifyCustomerInboxOwnerPin(ownerPin);
  const db = await dbOrThrow();
  let imported = 0;
  for (const item of items) {
    const id = stableLegacyId(item.id);
    const createdAt = timestamp(item.createdAt);
    const existing = await db
      .select({ id: customerRequests.id })
      .from(customerRequests)
      .where(eq(customerRequests.id, id))
      .limit(1);
    if (existing[0]) continue;
    try {
      await db.insert(customerRequests).values({
        id,
        name: item.name,
        phone: item.phone,
        request: item.request,
        source: item.source,
        status: item.status,
        createdAt,
        updatedAt: createdAt,
      });
      imported += 1;
    } catch (error: any) {
      const duplicate = isDuplicateEntry(error);
      if (!duplicate) throw error;
    }
  }
  return { success: true, imported };
}

export const customerInboxRouter = router({
  send: publicProcedure
    .input(sendInput)
    .mutation(({ input }) => sendCustomerRequest(input)),
  list: publicProcedure
    .input(listInput)
    .mutation(({ input }) => listCustomerRequests(input)),
  setStatus: publicProcedure
    .input(
      z.object({
        ownerPin: privatePin,
        id: z.string().min(1).max(128),
        status: z.enum(STATUS_VALUES),
      })
    )
    .mutation(({ input }) =>
      setCustomerRequestStatus(input.ownerPin, input.id, input.status)
    ),
  remove: publicProcedure
    .input(
      z.object({
        ownerPin: privatePin,
        id: z.string().min(1).max(128),
        confirm: z.literal(true),
      })
    )
    .mutation(({ input }) =>
      removeCustomerRequest(input.ownerPin, input.id, input.confirm)
    ),
  importLegacy: publicProcedure
    .input(
      z.object({ ownerPin: privatePin, items: z.array(legacyItem).max(100) })
    )
    .mutation(({ input }) =>
      importLegacyCustomerRequests(input.ownerPin, input.items)
    ),
});
