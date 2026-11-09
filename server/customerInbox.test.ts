import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  db: null as any,
}));
vi.mock("./db", () => ({ getDb: async () => state.db }));

import {
  importLegacyCustomerRequests,
  listCustomerRequests,
  removeCustomerRequest,
  sendCustomerRequest,
  setCustomerRequestStatus,
} from "./customerInbox";
import { ENV } from "./_core/env";

function makeDb() {
  return {
    insert: () => ({
      values: async (row: any) => {
        if (state.rows.has(row.id))
          throw Object.assign(new Error("Duplicate entry"), {
            code: "ER_DUP_ENTRY",
            errno: 1062,
          });
        state.rows.set(row.id, { ...row });
        return [];
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () =>
            [...state.rows.values()].slice(0, 1).map(row => ({ id: row.id })),
        }),
      }),
    }),
    update: () => ({
      set: (patch: any) => ({
        where: async () => {
          const first = [...state.rows.values()][0];
          if (first) Object.assign(first, patch);
        },
      }),
    }),
    delete: () => ({
      where: async () => {
        const first = [...state.rows.keys()][0];
        if (first) state.rows.delete(first);
      },
    }),
  };
}

describe("customerInbox backend", () => {
  beforeEach(() => {
    state.rows.clear();
    state.db = makeDb();
  });

  it("requires the owner PIN before private data access", async () => {
    state.db = {
      select: vi.fn(() => {
        throw new Error("data accessed");
      }),
    };
    await expect(
      listCustomerRequests({
        ownerPin: "wrong",
        search: "",
        status: "all",
        date: "all",
        page: 1,
        pageSize: 20,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.db.select).not.toHaveBeenCalled();
  });

  it("deduplicates a retry without overwriting the original payload", async () => {
    const first = await sendCustomerRequest({
      id: "11111111-1111-4111-8111-111111111111",
      name: "أول اسم",
      phone: "+967 70000000",
      request: "الطلب الأصلي",
      source: "المحادثة",
    });
    const retry = await sendCustomerRequest({
      id: first.id,
      name: "اسم مختلف",
      phone: "+967 71111111",
      request: "حمولة مختلفة",
      source: "متصفح آخر",
    });
    expect(retry).toEqual({ success: true, id: first.id });
    expect(state.rows.get(first.id)).toMatchObject({
      name: "أول اسم",
      phone: "+967 70000000",
      request: "الطلب الأصلي",
      source: "المحادثة",
    });
  });

  it("rejects invalid public payloads before touching the database", async () => {
    await expect(
      sendCustomerRequest({
        name: "",
        phone: "not-a-phone",
        request: "x",
        source: "المحادثة",
      } as any)
    ).rejects.toThrow();
    expect(state.rows).toHaveLength(0);
  });

  it("preserves legacy timestamps/status and imports each stable key once", async () => {
    const item = {
      id: "browser-row-1",
      name: "عميل قديم",
      phone: "غير محدد",
      request: "رسالة قديمة",
      source: "المتصفح",
      status: "contacted" as const,
      createdAt: "2025-01-02T03:04:05.000Z",
    };
    const first = await importLegacyCustomerRequests(ENV.ownerPin, [item]);
    const second = await importLegacyCustomerRequests(ENV.ownerPin, [item]);
    expect(first).toEqual({ success: true, imported: 1 });
    expect(second).toEqual({ success: true, imported: 0 });
    const row = [...state.rows.values()][0];
    expect(row).toMatchObject({
      name: item.name,
      phone: item.phone,
      request: item.request,
      source: item.source,
      status: item.status,
      createdAt: new Date(item.createdAt).getTime(),
    });
  });

  it("updates and removes only through explicit owner operations", async () => {
    await sendCustomerRequest({
      id: "22222222-2222-4222-8222-222222222222",
      name: "عميل",
      phone: "+967 70000000",
      request: "طلب",
      source: "المحادثة",
    });
    await setCustomerRequestStatus(
      ENV.ownerPin,
      "22222222-2222-4222-8222-222222222222",
      "completed"
    );
    expect([...state.rows.values()][0].status).toBe("completed");
    await expect(
      removeCustomerRequest(
        ENV.ownerPin,
        "22222222-2222-4222-8222-222222222222",
        false as true
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.rows).toHaveLength(1);
    await removeCustomerRequest(
      ENV.ownerPin,
      "22222222-2222-4222-8222-222222222222",
      true
    );
    expect(state.rows).toHaveLength(0);
  });
});
