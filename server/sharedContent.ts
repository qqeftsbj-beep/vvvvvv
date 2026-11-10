import { and, asc, count, desc, eq, gt, isNull, like, or, sql } from "drizzle-orm";
import type { PageMedia } from "@shared/pageMedia";
import {
  creativeCategories, creativeSubmissions, freeSites, managementTrash, managementWorkspaces, sharedContentItems,
  sharedContentState, sharedTemplates, templateCategories,
} from "../drizzle/schema";
import { getDb } from "./db";

export type SharedKind = "templates" | "freeSites" | "submissions" | "templateCategories" | "creativeCategories";
export type SharedPageInput = { page?: number; pageSize?: number; category?: string; tool?: string; search?: string; reviewState?: string; sort?: "newest" | "oldest" | "order" };
const KINDS: SharedKind[] = ["templates", "freeSites", "submissions", "templateCategories", "creativeCategories"];
const SHARED_STATE_ID = 1;
const DEFAULT_IDS: Record<SharedKind, number> = { templates: 1, freeSites: 1, submissions: 1, templateCategories: 1, creativeCategories: 1 };

function parseJson(value: unknown): any {
  if (typeof value !== "string") return value ?? {};
  try { return JSON.parse(value); } catch { return {}; }
}
function revive(value: any): any {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(revive);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) out[key] = ["createdAt", "updatedAt", "deletedAt"].includes(key) && typeof child === "string" ? new Date(child) : revive(child);
  if (typeof out.imageUrls === "string") out.imageUrls = parseJson(out.imageUrls);
  return out;
}
function idOf(item: any): string { return String(item?.id ?? ""); }
function searchValue(kind: SharedKind, item: any): string {
  const values = kind === "templates" ? [item.text, item.imageName, item.tool, item.category]
    : kind === "freeSites" ? [item.name, item.url, item.description, item.additionalText]
      : kind === "submissions" ? [item.projectName, item.description, item.category, item.link]
        : [item.name, item.slug, item.tool];
  return values.filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 512);
}
function effectiveStatus(kind: SharedKind, item: any): string {
  if (item.deletedAt) return "deleted";
  if (kind === "submissions") return String(item.status || "pending");
  return String(item.status || "published");
}
function effectiveVisibility(kind: SharedKind, item: any): number {
  if (item.deletedAt) return 0;
  if (kind === "submissions") return Number(item.isVisible) === 1 ? 1 : 0;
  if (kind === "templates") return item.isVisible === undefined ? 1 : Number(item.isVisible) === 1 ? 1 : 0;
  if (kind.endsWith("Categories")) return Number(item.isVisible) === 0 ? 0 : 1;
  return Number(item.isVisible) === 0 ? 0 : 1;
}
function safePublic(kind: SharedKind, item: any): boolean {
  if (Number(item.isVisible ?? 1) !== 1 && !(["templates", "templateCategories", "creativeCategories"].includes(kind) && item.isVisible === undefined)) return false;
  if (item.deletedAt) return false;
  if (kind === "submissions") return item.status === "approved" && item.reviewState === "saved";
  return item.status !== "private" && item.status !== "pending" && item.status !== "deleted";
}
function safeDate(value: unknown, fallback: Date): Date {
  const candidate = value instanceof Date ? value : typeof value === "string" || typeof value === "number" ? new Date(value) : fallback;
  return Number.isFinite(candidate.getTime()) ? candidate : fallback;
}
function dbRow(kind: SharedKind, item: any) {
  const createdAt = safeDate(item.createdAt, new Date());
  const updatedAt = safeDate(item.updatedAt, createdAt);
  const deletedAt = item.deletedAt ? safeDate(item.deletedAt, updatedAt) : null;
  return {
    kind, entityId: idOf(item), tool: item.tool == null ? null : String(item.tool), category: kind.endsWith("Categories") ? String(item.slug || "") : item.category == null ? null : String(item.category),
    status: effectiveStatus(kind, item), reviewState: item.reviewState ?? null, visibility: effectiveVisibility(kind, item),
    sortOrder: Number(item.sortOrder || 0), createdAt, updatedAt, deletedAt, searchText: searchValue(kind, item) || "", payloadJson: JSON.stringify(item),
  };
}
function apiItem(row: any): any {
  const item = revive(parseJson(row.payloadJson));
  // Indexed columns are authoritative for direct filtering and must stay reflected in results.
  item.id = /^\d+$/.test(String(row.entityId)) ? Number(row.entityId) : row.entityId;
  if (!item.previewUrl && typeof item.imageUrl === "string" && item.mediaType !== "video" && /^\/manus-storage\/.+\.(?:jpe?g|png|webp)$/i.test(item.imageUrl)) {
    item.previewUrl = `/api/media-preview/storage?key=${encodeURIComponent(item.imageUrl.slice("/manus-storage/".length))}&width=720`;
  }
  item.status = row.status;
  item.reviewState = row.reviewState ?? item.reviewState;
  item.sortOrder = Number(row.sortOrder ?? 0);
  item.createdAt = row.createdAt;
  item.updatedAt = row.updatedAt;
  if (["templates", "freeSites", "templateCategories", "creativeCategories"].includes(row.kind)) item.isVisible = Number(row.visibility);
  if (row.kind === "submissions") {
    item.isVisible = Number(row.visibility);
    if (typeof item.imageUrls === "string") item.imageUrls = parseJson(item.imageUrls);
  }
  return item;
}
async function dbOrThrow(): Promise<any> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}
async function ensureState(tx: any) {
  const readLocked = async () => {
    let query: any = tx.select().from(sharedContentState).where(eq(sharedContentState.id, SHARED_STATE_ID)).limit(1);
    if (typeof query.for === "function") query = query.for("update");
    return (await query)[0];
  };
  const existing = await readLocked();
  if (existing) return existing;
  await tx.insert(sharedContentState).values({ id: SHARED_STATE_ID, revision: 1, seeded: 0, nextIdsJson: JSON.stringify(DEFAULT_IDS) }).onDuplicateKeyUpdate({ set: { id: SHARED_STATE_ID } });
  const created = await readLocked();
  if (!created) throw new Error("Shared-content state initialization failed.");
  return created;
}
function mapById(rows: any[]) { return new Map(rows.map(item => [idOf(item), item])); }
async function readOriginalRows(tx: any): Promise<Record<SharedKind, any[]>> {
  const [templates, sites, posts, tcats, ccats] = await Promise.all([
    tx.select().from(sharedTemplates), tx.select().from(freeSites), tx.select().from(creativeSubmissions),
    tx.select().from(templateCategories), tx.select().from(creativeCategories),
  ]);
  return {
    templates: templates.map((r: any) => ({ ...r, id: Number(r.id), mediaType: r.mediaType || "image" })),
    freeSites: sites.map((r: any) => ({ ...r, id: Number(r.id) })),
    submissions: posts.map((r: any) => ({ ...r, id: Number(r.id), imageUrls: parseJson(r.imageUrls), reviewState: r.status === "approved" && Number(r.isVisible) === 1 && (!r.reviewState || r.reviewState === "inbox") ? "saved" : r.reviewState || (r.status === "rejected" ? "cancelled" : "inbox") })),
    templateCategories: tcats.map((r: any) => ({ ...r, id: Number(r.id) })),
    creativeCategories: ccats.map((r: any) => ({ ...r, id: Number(r.id) })),
  };
}
async function seedIfNeeded(tx: any): Promise<any> {
  let state = await ensureState(tx);
  if (Number(state.seeded) === 1) return state;
  const workspaceRows = await tx.select({ workingCollectionsJson: managementWorkspaces.workingCollectionsJson, publishedCollectionsJson: managementWorkspaces.publishedCollectionsJson }).from(managementWorkspaces).where(eq(managementWorkspaces.id, 1)).limit(1);
  const working = parseJson(workspaceRows[0]?.workingCollectionsJson);
  const published = parseJson(workspaceRows[0]?.publishedCollectionsJson);
  const originals = await readOriginalRows(tx);
  const values: any[] = [];
  const nextIds = { ...DEFAULT_IDS };
  for (const kind of KINDS) {
    const originalById = mapById(originals[kind]);
    const workById = mapById(Array.isArray(working[kind]) ? working[kind] : []);
    const publicById = mapById(Array.isArray(published[kind]) ? published[kind] : []);
    const allIds = Array.from(new Set(Array.from(originalById.keys()).concat(Array.from(workById.keys()), Array.from(publicById.keys()))));
    for (const id of allIds) {
      const legacy = originalById.get(id);
      const workingItem = workById.get(id);
      const publicItem = publicById.get(id);
      // Use only the previously published version as public. Old unpublished workspace-only
      // records remain intact but explicitly private until the owner saves them independently.
      let item: any = publicItem || workingItem || legacy;
      if (!item) continue;
      item = { ...item };
      item.createdAt = safeDate(item.createdAt, safeDate(legacy?.createdAt, new Date()));
      item.updatedAt = safeDate(item.updatedAt, safeDate(legacy?.updatedAt, item.createdAt));
      if (!publicItem) {
        const legacyIsPublished = !workspaceRows[0] && Boolean(legacy);
        if (legacyIsPublished) {
          item.status = kind === "submissions" ? (item.status || "pending") : "published";
          if (item.isVisible === undefined) item.isVisible = 1;
        } else {
          item.status = kind === "submissions" ? (item.status || "pending") : "private";
          item.isVisible = 0;
        }
      } else if (kind === "submissions") {
        item.status = publicItem.status || "approved";
        item.reviewState = item.status === "approved" && Number(publicItem.isVisible) === 1 && (!publicItem.reviewState || publicItem.reviewState === "inbox") ? "saved" : publicItem.reviewState || (item.status === "rejected" ? "cancelled" : "inbox");
        item.isVisible = Number(publicItem.isVisible) === 1 ? 1 : 0;
      } else {
        item.status = "published";
        if (item.isVisible === undefined) item.isVisible = 1;
      }
      // Legacy deleted templates stay deleted; they are never revived by migration.
      if (kind === "templates" && legacy?.deletedAt && !publicItem) item.deletedAt = legacy.deletedAt;
      values.push(dbRow(kind, item));
      if (/^\d+$/.test(id)) nextIds[kind] = Math.max(nextIds[kind], Number(id) + 1);
    }
  }
  for (let offset = 0; offset < values.length; offset += 100) {
    await tx.insert(sharedContentItems).ignore().values(values.slice(offset, offset + 100));
  }
  (nextIds as any).guestCursor = originals.submissions.reduce((max: number, item: any) => Math.max(max, Number(item.id) || 0), 0);
  nextIds.submissions = Math.max(nextIds.submissions, 1_000_000_000);
  const revision = Number(state.revision) + (values.length ? 1 : 0);
  await tx.update(sharedContentState).set({ seeded: 1, revision, nextIdsJson: JSON.stringify(nextIds) }).where(eq(sharedContentState.id, SHARED_STATE_ID));
  const confirmed = await tx.select().from(sharedContentState).where(eq(sharedContentState.id, SHARED_STATE_ID)).limit(1);
  if (!confirmed[0] || Number(confirmed[0].seeded) !== 1) throw new Error("Shared-content migration readback failed.");
  return confirmed[0];
}
async function transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const db: any = await dbOrThrow();
  return db.transaction(async (tx: any) => fn(tx));
}
async function ensureSeeded() {
  await transaction(async tx => {
    const state = await seedIfNeeded(tx);
    const nextIds = { ...DEFAULT_IDS, ...parseJson(state.nextIdsJson) } as any;
    // An indexed cursor imports only new arrivals from the compatible guest endpoint.
    // Existing approval/deletion rows are never overwritten or resurrected.
    const arrivals = await tx.select().from(creativeSubmissions).where(gt(creativeSubmissions.id, Number(nextIds.guestCursor || 0))).orderBy(asc(creativeSubmissions.id)).limit(200);
    if (!arrivals.length) return;
    for (const arrival of arrivals) {
      const existing = await tx.select({ id: sharedContentItems.entityId }).from(sharedContentItems).where(and(eq(sharedContentItems.kind, "submissions"), eq(sharedContentItems.entityId, String(arrival.id)))).limit(1);
      if (!existing[0]) {
        const item = { ...arrival, imageUrls: parseJson(arrival.imageUrls), status: "pending", reviewState: "inbox", isVisible: 0 };
        await tx.insert(sharedContentItems).values(dbRow("submissions", item));
      }
      nextIds.guestCursor = Math.max(Number(nextIds.guestCursor || 0), Number(arrival.id));
    }
    await tx.update(sharedContentState).set({ nextIdsJson: JSON.stringify(nextIds), revision: Number(state.revision) + 1 }).where(eq(sharedContentState.id, SHARED_STATE_ID));
  });
}
function adminRowFilter(kind: SharedKind) { return and(eq(sharedContentItems.kind, kind), isNull(sharedContentItems.deletedAt), sql`${sharedContentItems.status} <> 'deleted'`); }
function publicRowFilter(kind: SharedKind) {
  const common = [eq(sharedContentItems.kind, kind), eq(sharedContentItems.visibility, 1), isNull(sharedContentItems.deletedAt), sql`${sharedContentItems.status} NOT IN ('private','pending','deleted')`];
  if (kind === "submissions") common.push(eq(sharedContentItems.status, "approved"), eq(sharedContentItems.reviewState, "saved"));
  if (kind === "templates" || kind === "submissions") {
    const categoryKind = kind === "templates" ? "templateCategories" : "creativeCategories";
    const toolClause = kind === "templates" ? sql`AND hidden_category.tool = ${sharedContentItems.tool}` : sql``;
    common.push(sql`NOT EXISTS (SELECT 1 FROM shared_content_items AS hidden_category WHERE hidden_category.kind = ${categoryKind} AND hidden_category.category = ${sharedContentItems.category} ${toolClause} AND hidden_category.deletedAt IS NULL AND (hidden_category.visibility = 0 OR hidden_category.status = 'private'))`);
  }
  return and(...common);
}
export async function listSharedItems(kind: SharedKind, publicOnly = false): Promise<any[]> {
  await ensureSeeded();
  const db = await dbOrThrow();
  const rows = await db.select().from(sharedContentItems).where(publicOnly ? publicRowFilter(kind) : adminRowFilter(kind)).orderBy(asc(sharedContentItems.sortOrder), desc(sharedContentItems.createdAt));
  return rows.map(apiItem);
}
export async function pageSharedItems(kind: SharedKind, input: SharedPageInput = {}) {
  await ensureSeeded();
  const db = await dbOrThrow();
  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.max(1, Math.min(40, Math.floor(input.pageSize || 12)));
  const filters: any[] = [publicRowFilter(kind)];
  if (input.tool) filters.push(eq(sharedContentItems.tool, input.tool));
  if (input.category) filters.push(eq(sharedContentItems.category, input.category));
  if (input.search?.trim()) {
    const term = input.search.trim().slice(0, 100).replace(/[\\%_]/g, "\\$&");
    // Preserve substring and full prompt search on the server; only matched page rows leave the database.
    filters.push(sql`(JSON_UNQUOTE(JSON_EXTRACT(${sharedContentItems.payloadJson}, '$.text')) LIKE ${`%${term}%`} OR ${sharedContentItems.searchText} LIKE ${`%${term}%`})`);
  }
  const where = and(...filters);
  const order = input.sort === "oldest" ? [asc(sharedContentItems.createdAt), asc(sharedContentItems.entityId)]
    : input.sort === "order" ? [asc(sharedContentItems.sortOrder), desc(sharedContentItems.createdAt)]
      : [desc(sharedContentItems.createdAt), desc(sql`CAST(${sharedContentItems.entityId} AS UNSIGNED)`)];
  const [rows, totals] = await Promise.all([
    db.select().from(sharedContentItems).where(where).orderBy(...order).limit(pageSize + 1).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(sharedContentItems).where(where),
  ]);
  const hasMore = rows.length > pageSize;
  return { items: rows.slice(0, pageSize).map(apiItem), hasMore, total: Number(totals[0]?.total || 0), page };
}
export async function pageAdminSharedItems(kind: SharedKind, input: SharedPageInput & { status?: string } = {}) {
  await ensureSeeded();
  const db = await dbOrThrow();
  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.max(1, Math.min(40, Math.floor(input.pageSize || 12)));
  const filters: any[] = [adminRowFilter(kind)];
  if (input.tool) filters.push(eq(sharedContentItems.tool, input.tool));
  if (input.category) filters.push(eq(sharedContentItems.category, input.category));
  if (input.status) filters.push(eq(sharedContentItems.status, input.status));
  if (input.reviewState) filters.push(eq(sharedContentItems.reviewState, input.reviewState));
  if (input.search?.trim()) {
    const term = input.search.trim().slice(0, 100).replace(/[\\%_]/g, "\\$&");
    filters.push(sql`(JSON_UNQUOTE(JSON_EXTRACT(${sharedContentItems.payloadJson}, '$.text')) LIKE ${`%${term}%`} OR ${sharedContentItems.searchText} LIKE ${`%${term}%`})`);
  }
  const where = and(...filters);
  const [rows, totals] = await Promise.all([
    db.select().from(sharedContentItems).where(where).orderBy(desc(sharedContentItems.updatedAt), asc(sharedContentItems.sortOrder)).limit(pageSize + 1).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(sharedContentItems).where(where),
  ]);
  const pending = kind === "submissions" ? await db.select({ total: count() }).from(sharedContentItems).where(and(adminRowFilter(kind), eq(sharedContentItems.reviewState, "inbox"), eq(sharedContentItems.status, "pending"))) : [];
  return { items: rows.slice(0, pageSize).map(apiItem), hasMore: rows.length > pageSize, total: Number(totals[0]?.total || 0), pendingCount: Number(pending[0]?.total || 0), page };
}
export async function getSharedItem(kind: SharedKind, id: number | string, tool?: string) {
  await ensureSeeded();
  const db = await dbOrThrow();
  const filters: any[] = [publicRowFilter(kind), eq(sharedContentItems.entityId, String(id))];
  if (tool) filters.push(eq(sharedContentItems.tool, tool));
  const rows = await db.select().from(sharedContentItems).where(and(...filters)).limit(1);
  return rows[0] ? apiItem(rows[0]) : null;
}
function validateAttachments(kind: SharedKind, value: any) {
  if (value.attachments === undefined) return;
  if (!Array.isArray(value.attachments) || value.attachments.length > 12) throw new Error("Attachments must be an array of at most 12 media items.");
  const expectedPrefix = kind === "freeSites" ? "free-sites:" : kind === "submissions" ? "creative:" : null;
  for (const raw of value.attachments) {
    const media = raw as Partial<PageMedia>;
    if (!media || typeof media !== "object" || !/^[0-9a-f-]{36}$/i.test(String(media.id || ""))) throw new Error("Invalid attachment id.");
    if (typeof media.pageId !== "string" || media.pageId.length > 128 || (expectedPrefix && !media.pageId.startsWith(expectedPrefix))) throw new Error("Invalid attachment namespace.");
    if (![media.name, media.originalName, media.mimeType, media.url, media.downloadUrl, media.key].every(v => typeof v === "string" && v.length > 0)) throw new Error("Attachment metadata is incomplete.");
    if (!media.url!.startsWith(`/api/page-media/${media.id}`) || !media.downloadUrl!.startsWith(`/api/page-media/${media.id}/download`)) throw new Error("Attachment URLs must use the internal media endpoint.");
    if (!Number.isFinite(Number(media.size)) || Number(media.size) < 0 || Number(media.size) > 25 * 1024 * 1024) throw new Error("Invalid attachment size.");
  }
}
async function validateAttachmentReferences(tx: any, kind: SharedKind, item: any) {
  validateAttachments(kind, item);
  if (!Array.isArray(item.attachments) || item.attachments.length === 0) return;
  const ids = item.attachments.map((m: PageMedia) => m.id);
  const rows = await tx.select().from((await import("../drizzle/schema")).pageMediaFiles).where(sql`${(await import("../drizzle/schema")).pageMediaFiles.id} IN (${sql.join(ids.map((id: string) => sql`${id}`), sql`, `)})`);
  const byId = new Map(rows.map((row: any) => [row.id, row]));
  for (const media of item.attachments as PageMedia[]) {
    const stored: any = byId.get(media.id);
    if (!stored || stored.pageId !== media.pageId || stored.key !== media.key || stored.mimeType !== media.mimeType || Number(stored.size) !== Number(media.size)) throw new Error("Attachment does not match stored media metadata.");
  }
}
function publicDefaults(kind: SharedKind, value: any, creating: boolean) {
  const item = { ...value };
  delete item.id;
  delete item.ownerPin;
  delete item.ownerPassword;
  delete item.mediaData; delete item.imageData;
  if (kind === "submissions") {
    item.status = item.status || "pending";
    item.reviewState = item.reviewState || "inbox";
    item.isVisible = Number(item.isVisible) === 1 ? 1 : 0;
  } else {
    if (item.status !== "private" && item.status !== "pending") item.status = "published";
    if (item.isVisible === undefined) item.isVisible = creating ? 1 : 1;
    item.isVisible = item.isVisible === true ? 1 : item.isVisible === false ? 0 : Number(item.isVisible) === 1 ? 1 : 0;
  }
  return item;
}
export async function createSharedItem(kind: SharedKind, input: Record<string, unknown>) {
  return transaction(async tx => {
    const state = await seedIfNeeded(tx);
    const nextIds = { ...DEFAULT_IDS, ...parseJson(state.nextIdsJson) } as Record<SharedKind, number>;
    const item: any = publicDefaults(kind, input, true);
    item.id = input.id ?? nextIds[kind];
    item.createdAt = input.createdAt ?? new Date();
    item.updatedAt = new Date();
    validateAttachments(kind, item);
    await validateAttachmentReferences(tx, kind, item);
    const row = dbRow(kind, item);
    await tx.insert(sharedContentItems).values(row);
    nextIds[kind] = Math.max(Number(nextIds[kind] || 1), Number(item.id) + 1);
    await tx.update(sharedContentState).set({ revision: Number(state.revision) + 1, nextIdsJson: JSON.stringify(nextIds) }).where(eq(sharedContentState.id, SHARED_STATE_ID));
    const confirmed = await tx.select().from(sharedContentItems).where(and(eq(sharedContentItems.kind, kind), eq(sharedContentItems.entityId, row.entityId))).limit(1);
    if (!confirmed[0]) throw new Error("Shared-content save readback failed.");
    return apiItem(confirmed[0]);
  });
}
export async function updateSharedItem(kind: SharedKind, id: number | string, patch: Record<string, unknown>) {
  return transaction(async tx => {
    const state = await seedIfNeeded(tx);
    const rows = await tx.select().from(sharedContentItems).where(and(eq(sharedContentItems.kind, kind), eq(sharedContentItems.entityId, String(id)))).limit(1);
    if (!rows[0] || rows[0].deletedAt) throw new Error("Workspace item not found.");
    const current = apiItem(rows[0]);
    const safePatch = { ...patch } as any;
    delete safePatch.id; delete safePatch.ownerPin; delete safePatch.ownerPassword; delete safePatch.mediaData; delete safePatch.imageData;
    const next = { ...current, ...safePatch, id: current.id, updatedAt: new Date() };
    // Saving owner content publishes it immediately, except guest submissions whose
    // pending/waiting/cancelled state remains private until explicit approval.
    if (kind !== "submissions") next.status = "published";
    if (kind === "submissions") {
      next.isVisible = next.isVisible === true ? 1 : next.isVisible === false ? 0 : Number(next.isVisible) === 1 ? 1 : 0;
      if (patch.status === "approved" || patch.isVisible === true || patch.isVisible === 1) next.reviewState = patch.reviewState ?? "saved";
      if (patch.isVisible === false || patch.isVisible === 0) next.isVisible = 0;
    } else if (next.isVisible === true) next.isVisible = 1;
    else if (next.isVisible === false) next.isVisible = 0;
    validateAttachments(kind, next);
    await validateAttachmentReferences(tx, kind, next);
    if ((kind === "templateCategories" || kind === "creativeCategories") && typeof patch.slug === "string" && patch.slug !== current.slug) {
      const childKind = kind === "templateCategories" ? "templates" : "submissions";
      const childFilters: any[] = [eq(sharedContentItems.kind, childKind), eq(sharedContentItems.category, String(current.slug)), isNull(sharedContentItems.deletedAt)];
      if (kind === "templateCategories") childFilters.push(eq(sharedContentItems.tool, current.tool));
      const children = await tx.select().from(sharedContentItems).where(and(...childFilters));
      for (const child of children) {
        const changed = dbRow(childKind, { ...apiItem(child), category: patch.slug, updatedAt: new Date() });
        await tx.update(sharedContentItems).set(changed).where(and(eq(sharedContentItems.kind, childKind), eq(sharedContentItems.entityId, child.entityId)));
      }
    }
    const encoded = dbRow(kind, next);
    await tx.update(sharedContentItems).set({ ...encoded, entityId: String(id), kind }).where(and(eq(sharedContentItems.kind, kind), eq(sharedContentItems.entityId, String(id))));
    await tx.update(sharedContentState).set({ revision: Number(state.revision) + 1 }).where(eq(sharedContentState.id, SHARED_STATE_ID));
    const confirmed = await tx.select().from(sharedContentItems).where(and(eq(sharedContentItems.kind, kind), eq(sharedContentItems.entityId, String(id)))).limit(1);
    if (!confirmed[0] || confirmed[0].payloadJson !== encoded.payloadJson) throw new Error("Shared-content update readback failed.");
    return apiItem(confirmed[0]);
  });
}
export async function removeSharedItem(kind: SharedKind, id: number | string) {
  return transaction(async tx => {
    const state = await seedIfNeeded(tx);
    const rows = await tx.select().from(sharedContentItems).where(and(eq(sharedContentItems.kind, kind), eq(sharedContentItems.entityId, String(id)))).limit(1);
    if (!rows[0] || rows[0].deletedAt) return { success: true as const };
    const previous = apiItem(rows[0]);
    await tx.insert(managementTrash).values({ id: `shared:${kind}:${id}:${crypto.randomUUID()}`, kind: kind === "templates" ? "template" : kind === "submissions" ? "submission" : kind === "freeSites" ? "free-site" : "category", title: String(previous.projectName || previous.name || previous.imageName || previous.id).slice(0,255), source: `collections.${kind}`, valueJson: JSON.stringify(previous), workspaceRevision: Number(state.revision) + 1 });
    const item = { ...apiItem(rows[0]), deletedAt: new Date(), isVisible: 0, status: "deleted", updatedAt: new Date() };
    const encoded = dbRow(kind, item);
    await tx.update(sharedContentItems).set(encoded).where(and(eq(sharedContentItems.kind, kind), eq(sharedContentItems.entityId, String(id))));
    await tx.update(sharedContentState).set({ revision: Number(state.revision) + 1 }).where(eq(sharedContentState.id, SHARED_STATE_ID));
    return { success: true as const };
  });
}
export async function reorderSharedItems(kind: SharedKind, ids: number[], tool?: string) {
  return transaction(async tx => {
    const state = await seedIfNeeded(tx);
    if (new Set(ids).size !== ids.length) throw new Error("Duplicate ordering identifiers.");
    for (let index = 0; index < ids.length; index += 1) {
      const filters: any[] = [eq(sharedContentItems.kind, kind), eq(sharedContentItems.entityId, String(ids[index])), isNull(sharedContentItems.deletedAt)];
      if (tool) filters.push(eq(sharedContentItems.tool, tool));
      const rows = await tx.select().from(sharedContentItems).where(and(...filters)).limit(1);
      if (!rows[0]) throw new Error("Ordering contains an unavailable item or another design library.");
      const item = { ...apiItem(rows[0]), sortOrder: index + (kind.endsWith("Categories") ? 1 : 0), updatedAt: new Date() };
      const row = dbRow(kind, item);
      await tx.update(sharedContentItems).set(row).where(and(eq(sharedContentItems.kind, kind), eq(sharedContentItems.entityId, String(ids[index]))));
    }
    await tx.update(sharedContentState).set({ revision: Number(state.revision) + 1 }).where(eq(sharedContentState.id, SHARED_STATE_ID));
    const rows = await tx.select().from(sharedContentItems).where(adminRowFilter(kind)).orderBy(asc(sharedContentItems.sortOrder), desc(sharedContentItems.createdAt));
    return rows.map(apiItem).filter((item: any) => !tool || item.tool === tool);
  });
}
export async function getSharedContentRevision() {
  await ensureSeeded();
  const db = await dbOrThrow();
  const states = await db.select({ revision: sharedContentState.revision }).from(sharedContentState).where(eq(sharedContentState.id, SHARED_STATE_ID)).limit(1);
  const navigation = await db.select({ publishedRevision: managementWorkspaces.publishedRevision }).from(managementWorkspaces).where(eq(managementWorkspaces.id, 1)).limit(1);
  return { revision: Number(states[0]?.revision || 1), navigationRevision: Number(navigation[0]?.publishedRevision || 1) };
}
export async function getSharedNavigation() {
  const db = await dbOrThrow();
  // JSON_EXTRACT keeps navigation refreshes limited to just the label/route fields.
  const rows = await db.select({
    buttons: sql<any>`JSON_EXTRACT(${managementWorkspaces.publishedContentJson}, '$.buttons')`,
    pages: sql<any>`JSON_EXTRACT(${managementWorkspaces.publishedContentJson}, '$.pages')`,
  }).from(managementWorkspaces).where(eq(managementWorkspaces.id, 1)).limit(1);
  const buttons = parseJson(rows[0]?.buttons);
  const pages = parseJson(rows[0]?.pages);
  const cleanButtons = Array.isArray(buttons) ? buttons.map((item: any) => ({ id: item.id, label: item.label || item.title || item.name || "", action: item.action, url: item.url, visible: item.visible !== false && item.isVisible !== false, order: Number(item.order || 0), placement: item.placement ?? item.position ?? null })) : [];
  const cleanPages = Array.isArray(pages) ? pages.map((item: any) => ({ slug: item.slug, title: item.title || item.name || "", visible: item.visible !== false && item.status !== "draft", status: item.status })) : [];
  return { buttons: cleanButtons, pages: cleanPages };
}

/** Guest submissions are inserted in their original table for existing notifications/review flows. */
export async function syncGuestSubmission(record: any) {
  return transaction(async tx => {
    const state = await seedIfNeeded(tx);
    const item = { ...record, id: record.id, status: "pending", reviewState: record.reviewState || "inbox", isVisible: 0, createdAt: record.createdAt || new Date(), updatedAt: record.updatedAt || new Date() };
    const row = dbRow("submissions", item);
    await tx.insert(sharedContentItems).ignore().values(row);
    const nextIds = { ...DEFAULT_IDS, ...parseJson(state.nextIdsJson) } as Record<SharedKind, number>;
    nextIds.submissions = Math.max(nextIds.submissions, Number(item.id) + 1);
    (nextIds as any).guestCursor = Math.max(Number((nextIds as any).guestCursor || 0), Number(item.id));
    await tx.update(sharedContentState).set({ revision: Number(state.revision) + 1, nextIdsJson: JSON.stringify(nextIds) }).where(eq(sharedContentState.id, SHARED_STATE_ID));
    return item;
  });
}

/** Restore shared content independently; legacy backups never overwrite newer active items. */
export async function restoreSharedTrash(trashId: string) {
  return transaction(async tx => {
    const state = await seedIfNeeded(tx);
    const entries = await tx.select().from(managementTrash).where(eq(managementTrash.id, trashId)).limit(1);
    if (!entries[0]) throw new Error('Trash entry not found.');
    const entry = entries[0];
    const kind: SharedKind = entry.source === 'shared_templates' ? 'templates' : entry.source.slice('collections.'.length);
    if (!KINDS.includes(kind)) throw new Error('Not a shared content trash item.');
    const value = parseJson(entry.valueJson);
    if (!value || !value.id) throw new Error('Invalid shared trash item.');
    const existing = await tx.select().from(sharedContentItems).where(and(eq(sharedContentItems.kind, kind), eq(sharedContentItems.entityId, String(value.id)))).limit(1);
    if (!existing[0] || existing[0].deletedAt) {
      const restored = { ...value, deletedAt: null, updatedAt: new Date() };
      if (restored.status === 'deleted' || restored.status === 'private') restored.status = kind === 'submissions' ? 'pending' : 'published';
      await validateAttachmentReferences(tx, kind, restored);
      const encoded = dbRow(kind, restored);
      if (existing[0]) await tx.update(sharedContentItems).set(encoded).where(and(eq(sharedContentItems.kind, kind), eq(sharedContentItems.entityId, String(value.id))));
      else await tx.insert(sharedContentItems).values(encoded);
    }
    await tx.delete(managementTrash).where(eq(managementTrash.id, trashId));
    await tx.update(sharedContentState).set({ revision: Number(state.revision) + 1 }).where(eq(sharedContentState.id, SHARED_STATE_ID));
    return { success: true as const, revision: Number(state.revision) + 1 };
  });
}

export async function sharedSnapshotInTransaction(tx: any, publicOnly = false): Promise<Record<SharedKind, any[]>> {
  await seedIfNeeded(tx);
  const snapshot = {} as Record<SharedKind, any[]>;
  for (const kind of KINDS) {
    const rows = await tx.select().from(sharedContentItems).where(publicOnly ? publicRowFilter(kind) : adminRowFilter(kind)).orderBy(asc(sharedContentItems.sortOrder), desc(sharedContentItems.createdAt));
    snapshot[kind] = rows.map(apiItem);
  }
  return snapshot;
}
