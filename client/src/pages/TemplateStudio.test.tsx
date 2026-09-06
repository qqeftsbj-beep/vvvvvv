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

  it("clears the editor after saving and accepts a second template", async () => {
    const { container } = render(<TemplateStudio toolName="Gemini" toolLabel="Gemini" />);

    fireEvent.change(screen.getByLabelText("رمز المالك"), { target: { value: "7705" } });
    fireEvent.click(screen.getByRole("button", { name: "فتح وضع المالك" }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const textArea = screen.getByPlaceholderText("اكتب التهنئة أو النص الذي تريد الاحتفاظ به...");
    fireEvent.change(input, { target: { files: [new File(["first"], "first.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText("first.png")).toBeTruthy());
    fireEvent.change(textArea, { target: { value: "القالب الأول" } });
    await waitFor(() => expect((textArea as HTMLTextAreaElement).value).toBe("القالب الأول"));

    fireEvent.click(screen.getByRole("button", { name: "حفظ القالب" }));
    await waitFor(() => expect((textArea as HTMLTextAreaElement).value).toBe(""));
    expect(screen.getByRole("heading", { name: "قالب جديد" })).toBeTruthy();
    expect(input.value).toBe("");
    expect(screen.getByText("سيظهر النص هنا تحت الصورة")).toBeTruthy();

    fireEvent.change(input, { target: { files: [new File(["second"], "second.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText("second.png")).toBeTruthy());
    fireEvent.change(textArea, { target: { value: "القالب الثاني" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ القالب" }));
    await waitFor(() => expect((textArea as HTMLTextAreaElement).value).toBe(""));
    expect(mutate).toHaveBeenCalledTimes(2);
  });
});
