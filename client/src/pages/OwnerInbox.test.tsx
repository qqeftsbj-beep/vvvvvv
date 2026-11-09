// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listAsync, statusAsync, removeAsync, importAsync } = vi.hoisted(() => ({
  listAsync: vi.fn(),
  statusAsync: vi.fn(),
  removeAsync: vi.fn(),
  importAsync: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    customerInbox: {
      list: { useMutation: () => ({ mutateAsync: listAsync, isPending: false }) },
      setStatus: { useMutation: () => ({ mutateAsync: statusAsync, isPending: false }) },
      remove: { useMutation: () => ({ mutateAsync: removeAsync, isPending: false }) },
      importLegacy: { useMutation: () => ({ mutateAsync: importAsync, isPending: false }) },
    },
  },
}));
vi.mock("wouter", () => ({ Link: ({ children, ...props }: { children: React.ReactNode; href: string }) => <a {...props}>{children}</a> }));

import OwnerInbox from "./OwnerInbox";

const serverRecord = { id: "server-1", name: "خادم", phone: "+967771234567", request: "طلب خادم", source: "chat", status: "new" as const, createdAt: "2026-11-09T10:00:00.000Z" };
const localRecord = { id: "local-1", name: "محلي", phone: "+967770000000", request: "طلب محلي", source: "old", status: "new" as const, createdAt: "2026-11-08T10:00:00.000Z" };

describe("OwnerInbox server/local archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.setItem("abu-kayan-owner-panel", "true");
    window.localStorage.setItem("abu-kayan-owner-pin", "123456");
    listAsync.mockResolvedValue({ items: [serverRecord], total: 1, hasMore: false, page: 1 });
    statusAsync.mockResolvedValue({ success: true });
    removeAsync.mockResolvedValue({ success: true });
    importAsync.mockResolvedValue({ success: true, imported: 1 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("loads server records with the PIN and keeps local records in a separate visible section", async () => {
    window.localStorage.setItem("abu-kayan-inbox", JSON.stringify([localRecord]));
    render(<OwnerInbox />);
    await waitFor(() => expect(listAsync).toHaveBeenCalledWith(expect.objectContaining({ ownerPin: "123456", page: 1, pageSize: 20, status: "all", date: "all" })));
    expect(await screen.findByText("طلب خادم")).toBeTruthy();
    expect(screen.getByText("طلب محلي")).toBeTruthy();
    expect(screen.getByText("خادم الموقع · ٩‏/١١‏/٢٠٢٦، ١٠:٠٠:٠٠ ص")).toBeTruthy();
  });

  it("waits for successful server mutations before changing status or removing", async () => {
    render(<OwnerInbox />);
    await screen.findByText("طلب خادم");
    fireEvent.click(screen.getByRole("button", { name: /جديد/ }));
    await waitFor(() => expect(statusAsync).toHaveBeenCalledWith({ ownerPin: "123456", id: "server-1", status: "contacted" }));
    expect(screen.getAllByText("تمت المتابعة").length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: "حذف الرسالة من الخادم" }));
    await waitFor(() => expect(removeAsync).toHaveBeenCalledWith({ ownerPin: "123456", id: "server-1", confirm: true }));
    expect(screen.queryByText("طلب خادم")).toBeNull();
  });

  it("imports local records without deleting the local original", async () => {
    window.localStorage.setItem("abu-kayan-inbox", JSON.stringify([localRecord]));
    render(<OwnerInbox />);
    await screen.findByText("طلب محلي");
    fireEvent.click(screen.getByRole("button", { name: "استيراد الرسائل المحلية" }));
    await waitFor(() => expect(importAsync).toHaveBeenCalledWith({ ownerPin: "123456", items: [localRecord] }));
    expect(JSON.parse(window.localStorage.getItem("abu-kayan-inbox") || "[]")).toEqual([localRecord]);
    expect(JSON.parse(window.localStorage.getItem("abu-kayan-inbox-imported") || "[]")).toEqual(["local-1"]);
  });
});
