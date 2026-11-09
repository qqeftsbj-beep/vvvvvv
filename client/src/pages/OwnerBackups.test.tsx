// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { historyAsync, backupAsync, versionAsync, restoreAsync, deleteAsync, toastSuccess, toastError } = vi.hoisted(() => ({
  historyAsync: vi.fn().mockResolvedValue([{ id: "v-1", name: "نسخة نوفمبر", createdAt: "2026-11-08T12:00:00Z", size: 2048, type: "snapshot" }]),
  backupAsync: vi.fn().mockResolvedValue({ success: true }),
  versionAsync: vi.fn().mockResolvedValue({ heroTitle: "عنوان محفوظ", pages: [], buttons: [], services: [] }),
  restoreAsync: vi.fn().mockResolvedValue({ content: { heroTitle: "عنوان مستعاد", pages: [], buttons: [], services: [] } }),
  deleteAsync: vi.fn().mockResolvedValue({ success: true }),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    management: {
      history: { useMutation: () => ({ mutateAsync: historyAsync }) },
      backup: { useMutation: () => ({ mutateAsync: backupAsync, isPending: false }) },
      version: { useMutation: () => ({ mutateAsync: versionAsync }) },
      restoreVersion: { useMutation: () => ({ mutateAsync: restoreAsync }) },
      deleteVersion: { useMutation: () => ({ mutateAsync: deleteAsync }) },
    },
    siteContent: { history: { useQuery: () => ({ data: [], isLoading: false }) }, backup: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } },
    useUtils: () => ({ siteContent: { version: { fetch: vi.fn() } } }),
  },
}));
vi.mock("@/components/OwnerModal", () => ({ default: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

import OwnerBackups from "./OwnerBackups";

describe("OwnerBackups", () => {
  afterEach(() => cleanup());
  beforeEach(() => { vi.clearAllMocks(); historyAsync.mockResolvedValue([{ id: "v-1", name: "نسخة نوفمبر", createdAt: "2026-11-08T12:00:00Z", size: 2048, type: "snapshot" }]); });

  it("keeps the list collapsed until عرض النسخ الاحتياطية is pressed", async () => {
    render(<OwnerBackups ownerPin="1234" onRestore={vi.fn()} />);
    expect(screen.queryByText("نسخة نوفمبر")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /عرض النسخ الاحتياطية/ }));
    await waitFor(() => expect(screen.getByText("نسخة نوفمبر")).toBeTruthy());
    expect(screen.getAllByText(/2048|2 KB/).length).toBeGreaterThan(0);
  });

  it("previews and restores only after targeted confirmation", async () => {
    const onRestore = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<OwnerBackups ownerPin="1234" onRestore={onRestore} />);
    fireEvent.click(screen.getByRole("button", { name: /عرض النسخ الاحتياطية/ }));
    await waitFor(() => expect(screen.getByText("نسخة نوفمبر")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "معاينة" }));
    await waitFor(() => expect(versionAsync).toHaveBeenCalledWith({ ownerPin: "1234", id: "v-1" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /تحميل كمسودة خاصة/ }));
    await waitFor(() => expect(restoreAsync).toHaveBeenCalledWith({ ownerPin: "1234", id: "v-1" }));
    expect(onRestore).toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("نسخة نوفمبر"));
    confirm.mockRestore();
  });

  it("deletes only the named version after confirmation and never prunes the list", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<OwnerBackups ownerPin="1234" onRestore={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /عرض النسخ الاحتياطية/ }));
    await waitFor(() => expect(screen.getByText("نسخة نوفمبر")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /حذف هذه النسخة/ }));
    await waitFor(() => expect(deleteAsync).toHaveBeenCalledWith({ ownerPin: "1234", id: "v-1", confirm: true }));
    expect(toastSuccess).toHaveBeenCalled();
    confirm.mockRestore();
  });
});
