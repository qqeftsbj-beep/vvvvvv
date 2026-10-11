import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSiteContent, loadSiteContent, saveSiteContent } from "./siteContent";

describe("site template password setting", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("provides the legacy default and persists code settings", () => {
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
    expect(defaultSiteContent.settings.customCss).toBe("");
    saveSiteContent({ ...defaultSiteContent, settings: { ...defaultSiteContent.settings, templatePassword: "991122" } });
    expect(loadSiteContent().settings.templatePassword).toBe("991122");
    saveSiteContent({ ...defaultSiteContent, settings: { ...defaultSiteContent.settings, customCss: ".hero { color: red; }" } });
    expect(loadSiteContent().settings.customCss).toBe(".hero { color: red; }");
  });
});
