import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultWelcomeConfig } from "../shared/welcomeSchedule";
const { published, storagePut } = vi.hoisted(() => ({ published: vi.fn(), storagePut: vi.fn() }));
vi.mock("./managementWorkspace", () => ({ getPublishedSnapshot: published }));
vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./storage", () => ({ storagePut }));
import { welcomeRouter } from "./welcomeRouter";
import { normalizeAndUploadSiteContent } from "./siteContentPersistence";
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe("published welcome settings", () => {
  it("uses only the published settings and server time, never an owner draft", async () => {
    const config = structuredClone(defaultWelcomeConfig);
    config.templates.unshift({ ...config.templates[0], id: "friday", name: "Friday", title: "جمعة مباركة", schedule: { kind: "weekdays", days: [5], startTime: "00:00", endTime: "23:59" } });
    published.mockResolvedValue({ content: { welcome: config }, collections: {} });
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-12T21:00:00Z"));
    const caller = welcomeRouter.createCaller({ user: null, req: { headers: {} }, res: {} } as any);
    expect((await caller.active()).template?.id).toBe("friday");
    expect(published).toHaveBeenCalledWith(false);
    config.enabled = false;
    expect((await caller.active()).template).toBeNull();
  });
  it("preserves existing content and stores image references, not image bytes", async () => {
    const welcome = structuredClone(defaultWelcomeConfig);
    welcome.templates[0].image = "data:image/png;base64,aGVsbG8=";
    storagePut.mockResolvedValue({ url: "/manus-storage/welcome-test.png", key: "welcome-test.png" });
    const normalized = await normalizeAndUploadSiteContent({ heroTitle: "لا يتغير", settings: { backgroundColor: "#071426" }, welcome });
    expect((normalized.welcome as any).templates[0].image).toBe("/manus-storage/welcome-test.png");
    expect(normalized.heroTitle).toBe("لا يتغير");
    expect(storagePut).toHaveBeenCalledTimes(1);
    expect(welcome.templates[0].image.startsWith("data:")).toBe(true);
  });
  it("rejects invalid dates or unsafe links before any storage write", async () => {
    const welcome = structuredClone(defaultWelcomeConfig);
    welcome.templates[0].schedule = { kind: "range", startAt: 2000, endAt: 1000 };
    await expect(normalizeAndUploadSiteContent({ welcome })).rejects.toThrow("نهاية الفترة");
    welcome.templates[0].schedule = { kind: "always" };
    welcome.templates[0].buttonUrl = "javascript:alert(1)";
    await expect(normalizeAndUploadSiteContent({ welcome })).rejects.toThrow("رابط الزر");
    expect(storagePut).not.toHaveBeenCalled();
  });
});
