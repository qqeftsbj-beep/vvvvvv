// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    siteContent: {
      get: { useQuery: () => ({ data: null, isLoading: false }) },
      save: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      history: { useQuery: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }) },
      backup: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      version: { useQuery: () => ({ data: null, isLoading: false }) },
    },
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
vi.mock("./OwnerCodeWorkspace", () => ({ default: () => <div data-testid="code-admin" /> }));

import OwnerPanel from "./OwnerPanel";

describe("OwnerPanel organization", () => {
  beforeEach(() => { sessionStorage.setItem("abu-kayan-owner-panel", "true"); });
  afterEach(() => { cleanup(); sessionStorage.clear(); });

  it("shows named sections with a compact tabbed organizer", () => {
    render(<OwnerPanel />);
    expect(screen.getByText("الهوية والمحتوى")).toBeTruthy();
    expect(screen.getByText("المظهر العام")).toBeTruthy();
    expect(screen.getByText("مراجعة المشاركات")).toBeTruthy();
    const sections = Array.from(document.querySelectorAll("details.owner-panel-section"));
    expect(sections).toHaveLength(13);
    expect(sections[0].hasAttribute("open")).toBe(true);
    expect(sections.slice(1).every((section) => !section.hasAttribute("open"))).toBe(true);
    expect(screen.getByRole("tablist", { name: "أقسام لوحة التحكم" })).toBeTruthy();
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
});
