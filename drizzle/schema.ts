import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

export const sharedTemplates = mysqlTable("shared_templates", {
  id: int("id").autoincrement().primaryKey(),
  tool: varchar("tool", { length: 32 }).notNull(),
  text: text("text").notNull(),
  imageUrl: text("imageUrl").notNull(),
  imageKey: text("imageKey").notNull(),
  imageName: varchar("imageName", { length: 255 }).notNull(),
  mediaType: varchar("mediaType", { length: 16 }).default("image").notNull(),
  createdByOpenId: varchar("createdByOpenId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export const templateSettings = mysqlTable("template_settings", {
  id: int("id").primaryKey(),
  retentionDays: int("retentionDays").default(30).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const creativeSubmissions = mysqlTable("creative_submissions", {
  id: int("id").autoincrement().primaryKey(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  description: text("description").notNull(),
  imageUrls: text("imageUrls"),
  imageKeys: text("imageKeys"),
  link: text("link"),
  contact: varchar("contact", { length: 500 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  isVisible: int("isVisible").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const freeSites = mysqlTable("free_sites", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url"),
  description: text("description"),
  imageUrl: text("imageUrl"),
  imageKey: text("imageKey"),
  additionalText: text("additionalText"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isVisible: int("isVisible").default(1).notNull(),
  createdByOpenId: varchar("createdByOpenId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SharedTemplate = typeof sharedTemplates.$inferSelect;
export type InsertSharedTemplate = typeof sharedTemplates.$inferInsert;
export type FreeSite = typeof freeSites.$inferSelect;
export type InsertFreeSite = typeof freeSites.$inferInsert;
export type CreativeSubmission = typeof creativeSubmissions.$inferSelect;
export type InsertCreativeSubmission = typeof creativeSubmissions.$inferInsert;
