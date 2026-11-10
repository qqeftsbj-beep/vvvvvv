import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  creativeCategories, creativeSubmissions, freeSites, managementBackups, managementTrash,
  managementWorkspaces, sharedTemplates, siteContentVersions, siteSettings, templateCategories,
} from "../drizzle/schema";
import { getDb } from "./db";
import { normalizeAndUploadSiteContent } from "./siteContentPersistence";

export type WorkspaceCollections = {
  templates: any[];
  freeSites: any[];
  submissions: any[];
  templateCategories: any[];
  creativeCategories: any[];
};
export type WorkspaceSnapshot = { content: Record<string, unknown>; collections: WorkspaceCollections };
export type WorkspaceState = WorkspaceSnapshot & {
  revision: number; publishedRevision: number; savedAt: number; hasChanges: boolean; trash: TrashEntry[];
};
export type TrashEntry = {
  id: string; kind: string; title: string; source: string; deletedAt: number; value: unknown;
  parentId?: string; index?: number;
};
export type HistoryEntry = { id: string; name: string; createdAt: number; size: number; type: string };

const WORKSPACE_ID = 1;
const MAX_JSON_BYTES = 16 * 1024 * 1024;
const COLLECTION_KEYS = ["templates", "freeSites", "submissions", "templateCategories", "creativeCategories"] as const;
const NESTED_KEYS = new Set(["pages", "blocks", "buttons", "services", "products", "items", "sections", "media", "draft", "appearance"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function parse(value: string | null | undefined): any { try { return value ? JSON.parse(value) : {}; } catch { return {}; } }
function json(value: unknown) {
  const result = JSON.stringify(value ?? {});
  if (Buffer.byteLength(result, "utf8") > MAX_JSON_BYTES) throw new Error("Workspace snapshot is too large.");
  return result;
}
function numberDate(value: unknown): number { return value instanceof Date ? value.getTime() : typeof value === "number" ? value : new Date(String(value || 0)).getTime(); }
function reviveDates(value: any): any {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(reviveDates);
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    next[key] = ["createdAt", "updatedAt", "deletedAt"].includes(key) && typeof item === "string" ? new Date(item) : reviveDates(item);
  }
  return next;
}
function apiRow(row: any): any {
  if (!row) return row;
  const next = reviveDates({ ...row });
  if (typeof next.imageUrls === "string") { try { next.imageUrls = JSON.parse(next.imageUrls); } catch { next.imageUrls = []; } }
  return next;
}
function emptyCollections(): WorkspaceCollections { return { templates: [], freeSites: [], submissions: [], templateCategories: [], creativeCategories: [] }; }
type WorkspaceMetadata = { seenGuestIds: string[]; nextIds: Record<string, number> };
function metadataFromRow(row: any): WorkspaceMetadata {
  const parsed = parse(row?.metadataJson);
  return { seenGuestIds: Array.isArray(parsed.seenGuestIds) ? parsed.seenGuestIds.map(String) : [], nextIds: record(parsed.nextIds) as Record<string, number> };
}
function initialMetadata(collections: WorkspaceCollections): WorkspaceMetadata {
  const nextIds: Record<string, number> = {};
  for (const key of COLLECTION_KEYS) nextIds[key] = collections[key].reduce((max: number, item: any) => Math.max(max, typeof item?.id === "number" ? item.id + 1 : max), 1);
  return { seenGuestIds: collections.submissions.map((item: any) => String(item.id)), nextIds };
}
function orderedCollections(collections: WorkspaceCollections): WorkspaceCollections {
  for (const kind of ["templateCategories", "creativeCategories"] as const) collections[kind] = [...collections[kind]].sort((a:any,b:any)=>Number(a.sortOrder || 0)-Number(b.sortOrder || 0) || Number(a.id)-Number(b.id));
  collections.submissions = collections.submissions.map((item:any) => item.status === "approved" && Number(item.isVisible)===1 && (!item.reviewState || item.reviewState==="inbox") ? {...item,reviewState:"saved"} : item);
  return collections;
}
function snapshotFromRow(row: any): WorkspaceSnapshot {
  return { content: record(parse(row.workingContentJson)), collections: orderedCollections({ ...emptyCollections(), ...record(parse(row.workingCollectionsJson)) }) };
}
function publishedFromRow(row: any): WorkspaceSnapshot {
  return { content: record(parse(row.publishedContentJson)), collections: orderedCollections({ ...emptyCollections(), ...record(parse(row.publishedCollectionsJson)) }) };
}
function titleOf(value: any, fallback: string) { return String(value?.title || value?.name || value?.label || value?.projectName || value?.slug || value?.id || fallback).slice(0, 255); }
function identity(value: any, index: number) { return String(value?.id ?? value?.slug ?? value?.key ?? value?.name ?? `${index}:${JSON.stringify(value)}`); }

async function selectOne(source: any, lock = false): Promise<any | undefined> {
  let query: any = source.select().from(managementWorkspaces).where(eq(managementWorkspaces.id, WORKSPACE_ID));
  if (lock && typeof query.for === "function") query = query.for("update");
  const rows = await query;
  return rows[0];
}
async function readLegacy(source: any): Promise<WorkspaceSnapshot & { deletedTemplates: any[] }> {
  const [settings, templates, sites, submissions, tcats, ccats] = await Promise.all([
    source.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1),
    source.select().from(sharedTemplates).where(isNull(sharedTemplates.deletedAt)).orderBy(desc(sharedTemplates.createdAt)),
    source.select().from(freeSites).orderBy(desc(freeSites.createdAt)),
    source.select().from(creativeSubmissions).orderBy(desc(creativeSubmissions.createdAt)),
    source.select().from(templateCategories).orderBy(asc(templateCategories.sortOrder), asc(templateCategories.createdAt)),
    source.select().from(creativeCategories).orderBy(asc(creativeCategories.sortOrder), asc(creativeCategories.createdAt)),
  ]);
  // A second query is intentionally separate: old installations may not have any deleted rows.
  const allTemplates = await source.select().from(sharedTemplates).orderBy(desc(sharedTemplates.createdAt));
  return {
    content: record(parse(settings[0]?.contentJson)),
    collections: {
      templates: templates.map(apiRow), freeSites: sites.map(apiRow), submissions: submissions.map((row: any) => apiRow({ ...row, reviewState: row.reviewState || (row.status === "approved" && row.isVisible === 1 ? "saved" : row.status === "rejected" ? "cancelled" : "inbox") })),
      templateCategories: tcats.map(apiRow), creativeCategories: ccats.map(apiRow),
    },
    deletedTemplates: allTemplates.filter((row: any) => row.deletedAt).map(apiRow),
  };
}

async function insertLegacyTrash(tx: any, deletedTemplates: any[], revision: number) {
  for (const row of deletedTemplates) {
    const id = `legacy-template:${row.id}`;
    const existing = await tx.select({ id: managementTrash.id }).from(managementTrash).where(eq(managementTrash.id, id)).limit(1);
    if (!existing[0]) await tx.insert(managementTrash).values({ id, kind: "template", title: titleOf(row, "Deleted template"), source: "shared_templates", deletedAt: row.deletedAt || new Date(), valueJson: json(row), workspaceRevision: revision });
  }
}

async function ensureWorkspace(): Promise<any> {
  const db: any = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await selectOne(db);
  if (existing) return existing;
  const legacy = await readLegacy(db);
  const serializedContent = json(legacy.content);
  const serializedCollections = json(legacy.collections);
  const serializedMetadata = json(initialMetadata(legacy.collections));
  try {
    await db.insert(managementWorkspaces).values({ id: WORKSPACE_ID, workingContentJson: serializedContent, workingCollectionsJson: serializedCollections, publishedContentJson: serializedContent, publishedCollectionsJson: serializedCollections, revision: 1, publishedRevision: 1, metadataJson: serializedMetadata });
    await insertLegacyTrash(db, legacy.deletedTemplates, 1);
  } catch (error: any) {
    // Another request may have won initialization; never replace its edits.
    if (!String(error?.message || error).toLowerCase().includes("duplicate")) throw error;
  }
  const row = await selectOne(db);
  if (!row) throw new Error("Workspace initialization readback failed");
  return row;
}

async function mergeGuestArrivals(tx: any, row: any): Promise<any> {
  const snapshot = snapshotFromRow(row);
  const arrivals = await tx.select().from(creativeSubmissions).where(eq(creativeSubmissions.status, "pending"));
  const known = new Set(snapshot.collections.submissions.map((item: any) => String(item.id)));
  const metadata = metadataFromRow(row);
  for (const id of metadata.seenGuestIds) known.add(id);
  const tombstones = await tx.select().from(managementTrash);
  const deletedSubmissionIds = new Set(tombstones.map((item: any) => String(parse(item.valueJson)?.id ?? "")));
  for (const arrival of arrivals) {
    if (!known.has(String(arrival.id)) && !deletedSubmissionIds.has(String(arrival.id))) {
      snapshot.collections.submissions.push(apiRow(arrival));
      known.add(String(arrival.id));
      metadata.seenGuestIds.push(String(arrival.id));
    }
  }
  const serialized = json(snapshot.collections);
  const metadataJson = json(metadata);
  if (serialized !== row.workingCollectionsJson || metadataJson !== row.metadataJson) {
    const hasArrivals = metadata.seenGuestIds.some((id:string)=>!new Set((parse(row.metadataJson)?.seenGuestIds||[]).map(String)).has(id));
    const revision=Number(row.revision)+(hasArrivals?1:0);
    await tx.update(managementWorkspaces).set({ workingCollectionsJson: serialized, metadataJson, ...(hasArrivals?{revision,savedAt:new Date()}:{}) }).where(eq(managementWorkspaces.id, WORKSPACE_ID));
    row = { ...row, workingCollectionsJson: serialized, metadataJson, revision };
  }
  return row;
}

async function transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
  const db: any = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(callback);
}

function collectRemoved(before: unknown, after: unknown, path: string, output: Array<{ kind: string; title: string; source: string; value: unknown; parentId?: string; index?: number }>, parentId?: string) {
  if (Array.isArray(before)) {
    const afterArray=Array.isArray(after)?after:[];
    const afterIds = new Set(afterArray.map((item, index) => identity(item, index)));
    before.forEach((item, index) => {
      const itemId=identity(item,index);
      if (!afterIds.has(itemId)) { output.push({ kind:path.split(".").pop() || "content", title:titleOf(item,path), source:path, value:clone(item), parentId, index }); return; }
      const counterpart=afterArray.find((candidate,candidateIndex)=>identity(candidate,candidateIndex)===itemId);
      collectRemoved(item,counterpart,path,output,String(item?.id ?? parentId ?? ""));
    });
    return;
  }
  if (before && typeof before === "object") {
    const prior=before as Record<string,unknown>;const next=after && typeof after==="object"&&!Array.isArray(after)?after as Record<string,unknown>:{};
    for(const [key,value] of Object.entries(prior)) {
      if(Array.isArray(value) || (value && typeof value==="object")) collectRemoved(value,next[key],`${path}.${key}`,output,parentId);
    }
  }
}
function collectRemovedEntities(before: WorkspaceSnapshot, after: WorkspaceSnapshot) {
  const removed: Array<{ kind: string; title: string; source: string; value: unknown; parentId?: string; index?: number }> = [];
  for (const key of COLLECTION_KEYS) collectRemoved(before.collections[key], after.collections[key], `collections.${key}`, removed);
  collectRemoved(before.content,after.content,"content",removed);
  return removed;
}

async function trashRows(tx: any): Promise<TrashEntry[]> {
  const rows = await tx.select().from(managementTrash).orderBy(desc(managementTrash.deletedAt), desc(managementTrash.id));
  return rows.map((row: any) => ({ id: row.id, kind: row.kind, title: row.title, source: row.source, deletedAt: numberDate(row.deletedAt), value: parse(row.valueJson), ...(row.parentId ? { parentId: row.parentId } : {}), ...(row.itemIndex === null || row.itemIndex === undefined ? {} : { index: row.itemIndex }) }));
}
function stateFrom(row: any, trash: TrashEntry[]): WorkspaceState {
  return { ...snapshotFromRow(row), revision: row.revision, publishedRevision: row.publishedRevision, savedAt: numberDate(row.savedAt), hasChanges: row.revision !== row.publishedRevision, trash };
}
function sanitizePublishedContent(content: Record<string, unknown>) {
  const next = clone(content);
  if (Array.isArray(next.pages)) {
    next.pages = next.pages.filter((page: any) => page && page.visible !== false && page.status !== "draft").map((page: any) => {
      const approvedDraft = page.draft && (page.status === "approved" || page.approvalStatus === "approved" || page.draft.status === "approved") ? page.draft : null;
      const result = approvedDraft ? { ...page, ...approvedDraft } : { ...page };
      delete result.draft;
      delete result.draftSavedAt;
      return result;
    });
  }
  return next;
}
async function currentSharedCollections(publicOnly: boolean): Promise<WorkspaceCollections> {
  const { listSharedItems } = await import("./sharedContent");
  const rows = await Promise.all(COLLECTION_KEYS.map(kind => listSharedItems(kind, publicOnly)));
  return Object.fromEntries(COLLECTION_KEYS.map((kind,index) => [kind,rows[index]])) as WorkspaceCollections;
}
export async function getWorkingState(includeSharedCollections = true): Promise<WorkspaceState> {
  await ensureWorkspace();
  const state = await transaction(async tx => { const row = await selectOne(tx, true); return stateFrom(row, await trashRows(tx)); });
  state.collections = includeSharedCollections ? await currentSharedCollections(false) : emptyCollections();
  return state;
}
export async function getPublishedSnapshot(includeSharedCollections = true): Promise<WorkspaceSnapshot> {
  const row = await ensureWorkspace();
  const snapshot = materializePublishedSnapshot(publishedFromRow(row));
  snapshot.collections = includeSharedCollections ? await currentSharedCollections(true) : emptyCollections();
  return snapshot;
}
export function materializePublishedSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  const next = clone(snapshot);
  next.content = sanitizePublishedContent(next.content);
  next.collections = orderedCollections(next.collections);
  next.collections.submissions = next.collections.submissions.filter((item: any) => item.status === "approved" && Number(item.isVisible) === 1 && item.reviewState === "saved");
  return next;
}
export async function getWorkingSnapshot(includeSharedCollections = true): Promise<WorkspaceSnapshot> { const state = await getWorkingState(includeSharedCollections); return { content: state.content, collections: state.collections }; }
export async function getPublishedPage(slug: string) {
  const snapshot = await getPublishedSnapshot(false);
  const page = Array.isArray(snapshot.content.pages) ? snapshot.content.pages.find((item: any) => item?.slug === slug && item.visible !== false && item.status !== "draft") : null;
  const button = Array.isArray(snapshot.content.buttons) ? snapshot.content.buttons.filter((item:any)=>item.visible!==false).sort((a:any,b:any)=>Number(a.order||0)-Number(b.order||0)).find((item:any)=>["custom-page","internal"].includes(item.action)&&item.url?.split(/[?#]/)[0]===`/custom/${slug}`) : null;
  return page ? { page, settings: snapshot.content.settings, customCode: snapshot.content.customCode, sectionTitle: button?.label?.trim() || page.title } : null;
}

export async function saveWorkspace(content: Record<string, unknown>): Promise<WorkspaceState> {
  await ensureWorkspace();
  return transaction(async tx => {
    const row = await selectOne(tx, true);
    if (!row) throw new Error("Workspace is not initialized");
    const before = snapshotFromRow(row);
    const after: WorkspaceSnapshot = { content: clone(record(content)), collections: clone(before.collections) };
    const revision = Number(row.revision) + 1;
    for (const removed of collectRemovedEntities(before, after)) {
      const id = `trash:${revision}:${crypto.randomUUID()}`;
      await tx.insert(managementTrash).values({ id, kind: removed.kind, title: removed.title, source: removed.source, valueJson: json(removed.value), parentId: removed.parentId || null, itemIndex: removed.index ?? null, workspaceRevision: revision });
    }
    await tx.update(managementWorkspaces).set({ workingContentJson: json(after.content), workingCollectionsJson: json(after.collections), revision, savedAt: new Date() }).where(eq(managementWorkspaces.id, WORKSPACE_ID));
    const confirmed = await selectOne(tx, true);
    if (!confirmed || confirmed.revision !== revision || confirmed.workingContentJson !== json(after.content)) throw new Error("Workspace save readback failed");
    return stateFrom(confirmed, await trashRows(tx));
  });
}

export async function publishWorkspace(revision: number, confirm: boolean) {
  if (!confirm) throw new Error("Publishing requires explicit confirmation.");
  return transaction(async tx => {
    let row = await selectOne(tx, true);
    if (!row) { await ensureWorkspace(); row = await selectOne(tx, true); }
    // Shared guest/content events never change the administrative publication revision.
    if (Number(row.revision) !== revision) throw new Error("Workspace revision is stale; reload before publishing.");
    const oldSnapshot = publishedFromRow(row);
    const { sharedSnapshotInTransaction } = await import("./sharedContent");
    const currentPublicCollections = await sharedSnapshotInTransaction(tx, true);
    const backupJson = json(oldSnapshot.content);
    const backupCollections = json(currentPublicCollections);
    const backup = await tx.insert(managementBackups).values({ name: `قبل النشر #${row.publishedRevision}`, type: "published", size: Buffer.byteLength(backupJson + backupCollections, "utf8"), contentJson: backupJson, collectionsJson: backupCollections });
    const workingContent = sanitizePublishedContent(record(parse(row.workingContentJson)));
    // Collection snapshots are legacy backup data only. Publication changes structure, never shared items.
    const workingCollections = oldSnapshot.collections;
    const nextPublished = { content: json(workingContent), collections: json(workingCollections) };
    await tx.update(managementWorkspaces).set({ publishedContentJson: nextPublished.content, publishedCollectionsJson: nextPublished.collections, publishedRevision: row.revision }).where(eq(managementWorkspaces.id, WORKSPACE_ID));
    const confirmed = await selectOne(tx, true);
    if (!confirmed || confirmed.publishedRevision !== revision || confirmed.publishedContentJson !== nextPublished.content) throw new Error("Publish readback failed");
    return { success: true as const, publishedRevision: revision, backupId: Number(backup[0]?.insertId || 0) };
  });
}

export async function listTrash(): Promise<TrashEntry[]> { return transaction(async tx => trashRows(tx)); }
function restoreAt(snapshot: WorkspaceSnapshot, entry: TrashEntry) {
  if (entry.source === "shared_templates") {
    const restored = { ...clone(entry.value as any), deletedAt: null };
    if (!snapshot.collections.templates.some((item: any) => Number(item.id) === Number(restored.id))) snapshot.collections.templates.push(restored);
    return;
  }
  const parts = entry.source.split(".");
  let target: any = snapshot;
  const findDeep = (value: any): any => {
    if (Array.isArray(value)) for (const item of value) { if (String(item?.id) === String(entry.parentId)) return item; const nested = findDeep(item); if (nested) return nested; }
    else if (value && typeof value === "object") for (const child of Object.values(value)) { const nested = findDeep(child); if (nested) return nested; }
    return undefined;
  };
  for (const part of parts) {
    if (Array.isArray(target)) target = findDeep(target);
    target = target?.[part];
  }
  if (!Array.isArray(target)) throw new Error("Original trash location no longer exists.");
  const list = target as any[];
  if (list.some(item => identity(item, 0) === identity(entry.value, 0))) return;
  const index = entry.index === undefined ? list.length : Math.max(0, Math.min(entry.index, list.length));
  list.splice(index, 0, clone(entry.value));
}
export async function restoreTrash(id: string) {
  const entries = await listTrash();
  const target = entries.find(entry => entry.id === id);
  if (target && (target.source === "shared_templates" || /^collections\.(templates|freeSites|submissions|templateCategories|creativeCategories)$/.test(target.source))) {
    const { restoreSharedTrash } = await import("./sharedContent");
    return restoreSharedTrash(id);
  }
  return transaction(async tx => {
    const row = await selectOne(tx, true); const entries = await tx.select().from(managementTrash).where(eq(managementTrash.id, id)).limit(1);
    if (!row || !entries[0]) throw new Error("Trash entry not found.");
    const entry = entries[0]; const snapshot = snapshotFromRow(row);
    restoreAt(snapshot, { id, kind: entry.kind, title: entry.title, source: entry.source, deletedAt: numberDate(entry.deletedAt), value: parse(entry.valueJson), parentId: entry.parentId || undefined, index: entry.itemIndex ?? undefined });
    const revision = Number(row.revision) + 1;
    await tx.update(managementWorkspaces).set({ workingContentJson: json(snapshot.content), workingCollectionsJson: json(snapshot.collections), revision, savedAt: new Date() }).where(eq(managementWorkspaces.id, WORKSPACE_ID));
    await tx.delete(managementTrash).where(eq(managementTrash.id, id));
    return { success: true as const, revision };
  });
}
export async function purgeTrash(id: string, confirm: boolean) { if (!confirm) throw new Error("Permanent deletion requires explicit confirmation."); const db: any = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(managementTrash).where(eq(managementTrash.id, id)); return { success: true as const }; }

export async function backupWorkspace(name = `نسخة عمل ${new Date().toISOString()}`) {
  return transaction(async tx => { const row = await selectOne(tx, true); if (!row) throw new Error("Workspace not initialized"); const contentJson = row.workingContentJson; const { sharedSnapshotInTransaction } = await import("./sharedContent"); const collectionsJson = json(await sharedSnapshotInTransaction(tx)); const result = await tx.insert(managementBackups).values({ name, type: "working", size: Buffer.byteLength(contentJson + collectionsJson, "utf8"), contentJson, collectionsJson }); return { success: true as const, id: Number(result[0]?.insertId || 0), createdAt: Date.now(), size: Buffer.byteLength(contentJson + collectionsJson, "utf8"), type: "working" }; });
}
export async function listHistory(): Promise<HistoryEntry[]> {
  const db: any = await getDb(); if (!db) throw new Error("Database unavailable");
  const [backups, legacy] = await Promise.all([
    db.select().from(managementBackups).orderBy(desc(managementBackups.createdAt), desc(managementBackups.id)),
    db.select().from(siteContentVersions).orderBy(desc(siteContentVersions.createdAt), desc(siteContentVersions.id)),
  ]);
  return [...backups.map((row: any) => ({ id: `workspace:${row.id}`, name: row.name, createdAt: numberDate(row.createdAt), size: row.size, type: row.type })), ...legacy.map((row: any) => ({ id: `legacy:${row.id}`, name: `نسخة قديمة #${row.id}`, createdAt: numberDate(row.createdAt), size: Buffer.byteLength(row.contentJson, "utf8"), type: "legacy" }))].sort((a, b) => b.createdAt - a.createdAt);
}
export async function readVersion(id: string | number): Promise<WorkspaceSnapshot | null> {
  const db: any = await getDb(); if (!db) throw new Error("Database unavailable"); const raw = String(id);
  if (raw.startsWith("legacy:")) { const rows = await db.select().from(siteContentVersions).where(eq(siteContentVersions.id, Number(raw.slice(7)))).limit(1); return rows[0] ? { content: record(parse(rows[0].contentJson)), collections: emptyCollections() } : null; }
  const numeric = raw.startsWith("workspace:") ? Number(raw.slice(10)) : Number(raw); const rows = await db.select().from(managementBackups).where(eq(managementBackups.id, numeric)).limit(1); return rows[0] ? { content: record(parse(rows[0].contentJson)), collections: { ...emptyCollections(), ...record(parse(rows[0].collectionsJson)) } } : null;
}
export async function restoreVersion(id: string | number) {
  const snapshot = await readVersion(id); if (!snapshot) throw new Error("Version not found.");
  return transaction(async tx => { const row = await selectOne(tx, true); if (!row) throw new Error("Workspace not initialized"); await tx.insert(managementBackups).values({ name: `استرداد تلقائي قبل ${new Date().toISOString()}`, type: "working-before-restore", size: Buffer.byteLength(row.workingContentJson + row.workingCollectionsJson, "utf8"), contentJson: row.workingContentJson, collectionsJson: row.workingCollectionsJson }); const revision = Number(row.revision) + 1; const collections = snapshotFromRow(row).collections; await tx.update(managementWorkspaces).set({ workingContentJson: json(snapshot.content), workingCollectionsJson: json(collections), revision, savedAt: new Date() }).where(eq(managementWorkspaces.id, WORKSPACE_ID)); const confirmed = await selectOne(tx, true); return { ...stateFrom(confirmed, await trashRows(tx)), collections: await (await import("./sharedContent")).sharedSnapshotInTransaction(tx) }; });
}
export async function deleteVersion(id: string | number, confirm: boolean) { if (!confirm) throw new Error("Backup deletion requires explicit confirmation."); const db: any = await getDb(); if (!db) throw new Error("Database unavailable"); const raw = String(id); if (raw.startsWith("legacy:")) await db.delete(siteContentVersions).where(eq(siteContentVersions.id, Number(raw.slice(7)))); else await db.delete(managementBackups).where(eq(managementBackups.id, Number(raw.replace("workspace:", "")))); return { success: true as const }; }

export async function savePrivateSiteContent(content: Record<string, unknown>) { return saveWorkspace(await normalizeAndUploadSiteContent(content)); }
export async function listPublishedCollection(kind: keyof WorkspaceCollections) { const { listSharedItems } = await import("./sharedContent"); return listSharedItems(kind, true); }
export async function listWorkingCollection(kind: keyof WorkspaceCollections) { const { listSharedItems } = await import("./sharedContent"); return listSharedItems(kind, false); }
export async function createWorkingEntity(kind: keyof WorkspaceCollections, value: Record<string, unknown>) { const { createSharedItem } = await import("./sharedContent"); return createSharedItem(kind, value); }
export async function updateWorkingEntity(kind: keyof WorkspaceCollections, id: number, patch: Record<string, unknown>) { const { updateSharedItem } = await import("./sharedContent"); return updateSharedItem(kind, id, patch); }
export async function removeWorkingEntity(kind: keyof WorkspaceCollections, id: number) { const { removeSharedItem } = await import("./sharedContent"); return removeSharedItem(kind, id); }
export async function reorderWorkingEntities(kind: keyof WorkspaceCollections, ids: number[], tool?: string) { const { reorderSharedItems } = await import("./sharedContent"); return reorderSharedItems(kind, ids, tool); }
/** Deterministic in-memory repository used by unit tests; it follows the same optimistic rules. */
export function createMemoryWorkspace(seed: Partial<WorkspaceSnapshot> = {}) {
  let working: WorkspaceSnapshot = { content: clone(seed.content || {}), collections: { ...emptyCollections(), ...(seed.collections || {}) } };
  let published = clone(working); let revision = 1; let publishedRevision = 1; const backups: Array<{ id: string; snapshot: WorkspaceSnapshot; createdAt: number; type: string }> = []; const trash: TrashEntry[] = [];
  return {
    state(): WorkspaceState { return { ...clone(working), revision, publishedRevision, savedAt: Date.now(), hasChanges: revision !== publishedRevision, trash: clone(trash) }; },
    save(content: Record<string, unknown>) { const before = working; working = { content: clone(content), collections: clone(before.collections) }; revision += 1; return this.state(); },
    publish(expected: number) { if (expected !== revision) throw new Error("stale"); backups.push({ id: `workspace:${backups.length + 1}`, snapshot: clone(published), createdAt: Date.now(), type: "published" }); published = clone(working); publishedRevision = revision; return { success: true as const, publishedRevision }; },
    backup() { const id = `workspace:${backups.length + 1}`; backups.push({ id, snapshot: clone(working), createdAt: Date.now(), type: "working" }); return id; },
    history() { return backups.map(item => ({ id: item.id, name: item.type, createdAt: item.createdAt, size: JSON.stringify(item.snapshot).length, type: item.type })); },
    trashList() { return clone(trash); },
    restore(id: string) { const item = backups.find(value => value.id === id); if (!item) throw new Error("missing"); working = clone(item.snapshot); revision += 1; return this.state(); },
    deleteBackup(id: string) { const index = backups.findIndex(item => item.id === id); if (index >= 0) backups.splice(index, 1); return { success: true as const }; },
  };
}
