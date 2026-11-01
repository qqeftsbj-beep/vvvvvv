// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
vi.mock("@/lib/trpc", () => ({
  trpc: { creativeSpace: { list: { useQuery: () => ({ data: [{ id: 1, projectName: "مشروع جميل", description: "وصف المشروع", category: "graphic-design", imageUrls: ["/one.jpg", "/two.jpg"], link: null, contact: null }], isLoading: false }) }, create: { useMutation: () => ({ mutate, isPending: false }) } }, creativeCategories: { list: { useQuery: () => ({ data: [{ id: 1, name: "الجرافيك والتصميم", slug: "graphic-design" }], isLoading: false }) } } },
}));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }));
vi.mock("sonner", () => { const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }); return { toast }; });
vi.mock("wouter", () => ({ Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a> }));

import CreativeSpace from "./CreativeSpace";

describe("CreativeSpace public submissions", () => {
  afterEach(() => cleanup());
  beforeEach(() => mutate.mockClear());
  it("shows approved cards and requires both description and category", async () => {
    render(<CreativeSpace />);
    expect(screen.getByRole("heading", { name: "مشروع جميل" })).toBeTruthy();
    expect(screen.queryByText("بيانات التواصل (اختياري)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /أضف مشروعك/ }));
    expect(screen.getByRole("dialog", { name: "إضافة مشروع" })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("اكتب وصفًا مختصرًا وواضحًا..."), { target: { value: "تعريف مختصر" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "graphic-design" } });
    fireEvent.click(screen.getByRole("button", { name: /إرسال للمراجعة/ }));
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ projectName: "", description: "تعريف مختصر", category: "graphic-design", imageData: [] })));
  });

  it("updates the live preview while the visitor fills the form", () => {
    render(<CreativeSpace />);
    fireEvent.click(screen.getByRole("button", { name: /أضف مشروعك/ }));
    fireEvent.change(screen.getByPlaceholderText("مثال: استوديو ورد"), { target: { value: "استوديو المعاينة" } });
    fireEvent.change(screen.getByPlaceholderText("اكتب وصفًا مختصرًا وواضحًا..."), { target: { value: "وصف يظهر فورًا" } });
    expect(screen.getByText("استوديو المعاينة")).toBeTruthy();
    expect(screen.getAllByText("وصف يظهر فورًا")).toHaveLength(2);
  });

  it("does not submit when the mandatory description or category is missing", () => {
    render(<CreativeSpace />);
    fireEvent.click(screen.getByRole("button", { name: /أضف مشروعك/ }));
    fireEvent.click(screen.getByRole("button", { name: /إرسال للمراجعة/ }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("opens a multi-image grid in a navigable full-size gallery", () => {
    render(<CreativeSpace />);
    const imageButtons = screen.getAllByRole("button", { name: /تكبير صورة مشروع جميل/ });
    expect(imageButtons).toHaveLength(2);
    fireEvent.click(imageButtons[0]);
    expect(screen.getByRole("dialog", { name: "عارض الصور" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "الصورة التالية" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "الصورة التالية" }));
    expect(screen.getByAltText("عرض مكبر").getAttribute("src")).toBe("/two.jpg");
  });
});
