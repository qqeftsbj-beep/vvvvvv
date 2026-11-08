import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveSiteContentReliable: vi.fn(),
  listSiteContentHistory: vi.fn(),
  readSiteContentVersion: vi.fn(),
  backupSiteContent: vi.fn(),
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
vi.mock("./storage", () => ({ storagePut: vi.fn() }));
vi.mock("./siteContentPersistence", () => ({
  saveSiteContentReliable: mocks.saveSiteContentReliable,
  listSiteContentHistory: mocks.listSiteContentHistory,
  readSiteContentVersion: mocks.readSiteContentVersion,
  backupSiteContent: mocks.backupSiteContent,
}));

import { appRouter } from "./routers";
import { ENV } from "./_core/env";

function context() {
  return { user: null, req: { protocol: "https", headers: {} }, res: {} } as never;
}

describe("siteContent router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects incorrect PINs without invoking persistence", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.siteContent.save({ ownerPin: "wrong", content: {} })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.siteContent.history({ ownerPin: "wrong" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.siteContent.version({ ownerPin: "wrong", id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.siteContent.backup({ ownerPin: "wrong" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.saveSiteContentReliable).not.toHaveBeenCalled();
  });

  it("returns the persistence layer's confirmed normalized object", async () => {
    const content = { heroImage: "/manus-storage/hero.png", customCode: { html: "arbitrary" } };
    mocks.saveSiteContentReliable.mockResolvedValue({ success: true, content });
    await expect(appRouter.createCaller(context()).siteContent.save({ ownerPin: ENV.ownerPin, content })).resolves.toEqual({ success: true, content });
    expect(mocks.saveSiteContentReliable).toHaveBeenCalledWith(content);
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
