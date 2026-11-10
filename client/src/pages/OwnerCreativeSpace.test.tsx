// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { updateAsync, removeAsync, createAsync, adminPageAsync, invalidate, register, dirty, toastSuccess, toastError } = vi.hoisted(() => ({
  updateAsync: vi.fn().mockResolvedValue({ success: true }),
  removeAsync: vi.fn().mockResolvedValue({ success: true }),
  createAsync: vi.fn().mockResolvedValue({ id: 99, status: "approved", reviewState: "saved", isVisible: 1 }),
  adminPageAsync: vi.fn(),
  invalidate: vi.fn(),
  register: vi.fn(),
  dirty: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
const submission = { id: 7, projectName: "استوديو ورد", description: "تصميم هادئ", category: "design", imageUrls: ["/flower.jpg", "/detail.jpg"], link: "https://example.com/work", contact: "@studio", status: "pending", isVisible: 0, sortOrder: 1, reviewState: "inbox" };
const secondSubmission = { ...submission, id: 8, projectName: "استوديو ثانٍ" };
const pageResult = (state: string, page: number) => {
  const rows = state === "inbox" ? (page === 2 ? [secondSubmission] : [submission]) : state === "waiting" ? [{ ...submission, reviewState: "waiting" }] : state === "cancelled" ? [{ ...submission, status: "rejected", reviewState: "cancelled" }] : [];
  const totals: Record<string, number> = { inbox: 13, saved: 7, waiting: 1, cancelled: 2 };
  return { items: rows, hasMore: state === "inbox" && page === 1, total: totals[state] || 0, pendingCount: 15, page };
};
adminPageAsync.mockImplementation(async (input: { page?: number; reviewState?: string }) => pageResult(input.reviewState || "inbox", input.page || 1));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    sharedContent: { adminPage: { useMutation: () => ({ mutateAsync: adminPageAsync, isPending: false }) } },
    management:{workingEntityUpdate:{useMutation:()=>({mutateAsync:updateAsync})},workingEntityRemove:{useMutation:()=>({mutateAsync:removeAsync})}},
    creativeSpace: { adminList: { useQuery: () => ({ data: [submission], isLoading: false }) }, page: { invalidate }, list: { invalidate }, createWithPin:{useMutation:()=>({mutateAsync:createAsync,isPending:false})}, update: { useMutation: () => ({ mutateAsync: updateAsync }) }, remove: { useMutation: () => ({ mutateAsync: removeAsync }) } },
    creativeCategories: { adminList: { useQuery: () => ({ data: [{ slug: "design", name: "تصميم" }] }) }, list: { useQuery: () => ({ data: [{ slug: "design", name: "تصميم" }] }) } },
    useUtils: () => ({ creativeSpace: { adminList: { invalidate }, page: { invalidate }, list: { invalidate } } }),
  },
}));
vi.mock("@/components/OwnerModal", () => ({ default: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

import OwnerCreativeSpace from "./OwnerCreativeSpace";

describe("OwnerCreativeSpace", () => {
  afterEach(() => { cleanup(); window.dispatchEvent(new Event("abu-kayan-shared-content-updated")); });
  beforeEach(() => { vi.clearAllMocks(); adminPageAsync.mockImplementation(async (input: { page?: number; reviewState?: string }) => pageResult(input.reviewState || "inbox", input.page || 1)); register.mockImplementation((callback) => { if (callback) (globalThis as any).__saveCreative = callback; }); });

  it("loads bounded, independent moderation-group pages and displays the global pending total", async () => {
    render(<OwnerCreativeSpace unlocked ownerPin="1234" onDirtyChange={dirty} onSaveRegister={register} />);
    await waitFor(() => expect(screen.getByText("13 عنصر")).toBeTruthy());
    expect(adminPageAsync).toHaveBeenCalledWith({ ownerPin: "1234", kind: "submissions", reviewState: "inbox", page: 1, pageSize: 12 });
    expect(adminPageAsync).toHaveBeenCalledWith({ ownerPin: "1234", kind: "submissions", reviewState: "saved", page: 1, pageSize: 12 });
    expect(screen.getByText("15 مشاركة قيد المراجعة")).toBeTruthy();
  });

  it("keeps sections independent, opens a visitor-style preview, and exposes detail editing on demand", async () => {
    render(<OwnerCreativeSpace unlocked ownerPin="1234" onDirtyChange={dirty} onSaveRegister={register} />);
    expect(screen.getAllByText("الوارد").length).toBeGreaterThan(0);
    await waitFor(()=>expect(screen.getByRole("button", { name: /الوارد/ })).toBeTruthy());
    expect(screen.getByRole("button", { name: /المحفوظة/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /فتح معاينة كاملة استوديو ورد/ }));
    expect(screen.getByRole("dialog", { name: "استوديو ورد" })).toBeTruthy();
    expect(screen.getAllByAltText("استوديو ورد")[0]?.getAttribute("src")).toBe("/flower.jpg");
    fireEvent.click(await screen.findByRole("button", { name: "تحرير التفاصيل" }));
    expect(screen.getByDisplayValue("تصميم هادئ")).toBeTruthy();
  });

  it("immediately approves an inbox item on save and clears only the confirmed draft", async () => {
    render(<OwnerCreativeSpace unlocked ownerPin="1234" onDirtyChange={dirty} onSaveRegister={register} />);
    fireEvent.click(await screen.findByRole("button", { name: "تحرير التفاصيل" }));
    fireEvent.change(screen.getByDisplayValue("تصميم هادئ"), { target: { value: "وصف معدل" } });
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole("button", { name: "حفظ وإتاحة" }));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith(expect.objectContaining({ownerPin:"1234",kind:"submissions",id:7,patch:expect.objectContaining({description:"وصف معدل",reviewState:"saved",status:"approved",isVisible:1})})));
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("lets the owner add standalone content and reports availability after confirmation", async () => {
    render(<OwnerCreativeSpace unlocked ownerPin="1234" onDirtyChange={dirty} onSaveRegister={register} />);
    fireEvent.click(screen.getByRole("button", { name: "إضافة محتوى" }));
    const nameInput=screen.getByText("اسم المشروع").parentElement?.querySelector("input");
    expect(nameInput).toBeTruthy();
    fireEvent.change(nameInput!, { target: { value: "عمل جديد" } });
    fireEvent.click(screen.getByRole("button", { name: "إضافة وإتاحة" }));
    await waitFor(()=>expect(createAsync).toHaveBeenCalledWith(expect.objectContaining({ownerPin:"1234",projectName:"عمل جديد",category:"design",attachments:[],imageUrls:[]})));
    expect(toastSuccess).toHaveBeenCalledWith("تمت إضافة المحتوى وإتاحته مباشرةً.");
  });

  it("keeps waiting and cancelled moderation states nonpublic", async () => {
    render(<OwnerCreativeSpace unlocked ownerPin="1234" onDirtyChange={dirty} onSaveRegister={register} />);
    fireEvent.click(await screen.findByRole("button", { name: "انتظار" }));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith(expect.objectContaining({patch:expect.objectContaining({reviewState:"waiting",status:"pending",isVisible:0})})));
    cleanup();
    adminPageAsync.mockImplementation(async (input: { page?: number; reviewState?: string }) => input.reviewState === "inbox" ? { ...pageResult("inbox", input.page || 1), items: [submission] } : pageResult(input.reviewState || "inbox", input.page || 1));
    render(<OwnerCreativeSpace unlocked ownerPin="1234" onDirtyChange={dirty} onSaveRegister={register} />);
    fireEvent.click(await screen.findByRole("button", { name: "إلغاء" }));
    await waitFor(() => expect(updateAsync).toHaveBeenLastCalledWith(expect.objectContaining({patch:expect.objectContaining({reviewState:"cancelled",status:"rejected",isVisible:0})})));
  });

  it("refreshes the active group pages on shared updates without replacing unsaved form edits", async () => {
    render(<OwnerCreativeSpace unlocked ownerPin="1234" onDirtyChange={dirty} onSaveRegister={register} />);
    const inbox=screen.getByRole("navigation", { name: "صفحات الوارد" });
    const next=within(inbox).getByRole("button", { name: /التالي/ });
    await waitFor(()=>expect((next as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(next);
    await waitFor(() => expect(adminPageAsync).toHaveBeenCalledWith({ ownerPin: "1234", kind: "submissions", reviewState: "inbox", page: 2, pageSize: 12 }));
    await waitFor(() => expect(within(inbox).getByText("صفحة 2 من 2")).toBeTruthy());
    fireEvent.click(await screen.findByRole("button", { name: /تحرير التفاصيل/ }));
    fireEvent.change(screen.getByDisplayValue("تصميم هادئ"), { target: { value: "تعديل محلي" } });
    const before=adminPageAsync.mock.calls.length;
    window.dispatchEvent(new Event("abu-kayan-shared-content-updated"));
    await waitFor(() => expect(adminPageAsync.mock.calls.length).toBeGreaterThan(before));
    expect(adminPageAsync).toHaveBeenCalledWith({ ownerPin: "1234", kind: "submissions", reviewState: "inbox", page: 2, pageSize: 12 });
    expect(screen.getByDisplayValue("تعديل محلي")).toBeTruthy();
  });

  it("registers a global saver that can flush hidden local edits", async () => {
    render(<OwnerCreativeSpace unlocked ownerPin="1234" onDirtyChange={dirty} onSaveRegister={register} />);
    fireEvent.click(await screen.findByRole("button", { name: "تحرير التفاصيل" }));
    fireEvent.change(screen.getByDisplayValue("استوديو ورد"), { target: { value: "اسم جديد" } });
    expect((globalThis as any).__saveCreative).toBeTypeOf("function");
    await expect((globalThis as any).__saveCreative()).resolves.toBe(true);
    expect(updateAsync).toHaveBeenCalledWith(expect.objectContaining({patch:expect.objectContaining({projectName:"اسم جديد",reviewState:"saved",status:"approved",isVisible:1})}));
  });
});
