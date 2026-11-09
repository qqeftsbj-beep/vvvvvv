import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { createCustomPageRoute } from "./customPageRoutes";
import { STANDALONE_PAGE_CSP } from "./standalonePageDocument";

function request(slug: string): Request {
  return { params: { slug } } as Request;
}

function response() {
  const headers = new Map<string, string>();
  const result = {
    statusCode: 0,
    body: "",
    status(code: number) {
      result.statusCode = code;
      return result;
    },
    set(nameOrHeaders: string | Record<string, string>, value?: string) {
      if (typeof nameOrHeaders === "string") headers.set(nameOrHeaders.toLowerCase(), value || "");
      else Object.entries(nameOrHeaders).forEach(([name, headerValue]) => headers.set(name.toLowerCase(), headerValue));
      return result;
    },
    send(body: string) {
      result.body = body;
      return result;
    },
    headers,
  } as unknown as Response & { statusCode: number; body: string; headers: Map<string, string> };
  return result;
}

const publishedCode = {
  page: {
    slug: "published-page",
    renderMode: "code",
    status: "published",
    visible: true,
    customCode: { enabled: true, html: "<main>Native page</main>", css: "main { color: red; }", js: "window.nativePage = true;" },
  },
  customCode: { enabled: false, html: "", css: "", js: "" },
};

async function run(value: unknown, slug = "published-page") {
  const res = response();
  const next = vi.fn() as unknown as NextFunction;
  await createCustomPageRoute(async () => value)(request(slug), res, next);
  return { res, next };
}

describe("native custom page route", () => {
  it("serves enabled published code as a full HTML document, never an iframe", async () => {
    const { res, next } = await run(publishedCode);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBe(STANDALONE_PAGE_CSP);
    expect(res.body).toContain("<!doctype html>");
    expect(res.body).toContain("<main>Native page</main>");
    expect(res.body).toContain("<style data-page-code-style>");
    expect(res.body).toContain("<script data-page-code-user>");
    expect(res.body).not.toContain("<iframe");
    expect(res.body).not.toContain("custom-page-card");
  });

  it.each([
    ["missing", null],
    ["draft", { page: { slug: "draft", renderMode: "code", status: "draft", visible: true, customCode: { enabled: true, html: "draft" } } }],
    ["hidden", { page: { slug: "hidden", renderMode: "code", status: "published", visible: false, customCode: { enabled: true, html: "hidden" } } }],
    ["disabled", { page: { slug: "disabled", renderMode: "code", status: "published", visible: true, customCode: { enabled: false, html: "disabled" } } }],
    ["block", { page: { slug: "block", renderMode: "blocks", status: "published", visible: true, customCode: { enabled: true, html: "block" } } }],
  ])("falls through for %s rather than exposing non-public code", async (_name, value) => {
    const { res, next } = await run(value);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0);
    expect(res.body).toBe("");
  });

  it("uses the published lookup result and does not receive a working snapshot", async () => {
    const lookup = vi.fn(async (slug: string) => {
      expect(slug).toBe("published-page");
      return publishedCode;
    });
    const res = response();
    const next = vi.fn() as unknown as NextFunction;
    await createCustomPageRoute(lookup)(request("published-page"), res, next);
    expect(lookup).toHaveBeenCalledOnce();
    expect(res.body).toContain("Native page");
  });

  it("supports page-owned code without inheriting disabled legacy code", async () => {
    const { res, next } = await run({
      page: { slug: "owned", renderMode: "code", status: "published", visible: true, useLegacyCustomCode: false, customCode: { enabled: true, html: "<h1>Owned</h1>" } },
      customCode: { enabled: false, html: "legacy" },
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.body).toContain("Owned");
    expect(res.body).not.toContain("legacy");
  });

  it("does not render legacy site code when a new page opts out", async () => {
    const { res, next } = await run({
      page: { slug: "no-legacy", renderMode: "code", status: "published", visible: true, useLegacyCustomCode: false },
      customCode: { enabled: true, html: "<h1>Legacy must not appear</h1>" },
    });
    expect(next).toHaveBeenCalledOnce();
    expect(res.body).toBe("");
  });
  it("preserves user-activated downloads and external links without granting session origin access",async()=>{
    const {res}=await run({page:{...publishedCode.page,customCode:{enabled:true,html:'<a href="/api/page-media/pdf/download" download="brochure.pdf">PDF</a><a href="https://wa.me/967000000000" target="_blank" rel="noopener">Contact</a>'}}});
    const policy=res.headers.get("content-security-policy")||"";
    expect(policy).toContain("allow-downloads");expect(policy).toContain("allow-popups");expect(policy).not.toContain("allow-same-origin");
    expect(policy).toContain("connect-src 'none'");expect(res.body).toContain('download="brochure.pdf"');
    expect(res.body).toContain("https://wa.me/");
  });

});
