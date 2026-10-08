import { and, desc, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertSharedTemplate, InsertUser, sharedTemplates, templateSettings, User, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listSharedTemplates(tool: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sharedTemplates).where(and(eq(sharedTemplates.tool, tool), isNull(sharedTemplates.deletedAt))).orderBy(desc(sharedTemplates.createdAt));
}

export async function listDeletedSharedTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sharedTemplates).where(isNotNull(sharedTemplates.deletedAt)).orderBy(desc(sharedTemplates.deletedAt));
}

export async function createSharedTemplate(input: InsertSharedTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(sharedTemplates).values(input);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(sharedTemplates).where(eq(sharedTemplates.id, id)).limit(1);
  return rows[0];
}

export async function updateSharedTemplate(id: number, input: Partial<InsertSharedTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(sharedTemplates).set(input).where(and(eq(sharedTemplates.id, id), isNull(sharedTemplates.deletedAt)));
  const rows = await db.select().from(sharedTemplates).where(eq(sharedTemplates.id, id)).limit(1);
  return rows[0];
}

export async function softDeleteSharedTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(sharedTemplates).set({ deletedAt: new Date() }).where(eq(sharedTemplates.id, id));
  return { success: true } as const;
}

export async function restoreSharedTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(sharedTemplates).set({ deletedAt: null }).where(eq(sharedTemplates.id, id));
  return { success: true } as const;
}

export async function purgeSharedTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(sharedTemplates).where(eq(sharedTemplates.id, id));
  return { success: true } as const;
}

export async function cleanupDeletedSharedTemplates(retentionDays = 30) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const cutoff = new Date(Date.now() - Math.max(30, Math.min(365, retentionDays)) * 86400000);
  const result = await db.delete(sharedTemplates).where(lt(sharedTemplates.deletedAt, cutoff));
  return { success: true, deleted: Number(result[0].affectedRows || 0) } as const;
}

export async function getTemplateRetentionDays() {
  const db = await getDb();
  if (!db) return 30;
  const rows = await db.select().from(templateSettings).where(eq(templateSettings.id, 1)).limit(1);
  return rows[0]?.retentionDays ?? 30;
}

export async function setTemplateRetentionDays(retentionDays: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const bounded = Math.max(30, Math.min(365, Math.round(retentionDays)));
  await db.insert(templateSettings).values({ id: 1, retentionDays: bounded }).onDuplicateKeyUpdate({ set: { retentionDays: bounded } });
  return { retentionDays: bounded } as const;
}

/** Backward-compatible alias used by existing callers and tests. */
export const deleteSharedTemplate = softDeleteSharedTemplate;
