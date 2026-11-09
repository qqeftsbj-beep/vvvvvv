import { desc, eq, inArray } from "drizzle-orm";
import { siteContentVersions, siteSettings } from "../drizzle/schema";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { syncPageMediaMetadata } from "./pageMedia";

// History is permanent unless the owner explicitly deletes a targeted backup.
const MAX_HISTORY = Number.MAX_SAFE_INTEGER;
const PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INTERNAL_URL_PATTERN = /^\/(?!\/)[^<>"']*$/;
const HTTPS_URL_PATTERN = /^https:\/\/[^\s<>"']+$/i;
const DATA_IMAGE_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]+=*)$/i;

type JsonRecord = Record<string, unknown>;

export class SiteContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteContentValidationError";
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item)]));
  return value;
}

function assertSafePageUrl(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return;
  if (typeof value !== "string") throw new SiteContentValidationError(`${label} must be a safe URL.`);
  const url = value.trim();
  if (!INTERNAL_URL_PATTERN.test(url) && !HTTPS_URL_PATTERN.test(url)) {
    throw new SiteContentValidationError(`${label} must use an internal path or HTTPS URL.`);
  }
}

function assertPageSlugs(pages: unknown[]) {
  const seen = new Set<string>();
  pages.forEach((page, index) => {
    if (!isRecord(page)) throw new SiteContentValidationError(`Page ${index + 1} must be an object.`);
    const slug = typeof page.slug === "string" ? page.slug.trim() : "";
    if (!slug) throw new SiteContentValidationError(`Page ${index + 1} must have a non-empty slug.`);
    if (slug.length > 80 || !PAGE_SLUG_PATTERN.test(slug)) {
      throw new SiteContentValidationError(`Page ${index + 1} slug must contain only lowercase ASCII letters, numbers, and single hyphens.`);
    }
    const key = slug.toLowerCase();
    if (seen.has(key)) throw new SiteContentValidationError(`Page slug "${slug}" is duplicated.`);
    seen.add(key);
    const blocks = page.blocks;
    if (Array.isArray(blocks)) {
      blocks.forEach((block, blockIndex) => {
        if (isRecord(block)) assertSafePageUrl(block.url, `Page ${index + 1} block ${blockIndex + 1} URL`);
      });
    }
  });
}

function assertKnownUrls(content: JsonRecord) {
  if (Array.isArray(content.buttons)) {
    content.buttons.forEach((button, index) => {
      if (isRecord(button)) assertSafePageUrl(button.url, `Button ${index + 1} URL`);
    });
  }
  if (Array.isArray(content.pages)) assertPageSlugs(content.pages);
}

function dataUrlToBytes(value: string, label: string) {
  const match = value.match(DATA_IMAGE_PATTERN);
  if (!match) throw new SiteContentValidationError(`${label} must be a base64 image data URL.`);
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new SiteContentValidationError(`${label} cannot be empty.`);
  return { contentType: match[1], buffer };
}

function storageName(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 48) : "";
  return normalized || fallback;
}

async function uploadImage(value: unknown, path: string, label: string): Promise<unknown> {
  if (typeof value !== "string" || !value.startsWith("data:")) return value;
  const decoded = dataUrlToBytes(value, label);
  const uploaded = await storagePut(`site-content/${path}-${Date.now()}-${crypto.randomUUID()}`, decoded.buffer, decoded.contentType);
  return uploaded.url;
}

async function uploadKnownImages(content: JsonRecord): Promise<JsonRecord> {
  const next = cloneJson(content) as JsonRecord;
  next.heroImage = await uploadImage(next.heroImage, `hero-${storageName(next.heroImage, "image")}`, "heroImage");
  if (isRecord(next.settings)) {
    next.settings.backgroundImage = await uploadImage(next.settings.backgroundImage, `settings-background-${storageName(next.settings.backgroundImage, "image")}`, "settings.backgroundImage");
  }
  if (Array.isArray(next.services)) {
    for (let index = 0; index < next.services.length; index += 1) {
      const service = next.services[index];
      if (isRecord(service)) service.image = await uploadImage(service.image, `service-${index}-${storageName(service.image, "image")}`, `services[${index}].image`);
    }
  }
  if (Array.isArray(next.products)) {
    for (let index = 0; index < next.products.length; index += 1) {
      const product = next.products[index];
      if (isRecord(product)) product.image = await uploadImage(product.image, `product-${index}-${storageName(product.image, "image")}`, `products[${index}].image`);
    }
  }
  if (Array.isArray(next.pages)) {
    for (let pageIndex = 0; pageIndex < next.pages.length; pageIndex += 1) {
      const page = next.pages[pageIndex];
      if (!isRecord(page)) continue;
      if (isRecord(page.draft)) {
        const nested = await uploadKnownImages({ pages: [page.draft] });
        page.draft = (nested.pages as unknown[])[0];
      }
      if (isRecord(page.appearance)) page.appearance.backgroundImage = await uploadImage(page.appearance.backgroundImage, `page-${pageIndex}-background-${storageName(page.appearance.backgroundImage, "image")}`, `pages[${pageIndex}].appearance.backgroundImage`);
      if (Array.isArray(page.blocks)) {
        for (let blockIndex = 0; blockIndex < page.blocks.length; blockIndex += 1) {
          const block = page.blocks[blockIndex];
          if (isRecord(block)) block.image = await uploadImage(block.image, `page-${pageIndex}-block-${blockIndex}-${storageName(block.image, "image")}`, `pages[${pageIndex}].blocks[${blockIndex}].image`);
        }
      }
    }
  }
  return next;
}

export async function normalizeAndUploadSiteContent(content: JsonRecord): Promise<JsonRecord> {
  const cloned = cloneJson(content);
  if (!isRecord(cloned)) throw new SiteContentValidationError("Site content must be an object.");
  assertKnownUrls(cloned);
  return uploadKnownImages(cloned);
}

function parseContent(contentJson: string): JsonRecord {
  try {
    const parsed = JSON.parse(contentJson);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function pruneHistory(tx: any) {
  // Kept as a no-op for callers compiled against the older helper. Never prune
  // history automatically; deletion is now an explicit targeted API action.
  void tx;
}

export async function saveSiteContentReliable(content: JsonRecord) {
  const normalized = await normalizeAndUploadSiteContent(content);
  const serialized = JSON.stringify(normalized);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  let readback: string | undefined;
  await db.transaction(async (tx) => {
    if (Array.isArray(normalized.pages)) await syncPageMediaMetadata(tx, normalized.pages);
    const current = await tx.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
    if (current[0]?.contentJson) await tx.insert(siteContentVersions).values({ contentJson: current[0].contentJson });
    await tx.insert(siteSettings).values({ id: 1, contentJson: serialized }).onDuplicateKeyUpdate({ set: { contentJson: serialized } });
    const confirmed = await tx.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
    readback = confirmed[0]?.contentJson;
    if (readback !== serialized) throw new Error("Site content readback failed");
    await pruneHistory(tx);
  });
  return { success: true as const, content: parseContent(readback || serialized) };
}

export async function backupSiteContent() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const current = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  if (!current[0]?.contentJson) throw new Error("No site content to back up");
  const result = await db.insert(siteContentVersions).values({ contentJson: current[0].contentJson });
  const id = Number(result[0].insertId);
  await pruneHistory(db);
  const rows = await db.select({ id: siteContentVersions.id, createdAt: siteContentVersions.createdAt }).from(siteContentVersions).where(eq(siteContentVersions.id, id)).limit(1);
  return rows[0] || { id, createdAt: new Date() };
}

export async function listSiteContentHistory() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(siteContentVersions).orderBy(desc(siteContentVersions.createdAt), desc(siteContentVersions.id));
  return rows.map((row: any) => ({ id: row.id, createdAt: row.createdAt, size: Buffer.byteLength(row.contentJson, "utf8"), type: "legacy" }));
}

export async function readSiteContentVersion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(siteContentVersions).where(eq(siteContentVersions.id, id)).limit(1);
  return rows[0] ? parseContent(rows[0].contentJson) : null;
}
