import { buildPublicationChanges } from "./workspacePublicationSummary";
import { z } from "zod";
import type { PageMedia } from "@shared/pageMedia";
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { ownerProcedure, publicProcedure, router } from "./_core/trpc";
import { ownerNotificationsRouter } from "./ownerNotifications";
import { customerInboxRouter } from "./customerInbox";
import { ENV } from "./_core/env";
import {
  cleanupDeletedSharedTemplates,
  createFreeSite,
  deleteFreeSite,
  getTemplateRetentionDays,
  listAllFreeSites,
  listDeletedSharedTemplates,
  listSharedTemplates,
  listVisibleFreeSites,
  purgeSharedTemplate,
  restoreSharedTemplate,
  setTemplateRetentionDays,
  updateFreeSite,
  createCreativeSubmission,
  getSiteContent,
  saveSiteContent,
  listCreativeCategories,
  searchOwnerContent,
  listTemplateCategories,
} from "./db";
import {
  getPublicTemplate,
  pageCreativeSubmissions,
  pageFreeSites,
  pageTemplates,
} from "./db";
import { storagePut } from "./storage";
import {
  uploadPageMedia,
  listPageMedia,
  verifyPageMediaOwnerPin,
} from "./pageMedia";
import {
  clearOwnerWorkingDraft,
  readOwnerWorkingDraft,
  saveOwnerWorkingDraft,
  publicSiteContent,
} from "./ownerDraftPersistence";
import {
  backupSiteContent,
  listSiteContentHistory,
  readSiteContentVersion,
  saveSiteContentReliable,
} from "./siteContentPersistence";
import {
  backupWorkspace,
  createWorkingEntity,
  deleteVersion,
  getPublishedPage,
  getPublishedSnapshot,
  getWorkingSnapshot,
  getWorkingState,
  listHistory,
  listPublishedCollection,
  listTrash,
  listWorkingCollection,
  publishWorkspace,
  purgeTrash,
  readVersion,
  removeWorkingEntity,
  restoreTrash,
  restoreVersion,
  savePrivateSiteContent,
  updateWorkingEntity,
  materializePublishedSnapshot,
  reorderWorkingEntities,
} from "./managementWorkspace";
import {
  createSharedItem,
  getSharedContentRevision,
  getSharedNavigation,
  listSharedItems,
  pageAdminSharedItems,
  removeSharedItem,
  reorderSharedItems,
  updateSharedItem,
} from "./sharedContent";

const toolSchema = z.enum(["Gemini", "Chat GBT"]);
const pageMediaInput = z.object({
  id: z.string().uuid(),
  pageId: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  folder: z.string().max(160),
  description: z.string().max(5000),
  mimeType: z.string().min(1).max(255),
  size: z
    .number()
    .finite()
    .min(0)
    .max(25 * 1024 * 1024),
  url: z.string().min(1).max(2000),
  downloadUrl: z.string().min(1).max(2000),
  previewUrl: z.string().max(2000).optional(),
  key: z.string().min(1).max(2000),
  createdAt: z.number().finite(),
});
const attachmentListInput = z.array(pageMediaInput).max(12);
const sharedFields: Record<string, string[]> = {
  templates: [
    "tool",
    "category",
    "text",
    "mediaType",
    "imageUrl",
    "imageKey",
    "imageName",
    "createdByOpenId",
    "sortOrder",
    "isVisible",
    "previewUrl",
    "attachments",
  ],
  freeSites: [
    "name",
    "url",
    "description",
    "additionalText",
    "imageUrl",
    "imageKey",
    "attachments",
    "previewUrl",
    "sortOrder",
    "isVisible",
    "createdByOpenId",
  ],
  submissions: [
    "projectName",
    "description",
    "category",
    "link",
    "contact",
    "imageUrls",
    "imageKeys",
    "status",
    "reviewState",
    "isVisible",
    "sortOrder",
    "attachments",
    "previewUrl",
  ],
  templateCategories: ["tool", "name", "slug", "sortOrder", "isVisible"],
  creativeCategories: ["name", "slug", "sortOrder", "isVisible"],
};
function sanitizeSharedFields(kind: string, value: Record<string, unknown>) {
  const allowed = sharedFields[kind] || [];
  const safe: Record<string, unknown> = {};
  for (const key of allowed) {
    if (value[key] === undefined) continue;
    if (key === "attachments")
      safe.attachments = attachmentListInput.parse(value[key]) as PageMedia[];
    else safe[key] = value[key];
  }
  if (safe.isVisible !== undefined)
    safe.isVisible =
      safe.isVisible === true
        ? 1
        : safe.isVisible === false
          ? 0
          : Number(safe.isVisible) === 1
            ? 1
            : 0;
  return safe;
}
async function storeFreeSiteImage(
  imageData: unknown,
  imageName: unknown,
  fallbackName: string
) {
  if (typeof imageData !== "string" || !imageData) return {};
  const decoded = decodeDataUrl(imageData);
  const uploaded = await storagePut(
    `free-sites/${crypto.randomUUID()}-${siteFileName(typeof imageName === "string" ? imageName : fallbackName)}`,
    decoded.buffer,
    decoded.contentType
  );
  return { imageUrl: uploaded.url, imageKey: uploaded.key };
}
const templateInput = z
  .object({
    tool: toolSchema,
    category: z.string().max(160).default("other"),
    text: z.string().max(10000),
    mediaType: z.enum(["image", "video"]).default("image"),
    mediaData: z.string().min(1).optional(),
    imageData: z.string().min(1).optional(),
    imageName: z.string().max(255).default("design-media"),
    ownerPassword: z.string().min(1).max(128),
  })
  .refine(input => Boolean(input.mediaData || input.imageData), {
    message: "Media data is required",
  });

function verifyTemplatePassword(password: string) {
  if (password !== ENV.templatePassword) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "كلمة مرور القوالب غير صحيحة.",
    });
  }
}

function decodeDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid media data");
  return {
    contentType: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[2] || "", "base64"),
  };
}

function siteFileName(name: string) {
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .slice(0, 80) || "free-site"
  );
}

export const appRouter = router({
  system: systemRouter,
  sharedContent: router({
    revision: publicProcedure.query(() => getSharedContentRevision()),
    adminPage: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          kind: z.enum(["freeSites", "submissions", "templates"]),
          tool: toolSchema.optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(40).default(12),
          category: z.string().max(160).optional(),
          status: z.string().max(32).optional(),
          reviewState: z.string().max(32).optional(),
          search: z.string().max(100).optional(),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return pageAdminSharedItems(input.kind, input);
      }),
  }),
  management: router({
    state: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32) }))
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return getWorkingState(false);
      }),
    save: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          content: z.record(z.string(), z.unknown()),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return savePrivateSiteContent(input.content);
      }),
    summary: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32) }))
      .mutation(async ({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        const state = await getWorkingState(false);
        const published = await getPublishedSnapshot(false);
        const changes = buildPublicationChanges(
          published,
          materializePublishedSnapshot({
            content: state.content,
            collections: state.collections,
          })
        );
        return {
          revision: state.revision,
          hasChanges: changes.length > 0,
          changes,
        };
      }),
    publish: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          revision: z.number().int().positive(),
          confirm: z.literal(true),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return publishWorkspace(input.revision, input.confirm);
      }),
    trash: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32) }))
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return listTrash();
      }),
    restoreTrash: publicProcedure
      .input(
        z.object({ ownerPin: z.string().min(4).max(32), id: z.string().min(1) })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return restoreTrash(input.id);
      }),
    purgeTrash: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          id: z.string().min(1),
          confirm: z.literal(true),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return purgeTrash(input.id, input.confirm);
      }),
    history: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32) }))
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return listHistory();
      }),
    backup: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32) }))
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return backupWorkspace();
      }),
    version: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          id: z.union([z.string(), z.number()]),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return readVersion(input.id);
      }),
    restoreVersion: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          id: z.union([z.string(), z.number()]),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return restoreVersion(input.id);
      }),
    deleteVersion: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          id: z.union([z.string(), z.number()]),
          confirm: z.literal(true),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return deleteVersion(input.id, input.confirm);
      }),
    workingEntityCreate: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          kind: z.enum([
            "templates",
            "freeSites",
            "submissions",
            "templateCategories",
            "creativeCategories",
          ]),
          value: z.record(z.string(), z.unknown()),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return createWorkingEntity(input.kind, input.value);
      }),
    workingEntityUpdate: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          kind: z.enum([
            "templates",
            "freeSites",
            "submissions",
            "templateCategories",
            "creativeCategories",
          ]),
          id: z.number(),
          patch: z.record(z.string(), z.unknown()),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return updateWorkingEntity(input.kind, input.id, input.patch);
      }),
    workingEntityRemove: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          kind: z.enum([
            "templates",
            "freeSites",
            "submissions",
            "templateCategories",
            "creativeCategories",
          ]),
          id: z.number(),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return removeWorkingEntity(input.kind, input.id);
      }),
  }),
  pageMedia: router({
    upload: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          pageId: z.string().min(1).max(128),
          name: z.string().min(1).max(255),
          folder: z.string().max(160).default(""),
          description: z.string().max(5000).default(""),
          fileName: z.string().min(1).max(255),
          mimeType: z.string().max(255),
          data: z.string().max(36_000_000),
          replacementId: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        try {
          verifyPageMediaOwnerPin(input.ownerPin);
        } catch {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        }
        return uploadPageMedia(input);
      }),
    list: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          pageId: z.string().min(1).max(128),
        })
      )
      .mutation(({ input }) => {
        try {
          verifyPageMediaOwnerPin(input.ownerPin);
        } catch {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        }
        return listPageMedia(input.ownerPin, input.pageId);
      }),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  templates: router({
    list: publicProcedure
      .input(
        z.object({ tool: toolSchema, category: z.string().max(160).optional() })
      )
      .query(({ input }) => listSharedTemplates(input.tool, input.category)),
    page: publicProcedure
      .input(
        z.object({
          tool: toolSchema,
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(40).default(12),
          category: z.string().max(160).optional(),
          search: z.string().max(100).optional(),
          sort: z.enum(["newest", "oldest", "order"]).optional(),
        })
      )
      .query(({ input }) => pageTemplates(input.tool, input)),
    byId: publicProcedure
      .input(z.object({ id: z.number().int().positive(), tool: toolSchema }))
      .query(({ input }) => getPublicTemplate(input.id, input.tool)),
    adminList: publicProcedure
      .input(
        z.object({
          tool: toolSchema,
          ownerPassword: z.string().min(1).max(128),
        })
      )
      .mutation(async ({ input }) => {
        verifyTemplatePassword(input.ownerPassword);
        const rows = await listSharedItems("templates", false);
        return rows.filter(
          (row: any) => row.tool === input.tool && !row.deletedAt
        );
      }),
    create: publicProcedure
      .input(templateInput)
      .mutation(async ({ input, ctx }) => {
        verifyTemplatePassword(input.ownerPassword);
        const decoded = decodeDataUrl(input.mediaData || input.imageData || "");
        const uploaded = await storagePut(
          `shared-templates/${input.tool.toLowerCase().replace(/\s+/g, "-")}/${Date.now()}-${crypto.randomUUID()}-${siteFileName(input.imageName)}`,
          decoded.buffer,
          decoded.contentType
        );
        return createSharedItem("templates", {
          tool: input.tool,
          category: input.category,
          text: input.text,
          imageUrl: uploaded.url,
          imageKey: uploaded.key,
          imageName: input.imageName,
          mediaType: input.mediaType,
          createdByOpenId: ctx.user?.openId || "password-owner",
        });
      }),
    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          category: z.string().max(160).optional(),
          text: z.string().max(10000).optional(),
          mediaType: z.enum(["image", "video"]).optional(),
          mediaData: z.string().optional(),
          imageData: z.string().optional(),
          imageName: z.string().max(255).optional(),
          ownerPassword: z.string().min(1).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        verifyTemplatePassword(input.ownerPassword);
        const update: Record<string, unknown> = {};
        if (input.category !== undefined) update.category = input.category;
        if (input.text !== undefined) update.text = input.text;
        if (input.imageName !== undefined) update.imageName = input.imageName;
        if (input.mediaType !== undefined) update.mediaType = input.mediaType;
        if (input.mediaData || input.imageData) {
          const decoded = decodeDataUrl(
            input.mediaData || input.imageData || ""
          );
          const uploaded = await storagePut(
            `shared-templates/updates/${Date.now()}-${crypto.randomUUID()}-${siteFileName(input.imageName || "design-image")}`,
            decoded.buffer,
            decoded.contentType
          );
          update.imageUrl = uploaded.url;
          update.imageKey = uploaded.key;
        }
        update.createdByOpenId = ctx.user?.openId || "password-owner";
        return updateSharedItem("templates", input.id, update);
      }),
    remove: publicProcedure
      .input(
        z.object({ id: z.number(), ownerPassword: z.string().min(1).max(128) })
      )
      .mutation(({ input }) => {
        verifyTemplatePassword(input.ownerPassword);
        return removeSharedItem("templates", input.id);
      }),
    recycleBin: ownerProcedure.query(() => listDeletedSharedTemplates()),
    restore: ownerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => restoreSharedTemplate(input.id)),
    purge: ownerProcedure
      .input(z.object({ id: z.number(), confirm: z.literal(true) }))
      .mutation(({ input }) => purgeSharedTemplate(input.id, input.confirm)),
    cleanup: ownerProcedure
      .input(
        z.object({
          retentionDays: z.number().int().min(30).max(365).default(30),
        })
      )
      .mutation(({ input }) =>
        cleanupDeletedSharedTemplates(input.retentionDays)
      ),
    retentionDays: ownerProcedure.query(() => getTemplateRetentionDays()),
    setRetentionDays: ownerProcedure
      .input(z.object({ retentionDays: z.number().int().min(30).max(365) }))
      .mutation(({ input }) => setTemplateRetentionDays(input.retentionDays)),
  }),
  templateCategories: router({
    list: publicProcedure
      .input(z.object({ tool: toolSchema }))
      .query(async ({ input }) => {
        const rows = await listSharedItems("templateCategories", true);
        return rows.filter(
          (row: any) => row.tool === input.tool && row.isVisible === 1
        );
      }),
    adminList: ownerProcedure
      .input(z.object({ tool: toolSchema }))
      .query(async ({ input }) => {
        const rows = await listSharedItems("templateCategories", false);
        return rows.filter((row: any) => row.tool === input.tool);
      }),
    adminWithPassword: publicProcedure
      .input(
        z.object({
          tool: toolSchema,
          ownerPassword: z.string().min(1).max(128),
        })
      )
      .mutation(async ({ input }) => {
        verifyTemplatePassword(input.ownerPassword);
        const rows = await listSharedItems("templateCategories", false);
        return rows.filter((row: any) => row.tool === input.tool);
      }),
    createWithPin: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          tool: toolSchema,
          name: z.string().trim().min(1).max(120),
          slug: z.string().trim().min(1).max(160),
          sortOrder: z.number().int().min(0).default(0),
          isVisible: z.boolean().default(true),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        const { ownerPin: _ownerPin, isVisible, ...category } = input;
        return createSharedItem("templateCategories", {
          ...category,
          isVisible: isVisible ? 1 : 0,
        });
      }),
    updateWithPin: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          id: z.number(),
          name: z.string().trim().min(1).max(120).optional(),
          slug: z.string().trim().min(1).max(160).optional(),
          sortOrder: z.number().int().min(0).optional(),
          isVisible: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        const { ownerPin: _ownerPin, id, isVisible, ...rest } = input;
        return updateSharedItem("templateCategories", id, {
          ...rest,
          ...(isVisible === undefined ? {} : { isVisible: isVisible ? 1 : 0 }),
        });
      }),
    reorderWithPin: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          tool: toolSchema,
          ids: z.array(z.number()).max(100),
        })
      )
      .mutation(async ({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return reorderSharedItems("templateCategories", input.ids, input.tool);
      }),
    removeWithPin: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32), id: z.number() }))
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return removeSharedItem("templateCategories", input.id);
      }),
  }),
  siteContent: router({
    navigation: publicProcedure.query(() => getSharedNavigation()),
    adminGet: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32) }))
      .mutation(async ({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        const raw = await getSiteContent();
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      }),
    page: publicProcedure
      .input(z.object({ slug: z.string().min(1).max(80) }))
      .query(({ input }) => getPublishedPage(input.slug)),
    workingDraft: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32) }))
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return readOwnerWorkingDraft();
      }),
    saveWorkingDraft: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          content: z.record(z.string(), z.unknown()),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return saveOwnerWorkingDraft(input.content);
      }),
    clearWorkingDraft: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32) }))
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return clearOwnerWorkingDraft();
      }),
    get: publicProcedure.query(async () => {
      const snapshot = await getPublishedSnapshot(false);
      return publicSiteContent(snapshot.content);
    }),
    save: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          content: z.record(z.string(), z.unknown()),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return savePrivateSiteContent(input.content);
      }),
    history: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32) }))
      .query(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return listSiteContentHistory();
      }),
    version: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          id: z.number().int().positive(),
        })
      )
      .query(async ({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        const content = await readSiteContentVersion(input.id);
        if (!content)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "نسخة المحتوى غير موجودة.",
          });
        return content;
      }),
    backup: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32) }))
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return backupSiteContent();
      }),
  }),
  ownerSearch: router({
    query: ownerProcedure
      .input(
        z.object({
          term: z.string().max(120),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(5).max(50).default(20),
        })
      )
      .query(({ input }) =>
        searchOwnerContent(input.term, input.page, input.pageSize)
      ),
  }),
  creativeCategories: router({
    list: publicProcedure.query(async () =>
      (await listSharedItems("creativeCategories", true)).filter(
        (item: any) => item.isVisible === 1
      )
    ),
    adminList: ownerProcedure.query(() =>
      listSharedItems("creativeCategories", false)
    ),
    create: ownerProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(120),
          slug: z.string().trim().min(1).max(120),
          sortOrder: z.number().int().min(0).default(0),
          isVisible: z.boolean().default(true),
        })
      )
      .mutation(({ input }) =>
        createSharedItem("creativeCategories", {
          ...input,
          isVisible: input.isVisible ? 1 : 0,
        })
      ),
    update: ownerProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().trim().min(1).max(120).optional(),
          slug: z.string().trim().min(1).max(120).optional(),
          sortOrder: z.number().int().min(0).optional(),
          isVisible: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, isVisible, ...rest } = input;
        return updateSharedItem("creativeCategories", id, {
          ...rest,
          ...(isVisible === undefined ? {} : { isVisible: isVisible ? 1 : 0 }),
        });
      }),
    remove: ownerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) =>
        removeSharedItem("creativeCategories", input.id)
      ),
    createWithPin: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          name: z.string().trim().min(1).max(120),
          slug: z.string().trim().min(1).max(120),
          sortOrder: z.number().int().min(0).default(0),
          isVisible: z.boolean().default(true),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        const { ownerPin: _ownerPin, ...category } = input;
        return createSharedItem("creativeCategories", {
          ...category,
          isVisible: category.isVisible ? 1 : 0,
        });
      }),
    updateWithPin: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          id: z.number(),
          name: z.string().trim().min(1).max(120).optional(),
          slug: z.string().trim().min(1).max(120).optional(),
          sortOrder: z.number().int().min(0).optional(),
          isVisible: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        const { ownerPin: _ownerPin, id, isVisible, ...rest } = input;
        return updateSharedItem("creativeCategories", id, {
          ...rest,
          ...(isVisible === undefined ? {} : { isVisible: isVisible ? 1 : 0 }),
        });
      }),
    reorderWithPin: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          ids: z.array(z.number()).max(200),
        })
      )
      .mutation(async ({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return reorderSharedItems("creativeCategories", input.ids);
      }),
    removeWithPin: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32), id: z.number() }))
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return removeSharedItem("creativeCategories", input.id);
      }),
  }),
  creativeSpace: router({
    page: publicProcedure
      .input(
        z.object({
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(40).default(12),
          category: z.string().max(120).optional(),
          search: z.string().max(100).optional(),
          sort: z.enum(["newest", "oldest", "order"]).optional(),
        })
      )
      .query(({ input }) => pageCreativeSubmissions(input)),
    createWithPin: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          projectName: z.string().trim().max(255).optional().default(""),
          description: z.string().trim().max(5000).optional().default(""),
          category: z.string().trim().min(1).max(120),
          imageUrls: z
            .array(z.string().trim().min(1).max(2000))
            .max(4)
            .optional()
            .default([]),
          link: z.string().trim().max(2000).optional().default(""),
          contact: z.string().trim().max(500).optional().default(""),
          attachments: attachmentListInput.optional().default([]),
        })
      )
      .mutation(async ({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        if (
          !input.projectName &&
          !input.description &&
          !input.link &&
          !input.contact &&
          !input.imageUrls.length &&
          !input.attachments.length
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "أضف وصفًا أو صورة أو رابطًا أو مرفقًا واحدًا على الأقل.",
          });
        }
        const categories = await listSharedItems("creativeCategories", true);
        if (
          !categories.some(
            (item: any) => item.slug === input.category && item.isVisible === 1
          )
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "القسم غير متاح حاليًا.",
          });
        return createSharedItem("submissions", {
          projectName: input.projectName || null,
          description: input.description || null,
          category: input.category,
          imageUrls: JSON.stringify(input.imageUrls),
          imageKeys: JSON.stringify([]),
          link: input.link || null,
          contact: input.contact || null,
          attachments: input.attachments,
          status: "approved",
          reviewState: "saved",
          isVisible: 1,
          sortOrder: 0,
        });
      }),
    list: publicProcedure.query(async () => {
      const rows = await listSharedItems("submissions", true);
      return rows.filter(
        (row: any) =>
          row.status === "approved" &&
          row.isVisible === 1 &&
          (row.reviewState === "saved" ||
            row.reviewState === "inbox" ||
            !row.reviewState)
      );
    }),
    adminList: ownerProcedure.query(() =>
      listSharedItems("submissions", false)
    ),
    create: publicProcedure
      .input(
        z.object({
          projectName: z.string().trim().max(255).default(""),
          description: z
            .string()
            .trim()
            .min(1, "تعريف المشروع مطلوب.")
            .max(5000),
          category: z.string().trim().min(1, "اختيار القسم مطلوب.").max(120),
          link: z.string().trim().max(2000).default(""),
          contact: z.string().trim().max(500).default(""),
          imageData: z.array(z.string().min(1)).max(4).default([]),
        })
      )
      .mutation(async ({ input }) => {
        if (
          !input.projectName &&
          !input.description &&
          !input.link &&
          !input.contact &&
          input.imageData.length === 0
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "أضف صورة أو وصفًا أو رابطًا واحدًا على الأقل.",
          });
        const publishedCategories = await listSharedItems(
          "creativeCategories",
          true
        );
        if (
          !publishedCategories.some(
            (item: any) => item.slug === input.category && item.isVisible === 1
          )
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "القسم غير متاح لاستقبال المشاركات حاليًا.",
          });
        const urls: string[] = [];
        const keys: string[] = [];
        for (let index = 0; index < input.imageData.length; index += 1) {
          const data = input.imageData[index];
          const decoded = decodeDataUrl(data);
          const uploaded = await storagePut(
            `creative-space/${crypto.randomUUID()}-${index}-${siteFileName(input.projectName)}`,
            decoded.buffer,
            decoded.contentType
          );
          urls.push(uploaded.url);
          keys.push(uploaded.key);
        }
        return createCreativeSubmission({
          projectName: input.projectName || null,
          description: input.description || null,
          category: input.category,
          link: input.link || null,
          contact: input.contact || null,
          imageUrls: JSON.stringify(urls),
          imageKeys: JSON.stringify(keys),
          status: "pending",
          isVisible: 0,
          sortOrder: 0,
        });
      }),
    update: ownerProcedure
      .input(
        z.object({
          id: z.number(),
          projectName: z.string().trim().min(1).max(255).optional(),
          description: z.string().trim().min(1).max(5000).optional(),
          category: z.string().trim().min(1).max(120).optional(),
          link: z.string().trim().max(2000).optional(),
          contact: z.string().trim().max(500).optional(),
          status: z.enum(["pending", "approved", "rejected"]).optional(),
          reviewState: z
            .enum(["inbox", "saved", "waiting", "cancelled"])
            .optional(),
          isVisible: z.boolean().optional(),
          sortOrder: z.number().int().min(0).optional(),
          attachments: attachmentListInput.optional(),
          previewUrl: z.string().max(2000).optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, isVisible, ...rest } = input;
        return updateSharedItem("submissions", id, {
          ...rest,
          ...(isVisible === undefined ? {} : { isVisible: isVisible ? 1 : 0 }),
          ...(input.reviewState === undefined &&
          (input.status === "approved" || isVisible === true)
            ? { reviewState: "saved" }
            : {}),
          link: rest.link || null,
          contact: rest.contact || null,
        });
      }),
    setVisibility: ownerProcedure
      .input(z.object({ id: z.number(), isVisible: z.boolean() }))
      .mutation(({ input }) =>
        updateSharedItem("submissions", input.id, {
          isVisible: input.isVisible ? 1 : 0,
          status: input.isVisible ? "approved" : "pending",
          reviewState: "saved",
        })
      ),
    remove: ownerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => removeSharedItem("submissions", input.id)),
    reorder: ownerProcedure
      .input(z.object({ ids: z.array(z.number()).max(200) }))
      .mutation(async ({ input }) => {
        return reorderSharedItems("submissions", input.ids);
      }),
  }),
  freeSites: router({
    page: publicProcedure
      .input(
        z.object({
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(40).default(12),
          search: z.string().max(100).optional(),
          sort: z.enum(["newest", "oldest", "order"]).optional(),
        })
      )
      .query(({ input }) => pageFreeSites(input)),
    list: publicProcedure.query(() => listVisibleFreeSites()),
    adminList: ownerProcedure.query(() => listAllFreeSites()),
    adminListWithPin: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32) }))
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return listAllFreeSites();
      }),
    createWithPin: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          name: z.string().trim().min(1).max(255),
          url: z.string().trim().max(2000).optional(),
          description: z.string().max(5000).optional(),
          additionalText: z.string().max(10000).optional(),
          imageData: z.string().min(1).optional(),
          imageName: z.string().max(255).optional(),
          attachments: attachmentListInput.optional(),
          previewUrl: z.string().max(2000).optional(),
          sortOrder: z.number().int().min(0).default(0),
          isVisible: z.boolean().default(true),
        })
      )
      .mutation(async ({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        let imageUrl: string | null = null;
        let imageKey: string | null = null;
        if (input.imageData) {
          const decoded = decodeDataUrl(input.imageData);
          const uploaded = await storagePut(
            `free-sites/${crypto.randomUUID()}-${siteFileName(input.imageName || input.name)}`,
            decoded.buffer,
            decoded.contentType
          );
          imageUrl = uploaded.url;
          imageKey = uploaded.key;
        }
        return createFreeSite({
          name: input.name,
          url: input.url || null,
          description: input.description || null,
          additionalText: input.additionalText || null,
          imageUrl,
          imageKey,
          attachments: input.attachments,
          previewUrl: input.previewUrl,
          sortOrder: input.sortOrder,
          isVisible: input.isVisible ? 1 : 0,
          createdByOpenId: ENV.ownerOpenId || "owner-pin",
        } as any);
      }),
    updateWithPin: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          id: z.number(),
          name: z.string().trim().min(1).max(255).optional(),
          url: z.string().trim().max(2000).optional(),
          description: z.string().max(5000).optional(),
          additionalText: z.string().max(10000).optional(),
          imageData: z.string().min(1).optional(),
          imageName: z.string().max(255).optional(),
          attachments: attachmentListInput.optional(),
          previewUrl: z.string().max(2000).optional(),
          clearImage: z.boolean().optional(),
          sortOrder: z.number().int().min(0).optional(),
        })
      )
      .mutation(async ({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        const update: Record<string, unknown> = {};
        for (const key of [
          "name",
          "url",
          "description",
          "additionalText",
          "sortOrder",
          "attachments",
          "previewUrl",
        ] as const)
          if (input[key] !== undefined) update[key] = input[key] || null;
        if (input.clearImage) {
          update.imageUrl = null;
          update.imageKey = null;
        }
        if (input.imageData) {
          const decoded = decodeDataUrl(input.imageData);
          const uploaded = await storagePut(
            `free-sites/updates/${crypto.randomUUID()}-${siteFileName(input.imageName || "free-site")}`,
            decoded.buffer,
            decoded.contentType
          );
          update.imageUrl = uploaded.url;
          update.imageKey = uploaded.key;
        }
        return updateFreeSite(input.id, update);
      }),
    setVisibilityWithPin: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          id: z.number(),
          isVisible: z.boolean(),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return updateFreeSite(input.id, { isVisible: input.isVisible ? 1 : 0 });
      }),
    removeWithPin: publicProcedure
      .input(z.object({ ownerPin: z.string().min(4).max(32), id: z.number() }))
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return deleteFreeSite(input.id);
      }),
    reorderWithPin: publicProcedure
      .input(
        z.object({
          ownerPin: z.string().min(4).max(32),
          ids: z.array(z.number()).max(200),
        })
      )
      .mutation(({ input }) => {
        if (input.ownerPin !== ENV.ownerPin)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "كلمة مرور المالك غير صحيحة.",
          });
        return reorderSharedItems("freeSites", input.ids);
      }),
    create: ownerProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(255),
          url: z.string().trim().max(2000).optional(),
          description: z.string().max(5000).optional(),
          additionalText: z.string().max(10000).optional(),
          imageData: z.string().min(1).optional(),
          imageName: z.string().max(255).optional(),
          attachments: attachmentListInput.optional(),
          previewUrl: z.string().max(2000).optional(),
          sortOrder: z.number().int().min(0).default(0),
          isVisible: z.boolean().default(true),
        })
      )
      .mutation(async ({ input, ctx }) => {
        let imageUrl: string | null = null;
        let imageKey: string | null = null;
        if (input.imageData) {
          const decoded = decodeDataUrl(input.imageData);
          const uploaded = await storagePut(
            `free-sites/${crypto.randomUUID()}-${siteFileName(input.imageName || input.name)}`,
            decoded.buffer,
            decoded.contentType
          );
          imageUrl = uploaded.url;
          imageKey = uploaded.key;
        }
        return createFreeSite({
          name: input.name,
          url: input.url || null,
          description: input.description || null,
          additionalText: input.additionalText || null,
          imageUrl,
          imageKey,
          attachments: input.attachments,
          previewUrl: input.previewUrl,
          sortOrder: input.sortOrder,
          isVisible: input.isVisible ? 1 : 0,
          createdByOpenId: ctx.user.openId,
        } as any);
      }),
    update: ownerProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().trim().min(1).max(255).optional(),
          url: z.string().trim().max(2000).optional(),
          description: z.string().max(5000).optional(),
          additionalText: z.string().max(10000).optional(),
          imageData: z.string().min(1).optional(),
          imageName: z.string().max(255).optional(),
          attachments: attachmentListInput.optional(),
          previewUrl: z.string().max(2000).optional(),
          clearImage: z.boolean().optional(),
          sortOrder: z.number().int().min(0).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const update: Record<string, unknown> = {};
        for (const key of [
          "name",
          "url",
          "description",
          "additionalText",
          "sortOrder",
          "attachments",
          "previewUrl",
        ] as const) {
          if (input[key] !== undefined) update[key] = input[key] || null;
        }
        if (input.clearImage) {
          update.imageUrl = null;
          update.imageKey = null;
        }
        if (input.imageData) {
          const decoded = decodeDataUrl(input.imageData);
          const uploaded = await storagePut(
            `free-sites/updates/${crypto.randomUUID()}-${siteFileName(input.imageName || "free-site")}`,
            decoded.buffer,
            decoded.contentType
          );
          update.imageUrl = uploaded.url;
          update.imageKey = uploaded.key;
        }
        return updateFreeSite(input.id, update);
      }),
    setVisibility: ownerProcedure
      .input(z.object({ id: z.number(), isVisible: z.boolean() }))
      .mutation(({ input }) =>
        updateFreeSite(input.id, { isVisible: input.isVisible ? 1 : 0 })
      ),
    remove: ownerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteFreeSite(input.id)),
    reorder: ownerProcedure
      .input(z.object({ ids: z.array(z.number()).max(200) }))
      .mutation(async ({ input }) => {
        return reorderSharedItems("freeSites", input.ids);
      }),
  }),
  ownerNotifications: ownerNotificationsRouter,
  customerInbox: customerInboxRouter,
});

export type AppRouter = typeof appRouter;
