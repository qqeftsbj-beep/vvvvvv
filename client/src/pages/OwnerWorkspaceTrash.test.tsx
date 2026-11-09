// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { trashAsync, restoreAsync, purgeAsync, toastSuccess, toastError } = vi.hoisted(() => ({
  trashAsync: vi.fn(), restoreAsync: vi.fn().mockResolvedValue({ success: true }), purgeAsync: vi.fn().mockResolvedValue({ success: true }), toastSuccess: vi.fn(), toastError: vi.fn(),
}));
const rows = [{ id: "trash-1", kind: "submission", title: "مشروع محذوف", source: "مساحة الإبداع", deletedAt: "2026-11-08T12:00:00Z", value: { description: "وصف محفوظ", imageUrl: "/old.jpg" } }];
vi.mock("@/lib/trpc", () => ({ trpc: { management: { trash: { useMutation: () => ({ mutateAsync: trashAsync }) }, restoreTrash: { useMutation: () => ({ mutateAsync: restoreAsync }) }, purgeTrash: { useMutation: () => ({ mutateAsync: purgeAsync }) } } } }));
vi.mock("@/components/OwnerModal", () => ({ default: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div role="dialog">{children}</div> : null }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

import OwnerWorkspaceTrash from "./OwnerWorkspaceTrash";

describe("OwnerWorkspaceTrash", () => {
  afterEach(() => cleanup());
  beforeEach(() => { vi.clearAllMocks(); trashAsync.mockResolvedValue(rows); });

  it("loads searchable selectable cards and previews without deleting files", async () => {
    render(<OwnerWorkspaceTrash ownerPin="1234" onWorkspaceChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("مشروع محذوف")).toBeTruthy());
    fireEvent.change(screen.getByRole("textbox", { name: "البحث في السلة" }), { target: { value: "الإبداع" } });
    expect(screen.getByText("مشروع محذوف")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "معاينة" }));
    expect(screen.getByRole("dialog").textContent).toContain("وصف محفوظ");
    fireEvent.click(screen.getByRole("checkbox", { name: "تحديد مشروع محذوف" }));
    expect(screen.getByText(/1 محدد/)).toBeTruthy();
  });

  it("requires targeted confirmation for restore and permanent purge", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<OwnerWorkspaceTrash ownerPin="1234" />);
    await waitFor(() => expect(screen.getByText("مشروع محذوف")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /استعادة/ }));
    await waitFor(() => expect(restoreAsync).toHaveBeenCalledWith({ ownerPin: "1234", id: "trash-1" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("استعادة"));
    trashAsync.mockResolvedValue(rows);
    render(<OwnerWorkspaceTrash ownerPin="1234" />);
    await waitFor(() => expect(screen.getAllByText("مشروع محذوف").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: /حذف نهائي/ })[0]);
    await waitFor(() => expect(purgeAsync).toHaveBeenCalledWith({ ownerPin: "1234", id: "trash-1", confirm: true }));
    expect(toastSuccess).toHaveBeenCalled();
    confirm.mockRestore();
  });
});
