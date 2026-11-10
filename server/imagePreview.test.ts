import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  generateImagePreview,
  IMAGE_PREVIEW_MAX_INPUT_PIXELS,
  parsePreviewWidth,
  validatePreviewStorageKey,
} from "./imagePreview";

async function pngBuffer(width = 1200, height = 600): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 220, g: 80, b: 30 } } }).png().toBuffer();
}

describe("image preview input guards", () => {
  it("accepts only whitelisted widths and known app-owned storage keys", () => {
    expect(parsePreviewWidth("720")).toBe(720);
    expect(validatePreviewStorageKey("shared-templates/gemini/hero_123.jpg")).toBe("shared-templates/gemini/hero_123.jpg");
    expect(() => parsePreviewWidth("500")).toThrow(/width/i);
    expect(() => validatePreviewStorageKey("external-host/hero.jpg")).toThrow(/namespace/i);
    expect(() => validatePreviewStorageKey("free-sites/../../etc/passwd.jpg")).toThrow(/invalid/i);
    expect(() => validatePreviewStorageKey("free-sites/hero.svg")).toThrow(/Only JPEG/i);
  });
});

describe("generateImagePreview", () => {
  it("creates a WebP preview without enlargement and keeps the original buffer untouched", async () => {
    const original = await pngBuffer(1200, 600);
    const unchanged = Buffer.from(original);
    const result = await generateImagePreview(original, 720);
    const metadata = await sharp(result.buffer).metadata();
    expect(result.mimeType).toBe("image/webp");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(720);
    expect(metadata.height).toBe(360);
    expect(original).toEqual(unchanged);
  });

  it("preserves aspect ratio and honors EXIF orientation", async () => {
    const source = await sharp({ create: { width: 100, height: 50, channels: 3, background: "blue" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await generateImagePreview(source, 360);
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(50);
    expect(metadata.height).toBe(100);
  });

  it("rejects invalid signatures and leaves GIF animation on the original-image path", async () => {
    await expect(generateImagePreview(Buffer.from("not an image"), 720)).rejects.toMatchObject({ status: 415 });
    const gif = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).gif().toBuffer();
    await expect(generateImagePreview(gif, 720)).rejects.toThrow(/GIF previews use the original/i);
  });

  it("enforces decoder pixel limits", async () => {
    expect(IMAGE_PREVIEW_MAX_INPUT_PIXELS).toBe(40_000_000);
    // A valid PNG with >40 MP is rejected from its header before pixel allocation.
    const oversized = await sharp({ create: { width: 6500, height: 6500, channels: 3, background: "red" } }).png().toBuffer();
    await expect(generateImagePreview(oversized, 720)).rejects.toMatchObject({ status: 413 });
  });
});
