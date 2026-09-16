// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn((_input: unknown, callbacks?: { onSuccess?: () => void }) => callbacks?.onSuccess?.());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    templates: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      create: { useMutation: () => ({ mutate, isPending: false }) },
      update: { useMutation: () => ({ mutate, isPending: false }) },
      remove: { useMutation: () => ({ mutate, isPending: false }) },
    },
    useUtils: () => ({ templates: { list: { invalidate: vi.fn() } } }),
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn(), switchable: true }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast };
});
vi.mock("wouter", () => ({ Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a> }));

import TemplateStudio from "./TemplateStudio";

describe("TemplateStudio interactive flow", () => {
  beforeEach(() => {
    mutate.mockClear();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("opens the protected creator, clears it after saving, and accepts a second template", async () => {
    const { container } = render(<TemplateStudio toolName="Gemini" toolLabel="Gemini" />);

    fireEvent.click(screen.getByRole("button", { name: "إضافة قالب جديد" }));
    fireEvent.change(screen.getByLabelText("كلمة مرور القوالب"), { target: { value: "7705" } });
    fireEvent.click(screen.getByRole("button", { name: "فتح الإضافة" }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const textArea = screen.getByPlaceholderText("اكتب التهنئة أو النص الذي تريد الاحتفاظ به...");
    fireEvent.change(input, { target: { files: [new File(["first"], "first.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText(/first\.png/)).toBeTruthy());
    fireEvent.change(textArea, { target: { value: "القالب الأول" } });
    await waitFor(() => expect((textArea as HTMLTextAreaElement).value).toBe("القالب الأول"));

    fireEvent.click(screen.getByRole("button", { name: "حفظ ونشر القالب" }));
    await waitFor(() => expect(screen.queryByPlaceholderText("اكتب التهنئة أو النص الذي تريد الاحتفاظ به...")).toBeNull());
    expect(screen.getByRole("button", { name: "إضافة قالب جديد" })).toBeTruthy();
    expect(input.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "إضافة قالب جديد" }));
    const secondInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const secondTextArea = screen.getByPlaceholderText("اكتب التهنئة أو النص الذي تريد الاحتفاظ به...");
    fireEvent.change(secondInput, { target: { files: [new File(["second"], "second.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText(/second\.png/)).toBeTruthy());
    fireEvent.change(secondTextArea, { target: { value: "القالب الثاني" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ ونشر القالب" }));
    await waitFor(() => expect(screen.queryByPlaceholderText("اكتب التهنئة أو النص الذي تريد الاحتفاظ به...")).toBeNull());
    expect(mutate).toHaveBeenCalledTimes(2);
  });
});
