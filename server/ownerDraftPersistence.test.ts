import { describe, expect, it } from "vitest";
import { publicSiteContent } from "./ownerDraftPersistence";

describe("private page working drafts", () => {
  it("keeps unpublished pages and working copies private from public reads", () => {
    const result = publicSiteContent({
      settings: { themeMode: "dark", templatePassword: "secret" },
      pages: [
        { id: "published", slug: "live", title: "Published", status: "published", draft: { title: "Unsaved" }, draftSavedAt: 10 },
        { id: "draft", slug: "private", title: "Not public", status: "draft" },
        { id: "hidden", slug: "hidden", title: "Hidden", status: "published", visible: false },
      ],
    });
    expect(result.pages).toEqual([{ id: "published", slug: "live", title: "Published", status: "published" }]);
    expect(result.settings).toEqual({ themeMode: "dark" });
  });
});
