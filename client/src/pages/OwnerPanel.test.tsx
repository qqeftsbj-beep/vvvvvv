// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    templates: {
      recycleBin: { useQuery: () => ({ data: [], isLoading: false }) },
      retentionDays: { useQuery: () => ({ data: 30, isLoading: false }) },
      restore: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      purge: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      cleanup: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      setRetentionDays: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    useUtils: () => ({ templates: { recycleBin: { invalidate: vi.fn() }, retentionDays: { invalidate: vi.fn() } } }),
  },
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false, loading: false }) }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn(), switchable: true }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast };
});
vi.mock("wouter", () => ({ Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a> }));

import OwnerPanel from "./OwnerPanel";

describe("OwnerPanel refreshed control room", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("shows the protected screen until the owner unlocks it", () => {
    render(<OwnerPanel />);
    expect(screen.getByText("منطقة خاصة بالمالك")).toBeTruthy();
    expect(screen.queryByText("مركز التحكم")).toBeNull();
  });

  it("shows quick navigation and unsaved status after an edit", () => {
    window.sessionStorage.setItem("abu-kayan-owner-panel", "true");
    render(<OwnerPanel />);
    expect(screen.getByText("مركز التحكم")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /التصميم/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("كل التعديلات محفوظة")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("استوديو أبو كيان / اليمن"), { target: { value: "استوديو جديد" } });
    expect(screen.getByText("لديك تعديلات غير محفوظة")).toBeTruthy();
  });
});
