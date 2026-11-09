import { randomUUID, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import express, { type Request, type Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { PageMedia } from "@shared/pageMedia";
import { PAGE_MEDIA_MAX_BYTES, canPreviewMedia } from "@shared/pageMedia";
import { pageMediaFiles } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { storageGetSignedUrl, storagePut } from "./storage";

/**
 * Known-link behavior: the opaque id in a returned URL is intentionally public.
 * Anyone who has a canonical URL may preview/download that immutable version; listing,
 * uploading, and metadata changes remain owner-PIN protected.
 */
export const PAGE_MEDIA_ROUTE_PREFIX = "/api/page-media";

const MAX_NAME_LENGTH = 255;
const MAX_FOLDER_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_PAGE_ID_LENGTH = 128;
const MAX_BASE64_LENGTH = Math.ceil(PAGE_MEDIA_MAX_BYTES / 3) * 4 + 4;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  txt: "text/plain",
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_BY_EXTENSION));

export type PageMediaUploadInput = {
  ownerPin: string;
  pageId: string;
  name: string;
  folder?: string;
  description?: string;
  fileName: string;
  mimeType: string;
  data: string;
  replacementId?: string;
};

export type ValidatedPageMediaFile = {
  extension: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
};

export class PageMediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageMediaValidationError";
  }
}

export class PageMediaAuthorizationError extends Error {
  constructor(message = "Owner authorization required") {
    super(message);
    this.name = "PageMediaAuthorizationError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PageMediaValidationError("Upload payload must be an object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new PageMediaValidationError(`${label} is required.`);
  const normalized = value.trim();
  if (!normalized) throw new PageMediaValidationError(`${label} is required.`);
  if (normalized.length > maxLength) throw new PageMediaValidationError(`${label} is too long.`);
  return normalized;
}

function optionalString(value: unknown, label: string, maxLength: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new PageMediaValidationError(`${label} must be text.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new PageMediaValidationError(`${label} is too long.`);
  return normalized;
}

function validatePageId(pageId: string): string {
  if (/[/\\\u0000-\u001f\u007f]/.test(pageId)) {
    throw new PageMediaValidationError("pageId contains an invalid character.");
  }
  return pageId;
}

function extensionFor(fileName: string): string {
  if (fileName.includes("/") || fileName.includes("\\") || /[\u0000-\u001f\u007f]/.test(fileName)) {
    throw new PageMediaValidationError("fileName must be a simple file name.");
  }
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) {
    throw new PageMediaValidationError("fileName must have an allowed extension.");
  }
  const extension = fileName.slice(dot + 1).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new PageMediaValidationError("This file type is not allowed.");
  }
  return extension;
}

function decodeBase64Strict(value: string): Buffer {
  if (!value || value.length > MAX_BASE64_LENGTH || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new PageMediaValidationError("data must be a valid base64 string.");
  }
  const buffer = Buffer.from(value, "base64");
  if (!buffer.length || buffer.length > PAGE_MEDIA_MAX_BYTES) {
    throw new PageMediaValidationError(`File size must be between 1 byte and ${PAGE_MEDIA_MAX_BYTES} bytes.`);
  }
  // Buffer.from is deliberately lenient; re-encoding makes malformed or non-canonical
  // base64 fail rather than silently changing the uploaded bytes.
  if (buffer.toString("base64") !== value) {
    throw new PageMediaValidationError("data must be canonical base64.");
  }
  return buffer;
}

function isUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  const decoded = new TextDecoder("utf-8", { fatal: true });
  try {
    decoded.decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function hasMagic(extension: string, buffer: Buffer): boolean {
  const starts = (bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);
  switch (extension) {
    case "jpg":
    case "jpeg":
      return starts([0xff, 0xd8, 0xff]);
    case "png":
      return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "webp":
      return starts([0x52, 0x49, 0x46, 0x46]) && buffer.length >= 12 && buffer.toString("ascii", 8, 12) === "WEBP";
    case "gif":
      return buffer.length >= 6 && (buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a");
    case "mp4":
      return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
    case "webm":
      return starts([0x1a, 0x45, 0xdf, 0xa3]);
    case "mp3":
      return (buffer.length >= 3 && buffer.toString("ascii", 0, 3) === "ID3") || (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    case "wav":
      return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE";
    case "pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    case "doc":
    case "xls":
    case "ppt":
      return starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case "docx":
    case "xlsx":
    case "pptx":
    case "zip":
      return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2] ?? -1) && [0x04, 0x06, 0x08].includes(buffer[3] ?? -1);
    case "txt":
      return isUtf8Text(buffer);
    default:
      return false;
  }
}

/**
 * Pure, side-effect-free extension/MIME/magic/size validation for uploaded bytes.
 * This is format validation only, not antivirus or malware scanning.
 */
export function validatePageMediaFile(input: Pick<PageMediaUploadInput, "fileName" | "mimeType" | "data">): ValidatedPageMediaFile {
  const fileName = requiredString(input.fileName, "fileName", MAX_NAME_LENGTH);
  const extension = extensionFor(fileName);
  const mimeType = requiredString(input.mimeType, "mimeType", 255).toLowerCase();
  const expectedMimeType = MIME_BY_EXTENSION[extension];
  if (mimeType !== expectedMimeType && !(extension === "wav" && mimeType === "audio/x-wav") && !(extension === "zip" && mimeType === "application/x-zip-compressed")) {
    throw new PageMediaValidationError("File extension and MIME type do not match.");
  }
  if (typeof input.data !== "string") throw new PageMediaValidationError("data must be a base64 string.");
  const buffer = decodeBase64Strict(input.data);
  if (!hasMagic(extension, buffer)) {
    throw new PageMediaValidationError("File signature does not match its extension.");
  }
  return { extension, mimeType: expectedMimeType, buffer, size: buffer.length };
}

export function verifyPageMediaOwnerPin(ownerPin: unknown): void {
  if (typeof ownerPin !== "string" || !ENV.ownerPin) throw new PageMediaAuthorizationError();
  const actual = Buffer.from(ownerPin);
  const expected = Buffer.from(ENV.ownerPin);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new PageMediaAuthorizationError();
}

function sanitizeHeaderFileName(originalName: string, extension: string): { fallback: string; encoded: string } {
  const fallback = (originalName.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || `page-media.${extension}`).replace(/\.+$/g, `.${extension}`);
  return { fallback, encoded: encodeURIComponent(originalName) };
}

function mediaUrls(id: string): Pick<PageMedia, "url" | "downloadUrl"> {
  return { url: `${PAGE_MEDIA_ROUTE_PREFIX}/${encodeURIComponent(id)}`, downloadUrl: `${PAGE_MEDIA_ROUTE_PREFIX}/${encodeURIComponent(id)}/download` };
}

function toPageMedia(row: typeof pageMediaFiles.$inferSelect): PageMedia {
  return {
    id: row.id,
    pageId: row.pageId,
    name: row.name,
    originalName: row.originalName,
    folder: row.folder,
    description: row.description,
    mimeType: row.mimeType,
    size: row.size,
    ...mediaUrls(row.id),
    key: row.key,
    createdAt: row.createdAt.getTime(),
  };
}

function parseUploadInput(body: unknown): Omit<PageMediaUploadInput, "ownerPin"> & { ownerPin: string } {
  const record = asRecord(body);
  // This parser is deliberately called only after the route verifies ownerPin.
  const ownerPin = requiredString(record.ownerPin, "ownerPin", 128);
  const pageId = validatePageId(requiredString(record.pageId, "pageId", MAX_PAGE_ID_LENGTH));
  const name = requiredString(record.name, "name", MAX_NAME_LENGTH);
  const folder = optionalString(record.folder, "folder", MAX_FOLDER_LENGTH);
  const description = optionalString(record.description, "description", MAX_DESCRIPTION_LENGTH);
  const fileName = requiredString(record.fileName, "fileName", MAX_NAME_LENGTH);
  const mimeType = requiredString(record.mimeType, "mimeType", 255);
  const data = requiredString(record.data, "data", MAX_BASE64_LENGTH);
  const replacementId = record.replacementId === undefined ? undefined : requiredString(record.replacementId, "replacementId", 64);
  return { ownerPin, pageId, name, folder, description, fileName, mimeType, data, replacementId };
}

function storagePageId(pageId: string): string {
  return pageId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, MAX_PAGE_ID_LENGTH) || "page";
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

export async function uploadPageMedia(input: PageMediaUploadInput): Promise<PageMedia> {
  // Callers must authenticate before invoking this function; the HTTP handler does this
  // before parsing/decoding the data. This second check protects direct server callers.
  verifyPageMediaOwnerPin(input.ownerPin);
  const pageId = validatePageId(requiredString(input.pageId, "pageId", MAX_PAGE_ID_LENGTH));
  const name = requiredString(input.name, "name", MAX_NAME_LENGTH);
  const folder = optionalString(input.folder, "folder", MAX_FOLDER_LENGTH);
  const description = optionalString(input.description, "description", MAX_DESCRIPTION_LENGTH);
  const originalName = requiredString(input.fileName, "fileName", MAX_NAME_LENGTH);
  const validated = validatePageMediaFile(input);
  const db = await requireDb();
  const id = randomUUID();
  const uploaded = await storagePut(`page-media/${storagePageId(pageId)}/${id}.${validated.extension}`, validated.buffer, validated.mimeType);
  await db.insert(pageMediaFiles).values({
    id,
    pageId,
    name,
    originalName,
    folder,
    description,
    mimeType: validated.mimeType,
    size: validated.size,
    key: uploaded.key,
  });
  const rows = await db.select().from(pageMediaFiles).where(eq(pageMediaFiles.id, id)).limit(1);
  if (!rows[0]) throw new Error("Media metadata readback failed");
  return toPageMedia(rows[0]);
}

export async function listPageMedia(ownerPin: string, pageId?: string): Promise<PageMedia[]> {
  verifyPageMediaOwnerPin(ownerPin);
  const db = await requireDb();
  const normalizedPageId = pageId === undefined ? undefined : validatePageId(requiredString(pageId, "pageId", MAX_PAGE_ID_LENGTH));
  const rows = normalizedPageId
    ? await db.select().from(pageMediaFiles).where(eq(pageMediaFiles.pageId, normalizedPageId)).orderBy(desc(pageMediaFiles.createdAt), desc(pageMediaFiles.id))
    : await db.select().from(pageMediaFiles).orderBy(desc(pageMediaFiles.createdAt), desc(pageMediaFiles.id));
  return rows.map(toPageMedia);
}

function normalizeMetadata(value: unknown, label: string, maxLength: number, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new PageMediaValidationError(`${label} must be text.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new PageMediaValidationError(`${label} is too long.`);
  return normalized;
}

/** Extract and validate the page/media metadata that the parent save transaction should sync. */
export function collectPageMediaMetadata(pages: unknown): Array<{ id: string; pageId: string; name: string; folder: string; description: string }> {
  if (!Array.isArray(pages)) throw new PageMediaValidationError("pages must be an array.");
  const metadataById = new Map<string, { id: string; pageId: string; name: string; folder: string; description: string }>();
  for (const rawPage of pages) {
    if (!rawPage || typeof rawPage !== "object" || Array.isArray(rawPage)) throw new PageMediaValidationError("Each page must be an object.");
    const page = rawPage as Record<string, unknown>;
    const pageId = validatePageId(requiredString(page.id, "page.id", MAX_PAGE_ID_LENGTH));
    const sources: unknown[] = [];
    if (page.media !== undefined) sources.push(page.media);
    const draft = page.draft;
    if (draft !== undefined) {
      if (!draft || typeof draft !== "object" || Array.isArray(draft)) throw new PageMediaValidationError("page.draft must be an object.");
      const draftMedia = (draft as Record<string, unknown>).media;
      if (draftMedia !== undefined) sources.push(draftMedia);
    }
    for (const source of sources) {
      if (!Array.isArray(source)) throw new PageMediaValidationError("page media must be an array.");
      for (const rawMedia of source) {
        if (!rawMedia || typeof rawMedia !== "object" || Array.isArray(rawMedia)) throw new PageMediaValidationError("Each page media item must be an object.");
        const media = rawMedia as Record<string, unknown>;
        const id = requiredString(media.id, "media.id", 64);
        const next = {
          id,
          pageId,
          name: normalizeMetadata(media.name ?? media.displayName, "media.name", MAX_NAME_LENGTH, "media"),
          folder: normalizeMetadata(media.folder, "media.folder", MAX_FOLDER_LENGTH),
          description: normalizeMetadata(media.description, "media.description", MAX_DESCRIPTION_LENGTH),
        };
        const previous = metadataById.get(id);
        if (previous && previous.pageId !== pageId) throw new PageMediaValidationError(`Media id "${id}" is attached to multiple pages.`);
        // Draft metadata is encountered after root metadata and intentionally wins.
        metadataById.set(id, next);
      }
    }
  }
  return Array.from(metadataById.values());
}

/**
 * Syncs only mutable display metadata inside the parent's existing DB transaction.
 * It never deletes rows or storage objects, and rejects cross-page or unknown IDs.
 */
export async function syncPageMediaMetadata(tx: any, pages: unknown): Promise<void> {
  const metadata = collectPageMediaMetadata(pages);
  if (!metadata.length) return;
  const ids = metadata.map((item) => item.id);
  const rows = await tx.select().from(pageMediaFiles).where(inArray(pageMediaFiles.id, ids));
  const rowsById = new Map<string, typeof pageMediaFiles.$inferSelect>(rows.map((row: typeof pageMediaFiles.$inferSelect) => [row.id, row]));
  for (const item of metadata) {
    const row = rowsById.get(item.id);
    if (!row) throw new PageMediaValidationError(`Media id "${item.id}" does not exist.`);
    if (row.pageId !== item.pageId) throw new PageMediaValidationError(`Media id "${item.id}" does not belong to page "${item.pageId}".`);
  }
  for (const item of metadata) {
    await tx.update(pageMediaFiles).set({ name: item.name, folder: item.folder, description: item.description }).where(and(eq(pageMediaFiles.id, item.id), eq(pageMediaFiles.pageId, item.pageId)));
  }
}

async function findMedia(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const db = await requireDb();
  const rows = await db.select().from(pageMediaFiles).where(eq(pageMediaFiles.id, id)).limit(1);
  return rows[0];
}

function setContentHeaders(res: Response, row: typeof pageMediaFiles.$inferSelect, download: boolean): void {
  const downloadName = row.name.includes(".") ? row.name : `${row.name}.${row.originalName.split(".").pop() || "bin"}`;
  const { fallback, encoded } = sanitizeHeaderFileName(downloadName, row.originalName.split(".").pop()?.toLowerCase() || "bin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", row.mimeType);
  res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encoded}`);
  res.setHeader("Cache-Control", "public, max-age=60");
}

async function streamStoredMedia(req: Request, res: Response, row: typeof pageMediaFiles.$inferSelect, download: boolean): Promise<void> {
  setContentHeaders(res, row, download || !canPreviewMedia(row.mimeType));
  const signedUrl = await storageGetSignedUrl(row.key);
  const upstream = await fetch(signedUrl, req.headers.range ? { headers: { Range: req.headers.range } } : undefined);
  res.status(upstream.status);
  for (const header of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(header);
    if (value) res.setHeader(header, value);
  }
  if (!upstream.ok && upstream.status !== 206) {
    res.end();
    return;
  }
  if (!upstream.body) {
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(upstream.body as unknown as NodeReadableStream), res);
}

function sendRouteError(res: Response, error: unknown): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (error instanceof PageMediaAuthorizationError) {
    res.status(403).json({ error: "Owner authorization required" });
    return;
  }
  if (error instanceof PageMediaValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof Error && error.message === "Database unavailable") {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }
  console.error("[PageMedia] request failed", error);
  res.status(500).json({ error: "Media request failed" });
}

const pageMediaRouter = express.Router();

pageMediaRouter.get("/:id/download", async (req, res) => {
  try {
    const row = await findMedia(req.params.id);
    if (!row) {
      res.status(404).json({ error: "Media not found" });
      return;
    }
    await streamStoredMedia(req, res, row, true);
  } catch (error) {
    sendRouteError(res, error);
  }
});

pageMediaRouter.get("/:id", async (req, res) => {
  try {
    const row = await findMedia(req.params.id);
    if (!row) {
      res.status(404).json({ error: "Media not found" });
      return;
    }
    await streamStoredMedia(req, res, row, false);
  } catch (error) {
    sendRouteError(res, error);
  }
});

export { pageMediaRouter };
