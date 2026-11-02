// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    siteContent: { get: { useQuery: () => ({ data: null, isLoading: false }) }, save: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
    templates: {
      recycleBin: { useQuery: () => ({ data: null, isLoading: false }) }, retentionDays: { useQuery: () => ({ data: null, isLoading: false }) },
      restore: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, purge: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      cleanup: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, setRetentionDays: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    useUtils: () => ({ templates: { recycleBin: { invalidate: vi.fn() }, retentionDays: { invalidate: vi.fn() } } }),
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
vi.mock("./OwnerCodeWorkspace", () => ({ default: () => <div data-testid="code-admin" /> }));

import OwnerPanel from "./OwnerPanel";

describe("OwnerPanel organization", () => {
  beforeEach(() => { sessionStorage.setItem("abu-kayan-owner-panel", "true"); });
  afterEach(() => { cleanup(); sessionStorage.clear(); });

  it("shows named sections and keeps only the identity section open initially", () => {
    render(<OwnerPanel />);
    expect(screen.getByText("الهوية والمحتوى")).toBeTruthy();
    expect(screen.getByText("المظهر العام")).toBeTruthy();
    expect(screen.getByText("مراجعة المشاركات")).toBeTruthy();
    const sections = Array.from(document.querySelectorAll("details.owner-panel-section"));
    expect(sections).toHaveLength(10);
    expect(sections[0].hasAttribute("open")).toBe(true);
    expect(sections.slice(1).every((section) => !section.hasAttribute("open"))).toBe(true);
  });
});
