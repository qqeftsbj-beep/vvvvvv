export type StandalonePageCode = {
  html?: unknown;
  css?: unknown;
  js?: unknown;
  enabled?: unknown;
};

/**
 * The response-level policy is intentionally the security boundary for public
 * custom pages. In particular, `sandbox` deliberately omits allow-same-origin,
 * so code rendered by a page has an opaque origin and cannot join the app's
 * origin/session/storage/API security boundary.
 */
export const STANDALONE_PAGE_CSP = [
  "default-src 'none'",
  "sandbox allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation",
  "base-uri 'none'",
  "connect-src 'none'",
  "object-src 'none'",
  "worker-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "form-action 'none'",
  "img-src https: data: blob: /api/page-media/",
  "media-src https: data: blob: /api/page-media/",
  "font-src https: data: blob: /api/page-media/",
  "style-src 'unsafe-inline' https: data: /api/page-media/",
  "script-src 'unsafe-inline'",
].join("; ");

const CHARSET = '<meta charset="UTF-8">';
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Remove document controls that could conflict with the response security policy. */
export function stripStoredDocumentControls(markup: string): string {
  return markup
    // A stored base can change the meaning of relative URLs and is unnecessary
    // for a page whose public URL is already its document URL.
    .replace(/<base\b[^>]*>/gi, "")
    // A response CSP cannot be weakened by a stored meta CSP. Remove it anyway
    // so the rendered source has one unambiguous policy and cannot add a second
    // policy whose intent is mistaken for the response policy.
    .replace(
      /<meta\b(?=[^>]*\bhttp-equiv\s*=\s*["']?\s*content-security-policy\b)[^>]*>/gi,
      "",
    );
}

function safeStyle(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

function safeScript(js: string): string {
  return js.replace(/<\/script/gi, "<\\/script");
}

function additions(code: { css: string; js: string }): { head: string; tail: string } {
  const head = code.css ? `<style data-page-code-style>${safeStyle(code.css)}</style>` : "";
  const tail = code.js ? `<script data-page-code-user>${safeScript(code.js)}</script>` : "";
  return { head, tail };
}

function hasViewport(markup: string): boolean {
  return /<meta\b[^>]*\bname\s*=\s*["']?\s*viewport\b/i.test(markup);
}

function hasCharset(markup: string): boolean {
  return /<meta\b[^>]*\bcharset\s*=/i.test(markup) || /<meta\b[^>]*\bhttp-equiv\s*=\s*["']?\s*content-type\b/i.test(markup);
}

function injectIntoDocument(markup: string, head: string, tail: string): string {
  let document = stripStoredDocumentControls(markup);
  const headContent = `${hasViewport(document) ? "" : VIEWPORT}${head}`;
  const headTag = document.match(/<head\b[^>]*>/i);

  if (headTag?.index !== undefined) {
    const insertionPoint = headTag.index + headTag[0].length;
    document = `${document.slice(0, insertionPoint)}${hasCharset(document) ? "" : CHARSET}${headContent}${document.slice(insertionPoint)}`;
  } else {
    const htmlTag = document.match(/<html\b[^>]*>/i);
    if (htmlTag?.index !== undefined) {
      const insertionPoint = htmlTag.index + htmlTag[0].length;
      document = `${document.slice(0, insertionPoint)}<head>${CHARSET}${headContent}</head>${document.slice(insertionPoint)}`;
    } else {
      // Fragments are deliberately wrapped as a real document, rather than
      // placed in a preview/card shell. This also gives malformed fragments a
      // real viewport and predictable document/body boundaries.
      const bodyOnly = document.match(/^\s*<body\b[^>]*>([\s\S]*)<\/body\s*>\s*$/i);
      const body = bodyOnly ? bodyOnly[1] : document;
      document = `<!doctype html><html lang="ar" dir="rtl"><head>${CHARSET}${headContent}</head><body>${body}${tail}</body></html>`;
      return document;
    }
  }

  if (/<body\b[^>]*>/i.test(document)) {
    const closingBody = document.match(/<\/body\s*>/i);
    if (closingBody?.index !== undefined) {
      return `${document.slice(0, closingBody.index)}${tail}${document.slice(closingBody.index)}`;
    }
    return `${document}${tail}`;
  }

  const closingHtml = document.match(/<\/html\s*>/i);
  if (closingHtml?.index !== undefined) {
    return `${document.slice(0, closingHtml.index)}<body>${tail}</body>${document.slice(closingHtml.index)}`;
  }
  return `${document}<body>${tail}</body>`;
}

/**
 * Build the exact document sent for a public native custom page.
 *
 * `html` is preserved as authored (full documents stay full documents and
 * fragments are wrapped once). CSS/JS are inserted into the document without
 * adding the app's header, card, React root, or an iframe.
 */
export function buildStandalonePageDocument(code: StandalonePageCode): string {
  const html = text(code.html);
  const css = text(code.css);
  const js = text(code.js);
  const { head, tail } = additions({ css, js });
  const looksLikeDocument = /<!doctype\s+html\b|<html\b|<head\b|<body\b/i.test(html);

  if (!looksLikeDocument) {
    const safeMarkup = stripStoredDocumentControls(html);
    return `<!doctype html><html lang="ar" dir="rtl"><head>${CHARSET}${VIEWPORT}${head}</head><body>${safeMarkup}${tail}</body></html>`;
  }

  return injectIntoDocument(html, head, tail);
}

// Descriptive aliases keep the small builder convenient for route and unit
// callers without duplicating the implementation.
export const createStandalonePageDocument = buildStandalonePageDocument;
export const renderStandalonePageDocument = buildStandalonePageDocument;
