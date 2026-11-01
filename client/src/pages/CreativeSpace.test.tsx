// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
vi.mock("@/lib/trpc", () => ({
  trpc: { creativeSpace: { list: { useQuery: () => ({ data: [{ id: 1, projectName: "مشروع جميل", description: "وصف المشروع", category: "graphic-design", imageUrls: [], link: null, contact: null }], isLoading: false }) }, create: { useMutation: () => ({ mutate, isPending: false }) } }, creativeCategories: { list: { useQuery: () => ({ data: [{ id: 1, name: "الجرافيك والتصميم", slug: "graphic-design" }], isLoading: false }) } } },
}));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }));
vi.mock("sonner", () => { const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }); return { toast }; });
vi.mock("wouter", () => ({ Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a> }));

import CreativeSpace from "./CreativeSpace";

describe("CreativeSpace public submissions", () => {
  afterEach(() => cleanup());
  it("shows approved cards and submits required project details without empty optional blocks", async () => {
    render(<CreativeSpace />);
    expect(screen.getByRole("heading", { name: "مشروع جميل" })).toBeTruthy();
    expect(screen.getByText("بيانات التواصل (اختياري)")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("مثال: استوديو ورد"), { target: { value: "مشروعي" } });
    fireEvent.change(screen.getByPlaceholderText("اكتب وصفًا مختصرًا وواضحًا..."), { target: { value: "تعريف مختصر" } });
    fireEvent.click(screen.getByRole("button", { name: /إرسال للمراجعة/ }));
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ projectName: "مشروعي", description: "تعريف مختصر", imageData: [] })));
  });
});
