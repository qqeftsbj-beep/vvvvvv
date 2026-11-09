import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  db: null as any,
  reads: new Map<string, number>(),
  preferences: null as any,
}));
vi.mock("./db", () => ({ getDb: async () => state.db }));

import {
  listOwnerNotifications,
  markAllOwnerNotificationsRead,
  markOwnerNotificationsRead,
  saveOwnerNotificationPreferences,
} from "./ownerNotifications";
import { ENV } from "./_core/env";

function makeDb() {
  return {
    execute: async (query: any) => {
      const text = String(
        query?.queryChunks?.map((part: any) => part?.value || "").join("") ||
          query
      );
      if (text.includes("owner_notification_preferences"))
        return [[state.preferences].filter(Boolean)];
      return [[]];
    },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (state.preferences ? [state.preferences] : []),
        }),
      }),
    }),
    insert: () => ({
      values: (row: any) => {
        const apply = async () => {
          if (row.notificationKey)
            state.reads.set(row.notificationKey, row.readAt);
          else state.preferences = { ...row };
        };
        return { onDuplicateKeyUpdate: () => apply() };
      },
    }),
    transaction: async (callback: (tx: any) => Promise<unknown>) =>
      callback(makeDb()),
  };
}

describe("ownerNotifications backend", () => {
  beforeEach(() => {
    state.reads.clear();
    state.preferences = null;
    state.db = makeDb();
  });

  it("rejects an incorrect PIN before reading preferences or notification rows", async () => {
    state.db = {
      execute: vi.fn(() => {
        throw new Error("data accessed");
      }),
    };
    await expect(
      listOwnerNotifications({
        ownerPin: "wrong",
        filter: "all",
        page: 1,
        pageSize: 20,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.db.execute).not.toHaveBeenCalled();
  });

  it("returns durable default preferences and bounded empty feed", async () => {
    const result = await listOwnerNotifications({
      ownerPin: ENV.ownerPin,
      filter: "all",
      page: 1,
      pageSize: 20,
    });
    expect(result).toMatchObject({
      items: [],
      unreadCount: 0,
      counts: { submission: 0, request: 0 },
      page: 1,
      hasMore: false,
      preferences: {
        showSubmissions: true,
        showRequests: true,
        showToast: true,
      },
    });
  });

  it("persists preferences without touching workflow data", async () => {
    const preferences = {
      showSubmissions: false,
      showRequests: true,
      showToast: false,
    };
    await expect(
      saveOwnerNotificationPreferences(ENV.ownerPin, preferences)
    ).resolves.toEqual(preferences);
    expect(state.preferences).toMatchObject({
      showSubmissions: 0,
      showRequests: 1,
      showToast: 0,
    });
    expect(state.reads).toHaveLength(0);
  });

  it("stores only valid bounded receipt keys and never changes source statuses", async () => {
    await markOwnerNotificationsRead(ENV.ownerPin, [
      "submission:41",
      "request:abc",
      "request:abc",
      "not-a-notification",
      "submission:".repeat(60),
    ]);
    expect([...state.reads.keys()]).toEqual(["submission:41", "request:abc"]);
  });

  it("marks all through the database transaction path", async () => {
    const tx = vi.fn(async (callback: (inner: any) => Promise<unknown>) =>
      callback(makeDb())
    );
    state.db.transaction = tx;
    await markAllOwnerNotificationsRead(ENV.ownerPin);
    expect(tx).toHaveBeenCalledTimes(1);
  });
});
