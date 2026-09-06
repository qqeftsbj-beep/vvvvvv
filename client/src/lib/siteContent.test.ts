import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSiteContent, loadSiteContent, saveSiteContent } from "./siteContent";

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
    saveSiteContent({ ...defaultSiteContent, settings: { ...defaultSiteContent.settings, templatePassword: "991122" } });
    expect(loadSiteContent().settings.templatePassword).toBe("991122");
  });
});
