import type { EditablePage, PageDraft } from "@/lib/siteContent";

/** Return a page-shaped value with the draft marker removed. */
export function withoutDraft(page: EditablePage): PageDraft {
  const { draft: _draft, ...publishedOrEditable } = page;
  return { ...publishedOrEditable } as PageDraft;
}

/** The value the owner should edit and preview, never the public root when a draft exists. */
export function editablePage(page: EditablePage): PageDraft {
  return page.draft ? { ...page.draft } : withoutDraft(page);
}

/** Start an independent snapshot for an already published page. */
export function beginPageDraft(page: EditablePage): EditablePage {
  if (page.draft) return page;
  return { ...page, draft: withoutDraft(page) };
}

/** Apply a field patch to the editable representation without mutating a public root. */
export function updatePageDraft(page: EditablePage, patch: Partial<PageDraft>): EditablePage {
  const next = { ...editablePage(page), ...patch } as PageDraft;
  if (page.status !== "draft") return { ...page, draft: next };
  return next as EditablePage;
}

/** Mark a draft as saved after the parent confirms persistence. */
export function markPageDraftSaved(page: EditablePage, timestamp = Date.now()): EditablePage {
  if (page.draft) return { ...page, draft: { ...page.draft, draftSavedAt: timestamp } };
  return { ...page, draftSavedAt: timestamp };
}

/** Prepare a draft for explicit publication. The draft marker is intentionally omitted. */
export function publishPage(page: EditablePage, timestamp = Date.now()): EditablePage {
  const next = editablePage(page);
  const published: EditablePage = { ...next, status: "published" as const, visible: next.visible !== false, publishedAt: timestamp };
  return published;
}

export function hasPageDraft(page: EditablePage) {
  return Boolean(page.draft);
}
