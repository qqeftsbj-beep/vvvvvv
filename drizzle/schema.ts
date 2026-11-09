import { bigint, index, int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing auth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const templateCategories = mysqlTable("template_categories", {
  id: int("id").autoincrement().primaryKey(), tool: varchar("tool", { length: 32 }).notNull(), name: varchar("name", { length: 120 }).notNull(), slug: varchar("slug", { length: 160 }).notNull().unique(), sortOrder: int("sortOrder").default(0).notNull(), isVisible: int("isVisible").default(1).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const sharedTemplates = mysqlTable("shared_templates", {
  id: int("id").autoincrement().primaryKey(), tool: varchar("tool", { length: 32 }).notNull(), category: varchar("category", { length: 160 }).default("other").notNull(), text: text("text").notNull(), imageUrl: text("imageUrl").notNull(), imageKey: text("imageKey").notNull(), imageName: varchar("imageName", { length: 255 }).notNull(), mediaType: varchar("mediaType", { length: 16 }).default("image").notNull(), createdByOpenId: varchar("createdByOpenId", { length: 64 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), deletedAt: timestamp("deletedAt"),
});
export const templateSettings = mysqlTable("template_settings", { id: int("id").primaryKey(), retentionDays: int("retentionDays").default(30).notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export const siteSettings = mysqlTable("site_settings", { id: int("id").primaryKey(), contentJson: mediumtext("contentJson").notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export const siteContentVersions = mysqlTable("site_content_versions", { id: int("id").autoincrement().primaryKey(), contentJson: mediumtext("contentJson").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
export const creativeCategories = mysqlTable("creative_categories", { id: int("id").autoincrement().primaryKey(), name: varchar("name", { length: 120 }).notNull(), slug: varchar("slug", { length: 120 }).notNull().unique(), sortOrder: int("sortOrder").default(0).notNull(), isVisible: int("isVisible").default(1).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
export const creativeSubmissions = mysqlTable("creative_submissions", {
  id: int("id").autoincrement().primaryKey(), projectName: varchar("projectName", { length: 255 }), description: text("description"), category: varchar("category", { length: 120 }).default("other").notNull(), imageUrls: text("imageUrls"), imageKeys: text("imageKeys"), link: text("link"), contact: varchar("contact", { length: 500 }), status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(), reviewState: mysqlEnum("reviewState", ["inbox", "saved", "waiting", "cancelled"]).default("inbox").notNull(), isVisible: int("isVisible").default(0).notNull(), sortOrder: int("sortOrder").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const freeSites = mysqlTable("free_sites", { id: int("id").autoincrement().primaryKey(), name: varchar("name", { length: 255 }).notNull(), url: text("url"), description: text("description"), imageUrl: text("imageUrl"), imageKey: text("imageKey"), additionalText: text("additionalText"), sortOrder: int("sortOrder").default(0).notNull(), isVisible: int("isVisible").default(1).notNull(), createdByOpenId: varchar("createdByOpenId", { length: 64 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export const pageMediaFiles = mysqlTable("page_media_files", { id: varchar("id", { length: 36 }).primaryKey(), pageId: varchar("pageId", { length: 128 }).notNull(), name: varchar("name", { length: 255 }).notNull(), originalName: varchar("originalName", { length: 255 }).notNull(), folder: varchar("folder", { length: 160 }).default("").notNull(), description: text("description").notNull(), mimeType: varchar("mimeType", { length: 255 }).notNull(), size: int("size").notNull(), key: text("key").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
export const ownerEditorDrafts = mysqlTable("owner_editor_drafts", { id: int("id").primaryKey(), contentJson: mediumtext("contentJson").notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });

/** Singleton durable workspace. Legacy rows are never updated or deleted by this layer. */
export const managementWorkspaces = mysqlTable("management_workspaces", {
  id: int("id").primaryKey(),
  workingContentJson: mediumtext("workingContentJson").notNull(),
  workingCollectionsJson: mediumtext("workingCollectionsJson").notNull(),
  publishedContentJson: mediumtext("publishedContentJson").notNull(),
  publishedCollectionsJson: mediumtext("publishedCollectionsJson").notNull(),
  revision: int("revision").default(1).notNull(),
  publishedRevision: int("publishedRevision").default(1).notNull(),
  metadataJson: mediumtext("metadataJson").notNull(),
  savedAt: timestamp("savedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const managementTrash = mysqlTable("management_trash", {
  id: varchar("id", { length: 80 }).primaryKey(),
  kind: varchar("kind", { length: 80 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  source: varchar("source", { length: 255 }).notNull(),
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
  parentId: varchar("parentId", { length: 128 }),
  itemIndex: int("itemIndex"),
  valueJson: mediumtext("valueJson").notNull(),
  workspaceRevision: int("workspaceRevision").notNull(),
});

export const managementBackups = mysqlTable("management_backups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  size: int("size").notNull(),
  contentJson: mediumtext("contentJson").notNull(),
  collectionsJson: mediumtext("collectionsJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect; export type InsertUser = typeof users.$inferInsert;
export type TemplateCategory = typeof templateCategories.$inferSelect; export type InsertTemplateCategory = typeof templateCategories.$inferInsert;
export type SharedTemplate = typeof sharedTemplates.$inferSelect; export type InsertSharedTemplate = typeof sharedTemplates.$inferInsert;
export type FreeSite = typeof freeSites.$inferSelect; export type InsertFreeSite = typeof freeSites.$inferInsert;
export type CreativeSubmission = typeof creativeSubmissions.$inferSelect; export type InsertCreativeSubmission = typeof creativeSubmissions.$inferInsert;
export type SiteSettings = typeof siteSettings.$inferSelect; export type SiteContentVersion = typeof siteContentVersions.$inferSelect;
export type CreativeCategory = typeof creativeCategories.$inferSelect; export type InsertCreativeCategory = typeof creativeCategories.$inferInsert;
export type PageMediaFile = typeof pageMediaFiles.$inferSelect; export type InsertPageMediaFile = typeof pageMediaFiles.$inferInsert;
export type OwnerEditorDraft = typeof ownerEditorDrafts.$inferSelect; export type InsertOwnerEditorDraft = typeof ownerEditorDrafts.$inferInsert;
export type ManagementWorkspace = typeof managementWorkspaces.$inferSelect;
export type ManagementTrash = typeof managementTrash.$inferSelect;
export type ManagementBackup = typeof managementBackups.$inferSelect;

/** Owner-only notification state; notification keys are submission:<id> or request:<id>. */
export const ownerNotificationReads = mysqlTable("owner_notification_reads", {
  notificationKey: varchar("notificationKey", { length: 191 }).primaryKey(),
  readAt: bigint("readAt", { mode: "number" }).notNull(),
});

/** Singleton owner notification preferences. Values remain durable but never create notifications. */
export const ownerNotificationPreferences = mysqlTable(
  "owner_notification_preferences",
  {
    id: int("id").primaryKey(),
    showSubmissions: int("showSubmissions").default(1).notNull(),
    showRequests: int("showRequests").default(1).notNull(),
    showToast: int("showToast").default(1).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  }
);

/** Durable public customer inbox records. The caller-supplied id is the idempotency key when present. */
export const customerRequests = mysqlTable(
  "customer_requests",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    request: mediumtext("request").notNull(),
    source: varchar("source", { length: 150 }).notNull(),
    status: mysqlEnum("status", ["new", "contacted", "completed"])
      .default("new")
      .notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  table => ({
    createdAtIdx: index("customer_requests_created_at_idx").on(
      table.createdAt,
      table.id
    ),
    statusCreatedAtIdx: index("customer_requests_status_created_at_idx").on(
      table.status,
      table.createdAt,
      table.id
    ),
    nameIdx: index("customer_requests_name_idx").on(table.name),
  })
);

export type OwnerNotificationRead = typeof ownerNotificationReads.$inferSelect;
export type OwnerNotificationPreferences =
  typeof ownerNotificationPreferences.$inferSelect;
export type CustomerRequestRow = typeof customerRequests.$inferSelect;
