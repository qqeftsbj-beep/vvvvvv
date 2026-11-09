// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { EditablePage } from "@/lib/siteContent";
import { buildFullPageCodeDocument, FullPageCode, isTrustedFullPageCodeMessage, PAGE_CODE_BRIDGE } from "./FullPageCode";

const page = (overrides: Partial<EditablePage> = {}): EditablePage => ({
  id: "code-page",
  slug: "code-page",
  title: "صفحة كود",
  eyebrow: "اختبار",
  description: "",
  template: "landing",
  visible: true,
  renderMode: "code",
  blocks: [],
  ...overrides,
});

const code = (overrides: Partial<{ html: string; css: string; js: string; enabled: boolean }> = {}) => ({
  html: "<main><h1>محتوى كامل</h1></main>",
  css: "main{animation:fade 1s}",
  js: "window.__ran = true",
  enabled: true,
  ...overrides,
});

describe("FullPageCode", () => {
  it("preserves a complete document while escaping wrapper closing tags", () => {
    const document = buildFullPageCodeDocument({
      html: "<!doctype html><html><head><title>Own head</title></head><body><div>Own body</div></body></html>",
      css: "body{color:red}</style><script>alert(1)</script>",
      js: "window.__value = '</script>'",
    }, "https://store.example");
    expect(document).toContain("<title>Own head</title>");
    expect(document).toContain("<div>Own body</div>");
    expect(document).toContain("connect-src 'none'");
    expect(document).toContain("frame-src 'none'");
    expect(document).toContain("form-action 'none'");
    expect(document).toContain("img-src https: data: blob: https://store.example/api/page-media");
    expect(document).not.toContain('sandbox="allow-scripts allow-same-origin"');
    expect(document).toContain("window.__value = '<\\/script>'");
  });

  it("injects styles and the bridge inside a full document that has no head or closing body", () => {
    const document = buildFullPageCodeDocument({
      html: "<!doctype html><html><main><h1>مستند الصفحة</h1></main></html>",
      css: ".demo{color:#fff}",
      js: "window.demoReady = true",
    }, "https://store.example");
    const bridgeIndex = document.indexOf('<script data-page-code-bridge>');
    const closingHtmlIndex = document.lastIndexOf("</html>");
    expect(document).toContain("<head>");
    expect(document).toContain(".demo{color:#fff}");
    expect(bridgeIndex).toBeGreaterThan(-1);
    expect(bridgeIndex).toBeLessThan(closingHtmlIndex);
    expect(document).toContain("window.demoReady = true");
  });

  it("allows child media URLs on an HTTP development origin without allowing connections", () => {
    const document = buildFullPageCodeDocument({ html: '<img src="/api/page-media/example">', css: "", js: "" }, "http://localhost:3000");
    expect(document).toContain("img-src https: data: blob: http://localhost:3000/api/page-media/");
    expect(document).toContain("connect-src 'none'");
    expect(document).toContain('base href="http://localhost:3000/"');
  });

  it("does not create the iframe until explicit preview run", () => {
    const { rerender } = render(<FullPageCode page={page()} code={code()} mode="preview" />);
    expect(screen.queryByTitle("الكود المخصص · صفحة كود")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /تشغيل المعاينة/ }));
    expect(screen.getByTitle("الكود المخصص · صفحة كود")).toBeTruthy();
    rerender(<FullPageCode page={page()} code={code({ enabled: false })} mode="live" />);
    expect(screen.queryByTitle("الكود المخصص · صفحة كود")).toBeNull();
    expect(screen.getByText(/غير مفعّل/)).toBeTruthy();
  });

  it("renders code mode without the legacy hero/card and includes downloads by default", () => {
    render(<FullPageCode page={page({ media: [{ id: "m1", pageId: "code-page", name: "دليل", originalName: "guide.pdf", folder: "", description: "ملف", mimeType: "application/pdf", size: 1024, url: "/api/page-media/m1", downloadUrl: "/api/page-media/m1/download", key: "m1", createdAt: 0 }] })} code={code()} mode="live" />);
    expect(screen.getByTitle("الكود المخصص · صفحة كود")).toBeTruthy();
    expect(screen.queryByText("صفحة جاهزة لفكرتك.")).toBeNull();
    expect(screen.getByRole("link", { name: /تنزيل دليل/ }).getAttribute("download")).toBe("guide.pdf");
  });

  it("accepts only messages from the iframe window with the protocol tag", () => {
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    const valid = { source: frame.contentWindow, data: { protocol: PAGE_CODE_BRIDGE, type: "resize", height: 800 } } as MessageEvent;
    const wrongSource = { source: window, data: valid.data } as unknown as MessageEvent;
    const wrongProtocol = { source: frame.contentWindow, data: { protocol: "other", type: "resize", height: 800 } } as unknown as MessageEvent;
    expect(isTrustedFullPageCodeMessage(valid, frame)).toBe(true);
    expect(isTrustedFullPageCodeMessage(wrongSource, frame)).toBe(false);
    expect(isTrustedFullPageCodeMessage(wrongProtocol, frame)).toBe(false);
  });

  it("routes validated internal bridge navigation to the parent callback", () => {
    const onNavigate = vi.fn();
    render(<FullPageCode page={page()} code={code()} onNavigate={onNavigate} />);
    const frames = screen.getAllByTitle("الكود المخصص · صفحة كود");
    const frame = frames[frames.length - 1];
    const message = new MessageEvent("message", { data: { protocol: PAGE_CODE_BRIDGE, type: "navigate", url: "/custom/next" } });
    Object.defineProperty(message, "source", { value: (frame as HTMLIFrameElement).contentWindow });
    window.dispatchEvent(message);
    expect(onNavigate).toHaveBeenCalledWith("/custom/next");
  });
});
