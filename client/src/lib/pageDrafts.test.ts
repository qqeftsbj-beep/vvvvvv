import { describe, expect, it } from "vitest";
import type { EditablePage } from "@/lib/siteContent";
import { beginPageDraft, editablePage, markPageDraftSaved, publishPage, updatePageDraft, withoutDraft } from "./pageDrafts";

const page = (overrides: Partial<EditablePage> = {}): EditablePage => ({ id: "p", slug: "page", title: "Public", eyebrow: "e", description: "d", template: "landing", visible: true, status: "published", blocks: [], ...overrides });

describe("page draft lifecycle", () => {
  it("starts an independent snapshot and leaves the public root unchanged", () => {
    const root = page();
    const draft = beginPageDraft(root);
    const edited = updatePageDraft(draft, { title: "Private edit", renderMode: "code" });
    expect(root.title).toBe("Public");
    expect(edited.title).toBe("Public");
    expect(edited.draft?.title).toBe("Private edit");
    expect(editablePage(edited).renderMode).toBe("code");
    expect(withoutDraft(edited)).not.toHaveProperty("draft");
  });
  it("marks a draft after parent persistence without publishing", () => {
    const saved = markPageDraftSaved(updatePageDraft(beginPageDraft(page()), { description: "draft" }), 123);
    expect(saved.status).toBe("published");
    expect(saved.draft?.description).toBe("draft");
    expect(saved.draftSavedAt).toBeUndefined();
    expect(saved.draft?.draftSavedAt).toBe(123);
  });
  it("copies the editable snapshot to root only for explicit publish", () => {
    const draft = updatePageDraft(beginPageDraft(page()), { title: "Ready", status: "draft" });
    const published = publishPage(draft, 456);
    expect(published.title).toBe("Ready");
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBe(456);
    expect(published).not.toHaveProperty("draft");
  });
});
