// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnerNotificationFeed } from "@shared/ownerNotifications";
const { list, read, all, preferences, notify } = vi.hoisted(() => ({ list: vi.fn(), read: vi.fn(), all: vi.fn(), preferences: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { ownerNotifications: { list: { useMutation: () => ({ mutateAsync: list }) }, markRead: { useMutation: () => ({ mutateAsync: read }) }, markAllRead: { useMutation: () => ({ mutateAsync: all }) }, savePreferences: { useMutation: () => ({ mutateAsync: preferences }) } } } }));
vi.mock("sonner", () => ({ toast: notify }));
import OwnerNotifications from "./OwnerNotifications";
const base: OwnerNotificationFeed = { items: [{ id: "submission:2", sourceId: "2", type: "submission", title: "مشروع جديد ينتظر المراجعة", body: "وصف المشروع", createdAt: Date.now(), readAt: null, href: "/owner?tab=submissions" }], unreadCount: 1, counts: { submission: 1, request: 0 }, page: 1, hasMore: false, preferences: { showSubmissions: true, showRequests: true, showToast: true } };
beforeEach(() => { vi.clearAllMocks(); list.mockResolvedValue(structuredClone(base)); read.mockResolvedValue({ success: true }); all.mockResolvedValue({ success: true }); preferences.mockResolvedValue(base.preferences); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function open() { render(<OwnerNotifications ownerPin="test-owner-pin" onOpenSubmissions={vi.fn()} />); await waitFor(() => expect(list).toHaveBeenCalled()); await waitFor(() => expect(screen.getByRole("button", { name: "الإشعارات، 1 غير مقروءة" })).toBeTruthy()); fireEvent.click(screen.getByRole("button", { name: "الإشعارات، 1 غير مقروءة" })); }
describe("owner notification center", () => {
  it("loads only via authenticated POST mutation and does not toast historical notifications", async () => {
    await open();
    expect(list).toHaveBeenCalledWith({ ownerPin: "test-owner-pin", filter: "all", page: 1, pageSize: 20 });
    expect(screen.getByRole("dialog", { name: "إشعارات المالك" })).toBeTruthy();
    expect(screen.getByText(base.items[0].title)).toBeTruthy(); expect(notify).not.toHaveBeenCalled();
  });
  it("marks an item read centrally without changing its review state", async () => {
    await open(); list.mockResolvedValue({ ...base, unreadCount: 0, items: [{ ...base.items[0], readAt: Date.now() }] });
    fireEvent.click(screen.getByRole("button", { name: "تعليم كمقروء" }));
    await waitFor(() => expect(read).toHaveBeenCalledWith({ ownerPin: "test-owner-pin", ids: ["submission:2"] }));
    await waitFor(() => expect(screen.getByText("0 غير مقروءة")).toBeTruthy());
  });
  it("opens submissions only after read receipt succeeds", async () => {
    const navigate = vi.fn(); render(<OwnerNotifications ownerPin="test-owner-pin" onOpenSubmissions={navigate} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "الإشعارات، 1 غير مقروءة" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "الإشعارات، 1 غير مقروءة" })); fireEvent.click(screen.getByRole("button", { name: "فتح المشاركة" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1)); expect(read).toHaveBeenCalled(); expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps failed reads unread and displays a retryable error", async () => {
    read.mockRejectedValue(new Error("لم يتم تخزين القراءة")); await open();
    fireEvent.click(screen.getByRole("button", { name: "تعليم كمقروء" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("لم يتم تخزين"));
    expect(screen.getByText("1 غير مقروءة")).toBeTruthy();
  });
  it("saves custom preferences independently from website publication", async () => {
    await open(); fireEvent.click(screen.getByText("تخصيص الإشعارات"));
    fireEvent.click(screen.getByLabelText("إشعارات رسائل وطلبات العملاء"));
    await waitFor(() => expect(preferences).toHaveBeenCalledWith({ ownerPin: "test-owner-pin", preferences: { ...base.preferences, showRequests: false } }));
  });
  it("filters and pages using bounded server requests", async () => {
    await open(); fireEvent.click(screen.getByRole("button", { name: /^الطلبات$/ }));
    await waitFor(() => expect(list).toHaveBeenCalledWith({ ownerPin: "test-owner-pin", filter: "request", page: 1, pageSize: 20 }));
  });
  it("refreshes while panel is open and announces each new arrival once", async () => {
    vi.useFakeTimers(); render(<OwnerNotifications ownerPin="test-owner-pin" onOpenSubmissions={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    list.mockResolvedValue({ ...base, unreadCount: 2, items: [{ ...base.items[0], id: "submission:3", title: "مشاركة جديدة الآن" }, base.items[0]] });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(notify).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(notify).toHaveBeenCalledTimes(1);
    cleanup(); const calls = list.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); }); expect(list).toHaveBeenCalledTimes(calls);
  });
});
