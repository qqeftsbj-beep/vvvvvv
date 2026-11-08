// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { buildSandboxDocument } from "./SandboxCode";
import { PageRenderer } from "./PageRenderer";
import type { EditablePage } from "@/lib/siteContent";
import { fireEvent, render, screen } from "@testing-library/react";

const page = (overrides: Partial<EditablePage> = {}): EditablePage => ({
  id: "page-a",
  slug: "page-a",
  title: "صفحة مستقلة",
  eyebrow: "اختبار",
  description: "وصف الصفحة",
  template: "landing",
  visible: true,
  useLegacyCustomCode: false,
  blocks: [],
  ...overrides,
});

describe("PageRenderer and sandbox isolation", () => {
  it("does not inherit site-level custom code when a new page opts out", () => {
    render(<PageRenderer page={page({ customCode: { html: "<p>page code</p>", css: "", js: "", enabled: true } })} site={{ settings: { backgroundColor: "#000", panelColor: "#111", textColor: "#fff", mutedColor: "#aaa", accentColor: "#f0c", fontFamily: "system", headingFontFamily: "system", baseFontSize: 16, headingScale: 1, fontWeight: 500, lineHeight: 1.5, sectionGap: 1, buttonRadius: 0, cardRadius: 0, backgroundImage: "", templatePassword: "", recycleRetentionDays: 30, themeMode: "dark", borderColor: "#222", goldColor: "#fc0" }, customCode: { html: "<p>legacy code</p>", css: "", js: "", enabled: true } }} mode="preview" />);
    fireEvent.click(screen.getByRole("button", { name: "تشغيل المعاينة" }));
    const frame = screen.getByTitle("الكود المخصص · صفحة مستقلة") as HTMLIFrameElement;
    expect(frame.srcdoc).toContain("page code");
    expect(frame.srcdoc).not.toContain("legacy code");
  });

  it("keeps scripts disabled until the explicit preview run", () => {
    const beforeRun = buildSandboxDocument({ html: "<p>hello</p>", css: "", js: "window.__ran = true" }, false);
    const afterRun = buildSandboxDocument({ html: "<p>hello</p>", css: "", js: "window.__ran = true" }, true);
    expect(beforeRun).not.toContain("window.__ran = true</script>");
    expect(afterRun).toContain("window.__ran = true</script>");
  });

  it("emits a restrictive CSP and no same-origin sandbox token", () => {
    const document = buildSandboxDocument({ html: "<form><input></form>", css: "", js: "" }, false);
    expect(document).toContain("connect-src 'none'");
    expect(document).toContain("frame-src 'none'");
    expect(document).toContain("form-action 'none'");
    expect(document).toContain("img-src https: data: blob:");
    expect(document).not.toContain("allow-same-origin");
  });
});
