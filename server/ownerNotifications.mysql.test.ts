import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mysql, { type Connection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import fs from "node:fs";
const handle = vi.hoisted(() => ({ db: null as any }));
vi.mock("./db", () => ({ getDb: async () => handle.db }));
import { sendCustomerRequest, importLegacyCustomerRequests, listCustomerRequests, setCustomerRequestStatus, removeCustomerRequest } from "./customerInbox";
import { listOwnerNotifications, markOwnerNotificationsRead, markAllOwnerNotificationsRead, saveOwnerNotificationPreferences } from "./ownerNotifications";
import { ENV } from "./_core/env";
const ownerPin = ENV.ownerPin;
const input = { id: "12345678-1234-4234-8234-123456789000", name: "عميل الاختبار المعزول", phone: "+967771234567", request: "طلب تصميم محفوظ في جدول مؤقت", source: "المحادثة" };
const list = (filter: "all" | "unread" | "submission" | "request" = "all", page = 1, pageSize = 20) => listOwnerNotifications({ ownerPin, filter, page, pageSize });
// Every table used by these repositories is shadowed by a connection-local
// TEMPORARY table before any repository write. No production test rows are inserted.
describe.skipIf(!process.env.DATABASE_URL)("owner notifications real MySQL isolated persistence", () => {
  let connection: Connection;
  const tables = ["customer_requests", "owner_notification_reads", "owner_notification_preferences", "creative_submissions"];
  let ready = false;
  beforeAll(async () => {
    connection = await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      const ddl = fs.readFileSync(new URL("../drizzle/0013_unique_vin_gonzales.sql", import.meta.url), "utf8");
      for (const table of tables.slice(0, 3)) {
        const match = ddl.match(new RegExp("CREATE TABLE `" + table + "`[\\s\\S]*?;"));
        if (!match) throw new Error("Temporary schema missing " + table);
        await connection.query(match[0].replace("CREATE TABLE", "CREATE TEMPORARY TABLE"));
      }
      const [definition]: any = await connection.query("SHOW CREATE TABLE creative_submissions");
      await connection.query(String(definition[0]["Create Table"]).replace("CREATE TABLE", "CREATE TEMPORARY TABLE"));
      handle.db = drizzle(connection); ready = true;
    } catch (error) { await connection.end(); throw error; }
  }, 30000);
  beforeEach(async () => {
    if (!ready) throw new Error("Temporary isolation unavailable");
    for (const name of tables) await connection.query(`DELETE FROM \`${name}\``);
  }, 30000);
  afterAll(async () => { handle.db = null; if (ready) await connection.end(); });
  it("persists a public request, creates one unread notification, and reads it across repository instances", async () => {
    await sendCustomerRequest(input);
    const first = await list(); expect(first.unreadCount).toBe(1); expect(first.items[0]).toMatchObject({ id: `request:${input.id}`, title: input.name, readAt: null });
    await markOwnerNotificationsRead(ownerPin, [first.items[0].id]);
    handle.db = drizzle(connection);
    const next = await list(); expect(next.unreadCount).toBe(0); expect(next.items[0].readAt).toBeGreaterThan(0);
    const [[row]]: any = await connection.query("SELECT status FROM customer_requests WHERE id = ?", [input.id]); expect(row.status).toBe("new");
  }, 30000);
  it("deduplicates real database retries without overwriting data and avoids reimporting a server backup", async () => {
    await sendCustomerRequest(input);
    await sendCustomerRequest({ ...input, name: "لا تستبدل البيانات" });
    const result = await importLegacyCustomerRequests(ownerPin, [{ ...input, status: "new", createdAt: new Date().toISOString() }]);
    expect(result.imported).toBe(0);
    const [[count]]: any = await connection.query("SELECT COUNT(*) AS total FROM customer_requests"); expect(Number(count.total)).toBe(1);
    expect((await list()).items[0].title).toBe(input.name);
  }, 30000);
  it("keeps total unread count stable across filters and leaves approval statuses untouched", async () => {
    await sendCustomerRequest(input);
    await connection.execute("INSERT INTO creative_submissions (id,projectName,description,category,status,isVisible,sortOrder) VALUES (901,'مشاركة اختبار مؤقتة','تعريف المشروع','design','pending',0,0)");
    const submissions = await list("submission"); expect(submissions.items).toHaveLength(1); expect(submissions.unreadCount).toBe(2);
    await markOwnerNotificationsRead(ownerPin, ["submission:901"]);
    const [[source]]: any = await connection.query("SELECT status,reviewState,isVisible FROM creative_submissions WHERE id=901"); expect(source).toMatchObject({ status: "pending", reviewState: "inbox", isVisible: 0 });
    expect((await list("unread")).items.map(item => item.type)).toEqual(["request"]);
  }, 30000);
  it("marks current items read but leaves a subsequently arriving request unread", async () => {
    await sendCustomerRequest(input); await markAllOwnerNotificationsRead(ownerPin);
    expect((await list()).unreadCount).toBe(0);
    await sendCustomerRequest({ ...input, id: "12345678-1234-4234-8234-123456789001" });
    expect((await list()).unreadCount).toBe(1);
  }, 30000);
  it("persists preferences across instances and retains hidden notification source data", async () => {
    await sendCustomerRequest(input);
    await saveOwnerNotificationPreferences(ownerPin, { showSubmissions: true, showRequests: false, showToast: false });
    handle.db = drizzle(connection);
    expect((await list()).items).toHaveLength(0); expect((await list()).preferences.showToast).toBe(false);
    const page = await listCustomerRequests({ ownerPin, search: "", status: "all", date: "all", page: 1, pageSize: 20 }); expect(page.total).toBe(1);
    await saveOwnerNotificationPreferences(ownerPin, { showSubmissions: true, showRequests: true, showToast: true }); expect((await list()).unreadCount).toBe(1);
  }, 30000);
  it("paginates requests and confirms status/deletion while private calls reject wrong PINs", async () => {
    await sendCustomerRequest(input); await sendCustomerRequest({ ...input, id: "12345678-1234-4234-8234-123456789002" });
    const first = await list("all", 1, 1); expect(first.hasMore).toBe(true); expect(first.items).toHaveLength(1);
    const second = await list("all", 2, 1); expect(second.items[0].id).not.toBe(first.items[0].id);
    await expect(markOwnerNotificationsRead("wrong-pin", [first.items[0].id])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setCustomerRequestStatus(ownerPin, input.id, "completed");
    expect((await listCustomerRequests({ ownerPin, search: "", status: "completed", date: "all", page: 1, pageSize: 20 })).total).toBe(1);
    await removeCustomerRequest(ownerPin, input.id, true); expect((await list()).items).toHaveLength(1);
  }, 30000);
});
