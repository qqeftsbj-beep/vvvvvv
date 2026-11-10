// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mutate, pageQuery, byIdQuery } = vi.hoisted(() => ({
  mutate: vi.fn((_input: unknown, callbacks?: { onSuccess?: () => void }) => callbacks?.onSuccess?.()),
  pageQuery: vi.fn((input: { page: number; category?: string; search?: string }) => {
    const cache = (globalThis as any).__templateStudioPageCache || ((globalThis as any).__templateStudioPageCache = new Map());
    const key = JSON.stringify(input);
    if (!cache.has(key)) cache.set(key, { data: { items: input.page === 1 ? [{ id: 8, text: "هذه رسالة طويلة لاختبار عرض القالب بطريقة تشبه رسالة الواتساب مع إمكانية القراءة الموسعة والنسخ والمشاركة المباشرة عبر الرابط.".repeat(4), imageUrl: "/manus-storage/shared.png", previewUrl: "/manus-storage/shared-preview.webp", imageName: "shared.png", mediaType: "image", category: "gemini-weddings", createdAt: "2026-09-16T12:00:00.000Z" }] : [{ id: 9, text: "القالب الثاني", imageUrl: "/manus-storage/second.png", previewUrl: null, imageName: "second.png", mediaType: "image", category: "gemini-weddings", createdAt: "2026-09-17T12:00:00.000Z" }], hasMore: input.page === 1, page: input.page, total: 2 }, isLoading: false, isFetching: false });
    return cache.get(key);
  }),
  byIdQuery: vi.fn((input: { id: number }) => ({ data: input.id === 99 ? { id: 99, text: "قالب عبر الرابط المباشر", imageUrl: "/direct.png", previewUrl: null, imageName: "direct.png", mediaType: "image", category: "gemini-weddings", createdAt: "2026-09-18T12:00:00.000Z" } : undefined, isLoading: false })),
}));
const longTemplateText = "هذه رسالة طويلة لاختبار عرض القالب بطريقة تشبه رسالة الواتساب مع إمكانية القراءة الموسعة والنسخ والمشاركة المباشرة عبر الرابط.".repeat(4);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    templates: {
      page: { useQuery: pageQuery },
      byId: { useQuery: byIdQuery },
      adminList: { useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue([{ id: 8, tool: "Gemini", text: longTemplateText, imageUrl: "/manus-storage/shared.png", imageName: "shared.png", mediaType: "image", category: "gemini-weddings", createdAt: "2026-09-16T12:00:00.000Z" }]) }) },
      create: { useMutation: () => ({ mutate, isPending: false }) },
      update: { useMutation: () => ({ mutate, isPending: false }) },
      remove: { useMutation: () => ({ mutate, isPending: false }) },
    },
    templateCategories: {
      adminWithPassword: { useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue([{ id: 1, tool: "Gemini", name: "الأعراس والمناسبات", slug: "gemini-weddings", sortOrder: 1, isVisible: 1 }]) }) },
      list: { useQuery: () => ({ data: [{ id: 1, tool: "Gemini", name: "الأعراس والمناسبات", slug: "gemini-weddings", sortOrder: 1, isVisible: 1 }, { id: 2, tool: "Gemini", name: "تهاني العيد الطويلة", slug: "gemini-eid", sortOrder: 2, isVisible: 1 }], isLoading: false }) },
    },
    siteContent: { navigation: { useQuery: () => ({ data: null }) } },
    useUtils: () => ({ templates: { page: { invalidate: vi.fn() }, list: { invalidate: vi.fn() } }, templateCategories: { list: { invalidate: vi.fn() } } }),
  },
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn(), switchable: true }) }));
vi.mock("@/contexts/OwnerPreviewContext", () => ({ useOwnerPreview: () => null }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => { const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }); return { toast }; });
vi.mock("wouter", () => ({ Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a> }));

import TemplateStudio from "./TemplateStudio";

describe("TemplateStudio interactive flow", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    mutate.mockClear(); pageQuery.mockClear(); byIdQuery.mockClear(); (globalThis as any).__templateStudioPageCache = new Map();
    window.localStorage.clear(); window.sessionStorage.clear();
    window.history.replaceState({}, "", "/templates/gemini");
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("opens the protected creator, clears it after saving, and accepts a second template", async () => {
    const { container } = render(<TemplateStudio toolName="Gemini" toolLabel="Gemini" />);
    fireEvent.click(screen.getByRole("button", { name: "إضافة قالب جديد" }));
    fireEvent.change(screen.getByLabelText("كلمة مرور القوالب"), { target: { value: "7705" } });
    fireEvent.click(screen.getByRole("button", { name: "فتح الإضافة" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const textArea = screen.getByPlaceholderText("اكتب التهنئة أو النص الذي تريد الاحتفاظ به...");
    expect(screen.getByLabelText("قسم التصميم")).toBeTruthy();
    fireEvent.change(input, { target: { files: [new File(["first"], "first.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText(/first\.png/)).toBeTruthy());
    fireEvent.change(textArea, { target: { value: "القالب الأول" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ القالب" }));
    await waitFor(() => expect(screen.queryByPlaceholderText("اكتب التهنئة أو النص الذي تريد الاحتفاظ به...")).toBeNull());
    expect(screen.getByRole("button", { name: "إضافة قالب جديد" })).toBeTruthy();
    expect(input.value).toBe("");
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({ category: "gemini-weddings" });
    fireEvent.click(screen.getByRole("button", { name: "إضافة قالب جديد" }));
    const secondInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const secondTextArea = screen.getByPlaceholderText("اكتب التهنئة أو النص الذي تريد الاحتفاظ به...");
    fireEvent.change(secondInput, { target: { files: [new File(["second"], "second.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText(/second\.png/)).toBeTruthy());
    fireEvent.change(secondTextArea, { target: { value: "القالب الثاني" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ القالب" }));
    await waitFor(() => expect(screen.queryByPlaceholderText("اكتب التهنئة أو النص الذي تريد الاحتفاظ به...")).toBeNull());
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it("renders the text, full-size download, preview thumbnail, and direct share link", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const { container } = render(<TemplateStudio toolName="Gemini" toolLabel="Gemini" />);
    expect(screen.getByText("قراءة المزيد")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "قراءة المزيد" }));
    expect(screen.getByText(longTemplateText)).toBeTruthy();
    expect(screen.getByText(/template=8/)).toBeTruthy();
    expect(container.querySelector('img[src="/manus-storage/shared-preview.webp"]')?.getAttribute("loading")).toBe("lazy");
    fireEvent.click(screen.getByRole("button", { name: "مشاركة رابط القالب" }));
    await waitFor(() => expect(screen.getByText(/template=8/)).toBeTruthy());
  });

  it("opens an existing template in the modal and saves without re-uploading its storage URL", async () => {
    window.sessionStorage.setItem("abu-kayan-templates-gemini-owner", "true");
    render(<TemplateStudio toolName="Gemini" toolLabel="Gemini" />);
    fireEvent.click(await screen.findByRole("button", { name: "فتح قالب 1" }));
    const textArea = await screen.findByDisplayValue(longTemplateText);
    fireEvent.change(textArea, { target: { value: "تعديل سريع" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ القالب" }));
    await waitFor(() => expect(screen.queryByDisplayValue("تعديل سريع")).toBeNull());
    expect(mutate.mock.calls.at(-1)?.[0]).toMatchObject({ id: 8, text: "تعديل سريع" });
    expect(mutate.mock.calls.at(-1)?.[0]).not.toHaveProperty("mediaData");
  });

  it("keeps the add action reachable after category selection and protects creator with a password", () => {
    render(<TemplateStudio toolName="Gemini" toolLabel="Gemini" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "تهاني العيد الطويلة" }));
    expect(screen.getByRole("tab", { name: "تهاني العيد الطويلة" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "إضافة قالب جديد" }));
    expect(screen.getByRole("dialog", { name: "قالب جديد" })).toBeTruthy();
    expect(screen.getByLabelText("كلمة مرور القوالب")).toBeTruthy();
    expect(screen.queryByPlaceholderText("اكتب التهنئة أو النص الذي تريد الاحتفاظ به...")).toBeNull();
  });

  it("keeps an edited template when closing and confirms discarding explicitly", async () => {
    window.sessionStorage.setItem("abu-kayan-templates-gemini-owner", "true");
    const { container } = render(<TemplateStudio toolName="Gemini" toolLabel="Gemini" />);
    fireEvent.click(await screen.findByRole("button", { name: "فتح قالب 1" }));
    const dialog = screen.getByRole("dialog", { name: "تعديل قالب محفوظ" });
    expect(container.contains(dialog)).toBe(false);
    fireEvent.change(screen.getByDisplayValue(longTemplateText), { target: { value: "مسودة لم أحفظها" } });
    fireEvent.click(screen.getByRole("button", { name: "إغلاق تعديل قالب محفوظ" }));
    expect(screen.getByRole("dialog", { name: "تعديلات القالب غير محفوظة" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "العودة إلى التحرير" }));
    expect(screen.getByDisplayValue("مسودة لم أحفظها")).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "إغلاق تعديل قالب محفوظ" }));
    fireEvent.click(screen.getByRole("button", { name: "مغادرة دون حفظ" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("requests 12-item pages, filters server-side, and loads more on demand", async () => {
    render(<TemplateStudio toolName="Gemini" toolLabel="Gemini" />);
    expect(pageQuery).toHaveBeenCalledWith(expect.objectContaining({ tool: "Gemini", page: 1, pageSize: 12 }), expect.any(Object));
    expect(screen.getByText(/template=8/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "تحميل المزيد" }));
    await waitFor(() => expect(screen.getByText("القالب الثاني")).toBeTruthy());
    expect(pageQuery).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 12 }), expect.any(Object));
    fireEvent.click(screen.getByRole("tab", { name: "تهاني العيد الطويلة" }));
    await waitFor(() => expect(pageQuery).toHaveBeenCalledWith(expect.objectContaining({ page: 1, category: "gemini-eid" }), expect.any(Object)));
    fireEvent.change(screen.getByRole("textbox", { name: "ابحث في القوالب" }), { target: { value: "فرح" } });
    await waitFor(() => expect(pageQuery).toHaveBeenCalledWith(expect.objectContaining({ page: 1, category: "gemini-eid", search: "فرح" }), expect.any(Object)), { timeout: 1200 });
  });

  it("loads a deep-linked template by ID when it is outside the first page", async () => {
    window.history.replaceState({}, "", "/templates/gemini?template=99");
    render(<TemplateStudio toolName="Gemini" toolLabel="Gemini" />);
    expect(byIdQuery).toHaveBeenCalledWith({ id: 99, tool: "Gemini" }, expect.objectContaining({ enabled: true }));
    expect(await screen.findByText("قالب عبر الرابط المباشر")).toBeTruthy();
  });
});
