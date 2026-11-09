import { describe, expect, it } from "vitest";
import type { EditablePage } from "@/lib/siteContent";
import type { PageMedia } from "@shared/pageMedia";
import { attachStoredMedia, mediaSnippet, replaceMediaReferences } from "./OwnerPageMedia";

const item: PageMedia = { id: "m", pageId: "p", name: "hero", originalName: "hero.png", folder: "", description: "Hero", mimeType: "image/png", size: 10, url: "/manus-storage/a", downloadUrl: "/api/page-media/a", key: "a", createdAt: 1 };
const page = (overrides: Partial<EditablePage> = {}): EditablePage => ({ id: "p", slug: "p", title: "P", eyebrow: "", description: "", template: "landing", visible: true, status: "published", blocks: [{ id: "b", type: "image", image: item.url, title: "x" }], customCode: { html: `<img src="${item.url}">`, css: `.x{background:url(${item.url})}`, js: "" , enabled: true }, ...overrides });

describe("OwnerPageMedia", () => {
  it("creates useful download and media snippets", () => {
    expect(mediaSnippet(item, "img")).toContain(item.url);
    expect(mediaSnippet(item)).toContain("download");
  });
  it("re-attaches a stored media file without duplicating it", () => {
    const empty = page({ status: "draft", blocks: [], customCode: undefined });
    const attached = attachStoredMedia(empty, item);
    expect(attached.media).toEqual([item]);
    expect(attachStoredMedia(attached, item)).toEqual(attached);
  });
  it("rewrites old references while preserving the old media row", () => {
    const next = replaceMediaReferences(page({ media: [item] }), item.url, "/manus-storage/b");
    expect(next.draft?.blocks?.[0].image || next.blocks?.[0].image).toBe("/manus-storage/b");
    expect(next.draft?.customCode?.html || next.customCode?.html).toContain("/manus-storage/b");
    expect(next.media).toEqual([item]);
  });
});
