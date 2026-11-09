// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { updateAsync, removeAsync, invalidate, register, dirty, toastSuccess, toastError } = vi.hoisted(() => ({
  updateAsync: vi.fn().mockResolvedValue({ success: true }),
  removeAsync: vi.fn().mockResolvedValue({ success: true }),
  invalidate: vi.fn(),
  register: vi.fn(),
  dirty: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
const submission = { id: 7, projectName: "استوديو ورد", description: "تصميم هادئ", category: "design", imageUrls: ["/flower.jpg", "/detail.jpg"], link: "https://example.com/work", contact: "@studio", status: "pending", isVisible: 0, sortOrder: 1 };
vi.mock("@/lib/trpc", () => ({
  trpc: {
    management:{state:{useMutation:()=>({mutateAsync:vi.fn().mockResolvedValue({collections:{submissions:[submission],creativeCategories:[{slug:"design",name:"تصميم"}]}})})},workingEntityUpdate:{useMutation:()=>({mutateAsync:updateAsync})},workingEntityRemove:{useMutation:()=>({mutateAsync:removeAsync})}},
    creativeSpace: { adminList: { useQuery: () => ({ data: [submission], isLoading: false }) }, list: { invalidate }, update: { useMutation: () => ({ mutateAsync: updateAsync }) }, remove: { useMutation: () => ({ mutateAsync: removeAsync }) } },
    creativeCategories: { adminList: { useQuery: () => ({ data: [{ slug: "design", name: "تصميم" }] }) } },
    useUtils: () => ({ creativeSpace: { adminList: { invalidate }, list: { invalidate } } }),
  },
}));
vi.mock("@/components/OwnerModal", () => ({ default: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

import OwnerCreativeSpace from "./OwnerCreativeSpace";

describe("OwnerCreativeSpace", () => {
  afterEach(() => cleanup());
  beforeEach(() => { vi.clearAllMocks(); register.mockImplementation((callback) => { if (callback) (globalThis as any).__saveCreative = callback; }); });

  it("keeps sections independent, opens a visitor-style preview, and exposes detail editing on demand", async () => {
    render(<OwnerCreativeSpace unlocked ownerPin="1234" onDirtyChange={dirty} onSaveRegister={register} />);
    expect(screen.getAllByText("الوارد").length).toBeGreaterThan(0);
    await waitFor(()=>expect(screen.getByText("1 عنصر")).toBeTruthy());
    expect(screen.getByText("المحفوظة")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /فتح معاينة كاملة استوديو ورد/ }));
    expect(screen.getByRole("dialog", { name: "استوديو ورد" })).toBeTruthy();
    expect(screen.getAllByAltText("استوديو ورد")[0]?.getAttribute("src")).toBe("/flower.jpg");
    fireEvent.click(await screen.findByRole("button", { name: "تحرير التفاصيل" }));
    expect(screen.getByDisplayValue("تصميم هادئ")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /المحفوظة/ }));
    await waitFor(()=>expect(screen.getByText("1 عنصر")).toBeTruthy());
    expect(screen.getByText("استوديو ورد")).toBeTruthy();
  });

  it("maps save to private approved visibility and clears only the confirmed draft", async () => {
    render(<OwnerCreativeSpace unlocked ownerPin="1234" onDirtyChange={dirty} onSaveRegister={register} />);
    fireEvent.click(await screen.findByRole("button", { name: "تحرير التفاصيل" }));
    fireEvent.change(screen.getByDisplayValue("تصميم هادئ"), { target: { value: "وصف معدل" } });
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole("button", { name: "حفظ التفاصيل" }));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith(expect.objectContaining({id:7,ownerPin:"1234",kind:"submissions",patch:expect.objectContaining({description:"وصف معدل",reviewState:"inbox",status:"pending",isVisible:0})})));
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(updateAsync).toHaveBeenLastCalledWith(expect.objectContaining({patch:expect.objectContaining({reviewState:"saved",status:"approved",isVisible:1})})));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("registers a global saver that can flush hidden local edits", async () => {
    render(<OwnerCreativeSpace unlocked ownerPin="1234" onDirtyChange={dirty} onSaveRegister={register} />);
    fireEvent.click(await screen.findByRole("button", { name: "تحرير التفاصيل" }));
    fireEvent.change(screen.getByDisplayValue("استوديو ورد"), { target: { value: "اسم جديد" } });
    expect((globalThis as any).__saveCreative).toBeTypeOf("function");
    await expect((globalThis as any).__saveCreative()).resolves.toBe(true);
    expect(updateAsync).toHaveBeenCalledWith(expect.objectContaining({patch:expect.objectContaining({projectName:"اسم جديد"})}));
  });
});
