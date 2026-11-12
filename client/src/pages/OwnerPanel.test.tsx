// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { saveRemote, saveDraft, clearDraft, publishSaved, summary } = vi.hoisted(() => ({ saveRemote: vi.fn(), saveDraft: vi.fn(), clearDraft: vi.fn(), publishSaved:vi.fn(), summary:vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    management:{
      state:{useMutation:()=>({mutateAsync:vi.fn().mockResolvedValue({content:null,revision:1,publishedRevision:1,hasChanges:false,collections:{templates:[],freeSites:[],submissions:[],templateCategories:[],creativeCategories:[]}}),isPending:false})},
      save:{useMutation:()=>({mutateAsync:saveRemote,isPending:false})},
      summary:{useMutation:()=>({mutateAsync:summary,isPending:false})},
      publish:{useMutation:()=>({mutateAsync:publishSaved,isPending:false})},
    },
    siteContent: {
      get: { useQuery: () => ({ data: null, isLoading: false }) },
      adminGet: { useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue(null), isPending: false }) },
      workingDraft: { useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue(null), isPending: false }) },
      saveWorkingDraft: { useMutation: () => ({ mutateAsync: saveDraft, isPending: false }) },
      clearWorkingDraft: { useMutation: () => ({ mutateAsync: clearDraft, isPending: false }) },
      save: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: saveRemote, isPending: false }) },
      history: { useQuery: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }) },
      backup: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      version: { useQuery: () => ({ data: null, isLoading: false }) },
    },
    pageMedia: { upload: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } },
    ownerSearch: { query: { useQuery: () => ({ data: { items: [], hasMore: false }, isLoading: false }) } },
    templates: {
      recycleBin: { useQuery: () => ({ data: null, isLoading: false }) }, retentionDays: { useQuery: () => ({ data: null, isLoading: false }) },
      restore: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, purge: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      cleanup: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, setRetentionDays: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    useUtils: () => ({
      templates: { recycleBin: { invalidate: vi.fn() }, retentionDays: { invalidate: vi.fn() } },
      siteContent: { version: { fetch: vi.fn() }, get: { invalidate: vi.fn() } },
    }),
  },
}));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("wouter", () => ({ Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a> }));
vi.mock("./OwnerFreeSites", () => ({ default: () => <div data-testid="free-sites-admin" /> }));
vi.mock("./OwnerCreativeSpace", () => ({ default: () => <div data-testid="creative-admin" /> }));
vi.mock("./OwnerCreativeCategories", () => ({ default: () => <div data-testid="categories-admin" /> }));
vi.mock("./OwnerTemplateCategories", () => ({ default: ({ tool }: { tool: string }) => <div data-testid={`template-categories-${tool}`} /> }));
vi.mock("./OwnerBackups", () => ({ default: () => <div data-testid="backups-admin" /> }));
vi.mock("./OwnerWorkspaceTrash", () => ({ default: () => <div data-testid="trash-admin" /> }));
vi.mock("./OwnerNotifications", () => ({ default: ({ onOpenSubmissions, onOpenRequest }: { onOpenSubmissions: () => void; onOpenRequest: (url: string) => void }) => <><button type="button" onClick={onOpenSubmissions}>الإشعارات</button><button type="button" onClick={() => onOpenRequest("/owner/inbox")}>فتح إشعار الطلب</button></> }));
vi.mock("./OwnerCodeWorkspace", () => ({ default: () => <div data-testid="code-admin" /> }));

import OwnerPanel from "./OwnerPanel";

describe("OwnerPanel organization", () => {
  it("opens submissions from owner notifications without saving or publishing", () => {
    render(<OwnerPanel />);
    fireEvent.click(screen.getByRole("button", { name: "الإشعارات" }));
    expect(screen.getByRole("tab", { name: "المشاركات" }).getAttribute("aria-selected")).toBe("true");
    expect(saveRemote).not.toHaveBeenCalled();
    expect(publishSaved).not.toHaveBeenCalled();
  });
  beforeEach(() => { localStorage.clear(); sessionStorage.setItem("abu-kayan-owner-panel", "true");
    saveRemote.mockReset(); saveRemote.mockImplementation(async (input) => ({ success: true, content: input.content,revision:2,hasChanges:true }));
    saveDraft.mockReset(); saveDraft.mockResolvedValue({ success: true, savedAt: Date.now() });
    publishSaved.mockReset();publishSaved.mockResolvedValue({success:true,publishedRevision:2});
    summary.mockReset();summary.mockResolvedValue({revision:2,hasChanges:true,changes:[{kind:"settings",label:"الموقع العام",added:0,updated:1,removed:0}]});
    clearDraft.mockReset(); clearDraft.mockResolvedValue({ success: true });
  });
  afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); });

  it("shows named sections with a compact tabbed organizer", () => {
    render(<OwnerPanel />);
    expect(screen.getByText("الهوية والمحتوى")).toBeTruthy();
    expect(screen.getByText("المظهر العام")).toBeTruthy();
    expect(screen.getByText("مراجعة المشاركات")).toBeTruthy();
    const sections = Array.from(document.querySelectorAll("details.owner-panel-section"));
    expect(sections).toHaveLength(14);
    expect(sections[0].hasAttribute("open")).toBe(true);
    expect(sections.slice(1).every((section) => !section.hasAttribute("open"))).toBe(true);
    expect(screen.getByRole("tablist", { name: "أقسام لوحة التحكم" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "الترحيب والجدولة" }));
    expect(screen.getByRole("heading", { name: "الترحيب والقوالب المجدولة" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "إدارة الصفحات" }));
    expect((sections.find((section) => section.id === "owner-pages") as HTMLDetailsElement | undefined)?.hidden).toBe(false);
    expect(screen.getByRole("heading", { name: /أنشئ صفحاتك وانشرها/ })).toBeTruthy();
  });

  it("shows unsaved state after editing and exposes the global search field", () => {
    render(<OwnerPanel />);
    expect(screen.getByRole("textbox", { name: "البحث الشامل" })).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("نخلي فكرتك"), { target: { value: "عنوان جديد" } });
    expect(screen.getByText("لديك تعديلات غير محفوظة")).toBeTruthy();
    expect((screen.getByRole("button", { name: /حفظ التعديلات/ }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("confirms saving on the server before clearing dirty state", async () => {
    render(<OwnerPanel />);
    fireEvent.change(screen.getByDisplayValue("نخلي فكرتك"), { target: { value: "عنوان محفوظ للجميع" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    await waitFor(() => expect(saveRemote).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("كل التعديلات محفوظة")).toBeTruthy());
    expect(saveRemote.mock.calls[0][0].content.heroTitle).toBe("عنوان محفوظ للجميع");
  });
  it("retains edited values and supports retry after a save failure", async () => {
    saveRemote.mockRejectedValueOnce(new Error("تعذر اتصال قاعدة البيانات"));
    render(<OwnerPanel />);
    fireEvent.change(screen.getByDisplayValue("نخلي فكرتك"), { target: { value: "لا تفقد هذا التعديل" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("تعذر اتصال"));
    expect(screen.getByDisplayValue("لا تفقد هذا التعديل")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    await waitFor(() => expect(screen.getByText("كل التعديلات محفوظة")).toBeTruthy());
  });
  it("guards unsaved edits when opening an inbox notification", () => {
    render(<OwnerPanel />);
    fireEvent.change(screen.getByDisplayValue("نخلي فكرتك"), { target: { value: "لا تضيع مسودتي" } });
    fireEvent.click(screen.getByRole("button", { name: "فتح إشعار الطلب" }));
    expect(screen.getByRole("dialog", { name: "تعديلات غير محفوظة" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "البقاء في الصفحة" }));
    expect(screen.getByDisplayValue("لا تضيع مسودتي")).toBeTruthy();
  });
  it("guards leaving and allows staying without discarding edits", () => {
    const { container } = render(<OwnerPanel />);
    fireEvent.change(screen.getByDisplayValue("نخلي فكرتك"), { target: { value: "مسودة خروج" } });
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    const dialog = screen.getByRole("dialog", { name: "تعديلات غير محفوظة" });
    expect(container.contains(dialog)).toBe(false);
    expect(screen.getByRole("button", { name: "حفظ ومغادرة" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "مغادرة دون حفظ" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "البقاء في الصفحة" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByDisplayValue("مسودة خروج")).toBeTruthy();
  });

  it("saves privately and requires summary plus explicit confirmation before publishing", async()=>{
    render(<OwnerPanel/>);
    fireEvent.change(screen.getByDisplayValue("نخلي فكرتك"),{target:{value:"عنوان خاص حتى الترحيل"}});
    expect((screen.getByRole("button",{name:"ترحيل التعديلات"}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button",{name:"حفظ التعديلات"}));
    await waitFor(()=>expect(screen.getByText("كل التعديلات محفوظة")).toBeTruthy());
    expect(publishSaved).not.toHaveBeenCalled();
    expect(localStorage.getItem("abu-kayan-site-content-v3")||"").not.toContain("عنوان خاص حتى الترحيل");
    fireEvent.click(screen.getByRole("button",{name:"ترحيل التعديلات"}));
    await waitFor(()=>expect(screen.getByRole("dialog",{name:"تأكيد ترحيل التعديلات"})).toBeTruthy());
    expect(publishSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"تأكيد النشر للعامة"}));
    await waitFor(()=>expect(publishSaved).toHaveBeenCalledWith({ownerPin:"770562",revision:2,confirm:true}));
  });
  it("retains private edits if publication fails and never falsely reports publication",async()=>{
    publishSaved.mockRejectedValueOnce(new Error("فشل تأكيد النشر"));
    render(<OwnerPanel/>);
    fireEvent.change(screen.getByDisplayValue("نخلي فكرتك"),{target:{value:"مسودة للنشر لاحقًا"}});
    fireEvent.click(screen.getByRole("button",{name:"حفظ التعديلات"}));
    await waitFor(()=>expect(screen.getByText("كل التعديلات محفوظة")).toBeTruthy());
    fireEvent.click(screen.getByRole("button",{name:"ترحيل التعديلات"}));
    await waitFor(()=>expect(screen.getByRole("button",{name:"تأكيد النشر للعامة"})).toBeTruthy());
    fireEvent.click(screen.getByRole("button",{name:"تأكيد النشر للعامة"}));
    await waitFor(()=>expect(screen.getAllByRole("alert").some(item=>item.textContent?.includes("فشل تأكيد النشر"))).toBe(true));
    expect(screen.getByDisplayValue("مسودة للنشر لاحقًا")).toBeTruthy();
  });

});
