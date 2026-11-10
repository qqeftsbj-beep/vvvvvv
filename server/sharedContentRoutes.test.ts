import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

const store = vi.hoisted(() => {
  const collections: Record<string, any[]> = {
    templates: [],
    freeSites: [],
    submissions: [],
    templateCategories: [],
    creativeCategories: [],
  };
  const reset = () => {
    for (const list of Object.values(collections)) list.splice(0);
  };
  const create = vi.fn(async (kind: string, input: Record<string, any>) => {
    const id =
      kind === "submissions"
        ? 1_000_000_001 + collections[kind].length
        : collections[kind].length + 1;
    const item = {
      ...input,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: kind === "submissions" ? input.status || "pending" : "published",
    };
    collections[kind].push(item);
    return structuredClone(item);
  });
  const update = vi.fn(
    async (kind: string, id: number, patch: Record<string, any>) => {
      const item = collections[kind].find(row => row.id === id);
      if (!item) throw new Error("Workspace item not found.");
      Object.assign(item, patch, { updatedAt: new Date() });
      return structuredClone(item);
    }
  );
  const remove = vi.fn(async (kind: string, id: number) => {
    const item = collections[kind].find(row => row.id === id);
    if (item)
      Object.assign(item, {
        status: "deleted",
        isVisible: 0,
        deletedAt: new Date(),
      });
    return { success: true as const };
  });
  const publicItem = (kind: string, row: any) =>
    !row.deletedAt &&
    Number(row.isVisible ?? 1) === 1 &&
    (kind !== "submissions" ||
      (row.status === "approved" && row.reviewState === "saved"));
  const list = vi.fn(async (kind: string, publicOnly = false) =>
    structuredClone(
      collections[kind].filter(
        row => !row.deletedAt && (!publicOnly || publicItem(kind, row))
      )
    )
  );
  const mirrorGuest = vi.fn(async (record: any) => {
    collections.submissions.push({
      ...record,
      status: "pending",
      reviewState: "inbox",
      isVisible: 0,
    });
    return record;
  });
  return {
    collections,
    reset,
    create,
    update,
    remove,
    list,
    mirrorGuest,
    pageAdmin: vi.fn(async () => ({
      items: [],
      total: 0,
      hasMore: false,
      page: 1,
    })),
    revision: vi.fn(async () => ({ revision: 1, navigationRevision: 1 })),
    navigation: vi.fn(async () => ({ buttons: [], pages: [] })),
  };
});
const workspace = vi.hoisted(() => ({
  publishWorkspace: vi.fn(async () => ({
    success: true,
    publishedRevision: 1,
  })),
  getWorkingState: vi.fn(async () => ({ content: {}, collections: {} })),
  getPublishedSnapshot: vi.fn(async () => ({ content: {}, collections: {} })),
  listTrash: vi.fn(async () => []),
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
}));
const guestDb = vi.hoisted(() => ({
  create: vi.fn(async (value: any) => {
    const record = {
      ...value,
      id: 77,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await store.mirrorGuest(record);
    return record;
  }),
}));
vi.mock("./sharedContent", () => ({
  createSharedItem: store.create,
  updateSharedItem: store.update,
  removeSharedItem: store.remove,
  listSharedItems: store.list,
  reorderSharedItems: vi.fn(async () => []),
  getSharedContentRevision: store.revision,
  getSharedNavigation: store.navigation,
  pageAdminSharedItems: store.pageAdmin,
  pageSharedItems: vi.fn(async (kind: string) => ({
    items: await store.list(kind, true),
    hasMore: false,
    page: 1,
  })),
  getSharedItem: vi.fn(async () => null),
  syncGuestSubmission: store.mirrorGuest,
}));
vi.mock("./managementWorkspace", () => workspace);
vi.mock("./db", () => ({
  createCreativeSubmission: guestDb.create,
  listSharedTemplates: vi.fn(async () => []),
  pageTemplates: vi.fn(async () => ({ items: [], hasMore: false, page: 1 })),
  getPublicTemplate: vi.fn(async () => null),
  pageFreeSites: vi.fn(async () => ({ items: [], hasMore: false, page: 1 })),
  pageCreativeSubmissions: vi.fn(async () => ({
    items: await store.list("submissions", true),
    hasMore: false,
    page: 1,
  })),
  listVisibleFreeSites: vi.fn(async () => store.list("freeSites", true)),
  listAllFreeSites: vi.fn(async () => store.list("freeSites", false)),
  createFreeSite: vi.fn((input: any) => store.create("freeSites", input)),
  updateFreeSite: vi.fn((id: number, patch: any) =>
    store.update("freeSites", id, patch)
  ),
  deleteFreeSite: vi.fn((id: number) => store.remove("freeSites", id)),
  listCreativeCategories: vi.fn(async () =>
    store.list("creativeCategories", true)
  ),
  searchOwnerContent: vi.fn(async () => ({ items: [], hasMore: false })),
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
  getSiteContent: vi.fn(async () => "{}"),
  saveSiteContent: vi.fn(async () => ({})),
}));
vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({ key: "test", url: "/test.png" })),
}));

function context(user?: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}
const owner = {
  id: 1,
  openId: "owner",
  role: "admin",
  name: "Owner",
  email: null,
  loginMethod: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
} as const;
const ownerPin = ENV.ownerPin;

describe("shared collection route regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    workspace.publishWorkspace.mockClear();
  });

  it("keeps a public guest creative submission pending and out of public lists", async () => {
    await store.create("creativeCategories", {
      name: "تصميم",
      slug: "design",
      isVisible: 1,
    });
    const visitor = appRouter.createCaller(context());
    const result = await visitor.creativeSpace.create({
      projectName: "مساهمة زائر",
      description: "مشروع",
      category: "design",
    });
    expect(result).toMatchObject({ id: 77, status: "pending", isVisible: 0 });
    expect(guestDb.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        isVisible: 0,
        category: "design",
      })
    );
    await expect(visitor.creativeSpace.list()).resolves.toEqual([]);
    expect(workspace.publishWorkspace).not.toHaveBeenCalled();
  });

  it("requires the owner PIN and immediately publishes owner-created creative content without global publish", async () => {
    await store.create("creativeCategories", {
      name: "تصميم",
      slug: "design",
      isVisible: 1,
    });
    const visitor = appRouter.createCaller(context());
    await expect(
      visitor.creativeSpace.createWithPin({
        ownerPin: "wrong",
        category: "design",
        projectName: "عمل",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.create).toHaveBeenCalledTimes(1); // only category seed; bad PIN did not create content
    const saved = await visitor.creativeSpace.createWithPin({
      ownerPin,
      category: "design",
      projectName: "عمل المالك",
      description: "خدمة مباشرة",
    });
    expect(saved).toMatchObject({
      status: "approved",
      reviewState: "saved",
      isVisible: 1,
      category: "design",
    });
    await expect(
      appRouter.createCaller(context()).creativeSpace.list()
    ).resolves.toContainEqual(
      expect.objectContaining({ projectName: "عمل المالك" })
    );
    expect(workspace.publishWorkspace).not.toHaveBeenCalled();
  });

  it("rejects empty owner-created creative content and unavailable categories", async () => {
    await expect(
      appRouter
        .createCaller(context())
        .creativeSpace.createWithPin({ ownerPin, category: "missing" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await store.create("creativeCategories", {
      name: "مخفي",
      slug: "hidden",
      isVisible: 0,
    });
    await expect(
      appRouter.createCaller(context()).creativeSpace.createWithPin({
        ownerPin,
        category: "hidden",
        projectName: "مرفق",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
