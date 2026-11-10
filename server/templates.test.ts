import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

const shared = vi.hoisted(() => {
  type Kind =
    | "templates"
    | "freeSites"
    | "submissions"
    | "templateCategories"
    | "creativeCategories";
  const rows: Record<Kind, any[]> = {
    templates: [],
    freeSites: [],
    submissions: [],
    templateCategories: [],
    creativeCategories: [],
  };
  let next = 1;
  const published = (item: any) =>
    !item.deletedAt &&
    Number(item.isVisible ?? 1) === 1 &&
    item.status !== "pending" &&
    item.status !== "private" &&
    (item.status !== "approved" || item.reviewState === "saved");
  const reset = () => {
    for (const list of Object.values(rows)) list.splice(0);
    next = 1;
  };
  const create = vi.fn(async (kind: Kind, value: Record<string, any>) => {
    const item = {
      ...value,
      id: value.id ?? next++,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: kind === "submissions" ? value.status || "pending" : "published",
    };
    rows[kind].push(item);
    return structuredClone(item);
  });
  const update = vi.fn(
    async (kind: Kind, id: number, patch: Record<string, any>) => {
      const index = rows[kind].findIndex(item => item.id === id);
      if (index < 0) throw new Error("Workspace item not found.");
      rows[kind][index] = {
        ...rows[kind][index],
        ...patch,
        id,
        updatedAt: new Date(),
        ...(kind === "submissions" ? {} : { status: "published" }),
      };
      return structuredClone(rows[kind][index]);
    }
  );
  const remove = vi.fn(async (kind: Kind, id: number) => {
    const item = rows[kind].find(row => row.id === id);
    if (item)
      Object.assign(item, {
        status: "deleted",
        isVisible: 0,
        deletedAt: new Date(),
      });
    return { success: true as const };
  });
  const list = vi.fn(async (kind: Kind, publicOnly = false) =>
    structuredClone(
      rows[kind].filter(
        row => !row.deletedAt && (!publicOnly || published(row))
      )
    )
  );
  const reorder = vi.fn(async (kind: Kind, ids: number[], tool?: string) => {
    for (const [index, id] of ids.entries()) {
      const item = rows[kind].find(
        row => row.id === id && (!tool || row.tool === tool)
      );
      if (!item)
        throw new Error(
          "Ordering contains an unavailable item or another design library."
        );
      item.sortOrder = index + (kind.endsWith("Categories") ? 1 : 0);
    }
    return structuredClone(rows[kind].filter(row => !row.deletedAt));
  });
  return {
    rows,
    reset,
    create,
    update,
    remove,
    list,
    reorder,
    adminPage: vi.fn(),
    revision: vi.fn(async () => ({ revision: 1, navigationRevision: 1 })),
    navigation: vi.fn(async () => ({ buttons: [], pages: [] })),
  };
});

const workspace = vi.hoisted(() => {
  let trash: any[] = [];
  const reset = () => {
    trash = [];
  };
  return {
    reset,
    publishWorkspace: vi.fn(async () => ({
      success: true,
      publishedRevision: 1,
    })),
    getWorkingState: vi.fn(async () => ({ content: {}, collections: {} })),
    getPublishedSnapshot: vi.fn(async () => ({ content: {}, collections: {} })),
    listTrash: vi.fn(async () => trash),
    restoreTrash: vi.fn(async () => ({ success: true })),
    purgeTrash: vi.fn(async () => ({ success: true })),
    backupWorkspace: vi.fn(),
    deleteVersion: vi.fn(),
    getPublishedPage: vi.fn(),
    getWorkingSnapshot: vi.fn(),
    listHistory: vi.fn(),
    readVersion: vi.fn(),
    restoreVersion: vi.fn(),
    savePrivateSiteContent: vi.fn(),
    materializePublishedSnapshot: (value: any) => value,
  };
});
const mocks = vi.hoisted(() => ({
  storagePut: vi.fn(),
  listDeletedSharedTemplates: vi.fn(async () => []),
  restoreSharedTemplate: vi.fn(async () => ({ success: true })),
  purgeSharedTemplate: vi.fn(async () => ({ success: true })),
  cleanupDeletedSharedTemplates: vi.fn(async () => ({
    success: true,
    deleted: 0,
  })),
  getTemplateRetentionDays: vi.fn(async () => 30),
  setTemplateRetentionDays: vi.fn(async (retentionDays: number) => ({
    retentionDays,
  })),
}));

vi.mock("./sharedContent", () => ({
  createSharedItem: shared.create,
  updateSharedItem: shared.update,
  removeSharedItem: shared.remove,
  listSharedItems: shared.list,
  reorderSharedItems: shared.reorder,
  getSharedContentRevision: shared.revision,
  getSharedNavigation: shared.navigation,
  pageAdminSharedItems: shared.adminPage,
  pageSharedItems: vi.fn(async (kind: string, input: any) => ({
    items: (await shared.list(kind as any, true)).slice(
      0,
      input.pageSize || 12
    ),
    hasMore: false,
    page: input.page || 1,
  })),
  getSharedItem: vi.fn(async () => null),
  syncGuestSubmission: vi.fn(async (record: any) => record),
}));
vi.mock("./managementWorkspace", () => workspace);
vi.mock("./db", () => ({
  listSharedTemplates: vi.fn(async (tool: string, category?: string) =>
    (await shared.list("templates", true)).filter(
      (item: any) =>
        item.tool === tool && (!category || item.category === category)
    )
  ),
  pageTemplates: vi.fn(async () => ({ items: [], hasMore: false, page: 1 })),
  getPublicTemplate: vi.fn(async () => null),
  pageFreeSites: vi.fn(async () => ({
    items: await shared.list("freeSites", true),
    hasMore: false,
    page: 1,
  })),
  pageCreativeSubmissions: vi.fn(async () => ({
    items: await shared.list("submissions", true),
    hasMore: false,
    page: 1,
  })),
  listVisibleFreeSites: vi.fn(async () =>
    (await shared.list("freeSites", true)).filter(
      (item: any) => item.isVisible === 1
    )
  ),
  listAllFreeSites: vi.fn(async () => shared.list("freeSites", false)),
  createFreeSite: vi.fn((value: any) => shared.create("freeSites", value)),
  updateFreeSite: vi.fn((id: number, patch: any) =>
    shared.update("freeSites", id, patch)
  ),
  deleteFreeSite: vi.fn((id: number) => shared.remove("freeSites", id)),
  createCreativeSubmission: vi.fn(async (value: any) => ({
    ...value,
    id: 1000000000,
    reviewState: "inbox",
  })),
  listCreativeCategories: vi.fn(async () =>
    shared.list("creativeCategories", true)
  ),
  searchOwnerContent: vi.fn(async () => ({ items: [], hasMore: false })),
  listDeletedSharedTemplates: mocks.listDeletedSharedTemplates,
  restoreSharedTemplate: mocks.restoreSharedTemplate,
  purgeSharedTemplate: mocks.purgeSharedTemplate,
  cleanupDeletedSharedTemplates: mocks.cleanupDeletedSharedTemplates,
  getTemplateRetentionDays: mocks.getTemplateRetentionDays,
  setTemplateRetentionDays: mocks.setTemplateRetentionDays,
  getSiteContent: vi.fn(async () => "{}"),
  saveSiteContent: vi.fn(async () => ({})),
}));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

function context(user?: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}
const admin = {
  id: 1,
  openId: "admin",
  role: "admin",
  name: "Admin",
  email: null,
  loginMethod: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
} as const;
const regularUser = {
  id: 2,
  openId: "user",
  role: "user",
  name: "User",
  email: null,
  loginMethod: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
} as const;
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

describe("shared template and free-site routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shared.reset();
    workspace.reset();
    mocks.storagePut.mockResolvedValue({
      key: "shared/x.png",
      url: "/manus-storage/shared/x.png",
    });
  });

  it("saves a new template directly to shared storage without the global publisher", async () => {
    const owner = appRouter.createCaller(context(admin));
    const created = await owner.templates.create(createInput({ text: "فوري" }));
    expect(created).toMatchObject({ text: "فوري", status: "published" });
    await expect(
      appRouter.createCaller(context()).templates.list({ tool: "Gemini" })
    ).resolves.toContainEqual(expect.objectContaining({ text: "فوري" }));
    expect(shared.create).toHaveBeenCalledWith(
      "templates",
      expect.objectContaining({ text: "فوري", createdByOpenId: "admin" })
    );
    expect(workspace.publishWorkspace).not.toHaveBeenCalled();
  });

  it("updates and removes templates immediately, retaining media when omitted", async () => {
    const owner = appRouter.createCaller(context(admin));
    const original = await shared.create("templates", {
      id: 31,
      tool: "Gemini",
      text: "قديم",
      imageUrl: "/keep.png",
      imageKey: "keep.png",
    });
    const edited = await owner.templates.update({
      id: original.id,
      text: "جديد",
      ownerPassword: templatePassword,
    });
    expect(edited).toMatchObject({ text: "جديد", imageUrl: "/keep.png" });
    await expect(
      appRouter.createCaller(context()).templates.list({ tool: "Gemini" })
    ).resolves.toContainEqual(expect.objectContaining({ text: "جديد" }));
    await owner.templates.remove({
      id: original.id,
      ownerPassword: templatePassword,
    });
    await expect(
      appRouter.createCaller(context()).templates.list({ tool: "Gemini" })
    ).resolves.toEqual([]);
    expect(workspace.publishWorkspace).not.toHaveBeenCalled();
  });

  it("keeps duplicate templates independent and immediately public", async () => {
    const owner = appRouter.createCaller(context(admin));
    const first = await owner.templates.create(
      createInput({ text: "نفس النص" })
    );
    const second = await owner.templates.create(
      createInput({ text: "نفس النص" })
    );
    expect(first.id).not.toBe(second.id);
    await expect(
      appRouter.createCaller(context()).templates.list({ tool: "Gemini" })
    ).resolves.toHaveLength(2);
  });

  it("rejects bad template passwords before shared writes", async () => {
    const visitor = appRouter.createCaller(context());
    await expect(
      visitor.templates.create(createInput({ ownerPassword: "wrong" }))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      visitor.templates.update({ id: 1, text: "تعديل", ownerPassword: "wrong" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      visitor.templates.remove({ id: 1, ownerPassword: "wrong" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(shared.create).not.toHaveBeenCalled();
    expect(shared.update).not.toHaveBeenCalled();
    expect(shared.remove).not.toHaveBeenCalled();
  });

  it("keeps template recycle-bin actions owner protected and retention controls available", async () => {
    const owner = appRouter.createCaller(context(admin));
    await expect(owner.templates.recycleBin()).resolves.toEqual([]);
    await expect(owner.templates.restore({ id: 9 })).resolves.toMatchObject({
      success: true,
    });
    await expect(
      owner.templates.purge({ id: 9, confirm: true })
    ).resolves.toMatchObject({ success: true });
    await expect(
      owner.templates.cleanup({ retentionDays: 180 })
    ).resolves.toEqual({ success: true, deleted: 0 });
    await expect(owner.templates.retentionDays()).resolves.toBe(30);
    await expect(
      owner.templates.setRetentionDays({ retentionDays: 180 })
    ).resolves.toEqual({ retentionDays: 180 });
    await expect(
      appRouter.createCaller(context(regularUser)).templates.recycleBin()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("saves free sites immediately and preserves optional media and visibility controls", async () => {
    const owner = appRouter.createCaller(context(admin));
    mocks.storagePut.mockResolvedValue({
      key: "free-sites/canva.png",
      url: "/manus-storage/free-sites/canva.png",
    });
    const saved = await owner.freeSites.create({
      name: "Canva",
      url: "https://canva.com",
      imageData: "data:image/png;base64,AA==",
      imageName: "canva.png",
      attachments: [],
      previewUrl: "/preview.png",
      sortOrder: 0,
      isVisible: true,
    });
    expect(saved).toMatchObject({
      name: "Canva",
      status: "published",
      imageKey: "free-sites/canva.png",
      previewUrl: "/preview.png",
    });
    await expect(
      appRouter.createCaller(context()).freeSites.list()
    ).resolves.toContainEqual(expect.objectContaining({ name: "Canva" }));
    await owner.freeSites.setVisibility({ id: saved.id, isVisible: false });
    await expect(
      appRouter.createCaller(context()).freeSites.list()
    ).resolves.toEqual([]);
    await owner.freeSites.setVisibility({ id: saved.id, isVisible: true });
    await owner.freeSites.reorder({ ids: [saved.id] });
    await owner.freeSites.remove({ id: saved.id });
    await expect(
      appRouter.createCaller(context()).freeSites.list()
    ).resolves.toEqual([]);
    expect(workspace.publishWorkspace).not.toHaveBeenCalled();
  });

  it("keeps PIN free-site writes authenticated and immediately shared", async () => {
    const owner = appRouter.createCaller(context());
    await expect(
      owner.freeSites.adminListWithPin({ ownerPin: "invalid" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const created = await owner.freeSites.createWithPin({
      ownerPin,
      name: "جديد",
      attachments: [],
      previewUrl: "/thumb",
      isVisible: true,
      sortOrder: 0,
    });
    expect(created).toMatchObject({
      name: "جديد",
      status: "published",
      previewUrl: "/thumb",
    });
    await expect(
      owner.freeSites.adminListWithPin({ ownerPin })
    ).resolves.toContainEqual(expect.objectContaining({ id: created.id }));
    await owner.freeSites.setVisibilityWithPin({
      ownerPin,
      id: created.id,
      isVisible: false,
    });
    await expect(
      appRouter.createCaller(context()).freeSites.list()
    ).resolves.toEqual([]);
    await owner.freeSites.setVisibilityWithPin({
      ownerPin,
      id: created.id,
      isVisible: true,
    });
    await owner.freeSites.reorderWithPin({ ownerPin, ids: [created.id] });
    await owner.freeSites.removeWithPin({ ownerPin, id: created.id });
    expect(workspace.publishWorkspace).not.toHaveBeenCalled();
  });

  it("keeps Gemini and Chat GBT categories independent while applying visibility and ordering immediately", async () => {
    const owner = appRouter.createCaller(context());
    await expect(
      owner.templateCategories.createWithPin({
        ownerPin: "invalid",
        tool: "Gemini",
        name: "ممنوع",
        slug: "forbidden",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const gemini = await owner.templateCategories.createWithPin({
      ownerPin,
      tool: "Gemini",
      name: "أعراس",
      slug: "weddings",
      sortOrder: 0,
      isVisible: true,
    });
    const chat = await owner.templateCategories.createWithPin({
      ownerPin,
      tool: "Chat GBT",
      name: "ألعاب",
      slug: "games",
      sortOrder: 0,
      isVisible: true,
    });
    const hidden = await owner.templateCategories.createWithPin({
      ownerPin,
      tool: "Gemini",
      name: "مخفي",
      slug: "hidden",
      sortOrder: 1,
      isVisible: false,
    });
    await expect(
      appRouter
        .createCaller(context())
        .templateCategories.list({ tool: "Gemini" })
    ).resolves.toEqual([
      expect.objectContaining({ id: gemini.id, slug: "weddings" }),
    ]);
    await expect(
      appRouter
        .createCaller(context())
        .templateCategories.list({ tool: "Chat GBT" })
    ).resolves.toEqual([
      expect.objectContaining({ id: chat.id, slug: "games" }),
    ]);
    await expect(
      appRouter.createCaller(context(admin)).templateCategories.adminList({ tool: "Gemini" })
    ).resolves.toContainEqual(
      expect.objectContaining({ id: hidden.id, isVisible: 0 })
    );
    await owner.templateCategories.updateWithPin({
      ownerPin,
      id: hidden.id,
      name: "ظاهر",
      isVisible: true,
    });
    await owner.templateCategories.reorderWithPin({
      ownerPin,
      tool: "Gemini",
      ids: [hidden.id, gemini.id],
    });
    await expect(
      appRouter
        .createCaller(context())
        .templateCategories.list({ tool: "Gemini" })
    ).resolves.toHaveLength(2);
    await owner.templateCategories.removeWithPin({ ownerPin, id: hidden.id });
    await expect(
      appRouter
        .createCaller(context())
        .templateCategories.list({ tool: "Gemini" })
    ).resolves.toHaveLength(1);
    expect(shared.create).toHaveBeenCalledWith(
      "templateCategories",
      expect.objectContaining({ tool: "Gemini", slug: "weddings" })
    );
    expect(shared.reorder).toHaveBeenCalledWith(
      "templateCategories",
      [hidden.id, gemini.id],
      "Gemini"
    );
    expect(workspace.publishWorkspace).not.toHaveBeenCalled();
  });

  it("keeps hidden free sites in the PIN admin list but excludes them from public lists", async () => {
    const owner = appRouter.createCaller(context());
    const hidden = await owner.freeSites.createWithPin({
      ownerPin,
      name: "موقع مخفي",
      isVisible: false,
      sortOrder: 0,
    });
    await expect(
      owner.freeSites.adminListWithPin({ ownerPin })
    ).resolves.toContainEqual(
      expect.objectContaining({ id: hidden.id, isVisible: 0 })
    );
    await expect(
      appRouter.createCaller(context()).freeSites.list()
    ).resolves.toEqual([]);
    expect(workspace.publishWorkspace).not.toHaveBeenCalled();
  });
});
