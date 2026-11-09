import { asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertCreativeCategory,
  InsertCreativeSubmission,
  InsertFreeSite,
  InsertTemplateCategory,
  InsertUser,
  creativeSubmissions,
  templateSettings,
  User,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
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
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
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

/**
 * managementWorkspace imports getDb from this module. Keep this import dynamic so
 * the compatibility helpers below do not create a module-initialization cycle.
 */
async function workspace() {
  return import("./managementWorkspace");
}

type WorkspaceKind = "templates" | "freeSites" | "submissions" | "templateCategories" | "creativeCategories";

function dateValue(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = new Date(String(value || 0)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function newestFirst<T extends { createdAt?: unknown; sortOrder?: unknown }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt) || Number(b.sortOrder || 0) - Number(a.sortOrder || 0));
}

function parseImageUrls<T extends { imageUrls?: unknown }>(row: T): T & { imageUrls: string[] } {
  if (Array.isArray(row.imageUrls)) return row as T & { imageUrls: string[] };
  if (typeof row.imageUrls === "string") {
    try {
      return { ...row, imageUrls: JSON.parse(row.imageUrls) as string[] };
    } catch {
      return { ...row, imageUrls: [] };
    }
  }
  return { ...row, imageUrls: [] };
}

async function publishedCollection(kind: WorkspaceKind) {
  const { listPublishedCollection } = await workspace();
  return listPublishedCollection(kind);
}

async function workingCollection(kind: WorkspaceKind) {
  const { listWorkingCollection } = await workspace();
  return listWorkingCollection(kind);
}

async function createWorking(kind: WorkspaceKind, value: Record<string, unknown>) {
  const { createWorkingEntity } = await workspace();
  return createWorkingEntity(kind, value);
}

async function updateWorking(kind: WorkspaceKind, id: number, patch: Record<string, unknown>) {
  const { updateWorkingEntity } = await workspace();
  return updateWorkingEntity(kind, id, patch);
}

async function removeWorking(kind: WorkspaceKind, id: number) {
  const { removeWorkingEntity } = await workspace();
  return removeWorkingEntity(kind, id);
}

/** Public template list: published rows only, with hidden categories excluded from the all-tab. */
export async function listSharedTemplates(tool: string, category?: string) {
  const [templates, categories] = await Promise.all([
    publishedCollection("templates"),
    publishedCollection("templateCategories"),
  ]);
  const toolTemplates = templates.filter((row: any) => row.tool === tool);
  if (category) {
    const categoryRow=categories.find((row:any)=>row.tool===tool&&row.slug===category);
    if(categoryRow&&categoryRow.isVisible!==1)return [];
    return newestFirst(toolTemplates.filter((row: any) => row.category === category));
  }

  const toolCategories = categories.filter((row: any) => row.tool === tool);
  const knownSlugs = new Set(toolCategories.map((row: any) => String(row.slug)));
  const visibleSlugs = new Set(toolCategories.filter((row: any) => row.isVisible === 1).map((row: any) => String(row.slug)));
  return newestFirst(toolTemplates.filter((row: any) => {
    const slug = String(row.category || "").trim();
    // Keep legacy uncategorized/unknown rows visible as they were before categories existed.
    return !slug || !knownSlugs.has(slug) || visibleSlugs.has(slug);
  }));
}

const defaultTemplateCategories: Record<string, Array<Omit<InsertTemplateCategory, "tool">>> = {
  Gemini: [
    { name: "الأعراس والمناسبات", slug: "gemini-weddings", sortOrder: 1, isVisible: 1 },
    { name: "الأعياد", slug: "gemini-eids", sortOrder: 2, isVisible: 1 },
    { name: "البدل الرسمية", slug: "gemini-formal", sortOrder: 3, isVisible: 1 },
    { name: "إبداعية", slug: "gemini-creative", sortOrder: 4, isVisible: 1 },
    { name: "التعليم", slug: "gemini-education", sortOrder: 5, isVisible: 1 },
    { name: "نسائية", slug: "gemini-women", sortOrder: 6, isVisible: 1 },
    { name: "فنية وإعلانية", slug: "gemini-art-ads", sortOrder: 7, isVisible: 1 },
    { name: "أخرى", slug: "gemini-other", sortOrder: 8, isVisible: 1 },
  ],
  "Chat GBT": [
    { name: "عيد الميلاد", slug: "chat-birthday", sortOrder: 1, isVisible: 1 },
    { name: "الألعاب", slug: "chat-games", sortOrder: 2, isVisible: 1 },
    { name: "رسمية", slug: "chat-formal", sortOrder: 3, isVisible: 1 },
    { name: "إبداعية", slug: "chat-creative", sortOrder: 4, isVisible: 1 },
    { name: "أخرى", slug: "chat-other", sortOrder: 5, isVisible: 1 },
  ],
};

export async function listTemplateCategories(tool: string, includeHidden = false) {
  const rows = (await publishedCollection("templateCategories")).filter((row: any) => row.tool === tool);
  const source = rows.length ? rows : (defaultTemplateCategories[tool] || []).map((item, index) => ({ ...item, tool, id: index + 1, createdAt: new Date(), updatedAt: new Date() }));
  return includeHidden ? source : source.filter((row: any) => row.isVisible === 1);
}

export async function createTemplateCategory(input: InsertTemplateCategory) {
  return createWorking("templateCategories", input as unknown as Record<string, unknown>);
}

export async function updateTemplateCategory(id: number, input: Partial<InsertTemplateCategory>) {
  return updateWorking("templateCategories", id, input as Record<string, unknown>);
}

export async function deleteTemplateCategory(id: number) {
  return removeWorking("templateCategories", id);
}

/** Central workspace trash projection retained under the old template API name. */
export async function listDeletedSharedTemplates() {
  const { listTrash } = await workspace();
  const entries = await listTrash();
  return entries
    .filter((entry) => entry.source === "shared_templates" || entry.source === "collections.templates")
    .map((entry) => ({ ...(entry.value as Record<string, unknown>), deletedAt: new Date(entry.deletedAt), trashId: entry.id }));
}

function templateTrashId(entries: Array<{ id: string; source: string; value: unknown }>, templateId: number) {
  return entries.find((entry) => (entry.source === "shared_templates" || entry.source === "collections.templates") && Number((entry.value as any)?.id) === templateId)?.id;
}

export async function restoreSharedTemplate(id: number) {
  const { listTrash, restoreTrash } = await workspace();
  const trashId = templateTrashId(await listTrash(), id);
  if (!trashId) return { success: true } as const;
  return restoreTrash(trashId);
}

export async function purgeSharedTemplate(id: number, confirm = true) {
  const { listTrash, purgeTrash } = await workspace();
  const trashId = templateTrashId(await listTrash(), id);
  if (!trashId) return { success: true } as const;
  return purgeTrash(trashId, confirm);
}

/** Automatic expiration is intentionally disabled; deletion is manual central-trash purging only. */
export async function cleanupDeletedSharedTemplates(_retentionDays = 30) {
  return { success: true as const, deleted: 0 };
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

/** Backward-compatible alias; it now moves only the working snapshot row to central trash. */
export const deleteSharedTemplate = async (id: number) => removeWorking("templates", id);

export async function listVisibleFreeSites() {
  return newestFirst((await publishedCollection("freeSites")).filter((row: any) => row.isVisible === 1));
}

export async function listAllFreeSites() {
  return newestFirst(await workingCollection("freeSites"));
}

export async function createFreeSite(input: InsertFreeSite) {
  return createWorking("freeSites", input as unknown as Record<string, unknown>);
}

export async function updateFreeSite(id: number, input: Partial<InsertFreeSite>) {
  return updateWorking("freeSites", id, input as Record<string, unknown>);
}

export async function deleteFreeSite(id: number) {
  return removeWorking("freeSites", id);
}

export async function listApprovedCreativeSubmissions() {
  return (await publishedCollection("submissions"))
    .filter((row: any) => row.status === "approved" && row.isVisible === 1 && row.reviewState === "saved")
    .map(parseImageUrls);
}

export async function listAllCreativeSubmissions() {
  return (await workingCollection("submissions")).map(parseImageUrls);
}

/** Guest submissions intentionally remain original pending inserts; workspace reads merge them privately. */
export async function createCreativeSubmission(input: InsertCreativeSubmission) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(creativeSubmissions).values(input);
  const rows = await db.select().from(creativeSubmissions).where(eq(creativeSubmissions.id, Number(result[0].insertId))).limit(1);
  return rows[0] ? parseImageUrls(rows[0]) : rows[0];
}

export async function updateCreativeSubmission(id: number, input: Partial<InsertCreativeSubmission>) {
  return updateWorking("submissions", id, input as Record<string, unknown>);
}

export async function deleteCreativeSubmission(id: number) {
  return removeWorking("submissions", id);
}

/** Legacy admin read now means the private working content; public reads use getPublishedSnapshot directly. */
export async function getSiteContent() {
  const { getWorkingSnapshot } = await workspace();
  return JSON.stringify((await getWorkingSnapshot()).content);
}

export async function saveSiteContent(contentJson: string) {
  const { savePrivateSiteContent } = await workspace();
  const content = JSON.parse(contentJson) as Record<string, unknown>;
  return savePrivateSiteContent(content);
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
  const rows = await workingCollection("creativeCategories");
  const source = rows.length ? rows : defaultCreativeCategories.map((item, index) => ({ ...item, id: index + 1, createdAt: new Date() }));
  return includeHidden ? source : source.filter((row: any) => row.isVisible === 1);
}

export async function createCreativeCategory(input: InsertCreativeCategory) {
  return createWorking("creativeCategories", input as unknown as Record<string, unknown>);
}

export async function updateCreativeCategory(id: number, input: Partial<InsertCreativeCategory>) {
  return updateWorking("creativeCategories", id, input as Record<string, unknown>);
}

export async function deleteCreativeCategory(id: number) {
  return removeWorking("creativeCategories", id);
}

export type OwnerSearchResult = { kind: "template" | "free-site" | "submission" | "category"; id: number; title: string; subtitle: string; section: "templates" | "free-sites" | "creative" | "categories"; url?: string };

/** Owner search is deliberately sourced from the private working snapshot, including hidden rows. */
export async function searchOwnerContent(term: string, page = 1, pageSize = 20) {
  const clean = term.trim().slice(0, 120);
  if (clean.length < 2) return { items: [] as OwnerSearchResult[], hasMore: false };
  const { getWorkingSnapshot } = await workspace();
  const snapshot = await getWorkingSnapshot();
  const pattern = clean.toLocaleLowerCase();
  const matches = (value: unknown) => String(value ?? "").toLocaleLowerCase().includes(pattern);
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(5, Math.min(50, Math.floor(pageSize)));
  const offset = (safePage - 1) * safeSize;
  const templateRows = newestFirst(snapshot.collections.templates.filter((row: any) => matches(row.text) || matches(row.imageName) || matches(row.tool)));
  const siteRows = newestFirst(snapshot.collections.freeSites.filter((row: any) => matches(row.name) || matches(row.url) || matches(row.description) || matches(row.additionalText)));
  const submissionRows = newestFirst(snapshot.collections.submissions.filter((row: any) => matches(row.projectName) || matches(row.description) || matches(row.category) || matches(row.link) || matches(row.contact)));
  const categoryRows = [...snapshot.collections.creativeCategories, ...snapshot.collections.templateCategories].filter((row: any) => matches(row.name) || matches(row.slug)).sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const items: OwnerSearchResult[] = [
    ...templateRows.slice(offset, offset + safeSize).map((row: any) => ({ kind: "template" as const, id: row.id, title: row.imageName, subtitle: `${row.tool} · ${String(row.text || "").slice(0, 100)}`, section: "templates" as const, url: `/templates/${row.tool === "Gemini" ? "gemini" : "chat-gbt"}?template=${row.id}` })),
    ...siteRows.slice(offset, offset + safeSize).map((row: any) => ({ kind: "free-site" as const, id: row.id, title: row.name, subtitle: row.description || row.url || "موقع مجاني", section: "free-sites" as const })),
    ...submissionRows.slice(offset, offset + safeSize).map((row: any) => ({ kind: "submission" as const, id: row.id, title: row.projectName || "مشاركة إبداعية", subtitle: row.description || row.category, section: "creative" as const })),
    ...categoryRows.slice(offset, offset + safeSize).map((row: any) => ({ kind: "category" as const, id: row.id, title: row.name, subtitle: row.slug, section: "categories" as const })),
  ];
  return { items, hasMore: templateRows.length > offset + safeSize || siteRows.length > offset + safeSize || submissionRows.length > offset + safeSize || categoryRows.length > offset + safeSize };
}
