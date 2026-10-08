import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

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
  storagePut: vi.fn(),
}));
const { listSharedTemplates, createSharedTemplate, updateSharedTemplate, deleteSharedTemplate, listDeletedSharedTemplates, restoreSharedTemplate, purgeSharedTemplate, cleanupDeletedSharedTemplates, getTemplateRetentionDays, setTemplateRetentionDays, storagePut } = mocks;

vi.mock("./db", () => ({
  listSharedTemplates: mocks.listSharedTemplates,
  createSharedTemplate: mocks.createSharedTemplate,
  updateSharedTemplate: mocks.updateSharedTemplate,
  deleteSharedTemplate: mocks.deleteSharedTemplate,
  listDeletedSharedTemplates: mocks.listDeletedSharedTemplates,
  restoreSharedTemplate: mocks.restoreSharedTemplate,
  purgeSharedTemplate: mocks.purgeSharedTemplate,
  cleanupDeletedSharedTemplates: mocks.cleanupDeletedSharedTemplates,
  getTemplateRetentionDays: mocks.getTemplateRetentionDays,
  setTemplateRetentionDays: mocks.setTemplateRetentionDays,
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

const createInput = (overrides: Record<string, unknown> = {}) => ({
  tool: "Gemini" as const,
  text: "نص",
  imageData: "data:image/png;base64,AA==",
  imageName: "x.png",
  ownerPassword: templatePassword,
  ...overrides,
});

describe("shared templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists templates publicly for a selected tool", async () => {
    listSharedTemplates.mockResolvedValue([{ id: 2, tool: "Gemini" }]);
    const visitorSession = appRouter.createCaller(context());
    const result = await visitorSession.templates.list({ tool: "Gemini" });
    expect(result).toEqual([{ id: 2, tool: "Gemini" }]);
    expect(listSharedTemplates).toHaveBeenCalledWith("Gemini");
  });

  it("preserves separate templates even when their image and text match", async () => {
    const matchingTemplates = [{ id: 4, tool: "Gemini", text: "نفس النص", imageUrl: "/one.png" }, { id: 5, tool: "Gemini", text: "نفس النص", imageUrl: "/one.png" }];
    listSharedTemplates.mockResolvedValue(matchingTemplates);
    await expect(appRouter.createCaller(context()).templates.list({ tool: "Gemini" })).resolves.toEqual(matchingTemplates);
  });

  it("syncs two consecutive templates to a separate visitor session in newest-first order and keeps the other after deletion", async () => {
    storagePut.mockResolvedValue({ key: "shared/x.png", url: "/manus-storage/shared/x.png" });
    const first = { id: 3, tool: "Gemini", text: "القالب الأول" };
    const second = { id: 4, tool: "Gemini", text: "القالب الأحدث" };
    createSharedTemplate.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    listSharedTemplates.mockResolvedValue([second, first]);
    deleteSharedTemplate.mockResolvedValue({ success: true });

    const ownerSession = appRouter.createCaller(context(admin));
    await ownerSession.templates.create(createInput({ text: first.text, imageName: "first.png" }));
    await ownerSession.templates.create(createInput({ text: second.text, imageName: "second.png" }));

    const visitorSession = appRouter.createCaller(context());
    await expect(visitorSession.templates.list({ tool: "Gemini" })).resolves.toEqual([second, first]);
    await expect(ownerSession.templates.remove({ id: second.id, ownerPassword: templatePassword })).resolves.toEqual({ success: true });
    expect(deleteSharedTemplate).toHaveBeenCalledWith(second.id);
  });

  it("syncs an admin-created template to a separate visitor session", async () => {
    storagePut.mockResolvedValue({ key: "shared/x.png", url: "/manus-storage/shared/x.png" });
    const saved = { id: 3, tool: "Gemini", text: "نص جديد" };
    createSharedTemplate.mockResolvedValue(saved);
    listSharedTemplates.mockResolvedValue([saved]);

    const ownerSession = appRouter.createCaller(context(admin));
    await ownerSession.templates.create(createInput({ text: "نص جديد" }));

    const visitorSession = appRouter.createCaller(context());
    await expect(visitorSession.templates.list({ tool: "Gemini" })).resolves.toEqual([saved]);
    expect(listSharedTemplates).toHaveBeenCalledWith("Gemini");
  });

  it("rejects an incorrect template password", async () => {
    const visitorSession = appRouter.createCaller(context());
    await expect(visitorSession.templates.create(createInput({ ownerPassword: "wrong" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(visitorSession.templates.update({ id: 3, text: "تعديل", ownerPassword: "wrong" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(visitorSession.templates.remove({ id: 3, ownerPassword: "wrong" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("updates and removes a template with the correct password", async () => {
    updateSharedTemplate.mockResolvedValue({ id: 3, text: "تعديل المالك" });
    deleteSharedTemplate.mockResolvedValue({ success: true });
    const ownerSession = appRouter.createCaller(context(admin));

    await expect(ownerSession.templates.update({ id: 3, text: "تعديل المالك", ownerPassword: templatePassword })).resolves.toEqual({ id: 3, text: "تعديل المالك" });
    await expect(ownerSession.templates.remove({ id: 3, ownerPassword: templatePassword })).resolves.toEqual({ success: true });
    expect(updateSharedTemplate).toHaveBeenCalledWith(3, expect.objectContaining({ text: "تعديل المالك", createdByOpenId: "admin" }));
    expect(deleteSharedTemplate).toHaveBeenCalledWith(3);
  });

  it("uploads and creates a template with the correct password", async () => {
    storagePut.mockResolvedValue({ key: "shared/x.png", url: "/manus-storage/shared/x.png" });
    createSharedTemplate.mockResolvedValue({ id: 3, tool: "Gemini" });
    const result = await appRouter.createCaller(context(admin)).templates.create(createInput());
    expect(result).toEqual({ id: 3, tool: "Gemini" });
    expect(storagePut).toHaveBeenCalled();
    expect(createSharedTemplate).toHaveBeenCalledWith(expect.objectContaining({ tool: "Gemini", imageKey: "shared/x.png", imageUrl: "/manus-storage/shared/x.png", createdByOpenId: "admin" }));
  });

  it("allows password owner flow without an OAuth session", async () => {
    storagePut.mockResolvedValue({ key: "shared/password.png", url: "/manus-storage/password.png" });
    createSharedTemplate.mockResolvedValue({ id: 11, tool: "Gemini" });
    const visitorSession = appRouter.createCaller(context());
    await expect(visitorSession.templates.create(createInput({ text: "حفظ بكلمة المرور", imageName: "password.png" }))).resolves.toEqual({ id: 11, tool: "Gemini" });
  });

  it("protects recycle-bin operations and forwards retention settings", async () => {
    const deleted = [{ id: 9, tool: "Gemini", deletedAt: new Date() }];
    listDeletedSharedTemplates.mockResolvedValue(deleted);
    restoreSharedTemplate.mockResolvedValue({ success: true });
    purgeSharedTemplate.mockResolvedValue({ success: true });
    cleanupDeletedSharedTemplates.mockResolvedValue({ success: true, deleted: 2 });
    getTemplateRetentionDays.mockResolvedValue(60);
    setTemplateRetentionDays.mockResolvedValue({ retentionDays: 180 });
    const ownerSession = appRouter.createCaller(context(admin));
    await expect(ownerSession.templates.recycleBin()).resolves.toEqual(deleted);
    await expect(ownerSession.templates.restore({ id: 9 })).resolves.toEqual({ success: true });
    await expect(ownerSession.templates.purge({ id: 9 })).resolves.toEqual({ success: true });
    await expect(ownerSession.templates.cleanup({ retentionDays: 180 })).resolves.toEqual({ success: true, deleted: 2 });
    await expect(ownerSession.templates.retentionDays()).resolves.toBe(60);
    await expect(ownerSession.templates.setRetentionDays({ retentionDays: 180 })).resolves.toEqual({ retentionDays: 180 });
    expect(cleanupDeletedSharedTemplates).toHaveBeenCalledWith(180);
    expect(setTemplateRetentionDays).toHaveBeenCalledWith(180);

    const visitorSession = appRouter.createCaller(context(regularUser));
    await expect(visitorSession.templates.recycleBin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(visitorSession.templates.restore({ id: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
