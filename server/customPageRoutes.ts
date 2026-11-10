import type { Express, NextFunction, Request, Response } from "express";
import { getPublishedPage } from "./managementWorkspace";
import { buildStandalonePageDocument, STANDALONE_PAGE_CSP, type StandalonePageCode } from "./standalonePageDocument";

export type PublishedPageLookup = (slug: string) => Promise<unknown> | unknown;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asCustomCode(value: unknown): RecordValue | null {
  return isRecord(value) ? value : null;
}

/**
 * Accept the workspace contract's `{ page, settings, customCode }` shape and
 * tolerate a direct page result while the workspace migration is in progress.
 * The route still applies its own code/enabled guard; it never trusts a draft
 * or hidden record merely because a lookup returned an object.
 */
function publishedCodePage(value: unknown): RecordValue | null {
  if (!isRecord(value)) return null;
  const page = isRecord(value.page) ? value.page : value;
  if (page.renderMode !== "code" || page.status === "draft" || page.visible === false) return null;

  const pageCode = asCustomCode(page.customCode);
  const returnedCode = asCustomCode(value.customCode);
  const code = pageCode || (page.useLegacyCustomCode !== false ? returnedCode : null);
  if (!code || code.enabled !== true) return null;

  return { page, code, sectionTitle: typeof value.sectionTitle === "string" ? value.sectionTitle : page.title };
}

export function createCustomPageRoute(loadPublishedPage: PublishedPageLookup = getPublishedPage) {
  return async function customPageRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";
    if (!slug) return next();

    try {
      const published = publishedCodePage(await loadPublishedPage(slug));
      // Missing, private, hidden, draft, block, or disabled pages deliberately
      // do not become a native document. `next()` preserves the existing SPA
      // fallback behavior for block pages and ordinary app routes.
      if (!published) return next();

      const document = buildStandalonePageDocument(published.code as StandalonePageCode, typeof published.sectionTitle === "string" ? published.sectionTitle : undefined);
      res
        .status(200)
        .set({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": STANDALONE_PAGE_CSP,
          "X-Content-Type-Options": "nosniff",
        })
        .send(document);
    } catch (error) {
      next(error);
    }
  };
}

/** Register before Vite/static SPA fallback. */
export function registerCustomPageRoutes(app: Express, loadPublishedPage: PublishedPageLookup = getPublishedPage): void {
  app.get("/custom/:slug", createCustomPageRoute(loadPublishedPage));
}
