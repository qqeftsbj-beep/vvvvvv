import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSiteContent, loadSiteContent, normalizeSiteContent, saveSiteContent } from "./siteContent";

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
});
