import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { ownerProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { cleanupDeletedSharedTemplates, createFreeSite, createSharedTemplate, deleteFreeSite, deleteSharedTemplate, getTemplateRetentionDays, listAllFreeSites, listDeletedSharedTemplates, listSharedTemplates, listVisibleFreeSites, purgeSharedTemplate, restoreSharedTemplate, setTemplateRetentionDays, updateFreeSite, updateSharedTemplate, listApprovedCreativeSubmissions, listAllCreativeSubmissions, createCreativeSubmission, updateCreativeSubmission, deleteCreativeSubmission, getSiteContent, saveSiteContent, listCreativeCategories, createCreativeCategory, updateCreativeCategory, deleteCreativeCategory } from "./db";
import { storagePut } from "./storage";

const toolSchema = z.enum(["Gemini", "Chat GBT"]);
const templateInput = z.object({
  tool: toolSchema,
  text: z.string().max(10000),
  mediaType: z.enum(["image", "video"]).default("image"),
  mediaData: z.string().min(1).optional(),
  imageData: z.string().min(1).optional(),
  imageName: z.string().max(255).default("design-media"),
  ownerPassword: z.string().min(1).max(128),
}).refine((input) => Boolean(input.mediaData || input.imageData), { message: "Media data is required" });

function verifyTemplatePassword(password: string) {
  if (password !== ENV.templatePassword) {
    throw new TRPCError({ code: "FORBIDDEN", message: "كلمة مرور القوالب غير صحيحة." });
  }
}

function decodeDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid media data");
  return { contentType: match[1] || "application/octet-stream", buffer: Buffer.from(match[2] || "", "base64") };
}

function siteFileName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "free-site";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  templates: router({
    list: publicProcedure.input(z.object({ tool: toolSchema })).query(({ input }) => listSharedTemplates(input.tool)),
    create: publicProcedure.input(templateInput).mutation(async ({ input, ctx }) => {
      verifyTemplatePassword(input.ownerPassword);
      const decoded = decodeDataUrl(input.mediaData || input.imageData || "");
      const uploaded = await storagePut(`shared-templates/${input.tool.toLowerCase().replace(/\s+/g, "-")}/${input.imageName}`, decoded.buffer, decoded.contentType);
      return createSharedTemplate({ tool: input.tool, text: input.text, imageUrl: uploaded.url, imageKey: uploaded.key, imageName: input.imageName, mediaType: input.mediaType, createdByOpenId: ctx.user?.openId || "password-owner" });
    }),
    update: publicProcedure.input(z.object({ id: z.number(), text: z.string().max(10000).optional(), mediaType: z.enum(["image", "video"]).optional(), mediaData: z.string().optional(), imageData: z.string().optional(), imageName: z.string().max(255).optional(), ownerPassword: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
      verifyTemplatePassword(input.ownerPassword);
      const update: Record<string, unknown> = {};
      if (input.text !== undefined) update.text = input.text;
      if (input.imageName !== undefined) update.imageName = input.imageName;
      if (input.mediaType !== undefined) update.mediaType = input.mediaType;
      if (input.mediaData || input.imageData) {
        const decoded = decodeDataUrl(input.mediaData || input.imageData || "");
        const uploaded = await storagePut(`shared-templates/updates/${input.imageName || "design-image"}`, decoded.buffer, decoded.contentType);
        update.imageUrl = uploaded.url;
        update.imageKey = uploaded.key;
      }
      update.createdByOpenId = ctx.user?.openId || "password-owner";
      return updateSharedTemplate(input.id, update);
    }),
    remove: publicProcedure.input(z.object({ id: z.number(), ownerPassword: z.string().min(1).max(128) })).mutation(({ input }) => { verifyTemplatePassword(input.ownerPassword); return deleteSharedTemplate(input.id); }),
    recycleBin: ownerProcedure.query(() => listDeletedSharedTemplates()),
    restore: ownerProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => restoreSharedTemplate(input.id)),
    purge: ownerProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => purgeSharedTemplate(input.id)),
    cleanup: ownerProcedure.input(z.object({ retentionDays: z.number().int().min(30).max(365).default(30) })).mutation(({ input }) => cleanupDeletedSharedTemplates(input.retentionDays)),
    retentionDays: ownerProcedure.query(() => getTemplateRetentionDays()),
    setRetentionDays: ownerProcedure.input(z.object({ retentionDays: z.number().int().min(30).max(365) })).mutation(({ input }) => setTemplateRetentionDays(input.retentionDays)),
  }),
  siteContent: router({
    get: publicProcedure.query(async () => {
      const raw = await getSiteContent();
      if (!raw) return null;
      try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
    }),
    save: publicProcedure.input(z.object({ ownerPin: z.string().min(4).max(32), content: z.record(z.string(), z.unknown()) })).mutation(({ input }) => {
      if (input.ownerPin !== ENV.ownerPin) throw new TRPCError({ code: "FORBIDDEN", message: "كلمة مرور المالك غير صحيحة." });
      return saveSiteContent(JSON.stringify(input.content));
    }),
  }),
  creativeCategories: router({
    list: publicProcedure.query(() => listCreativeCategories(false)),
    adminList: ownerProcedure.query(() => listCreativeCategories(true)),
    create: ownerProcedure.input(z.object({ name: z.string().trim().min(1).max(120), slug: z.string().trim().min(1).max(120), sortOrder: z.number().int().min(0).default(0), isVisible: z.boolean().default(true) })).mutation(({ input }) => createCreativeCategory({ ...input, isVisible: input.isVisible ? 1 : 0 })),
    update: ownerProcedure.input(z.object({ id: z.number(), name: z.string().trim().min(1).max(120).optional(), slug: z.string().trim().min(1).max(120).optional(), sortOrder: z.number().int().min(0).optional(), isVisible: z.boolean().optional() })).mutation(({ input }) => { const { id, isVisible, ...rest } = input; return updateCreativeCategory(id, { ...rest, ...(isVisible === undefined ? {} : { isVisible: isVisible ? 1 : 0 }) }); }),
    remove: ownerProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteCreativeCategory(input.id)),
  }),
  creativeSpace: router({
    list: publicProcedure.query(() => listApprovedCreativeSubmissions()),
    adminList: ownerProcedure.query(() => listAllCreativeSubmissions()),
    create: publicProcedure.input(z.object({
      projectName: z.string().trim().min(1).max(255),
      description: z.string().trim().min(1).max(5000),
      category: z.string().trim().min(1).max(120).default("other"),
      link: z.string().trim().max(2000).optional(),
      contact: z.string().trim().max(500).optional(),
      imageData: z.array(z.string().min(1)).max(4).default([]),
    })).mutation(async ({ input }) => {
      const urls: string[] = [];
      const keys: string[] = [];
      for (let index = 0; index < input.imageData.length; index += 1) {
        const data = input.imageData[index];
        const decoded = decodeDataUrl(data);
        const uploaded = await storagePut(`creative-space/${Date.now()}-${index}-${siteFileName(input.projectName)}`, decoded.buffer, decoded.contentType);
        urls.push(uploaded.url); keys.push(uploaded.key);
      }
      return createCreativeSubmission({ projectName: input.projectName, description: input.description, category: input.category, link: input.link || null, contact: input.contact || null, imageUrls: JSON.stringify(urls), imageKeys: JSON.stringify(keys), status: "pending", isVisible: 0, sortOrder: 0 });
    }),
    update: ownerProcedure.input(z.object({
      id: z.number(), projectName: z.string().trim().min(1).max(255).optional(), description: z.string().trim().min(1).max(5000).optional(), category: z.string().trim().min(1).max(120).optional(), link: z.string().trim().max(2000).optional(), contact: z.string().trim().max(500).optional(), status: z.enum(["pending", "approved", "rejected"]).optional(), isVisible: z.boolean().optional(), sortOrder: z.number().int().min(0).optional(),
    })).mutation(({ input }) => { const { id, isVisible, ...rest } = input; return updateCreativeSubmission(id, { ...rest, ...(isVisible === undefined ? {} : { isVisible: isVisible ? 1 : 0 }), link: rest.link || null, contact: rest.contact || null }); }),
    setVisibility: ownerProcedure.input(z.object({ id: z.number(), isVisible: z.boolean() })).mutation(({ input }) => updateCreativeSubmission(input.id, { isVisible: input.isVisible ? 1 : 0, status: input.isVisible ? "approved" : "pending" })),
    remove: ownerProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteCreativeSubmission(input.id)),
    reorder: ownerProcedure.input(z.object({ ids: z.array(z.number()).max(200) })).mutation(async ({ input }) => { await Promise.all(input.ids.map((id, index) => updateCreativeSubmission(id, { sortOrder: index }))); return listAllCreativeSubmissions(); }),
  }),
  freeSites: router({
    list: publicProcedure.query(() => listVisibleFreeSites()),
    adminList: ownerProcedure.query(() => listAllFreeSites()),
    create: ownerProcedure.input(z.object({
      name: z.string().trim().min(1).max(255),
      url: z.string().trim().max(2000).optional(),
      description: z.string().max(5000).optional(),
      additionalText: z.string().max(10000).optional(),
      imageData: z.string().min(1).optional(),
      imageName: z.string().max(255).optional(),
      sortOrder: z.number().int().min(0).default(0),
      isVisible: z.boolean().default(true),
    })).mutation(async ({ input, ctx }) => {
      let imageUrl: string | null = null;
      let imageKey: string | null = null;
      if (input.imageData) {
        const decoded = decodeDataUrl(input.imageData);
        const uploaded = await storagePut(`free-sites/${Date.now()}-${siteFileName(input.imageName || input.name)}`, decoded.buffer, decoded.contentType);
        imageUrl = uploaded.url;
        imageKey = uploaded.key;
      }
      return createFreeSite({ name: input.name, url: input.url || null, description: input.description || null, additionalText: input.additionalText || null, imageUrl, imageKey, sortOrder: input.sortOrder, isVisible: input.isVisible ? 1 : 0, createdByOpenId: ctx.user.openId });
    }),
    update: ownerProcedure.input(z.object({
      id: z.number(),
      name: z.string().trim().min(1).max(255).optional(),
      url: z.string().trim().max(2000).optional(),
      description: z.string().max(5000).optional(),
      additionalText: z.string().max(10000).optional(),
      imageData: z.string().min(1).optional(),
      imageName: z.string().max(255).optional(),
      clearImage: z.boolean().optional(),
      sortOrder: z.number().int().min(0).optional(),
    })).mutation(async ({ input }) => {
      const update: Record<string, unknown> = {};
      for (const key of ["name", "url", "description", "additionalText", "sortOrder"] as const) {
        if (input[key] !== undefined) update[key] = input[key] || null;
      }
      if (input.clearImage) { update.imageUrl = null; update.imageKey = null; }
      if (input.imageData) {
        const decoded = decodeDataUrl(input.imageData);
        const uploaded = await storagePut(`free-sites/updates/${Date.now()}-${siteFileName(input.imageName || "free-site")}`, decoded.buffer, decoded.contentType);
        update.imageUrl = uploaded.url;
        update.imageKey = uploaded.key;
      }
      return updateFreeSite(input.id, update);
    }),
    setVisibility: ownerProcedure.input(z.object({ id: z.number(), isVisible: z.boolean() })).mutation(({ input }) => updateFreeSite(input.id, { isVisible: input.isVisible ? 1 : 0 })),
    remove: ownerProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteFreeSite(input.id)),
    reorder: ownerProcedure.input(z.object({ ids: z.array(z.number()).max(200) })).mutation(async ({ input }) => {
      await Promise.all(input.ids.map((id, index) => updateFreeSite(id, { sortOrder: index })));
      return listAllFreeSites();
    }),
  }),
});

export type AppRouter = typeof appRouter;
