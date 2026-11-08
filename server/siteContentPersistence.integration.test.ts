import { beforeEach, describe, expect, it, vi } from "vitest";
import { siteContentVersions, siteSettings } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), storagePut: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

import { normalizeAndUploadSiteContent, saveSiteContentReliable } from "./siteContentPersistence";

function dataUrl() { return "data:image/png;base64,AA=="; }

type Version = { id: number; contentJson: string; createdAt: Date };
type State = { content: string; versions: Version[]; nextId: number; failReadback: boolean };

function createDb(initial: string) {
  const state: State = { content: initial, versions: [], nextId: 1, failReadback: false };
  const select = (_selection?: unknown) => ({
    from: (table: unknown) => ({
      where: (_condition: unknown) => ({
        limit: async () => table === siteSettings ? [{ id: 1, contentJson: state.content }] : state.versions.slice(0, 1),
      }),
      orderBy: async () => table === siteContentVersions ? state.versions : [{ id: 1, contentJson: state.content }],
      limit: async () => table === siteContentVersions ? state.versions.slice(0, 20) : [{ id: 1, contentJson: state.content }],
    }),
  });
  const insert = (table: unknown) => ({
    values: (values: { contentJson: string }) => {
      const execute = async () => {
        if (table === siteSettings) state.content = values.contentJson;
        else state.versions.push({ id: state.nextId++, contentJson: values.contentJson, createdAt: new Date() });
        return [{ insertId: table === siteContentVersions ? state.nextId - 1 : 1 }];
      };
      return { then: (resolve: (value: unknown) => unknown) => execute().then(resolve), onDuplicateKeyUpdate: execute };
    },
  });
  const db: any = {
    select,
    insert,
    delete: () => ({ where: async () => undefined }),
    transaction: async (callback: (tx: any) => Promise<void>) => {
      const snapshot = { content: state.content, versions: state.versions.map((version) => ({ ...version })), nextId: state.nextId };
      const tx: any = { select, insert, delete: db.delete };
      if (state.failReadback) {
        tx.select = () => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => table === siteSettings ? [{ id: 1, contentJson: "corrupt-readback" }] : [] }), orderBy: async () => [], limit: async () => [] }) });
      }
      try { await callback(tx); } catch (error) { state.content = snapshot.content; state.versions = snapshot.versions; state.nextId = snapshot.nextId; throw error; }
    },
  };
  mocks.getDb.mockResolvedValue(db);
  return state;
}

const content = {
  heroImage: dataUrl(),
  settings: { backgroundImage: dataUrl() },
  services: [{ image: dataUrl(), title: "خدمة" }],
  products: [{ image: dataUrl(), id: "p1", title: "منتج" }],
  pages: [{ id: "page-1", slug: "safe-page", appearance: { backgroundImage: dataUrl() }, blocks: [{ id: "b1", type: "image", image: dataUrl(), url: "/custom/safe-page", content: "preserve me" }] }],
  customCode: { html: "<div>arbitrary</div>", css: "body{}", js: "console.log(1)", enabled: true },
};

describe("siteContentPersistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storagePut.mockImplementation(async (key: string) => ({ key, url: `/manus-storage/${key}` }));
  });

  it("uploads each supported image path and preserves arbitrary content", async () => {
    const state = createDb(JSON.stringify({ old: true }));
    const result = await saveSiteContentReliable(content);
    expect(result.success).toBe(true);
    expect(mocks.storagePut).toHaveBeenCalledTimes(6);
    const saved = JSON.parse(state.content);
    expect(saved.customCode).toEqual(content.customCode);
    expect(saved.pages[0].blocks[0]).toMatchObject({ content: "preserve me", url: "/custom/safe-page" });
    expect(JSON.stringify(saved)).not.toContain("data:image/png;base64");
    expect(state.versions).toHaveLength(1);
  });

  it("rejects duplicate slugs and unsafe known URLs before any DB or upload operation", async () => {
    const state = createDb(JSON.stringify({ old: true }));
    await expect(normalizeAndUploadSiteContent({ pages: [{ id: "a", slug: "same" }, { id: "b", slug: "same" }] })).rejects.toThrow(/duplicated/i);
    await expect(normalizeAndUploadSiteContent({ pages: [{ id: "a", slug: "safe", blocks: [{ url: "javascript:alert(1)" }] }] })).rejects.toThrow(/internal path or HTTPS URL/i);
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(state.content).toBe(JSON.stringify({ old: true }));
  });

  it("rolls back the update and automatic backup when readback is unavailable", async () => {
    const original = JSON.stringify({ old: "content" });
    const state = createDb(original);
    state.failReadback = true;
    await expect(saveSiteContentReliable({ pages: [{ id: "a", slug: "safe" }], text: "new" })).rejects.toThrow(/readback/i);
    expect(state.content).toBe(original);
    expect(state.versions).toHaveLength(0);
  });
});
