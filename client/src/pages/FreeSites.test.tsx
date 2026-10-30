// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const copy = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/trpc", () => ({
  trpc: { freeSites: { list: { useQuery: () => ({ data: [{ id: 1, name: "Canva", url: "https://canva.com", description: "تصميم سريع", additionalText: null, imageUrl: "/shot.png", sortOrder: 0, isVisible: 1 }], isLoading: false }) } } },
}));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }));
vi.mock("sonner", () => { const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }); return { toast }; });
vi.mock("wouter", () => ({ Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a> }));

import FreeSites from "./FreeSites";

describe("FreeSites public directory", () => {
  afterEach(() => cleanup());

  it("shows only supplied fields and provides open and copy actions", async () => {
    Object.assign(navigator, { clipboard: { writeText: copy } });
    render(<FreeSites />);
    expect(screen.getByRole("heading", { name: "Canva" })).toBeTruthy();
    expect(screen.getByText("تصميم سريع")).toBeTruthy();
    expect(screen.getByAltText("لقطة Canva")).toBeTruthy();
    expect(screen.getByRole("link", { name: /فتح الموقع/ }).getAttribute("href")).toBe("https://canva.com");
    fireEvent.click(screen.getByRole("button", { name: /نسخ الرابط/ }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith("https://canva.com"));
  });
});
