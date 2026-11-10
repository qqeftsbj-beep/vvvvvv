import { describe, expect, it } from "vitest";
import { collectPageMediaMetadata, PageMediaValidationError, pageMediaPreviewUrl, validatePageMediaFile } from "./pageMedia";

function encoded(bytes: number[]): string {
  return Buffer.from(bytes).toString("base64");
}

describe("validatePageMediaFile", () => {
  it("accepts a valid PNG and reports canonical bytes", () => {
    const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
    const result = validatePageMediaFile({ fileName: "hero.png", mimeType: "image/png", data: encoded(bytes) });
    expect(result.extension).toBe("png");
    expect(result.mimeType).toBe("image/png");
    expect(result.size).toBe(bytes.length);
    expect(result.buffer).toEqual(Buffer.from(bytes));
  });

  it("rejects extension/MIME mismatches and fake signatures", () => {
    expect(() => validatePageMediaFile({ fileName: "page.html", mimeType: "text/html", data: encoded([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e]) })).toThrow(/not allowed/i);
    expect(() => validatePageMediaFile({ fileName: "hero.png", mimeType: "image/jpeg", data: encoded([0x89, 0x50, 0x4e, 0x47]) })).toThrow(/MIME/i);
    expect(() => validatePageMediaFile({ fileName: "hero.png", mimeType: "image/png", data: encoded([0x00, 0x01, 0x02, 0x03]) })).toThrow(/signature/i);
  });

  it("rejects malformed base64 and SVG-like text", () => {
    expect(() => validatePageMediaFile({ fileName: "file.txt", mimeType: "text/plain", data: "%%%=" })).toThrow(/base64/i);
    expect(() => validatePageMediaFile({ fileName: "file.svg", mimeType: "image/svg+xml", data: encoded([0x3c, 0x73, 0x76, 0x67, 0x3e]) })).toThrow(/not allowed/i);
  });
});

describe("collectPageMediaMetadata", () => {
  it("collects root and draft media, with draft metadata taking precedence", () => {
    const result = collectPageMediaMetadata([
      {
        id: "page-a",
        media: [{ id: "00000000-0000-0000-0000-000000000001", name: "Published", folder: "old", description: "old" }],
        draft: {
          media: [{ id: "00000000-0000-0000-0000-000000000001", name: "Working copy", folder: "new", description: "new" }],
        },
      },
    ]);
    expect(result).toEqual([{
      id: "00000000-0000-0000-0000-000000000001",
      pageId: "page-a",
      name: "Working copy",
      folder: "new",
      description: "new",
    }]);
  });

  it("rejects malformed page media and cross-page duplicate ownership", () => {
    expect(() => collectPageMediaMetadata([{ id: "page-a", media: "not-an-array" }])).toThrow(PageMediaValidationError);
    expect(() => collectPageMediaMetadata([
      { id: "page-a", media: [{ id: "00000000-0000-0000-0000-000000000002", name: "A" }] },
      { id: "page-b", draft: { media: [{ id: "00000000-0000-0000-0000-000000000002", name: "B" }] } },
    ])).toThrow(/multiple pages/i);
  });
});

describe("pageMediaPreviewUrl", () => {
  it("returns a stable default preview URL only for supported static image types", () => {
    expect(pageMediaPreviewUrl("00000000-0000-0000-0000-000000000001", "image/png")).toBe("/api/media-preview/file/00000000-0000-0000-0000-000000000001?width=720");
    expect(pageMediaPreviewUrl("00000000-0000-0000-0000-000000000001", "image/gif")).toBeUndefined();
    expect(pageMediaPreviewUrl("00000000-0000-0000-0000-000000000001", "application/pdf")).toBeUndefined();
  });
});
