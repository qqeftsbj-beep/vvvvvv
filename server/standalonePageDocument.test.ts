import { describe, expect, it } from "vitest";
import { buildStandalonePageDocument, STANDALONE_PAGE_CSP } from "./standalonePageDocument";

describe("buildStandalonePageDocument", () => {
  it("returns a real document for a fragment without an iframe or app shell", () => {
    const document = buildStandalonePageDocument({
      html: '<main class="hero"><h1>Published</h1></main>',
      css: ".hero { color: red; }",
      js: "document.body.dataset.ready = 'yes';",
    });

    expect(document).toMatch(/^<!doctype html>/i);
    expect(document).toContain('<meta charset="UTF-8">');
    expect(document).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(document).toContain('<main class="hero"><h1>Published</h1></main>');
    expect(document).toContain('<style data-page-code-style>.hero { color: red; }</style>');
    expect(document).toContain("<script data-page-code-user>document.body.dataset.ready = 'yes';</script>");
    expect(document).not.toContain("<iframe");
    expect(document).not.toContain("custom-page-card");
    expect(document).toContain("<body>");
    expect(document).toContain("</body></html>");
  });

  it("injects CSS into head and JavaScript before the existing closing body", () => {
    const document = buildStandalonePageDocument({
      html: '<!doctype html><html><head><title>Author title</title></head><body><section id="content">Body</section></body></html>',
      css: "body { background: black; }",
      js: "window.pageLoaded = true;",
    });

    expect(document).toContain("<title>Author title</title>");
    expect(document.indexOf("<style data-page-code-style>")).toBeGreaterThan(document.indexOf("<head>"));
    expect(document.indexOf("<script data-page-code-user>")).toBeLessThan(document.indexOf("</body>"));
    expect(document.match(/<meta\s+name=["']viewport["']/gi)).toHaveLength(1);
    expect(document.match(/<meta\s+charset=/gi)).toHaveLength(1);
  });

  it("adds a head when html has no head and preserves authored body markup", () => {
    const document = buildStandalonePageDocument({
      html: '<html lang="en"><body><h1>Keep this body</h1></body></html>',
      css: ".page { min-height: 100vh; }",
      js: "console.log('page');",
    });

    expect(document).toContain('<html lang="en"><head>');
    expect(document).toContain('<meta charset="UTF-8">');
    expect(document).toContain('<h1>Keep this body</h1>');
    expect(document).toContain("<style data-page-code-style>");
    expect(document).toContain("<script data-page-code-user>");
  });

  it("removes stored base and CSP controls so they cannot weaken the response policy", () => {
    const document = buildStandalonePageDocument({
      html: '<!doctype html><html><head><base href="https://evil.example/"><meta http-equiv="Content-Security-Policy" content="default-src *"></head><body>Safe</body></html>',
      css: "",
      js: "",
    });

    expect(document).not.toMatch(/<base\b/i);
    expect(document).not.toMatch(/http-equiv\s*=\s*["']?content-security-policy/i);
    expect(document).toContain("Safe");
  });

  it("does not allow closing tags in user CSS/JS to escape their injection elements", () => {
    const document = buildStandalonePageDocument({
      html: "<div>Content</div>",
      css: "a::after { content: '</style><script>bad()</script>'; }",
      js: "const x = '</script><script>bad()</script>';",
    });

    expect(document).toContain("<\\/style>");
    expect(document).toContain("<\\/script>");
    expect(document.match(/<script data-page-code-user>/g)).toHaveLength(1);
  });
});

describe("STANDALONE_PAGE_CSP", () => {
  it("isolates the page while allowing only safe public assets", () => {
    expect(STANDALONE_PAGE_CSP).toContain("sandbox allow-scripts");
    expect(STANDALONE_PAGE_CSP).not.toContain("allow-same-origin");
    expect(STANDALONE_PAGE_CSP).toContain("connect-src 'none'");
    expect(STANDALONE_PAGE_CSP).toContain("object-src 'none'");
    expect(STANDALONE_PAGE_CSP).toContain("worker-src 'none'");
    expect(STANDALONE_PAGE_CSP).toContain("frame-src 'none'");
    expect(STANDALONE_PAGE_CSP).toContain("form-action 'none'");
    expect(STANDALONE_PAGE_CSP).toContain("img-src https: data: blob: /api/page-media/");
  });
});
