import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

const workspace = vi.hoisted(() => {
  type Snapshot = { content: Record<string, unknown>; collections: Record<string, any[]> };
  const emptyCollections = () => ({ templates: [], freeSites: [], submissions: [], templateCategories: [], creativeCategories: [] });
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  let working: Snapshot = { content: {}, collections: emptyCollections() };
  let published: Snapshot = clone(working);
  let revision = 1;
  let publishedRevision = 1;
  let trash: any[] = [];

  const reset = () => {
    working = { content: {}, collections: emptyCollections() };
    published = clone(working);
    revision = 1;
    publishedRevision = 1;
    trash = [];
  };
  const seedCollection = (kind:string,items:any[]) => { working.collections[kind]=clone(items); published=clone(working); revision=1; publishedRevision=1; trash=[]; };
  const seedTemplates = (templates: any[]) => {
    working.collections.templates = clone(templates);
    published = clone(working);
    revision = 1;
    publishedRevision = 1;
    trash = [];
  };
  const state = () => ({
    ...clone(working),
    revision,
    publishedRevision,
    savedAt: Date.now(),
    hasChanges: revision !== publishedRevision,
    trash: clone(trash),
  });

  const listPublishedCollection = vi.fn(async (kind: string) => clone(published.collections[kind] || []));
  const listWorkingCollection = vi.fn(async (kind: string) => clone(working.collections[kind] || []));
  const createWorkingEntity = vi.fn(async (kind: string, value: Record<string, unknown>) => {
    const items = working.collections[kind] || (working.collections[kind] = []);
    const id = value.id ?? (items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1);
    const item = { ...clone(value), id };
    items.push(item);
    revision += 1;
    return clone(item);
  });
  const updateWorkingEntity = vi.fn(async (kind: string, id: number, patch: Record<string, unknown>) => {
    const items = working.collections[kind] || [];
    const index = items.findIndex(item => Number(item.id) === id);
    if (index < 0) throw new Error("Workspace item not found.");
    items[index] = { ...items[index], ...clone(patch), id };
    revision += 1;
    return clone(items[index]);
  });
  const removeWorkingEntity = vi.fn(async (kind: string, id: number) => {
    const items = working.collections[kind] || [];
    const index = items.findIndex(item => Number(item.id) === id);
    if (index < 0) return { success: true as const };
    const [value] = items.splice(index, 1);
    revision += 1;
    trash.unshift({ id: `trash:${revision}:${id}`, kind: kind.slice(0, -1), title: value.name || value.text || String(id), source: `collections.${kind}`, deletedAt: Date.now(), value: clone(value), index });
    return { success: true as const };
  });
  const publishWorkspace = vi.fn(async (expectedRevision: number, confirm: boolean) => {
    if (!confirm) throw new Error("Publishing requires explicit confirmation.");
    if (expectedRevision !== revision) throw new Error("Workspace revision is stale; reload before publishing.");
    published = clone(working);
    publishedRevision = revision;
    return { success: true as const, publishedRevision, backupId: 1 };
  });
  const listTrash = vi.fn(async () => clone(trash));
  const getWorkingState = vi.fn(async () => state());
  const getPublishedSnapshot = vi.fn(async () => clone(published));

  return {
    reorderWorkingEntities: vi.fn(async(kind:string,ids:number[]) => {for(const [index,id] of Array.from(ids.entries()))await updateWorkingEntity(kind,id,{sortOrder:index});return listWorkingCollection(kind);}),
    materializePublishedSnapshot: (value:any)=>value,
    reset,
    seedTemplates,
    seedCollection,
    state,
    listPublishedCollection,
    listWorkingCollection,
    createWorkingEntity,
    updateWorkingEntity,
    removeWorkingEntity,
    publishWorkspace,
    listTrash,
    getWorkingState,
    getPublishedSnapshot,
    backupWorkspace: vi.fn(),
    deleteVersion: vi.fn(),
    getPublishedPage: vi.fn(),
    getWorkingSnapshot: vi.fn(),
    listHistory: vi.fn(),
    purgeTrash: vi.fn(async () => ({success:true as const})),
    readVersion: vi.fn(),
    restoreTrash: vi.fn(async () => ({success:true as const})),
    restoreVersion: vi.fn(),
    savePrivateSiteContent: vi.fn(),
  };
});

const mocks = vi.hoisted(() => ({
  listSharedTemplates: vi.fn(),
  createSharedTemplate: vi.fn(),
  updateSharedTemplate: vi.fn(),
  deleteSharedTemplate: vi.fn(),
  listDeletedSharedTemplates: vi.fn(),
  restoreSharedTemplate: vi.fn(),
  purgeSharedTemplate: vi.fn(),
  cleanupDeletedSharedTemplates: vi.fn(),
  getTemplateRetentionDays: vi.fn(),
  setTemplateRetentionDays: vi.fn(),
  listVisibleFreeSites: vi.fn(),
  listAllFreeSites: vi.fn(),
  createFreeSite: vi.fn(),
  updateFreeSite: vi.fn(),
  deleteFreeSite: vi.fn(),
  storagePut: vi.fn(),
}));
const { listSharedTemplates, createSharedTemplate, updateSharedTemplate, deleteSharedTemplate, listDeletedSharedTemplates, restoreSharedTemplate, purgeSharedTemplate, cleanupDeletedSharedTemplates, getTemplateRetentionDays, setTemplateRetentionDays, listVisibleFreeSites, listAllFreeSites, createFreeSite, updateFreeSite, deleteFreeSite, storagePut } = mocks;

vi.mock("./managementWorkspace", () => workspace);
vi.mock("./db", () => ({
  listSharedTemplates: vi.fn(async (tool:string,category?:string) => { const rows=await workspace.listPublishedCollection("templates"); const cats=await workspace.listPublishedCollection("templateCategories");const relevant=cats.filter((row:any)=>row.tool===tool);const hidden=new Set(relevant.filter((row:any)=>row.isVisible!==1).map((row:any)=>row.slug));return rows.filter((row:any)=>row.tool===tool&&(!category?(!row.category||row.category==="other"||!hidden.has(row.category)):row.category===category)).sort((a:any,b:any)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime()); }),
  createSharedTemplate: vi.fn(async (input:any) => workspace.createWorkingEntity("templates",input)),
  updateSharedTemplate: vi.fn(async (id:number,input:any) => workspace.updateWorkingEntity("templates",id,input)),
  deleteSharedTemplate: vi.fn(async (id:number) => workspace.removeWorkingEntity("templates",id)),
  listDeletedSharedTemplates: vi.fn(async () => (await workspace.listTrash()).filter((entry:any)=>entry.source==="shared_templates"||entry.source==="collections.templates").map((entry:any)=>({...entry.value,deletedAt:new Date(entry.deletedAt),trashId:entry.id}))),
  restoreSharedTemplate: vi.fn(async (id:number) => {const entry=(await workspace.listTrash()).find((item:any)=>Number(item.value?.id)===id);return entry?workspace.restoreTrash(entry.id):{success:true};}),
  purgeSharedTemplate: vi.fn(async (id:number,confirm:boolean) => {const entry=(await workspace.listTrash()).find((item:any)=>Number(item.value?.id)===id);return entry?workspace.purgeTrash(entry.id,confirm):{success:true};}),
  cleanupDeletedSharedTemplates: vi.fn(async () => ({success:true,deleted:0})),
  getTemplateRetentionDays: vi.fn(async()=>30),
  setTemplateRetentionDays: vi.fn(async(retentionDays:number)=>({retentionDays})),
  listVisibleFreeSites: vi.fn(async()=> (await workspace.listPublishedCollection("freeSites")).filter((row:any)=>row.isVisible===1).sort((a:any,b:any)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime())),
  listAllFreeSites: vi.fn(async()=>workspace.listWorkingCollection("freeSites")),
  createFreeSite: vi.fn(async(input:any)=>workspace.createWorkingEntity("freeSites",{...input,id:input.id??7})),
  updateFreeSite: vi.fn(async(id:number,input:any)=>workspace.updateWorkingEntity("freeSites",id,input)),
  deleteFreeSite: vi.fn(async(id:number)=>workspace.removeWorkingEntity("freeSites",id)),
}));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

function context(user?: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const admin = { id: 1, openId: "admin", role: "admin", name: "Admin", email: null, loginMethod: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as const;
const regularUser = { id: 2, openId: "user", role: "user", name: "User", email: null, loginMethod: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as const;
const templatePassword = ENV.templatePassword;
const ownerPin = ENV.ownerPin;

const createInput = (overrides: Record<string, unknown> = {}) => ({
  tool: "Gemini" as const,
  text: "نص",
  imageData: "data:image/png;base64,AA==",
  imageName: "x.png",
  ownerPassword: templatePassword,
  ...overrides,
});

describe("shared templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspace.reset();
    storagePut.mockResolvedValue({ key: "shared/x.png", url: "/manus-storage/shared/x.png" });
  });

  it("keeps a newly created template private until explicit publish", async () => {
    const baseline = { id: 1, tool: "Gemini", text: "الأساسي", imageUrl: "/baseline.png" };
    workspace.seedTemplates([baseline]);
    const ownerSession = appRouter.createCaller(context(admin));

    const created = await ownerSession.templates.create(createInput({ text: "خاص" }));
    expect(created).toMatchObject({ id: 2, text: "خاص" });
    await expect(appRouter.createCaller(context()).templates.list({ tool: "Gemini" })).resolves.toEqual([baseline]);
    await expect(ownerSession.templates.adminList({ tool: "Gemini", ownerPassword: templatePassword })).resolves.toContainEqual(expect.objectContaining({ id: 2, text: "خاص" }));

    const state = workspace.state();
    await expect(ownerSession.management.publish({ ownerPin, revision: state.revision, confirm: true })).resolves.toMatchObject({ publishedRevision: state.revision });
    await expect(appRouter.createCaller(context()).templates.list({ tool: "Gemini" })).resolves.toContainEqual(expect.objectContaining({ id: 2, text: "خاص" }));
    expect(workspace.createWorkingEntity).toHaveBeenCalledWith("templates", expect.objectContaining({ text: "خاص", createdByOpenId: "admin" }));
  });

  it("edits the working template while preserving existing media until publish", async () => {
    const original = { id: 3, tool: "Gemini", text: "قديم", imageUrl: "/keep.png", imageKey: "keep.png", imageName: "keep.png" };
    workspace.seedTemplates([original]);
    const ownerSession = appRouter.createCaller(context(admin));

    const edited = await ownerSession.templates.update({ id: 3, text: "جديد", ownerPassword: templatePassword });
    expect(edited).toMatchObject({ id: 3, text: "جديد", imageUrl: "/keep.png", imageKey: "keep.png" });
    await expect(appRouter.createCaller(context()).templates.list({ tool: "Gemini" })).resolves.toEqual([original]);
    await expect(ownerSession.templates.adminList({ tool: "Gemini", ownerPassword: templatePassword })).resolves.toEqual([expect.objectContaining({ id: 3, text: "جديد", imageUrl: "/keep.png" })]);

    const state = workspace.state();
    await ownerSession.management.publish({ ownerPin, revision: state.revision, confirm: true });
    await expect(appRouter.createCaller(context()).templates.list({ tool: "Gemini" })).resolves.toEqual([expect.objectContaining({ id: 3, text: "جديد", imageUrl: "/keep.png" })]);
    expect(workspace.updateWorkingEntity).toHaveBeenCalledWith("templates", 3, expect.objectContaining({ text: "جديد", createdByOpenId: "admin" }));
  });

  it("keeps duplicate templates as separate working and published entities", async () => {
    const ownerSession = appRouter.createCaller(context(admin));
    const first = await ownerSession.templates.create(createInput({ text: "نفس النص", imageName: "same.png" }));
    const second = await ownerSession.templates.create(createInput({ text: "نفس النص", imageName: "same.png" }));
    expect(first.id).not.toBe(second.id);
    await expect(ownerSession.templates.adminList({ tool: "Gemini", ownerPassword: templatePassword })).resolves.toHaveLength(2);
    await ownerSession.management.publish({ ownerPin, revision: workspace.state().revision, confirm: true });
    await expect(appRouter.createCaller(context()).templates.list({ tool: "Gemini" })).resolves.toHaveLength(2);
  });

  it("moves deletion to central private trash and exposes it publicly only after publish", async () => {
    const template = { id: 9, tool: "Gemini", text: "للحذف", imageUrl: "/delete.png" };
    workspace.seedTemplates([template]);
    const ownerSession = appRouter.createCaller(context(admin));

    await expect(ownerSession.templates.remove({ id: 9, ownerPassword: templatePassword })).resolves.toEqual({ success: true });
    await expect(appRouter.createCaller(context()).templates.list({ tool: "Gemini" })).resolves.toEqual([template]);
    await expect(ownerSession.templates.adminList({ tool: "Gemini", ownerPassword: templatePassword })).resolves.toEqual([]);
    await expect(ownerSession.management.trash({ ownerPin })).resolves.toEqual([expect.objectContaining({ value: template, source: "collections.templates" })]);

    await ownerSession.management.publish({ ownerPin, revision: workspace.state().revision, confirm: true });
    await expect(appRouter.createCaller(context()).templates.list({ tool: "Gemini" })).resolves.toEqual([]);
    expect(workspace.removeWorkingEntity).toHaveBeenCalledWith("templates", 9);
  });

  it("blocks unauthorized template writes and publishing", async () => {
    const visitorSession = appRouter.createCaller(context());
    await expect(visitorSession.templates.create(createInput({ ownerPassword: "wrong" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(visitorSession.templates.update({ id: 3, text: "تعديل", ownerPassword: "wrong" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(visitorSession.templates.remove({ id: 3, ownerPassword: "wrong" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(visitorSession.management.publish({ ownerPin: "wrong", revision: 1, confirm: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(workspace.createWorkingEntity).not.toHaveBeenCalled();
    expect(workspace.updateWorkingEntity).not.toHaveBeenCalled();
    expect(workspace.removeWorkingEntity).not.toHaveBeenCalled();
  });

  it("protects legacy recycle-bin operations and forwards retention settings", async () => {
    workspace.seedTemplates([{id:9,tool:"Gemini",text:"عنصر محذوف"}]); await workspace.removeWorkingEntity("templates",9);
    const ownerSession = appRouter.createCaller(context(admin));
    await expect(ownerSession.templates.recycleBin()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({id:9,text:"عنصر محذوف"})]));
    await expect(ownerSession.templates.restore({ id: 9 })).resolves.toMatchObject({ success: true });
    await expect(ownerSession.templates.purge({ id: 9, confirm: true })).resolves.toMatchObject({ success: true });
    await expect(ownerSession.templates.cleanup({ retentionDays: 180 })).resolves.toEqual({ success: true, deleted: 0 });
    await expect(ownerSession.templates.retentionDays()).resolves.toBe(30);
    await expect(ownerSession.templates.setRetentionDays({ retentionDays: 180 })).resolves.toEqual({ retentionDays: 180 });
    const visitorSession = appRouter.createCaller(context(regularUser));
    await expect(visitorSession.templates.recycleBin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(visitorSession.templates.restore({ id: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lists published free sites publicly and keeps management protected", async () => {
    const published = [{ id: 1, name: "Canva", isVisible: 1, sortOrder: 0 }];
    workspace.seedCollection("freeSites", [...published, { id: 2, name: "مخفي", isVisible: 0, sortOrder: 1 }]);
    const visitorSession = appRouter.createCaller(context());
    await expect(visitorSession.freeSites.list()).resolves.toEqual(published);
    await expect(visitorSession.freeSites.adminList()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(context(admin)).freeSites.adminList()).resolves.toHaveLength(2);
  });

  it("creates, updates, publishes, reorders, and removes a free site", async () => {
    storagePut.mockResolvedValue({ key: "free-sites/canva.png", url: "/manus-storage/free-sites/canva.png" });
    const saved = { id: 7, name: "Canva", imageUrl: "/manus-storage/free-sites/canva.png", isVisible: 1, sortOrder: 0 };
    createFreeSite.mockResolvedValue(saved);
    updateFreeSite.mockResolvedValue({ ...saved, name: "Canva Pro" });
    deleteFreeSite.mockResolvedValue({ success: true });
    listAllFreeSites.mockResolvedValue([saved]);
    const ownerSession = appRouter.createCaller(context(admin));
    await expect(ownerSession.freeSites.create({ name: "Canva", url: "https://canva.com", description: "تصميم", additionalText: "", imageData: "data:image/png;base64,AA==", imageName: "canva.png", sortOrder: 0, isVisible: true })).resolves.toMatchObject(saved);
    await expect(ownerSession.freeSites.update({ id: 7, name: "Canva Pro", clearImage: true })).resolves.toMatchObject({ name: "Canva Pro" });
    await expect(ownerSession.freeSites.setVisibility({ id: 7, isVisible: false })).resolves.toMatchObject({ name: "Canva Pro" });
    await expect(ownerSession.freeSites.reorder({ ids: [7] })).resolves.toContainEqual(expect.objectContaining({id:7,name:"Canva Pro",isVisible:0}));
    await expect(ownerSession.freeSites.remove({ id: 7 })).resolves.toEqual({ success: true });
    expect(workspace.createWorkingEntity).toHaveBeenCalledWith("freeSites",expect.objectContaining({ name: "Canva", imageKey: "free-sites/canva.png" }));
    expect(workspace.updateWorkingEntity).toHaveBeenCalledWith("freeSites",7,expect.objectContaining({ imageUrl: null, imageKey: null }));
    expect(workspace.removeWorkingEntity).toHaveBeenCalledWith("freeSites",7);
  });

  it("lets the authenticated owner PIN manage free sites without OAuth while rejecting an invalid PIN", async () => {
    workspace.seedCollection("freeSites", [{ id: 11, name: "موقع محفوظ", isVisible: 1, sortOrder: 0 }]);
    const owner = appRouter.createCaller(context());
    await expect(owner.freeSites.adminListWithPin({ ownerPin: "invalid" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(owner.freeSites.adminListWithPin({ ownerPin })).resolves.toHaveLength(1);
    await expect(owner.freeSites.setVisibilityWithPin({ ownerPin, id: 11, isVisible: false })).resolves.toMatchObject({ isVisible: 0 });
    await expect(owner.freeSites.createWithPin({ ownerPin, name: "موقع جديد", sortOrder: 1, isVisible: true })).resolves.toMatchObject({ name: "موقع جديد" });
    const rows = await owner.freeSites.adminListWithPin({ ownerPin });
    await expect(owner.freeSites.reorderWithPin({ ownerPin, ids: rows.map(row => row.id).reverse() })).resolves.toHaveLength(2);
    await expect(owner.freeSites.removeWithPin({ ownerPin, id: 11 })).resolves.toEqual({ success: true });
  });
});
