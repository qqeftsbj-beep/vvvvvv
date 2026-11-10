// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { copy, pageQuery } = vi.hoisted(() => ({ copy: vi.fn().mockResolvedValue(undefined), pageQuery: vi.fn() }));
const baseSite = { id: 1, name: "Canva", url: "https://canva.com", description: "تصميم سريع", additionalText: null, imageUrl: "/shot.png", sortOrder: 0, isVisible: 1 };
const image = { id: "i1", pageId: "free-sites:item", name: "مرفق", originalName: "file.jpg", folder: "", description: "", mimeType: "image/jpeg", size: 100, url: "/att.jpg", downloadUrl: "/api/page-media/i1", key: "i1", createdAt: 1 };
const video = { ...image, id: "v1", name: "مقطع", originalName: "clip.mp4", mimeType: "video/mp4", url: "/clip.mp4", downloadUrl: "/api/page-media/v1" };
const file = { ...image, id: "f1", name: "دليل PDF", originalName: "guide.pdf", mimeType: "application/pdf", url: "/guide.pdf", downloadUrl: "/api/page-media/f1" };
vi.mock("@/lib/trpc", () => ({ trpc: { freeSites: { page: { useQuery: (input: unknown) => pageQuery(input) } } } }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: (_path: string, fallback: string) => fallback }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }));
vi.mock("@/contexts/OwnerPreviewContext", () => ({ useOwnerPreview: () => null }));
vi.mock("sonner", () => { const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }); return { toast }; });
vi.mock("wouter", () => ({ Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a> }));

import FreeSites from "./FreeSites";

describe("FreeSites public directory", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    pageQuery.mockReset();
    pageQuery.mockImplementation((input: { page: number }) => ({ data: { items: input.page === 1 ? [{ ...baseSite, attachments: [image, video, file] }] : [{ ...baseSite, id: 2, name: "صفحة ثانية" }], hasMore: input.page === 1, page: input.page }, isLoading: false, isFetching: false }));
    Object.assign(navigator, { clipboard: { writeText: copy } });
  });

  it("shows supplied fields and copy/open actions without attachment duplicates", async () => {
    render(<FreeSites />);
    expect(screen.getByRole("heading", { name: "Canva" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "المواقع المجانية" })).toBeTruthy();
    expect(screen.getByText("تصميم سريع")).toBeTruthy();
    expect(screen.getByAltText("لقطة Canva")).toBeTruthy();
    expect(screen.getByRole("link", { name: /فتح الموقع/ }).getAttribute("href")).toBe("https://canva.com");
    expect(screen.getByLabelText("فيديو مقطع").getAttribute("preload")).toBe("none");
    expect(screen.getByRole("link", { name: "تنزيل الملف: دليل PDF" }).getAttribute("href")).toBe("/api/page-media/f1");
    fireEvent.click(screen.getByRole("button", { name: /نسخ الرابط/ }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith("https://canva.com"));
  });

  it("does not render empty attachment areas", () => {
    pageQuery.mockImplementation(() => ({ data: { items: [baseSite], hasMore: false, page: 1 }, isLoading: false, isFetching: false }));
    const { container } = render(<FreeSites />);
    expect(container.querySelector(".content-attachments")).toBeNull();
  });

  it("loads the next server page only when requested", () => {
    render(<FreeSites />);
    expect(screen.queryByRole("heading", { name: "صفحة ثانية" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "تحميل المزيد" }));
    expect(pageQuery).toHaveBeenLastCalledWith({ page: 2, pageSize: 12 });
    expect(screen.getByRole("heading", { name: "صفحة ثانية" })).toBeTruthy();
  });
});
