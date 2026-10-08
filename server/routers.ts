import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { ownerProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { cleanupDeletedSharedTemplates, createSharedTemplate, deleteSharedTemplate, getTemplateRetentionDays, listDeletedSharedTemplates, listSharedTemplates, purgeSharedTemplate, restoreSharedTemplate, setTemplateRetentionDays, updateSharedTemplate } from "./db";
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
});

export type AppRouter = typeof appRouter;
