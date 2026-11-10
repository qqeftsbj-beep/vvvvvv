import express, { type Request, type Response as ExpressResponse } from "express";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { pageMediaFiles, imagePreviewCache } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetSignedUrl, storagePut } from "./storage";

export const IMAGE_PREVIEW_ROUTE_PREFIX = "/api/media-preview";
export const IMAGE_PREVIEW_WIDTHS = [360, 720, 1280] as const;
export const IMAGE_PREVIEW_MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const IMAGE_PREVIEW_MAX_OUTPUT_BYTES = 25 * 1024 * 1024;
export const IMAGE_PREVIEW_MAX_INPUT_PIXELS = 40_000_000;
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const STORAGE_KEY_NAMESPACES = new Set([
  "creative-space",
  "free-sites",
  "generated",
  "page-media",
  "shared-templates",
  "site-content",
]);

export class ImagePreviewInputError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ImagePreviewInputError";
  }
}

/** Only existing object keys in known app-owned storage prefixes are accepted. */
export function validatePreviewStorageKey(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 1024) {
    throw new ImagePreviewInputError("A valid storage key is required.");
  }
  if (value.startsWith("/") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ImagePreviewInputError("Invalid storage key.");
  }
  const segments = value.split("/");
  const legacyOwnedImage = /^abu-kayan-[a-z0-9-]+_[a-f0-9]{8}\.(?:jpe?g|png|webp)$/i.test(value);
  if ((!legacyOwnedImage && segments.length < 2) || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new ImagePreviewInputError("Invalid storage key.");
  }
  if (!legacyOwnedImage && !STORAGE_KEY_NAMESPACES.has(segments[0]!)) {
    throw new ImagePreviewInputError("Storage key is outside approved image namespaces.", 403);
  }
  const leaf = segments[segments.length - 1]!.toLowerCase();
  if (!/\.(?:jpe?g|png|webp|gif)$/.test(leaf)) {
    throw new ImagePreviewInputError("Only JPEG, PNG, WebP, and GIF storage objects are supported.", 415);
  }
  return value;
}

export function parsePreviewWidth(value: unknown): (typeof IMAGE_PREVIEW_WIDTHS)[number] {
  const width = typeof value === "string" && /^\d{1,4}$/.test(value) ? Number(value) : NaN;
  if (!IMAGE_PREVIEW_WIDTHS.includes(width as (typeof IMAGE_PREVIEW_WIDTHS)[number])) {
    throw new ImagePreviewInputError("width must be one of 360, 720, or 1280.");
  }
  return width as (typeof IMAGE_PREVIEW_WIDTHS)[number];
}

function sniffImageMime(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) return "image/gif";
  return undefined;
}

/** Pure image transformation. Never upscales, crops, or replaces the stored original. */
export async function generateImagePreview(source: Buffer, width: number): Promise<{ buffer: Buffer; mimeType: "image/webp" }> {
  if (!IMAGE_PREVIEW_WIDTHS.includes(width as (typeof IMAGE_PREVIEW_WIDTHS)[number])) {
    throw new ImagePreviewInputError("Unsupported preview width.");
  }
  if (!Buffer.isBuffer(source) || source.length === 0 || source.length > IMAGE_PREVIEW_MAX_SOURCE_BYTES) {
    throw new ImagePreviewInputError("Image source exceeds the allowed size.", 413);
  }
  const mimeType = sniffImageMime(source);
  if (!mimeType) throw new ImagePreviewInputError("Image signature is not supported.", 415);
  // Re-encoding GIFs would discard animation. Leave those sources on the original-image path.
  if (mimeType === "image/gif") throw new ImagePreviewInputError("Animated GIF previews use the original image.", 415);

  try {
    // Header-only metadata inspection avoids decoding pixels, and lets the explicit
    // 40 MP guard return 413 before sharp's decoder starts allocating a raster.
    const metadata = await sharp(source, { limitInputPixels: false, animated: false, failOn: "error" }).metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > IMAGE_PREVIEW_MAX_INPUT_PIXELS) {
      throw new ImagePreviewInputError("Image dimensions exceed the allowed limit.", 413);
    }
    const image = sharp(source, { limitInputPixels: IMAGE_PREVIEW_MAX_INPUT_PIXELS, animated: false, failOn: "error" });
    const output = await image.rotate().resize({ width, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    if (!output.length || output.length > IMAGE_PREVIEW_MAX_OUTPUT_BYTES) {
      throw new ImagePreviewInputError("Generated preview exceeds the allowed size.", 413);
    }
    return { buffer: output, mimeType: "image/webp" };
  } catch (error) {
    if (error instanceof ImagePreviewInputError) throw error;
    throw new ImagePreviewInputError("Image could not be decoded safely.", 415);
  }
}

async function readBounded(response: globalThis.Response): Promise<Buffer> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > IMAGE_PREVIEW_MAX_SOURCE_BYTES) {
    throw new ImagePreviewInputError("Image source exceeds the allowed size.", 413);
  }
  if (!response.body) throw new ImagePreviewInputError("Image source is empty.", 502);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > IMAGE_PREVIEW_MAX_SOURCE_BYTES) {
        await reader.cancel();
        throw new ImagePreviewInputError("Image source exceeds the allowed size.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
}

async function fetchStoredImage(key: string): Promise<Buffer> {
  // The key is validated before a provider URL is requested. It is never treated as a URL.
  const signedUrl = await storageGetSignedUrl(key);
  let parsed: URL;
  try {
    parsed = new URL(signedUrl);
  } catch {
    throw new ImagePreviewInputError("Storage returned an invalid source URL.", 502);
  }
  if (parsed.protocol !== "https:") throw new ImagePreviewInputError("Storage returned an unsafe source URL.", 502);
  const response = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new ImagePreviewInputError("Stored image could not be fetched.", 502);
  return readBounded(response);
}

async function keyFromPageMediaId(id: string): Promise<{ key: string; mimeType: string } | undefined> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(pageMediaFiles).where(eq(pageMediaFiles.id, id)).limit(1);
  const row = rows[0];
  if (!row || !row.mimeType.startsWith("image/")) return undefined;
  return { key: row.key, mimeType: row.mimeType };
}

function setImmutableHeaders(res: ExpressResponse): void {
  res.setHeader("Cache-Control", CACHE_CONTROL);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Accept-Encoding");
}

// This map coalesces only active HTTP work. Durable caching remains in storage + DB.
const previewBuilds = new Map<string, Promise<Buffer>>();
async function resolvePreviewBytes(safeKey: string, width: number, cacheKey: string, declaredMimeType?: string): Promise<Buffer> {
  const db = await getDb();
  if (db) {
    const cached = await db.select().from(imagePreviewCache).where(eq(imagePreviewCache.cacheKey, cacheKey)).limit(1);
    if (cached[0]) {
      try { return await fetchStoredImage(cached[0].storageKey); } catch { /* regenerate a missing derivative, never alter the original */ }
    }
  }
  const source = await fetchStoredImage(safeKey);
  const detected = sniffImageMime(source);
  if (!detected || (declaredMimeType && declaredMimeType !== detected)) throw new ImagePreviewInputError("Stored image signature does not match its media type.", 415);
  const preview = await generateImagePreview(source, width);
  if (db) {
    try {
      const cachedObject = await storagePut(`image-previews/${cacheKey}.webp`, preview.buffer, preview.mimeType);
      await db.insert(imagePreviewCache).values({ cacheKey, storageKey: cachedObject.key, createdAt: Date.now() }).onDuplicateKeyUpdate({ set: { storageKey: cachedObject.key } });
    } catch { console.warn("[ImagePreview] derivative cache unavailable; serving generated preview"); }
  }
  return preview.buffer;
}
async function sendPreview(res: ExpressResponse, key: string, width: number, declaredMimeType?: string): Promise<void> {
  const safeKey = validatePreviewStorageKey(key);
  const cacheKey = createHash("sha256").update(`webp-q80-v1:${width}:${safeKey}`).digest("hex");
  let pending = previewBuilds.get(cacheKey);
  if (!pending) {
    if (previewBuilds.size >= 32) throw new ImagePreviewInputError("Preview processing is busy; use the original image.", 429);
    pending = resolvePreviewBytes(safeKey, width, cacheKey, declaredMimeType);
    previewBuilds.set(cacheKey, pending);
  }
  try {
    const bytes = await pending;
    setImmutableHeaders(res); res.type("image/webp").send(bytes);
  } finally { if (previewBuilds.get(cacheKey) === pending) previewBuilds.delete(cacheKey); }
}

function handleError(res: ExpressResponse, error: unknown): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (error instanceof ImagePreviewInputError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof Error && error.message === "Database unavailable") {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }
  console.error("[ImagePreview] request failed", error);
  res.status(502).json({ error: "Image preview unavailable" });
}

export const imagePreviewRouter = express.Router();

imagePreviewRouter.get("/storage", async (req: Request, res: ExpressResponse) => {
  try {
    const key = validatePreviewStorageKey(req.query.key);
    const width = parsePreviewWidth(req.query.width);
    await sendPreview(res, key, width);
  } catch (error) {
    handleError(res, error);
  }
});

imagePreviewRouter.get("/file/:id", async (req: Request, res: ExpressResponse) => {
  try {
    const width = parsePreviewWidth(req.query.width);
    const media = await keyFromPageMediaId(req.params.id);
    if (!media) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(media.mimeType)) {
      throw new ImagePreviewInputError("This media type uses its original image URL.", 415);
    }
    await sendPreview(res, media.key, width, media.mimeType);
  } catch (error) {
    handleError(res, error);
  }
});
