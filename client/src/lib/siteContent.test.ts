import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSiteContent, loadSiteContent, normalizeSiteContent, saveSiteContent, validateSitePages, isSafePageUrl, updatePageSlugInSiteContent } from "./siteContent";

describe("site template password setting", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("provides the legacy default and persists a changed template password", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
      dispatchEvent: vi.fn(),
    });

    expect(defaultSiteContent.settings.templatePassword).toBe("7705");
    expect(defaultSiteContent.settings.headingFontFamily).toBe("Noto Kufi Arabic");
    expect(defaultSiteContent.settings.themeMode).toBe("dark");
    expect(defaultSiteContent.settings.buttonRadius).toBe(0);
    expect(defaultSiteContent.settings.backgroundColor).toBe("#071426");
    expect(defaultSiteContent.settings.accentColor).toBe("#3d83e6");
    expect(defaultSiteContent.settings.goldColor).toBe("#d9b86c");
    saveSiteContent({ ...defaultSiteContent, settings: { ...defaultSiteContent.settings, templatePassword: "991122" } });
    expect(loadSiteContent().settings.templatePassword).toBe("991122");
  });

  it("normalizes remotely synchronized content without dropping new page templates", () => {
    const normalized = normalizeSiteContent({
      heroTitle: "عنوان متزامن",
      pages: [{ id: "p1", slug: "new-page", title: "صفحة جديدة", eyebrow: "قالب", description: "وصف", template: "landing", visible: true }],
      settings: { goldColor: "#ffffff" },
    });
    expect(normalized.heroTitle).toBe("عنوان متزامن");
    expect(normalized.pages[0].slug).toBe("new-page");
    expect(normalized.settings.goldColor).toBe("#ffffff");
    expect(normalized.services.length).toBeGreaterThan(0);
  });

  it("migrates legacy content into the managed hero button catalog", () => {
    const normalized = normalizeSiteContent({ buttons: [{ id: "legacy", label: "زر إضافي", placement: "hero", action: "external", url: "https://example.com" }] });
    expect(normalized.buttons.map((button) => button.id)).toEqual(expect.arrayContaining(["hero-gemini", "hero-chat", "hero-free-sites", "hero-creative-space", "legacy"]));
    expect(normalized.buttonCatalogInitialized).toBe(true);
  });

  it("rejects duplicate or unsafe page slugs while accepting internal and https URLs", () => {
    const pages = [
      { id: "one", slug: "same-page", title: "One", eyebrow: "", description: "", template: "landing" as const, visible: true },
      { id: "two", slug: "same-page", title: "Two", eyebrow: "", description: "", template: "landing" as const, visible: true },
    ];
    const result = validateSitePages(pages);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === "slug")).toBe(true);
    expect(isSafePageUrl("/custom/same-page")).toBe(true);
    expect(isSafePageUrl("https://example.com/path")).toBe(true);
    expect(isSafePageUrl("javascript:alert(1)")).toBe(false);
    expect(isSafePageUrl("//evil.example")).toBe(false);
  });

  it("updates page button references when a slug is renamed", () => {
    const content = normalizeSiteContent({
      pages: [{ id: "page-1", slug: "old-page", title: "Page", eyebrow: "", description: "", template: "landing", visible: true }],
      buttons: [{ id: "link", label: "Open", placement: "hero", action: "custom-page", url: "/custom/old-page" }],
      buttonCatalogInitialized: true,
    });
    const renamed = updatePageSlugInSiteContent(content, "page-1", "new-page");
    expect(renamed.pages[0].slug).toBe("new-page");
    expect(renamed.buttons.find((button) => button.id === "link")?.url).toBe("/custom/new-page");
  });
});
