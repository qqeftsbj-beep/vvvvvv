import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  savePrivateSiteContent: vi.fn(),
  saveSiteContentReliable: vi.fn(),
  listSiteContentHistory: vi.fn(),
  readSiteContentVersion: vi.fn(),
  backupSiteContent: vi.fn(),
  storagePut: vi.fn(),
}));

const workspace = vi.hoisted(() => ({
  savePrivateSiteContent: mocks.savePrivateSiteContent,
  backupWorkspace: vi.fn(),
  createWorkingEntity: vi.fn(),
  deleteVersion: vi.fn(),
  getPublishedPage: vi.fn(),
  getPublishedSnapshot: vi.fn(),
  getWorkingSnapshot: vi.fn(),
  getWorkingState: vi.fn(),
  listHistory: vi.fn(),
  listPublishedCollection: vi.fn(),
  listTrash: vi.fn(),
  listWorkingCollection: vi.fn(),
  publishWorkspace: vi.fn(),
  purgeTrash: vi.fn(),
  readVersion: vi.fn(),
  removeWorkingEntity: vi.fn(),
  restoreTrash: vi.fn(),
  restoreVersion: vi.fn(),
  updateWorkingEntity: vi.fn(),
}));

vi.mock("./db", () => ({
  getSiteContent: vi.fn(),
  saveSiteContent: vi.fn(),
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
  listApprovedCreativeSubmissions: vi.fn(),
  listAllCreativeSubmissions: vi.fn(),
  createCreativeSubmission: vi.fn(),
  updateCreativeSubmission: vi.fn(),
  deleteCreativeSubmission: vi.fn(),
  listCreativeCategories: vi.fn(),
  createCreativeCategory: vi.fn(),
  updateCreativeCategory: vi.fn(),
  deleteCreativeCategory: vi.fn(),
  searchOwnerContent: vi.fn(),
  listTemplateCategories: vi.fn(),
  createTemplateCategory: vi.fn(),
  updateTemplateCategory: vi.fn(),
  deleteTemplateCategory: vi.fn(),
}));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("./managementWorkspace", () => workspace);
vi.mock("./siteContentPersistence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./siteContentPersistence")>()),
  saveSiteContentReliable: mocks.saveSiteContentReliable,
  listSiteContentHistory: mocks.listSiteContentHistory,
  readSiteContentVersion: mocks.readSiteContentVersion,
  backupSiteContent: mocks.backupSiteContent,
}));

import { appRouter } from "./routers";
import { ENV } from "./_core/env";
import { normalizeAndUploadSiteContent } from "./siteContentPersistence";

function context() {
  return { user: null, req: { protocol: "https", headers: {} }, res: {} } as never;
}

function dataUrl() {
  return "data:image/png;base64,AA==";
}

const content = {
  heroImage: dataUrl(),
  settings: { backgroundImage: dataUrl() },
  services: [{ image: dataUrl(), title: "خدمة" }],
  products: [{ image: dataUrl(), id: "p1", title: "منتج" }],
  pages: [{ id: "page-1", slug: "safe-page", appearance: { backgroundImage: dataUrl() }, blocks: [{ id: "b1", type: "image", image: dataUrl(), url: "/custom/safe-page", content: "preserve me" }] }],
  customCode: { html: "<div>arbitrary</div>", css: "body{}", js: "console.log(1)", enabled: true },
};

describe("siteContent router and persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storagePut.mockImplementation(async (key: string) => ({ key, url: `/manus-storage/${key}` }));
  });

  it("uploads each supported image path and preserves arbitrary content", async () => {
    const normalized = await normalizeAndUploadSiteContent(content);
    expect(mocks.storagePut).toHaveBeenCalledTimes(6);
    expect(normalized.customCode).toEqual(content.customCode);
    expect((normalized.pages as any[])[0]?.blocks?.[0]).toMatchObject({ content: "preserve me", url: "/custom/safe-page" });
    expect(JSON.stringify(normalized)).not.toContain("data:image/png;base64");
  });

  it("rejects duplicate slugs and unsafe known URLs before any upload operation", async () => {
    await expect(normalizeAndUploadSiteContent({ pages: [{ id: "a", slug: "same" }, { id: "b", slug: "same" }] })).rejects.toThrow(/duplicated/i);
    await expect(normalizeAndUploadSiteContent({ pages: [{ id: "a", slug: "safe", blocks: [{ url: "javascript:alert(1)" }] }] })).rejects.toThrow(/internal path or HTTPS URL/i);
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("rejects incorrect PINs without invoking private workspace persistence", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.siteContent.save({ ownerPin: "wrong", content: {} })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.siteContent.history({ ownerPin: "wrong" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.siteContent.version({ ownerPin: "wrong", id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.siteContent.backup({ ownerPin: "wrong" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.savePrivateSiteContent).not.toHaveBeenCalled();
  });

  it("returns the confirmed private workspace state and its normalized content", async () => {
    const requested = { heroImage: "/manus-storage/hero.png", customCode: { html: "arbitrary" } };
    const savedState = {
      content: requested,
      collections: { templates: [], freeSites: [], submissions: [], templateCategories: [], creativeCategories: [] },
      revision: 2,
      publishedRevision: 1,
      savedAt: Date.now(),
      hasChanges: true,
      trash: [],
    };
    mocks.savePrivateSiteContent.mockResolvedValue(savedState);

    const result = await appRouter.createCaller(context()).siteContent.save({ ownerPin: ENV.ownerPin, content: requested });

    expect(result).toEqual(savedState);
    expect(result.content).toEqual(requested);
    expect(mocks.savePrivateSiteContent).toHaveBeenCalledWith(requested);
  });

  it("returns only history metadata and reads a version through authenticated procedures", async () => {
    mocks.listSiteContentHistory.mockResolvedValue([{ id: 7, createdAt: new Date("2026-01-01T00:00:00.000Z") }]);
    mocks.readSiteContentVersion.mockResolvedValue({ text: "saved" });
    mocks.backupSiteContent.mockResolvedValue({ id: 8, createdAt: new Date("2026-01-02T00:00:00.000Z") });
    const caller = appRouter.createCaller(context());
    await expect(caller.siteContent.history({ ownerPin: ENV.ownerPin })).resolves.toHaveLength(1);
    await expect(caller.siteContent.version({ ownerPin: ENV.ownerPin, id: 7 })).resolves.toEqual({ text: "saved" });
    await expect(caller.siteContent.backup({ ownerPin: ENV.ownerPin })).resolves.toMatchObject({ id: 8 });
    expect(mocks.listSiteContentHistory).toHaveBeenCalledTimes(1);
  });
});
