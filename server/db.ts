import { and, asc, desc, eq, isNotNull, isNull, lt, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { CreativeCategory, CreativeSubmission, FreeSite, InsertCreativeCategory, InsertCreativeSubmission, InsertFreeSite, InsertSharedTemplate, InsertUser, creativeCategories, creativeSubmissions, freeSites, sharedTemplates, siteSettings, templateSettings, User, users } from "../drizzle/schema";
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

export async function listVisibleFreeSites() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(freeSites).where(eq(freeSites.isVisible, 1)).orderBy(desc(freeSites.createdAt), desc(freeSites.sortOrder));
}

export async function listAllFreeSites() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(freeSites).orderBy(desc(freeSites.createdAt), desc(freeSites.sortOrder));
}

export async function createFreeSite(input: InsertFreeSite) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(freeSites).values(input);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(freeSites).where(eq(freeSites.id, id)).limit(1);
  return rows[0];
}

export async function updateFreeSite(id: number, input: Partial<InsertFreeSite>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(freeSites).set(input).where(eq(freeSites.id, id));
  const rows = await db.select().from(freeSites).where(eq(freeSites.id, id)).limit(1);
  return rows[0];
}

export async function deleteFreeSite(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(freeSites).where(eq(freeSites.id, id));
  return { success: true } as const;
}


export async function listApprovedCreativeSubmissions() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(creativeSubmissions).where(and(eq(creativeSubmissions.status, "approved"), eq(creativeSubmissions.isVisible, 1))).orderBy(desc(creativeSubmissions.createdAt));
  return rows.map((row) => ({ ...row, imageUrls: row.imageUrls ? JSON.parse(row.imageUrls) as string[] : [] }));
}

export async function listAllCreativeSubmissions() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(creativeSubmissions).orderBy(desc(creativeSubmissions.createdAt));
  return rows.map((row) => ({ ...row, imageUrls: row.imageUrls ? JSON.parse(row.imageUrls) as string[] : [] }));
}

export async function createCreativeSubmission(input: InsertCreativeSubmission) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(creativeSubmissions).values(input);
  const rows = await db.select().from(creativeSubmissions).where(eq(creativeSubmissions.id, Number(result[0].insertId))).limit(1);
  const row = rows[0];
  return row ? { ...row, imageUrls: row.imageUrls ? JSON.parse(row.imageUrls) as string[] : [] } : row;
}

export async function updateCreativeSubmission(id: number, input: Partial<InsertCreativeSubmission>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(creativeSubmissions).set(input).where(eq(creativeSubmissions.id, id));
  const rows = await db.select().from(creativeSubmissions).where(eq(creativeSubmissions.id, id)).limit(1);
  const row = rows[0];
  return row ? { ...row, imageUrls: row.imageUrls ? JSON.parse(row.imageUrls) as string[] : [] } : row;
}

export async function deleteCreativeSubmission(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(creativeSubmissions).where(eq(creativeSubmissions.id, id));
  return { success: true } as const;
}


export async function getSiteContent() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return rows[0]?.contentJson || null;
}

export async function saveSiteContent(contentJson: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(siteSettings).values({ id: 1, contentJson }).onDuplicateKeyUpdate({ set: { contentJson } });
  return { success: true } as const;
}

const defaultCreativeCategories: Array<InsertCreativeCategory> = [
  { name: "الجرافيك والتصميم", slug: "graphic-design", sortOrder: 1, isVisible: 1 },
  { name: "البرمجة والمواقع", slug: "programming-web", sortOrder: 2, isVisible: 1 },
  { name: "المونتاج والفيديو", slug: "video-editing", sortOrder: 3, isVisible: 1 },
  { name: "التصوير", slug: "photography", sortOrder: 4, isVisible: 1 },
  { name: "الأعمال التجارية", slug: "business", sortOrder: 5, isVisible: 1 },
  { name: "المشاريع الناشئة", slug: "startups", sortOrder: 6, isVisible: 1 },
  { name: "الحرف اليدوية", slug: "handmade", sortOrder: 7, isVisible: 1 },
  { name: "التعليم والخدمات", slug: "education-services", sortOrder: 8, isVisible: 1 },
  { name: "أخرى", slug: "other", sortOrder: 99, isVisible: 1 },
];

export async function listCreativeCategories(includeHidden = false) {
  const db = await getDb();
  if (!db) return defaultCreativeCategories.map((item, index) => ({ ...item, id: index + 1, createdAt: new Date() }));
  let rows = await db.select().from(creativeCategories).orderBy(asc(creativeCategories.sortOrder), asc(creativeCategories.createdAt));
  if (!rows.length) {
    await db.insert(creativeCategories).values(defaultCreativeCategories);
    rows = await db.select().from(creativeCategories).orderBy(asc(creativeCategories.sortOrder), asc(creativeCategories.createdAt));
  }
  return includeHidden ? rows : rows.filter((row) => row.isVisible === 1);
}

export async function createCreativeCategory(input: InsertCreativeCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(creativeCategories).values(input);
  const rows = await db.select().from(creativeCategories).where(eq(creativeCategories.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}

export async function updateCreativeCategory(id: number, input: Partial<InsertCreativeCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(creativeCategories).set(input).where(eq(creativeCategories.id, id));
  const rows = await db.select().from(creativeCategories).where(eq(creativeCategories.id, id)).limit(1);
  return rows[0];
}

export async function deleteCreativeCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(creativeCategories).where(eq(creativeCategories.id, id));
  return { success: true } as const;
}


export type OwnerSearchResult = { kind: "template" | "free-site" | "submission" | "category"; id: number; title: string; subtitle: string; section: "templates" | "free-sites" | "creative" | "categories"; url?: string };
export async function searchOwnerContent(term: string, page = 1, pageSize = 20) {
  const db = await getDb();
  if (!db) return { items: [] as OwnerSearchResult[], hasMore: false };
  const clean = term.trim().slice(0, 120);
  if (clean.length < 2) return { items: [] as OwnerSearchResult[], hasMore: false };
  const pattern = `%${clean}%`; const safePage = Math.max(1, Math.floor(page)); const safeSize = Math.max(5, Math.min(50, Math.floor(pageSize))); const offset = (safePage - 1) * safeSize;
  const [templateRows, siteRows, submissionRows, categoryRows] = await Promise.all([
    db.select().from(sharedTemplates).where(and(isNull(sharedTemplates.deletedAt), or(like(sharedTemplates.text, pattern), like(sharedTemplates.imageName, pattern), like(sharedTemplates.tool, pattern)))).orderBy(desc(sharedTemplates.createdAt)).limit(safeSize + 1).offset(offset),
    db.select().from(freeSites).where(or(like(freeSites.name, pattern), like(freeSites.url, pattern), like(freeSites.description, pattern), like(freeSites.additionalText, pattern))).orderBy(desc(freeSites.createdAt)).limit(safeSize + 1).offset(offset),
    db.select().from(creativeSubmissions).where(or(like(creativeSubmissions.projectName, pattern), like(creativeSubmissions.description, pattern), like(creativeSubmissions.category, pattern), like(creativeSubmissions.link, pattern), like(creativeSubmissions.contact, pattern))).orderBy(desc(creativeSubmissions.createdAt)).limit(safeSize + 1).offset(offset),
    db.select().from(creativeCategories).where(or(like(creativeCategories.name, pattern), like(creativeCategories.slug, pattern))).orderBy(asc(creativeCategories.sortOrder)).limit(safeSize + 1).offset(offset),
  ]);
  const items: OwnerSearchResult[] = [
    ...templateRows.slice(0, safeSize).map((row) => ({ kind: "template" as const, id: row.id, title: row.imageName, subtitle: `${row.tool} · ${row.text.slice(0, 100)}`, section: "templates" as const, url: `/templates/${row.tool === "Gemini" ? "gemini" : "chat-gbt"}?template=${row.id}` })),
    ...siteRows.slice(0, safeSize).map((row) => ({ kind: "free-site" as const, id: row.id, title: row.name, subtitle: row.description || row.url || "موقع مجاني", section: "free-sites" as const })),
    ...submissionRows.slice(0, safeSize).map((row) => ({ kind: "submission" as const, id: row.id, title: row.projectName || "مشاركة إبداعية", subtitle: row.description || row.category, section: "creative" as const })),
    ...categoryRows.slice(0, safeSize).map((row) => ({ kind: "category" as const, id: row.id, title: row.name, subtitle: row.slug, section: "categories" as const })),
  ];
  return { items, hasMore: templateRows.length > safeSize || siteRows.length > safeSize || submissionRows.length > safeSize || categoryRows.length > safeSize };
}
