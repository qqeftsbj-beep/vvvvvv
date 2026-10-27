// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSiteContent } from "@/lib/siteContent";

vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast };
});

import OwnerCodeWorkspace from "./OwnerCodeWorkspace";

describe("OwnerCodeWorkspace safe settings flow", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("shows the real source boundary and previews valid JSON without applying it", () => {
    const onApply = vi.fn();
    render(<OwnerCodeWorkspace content={defaultSiteContent} onApply={onApply} />);
    expect(screen.getByText(/ملفات React وCSS والخادم/)).toBeTruthy();
    const editor = screen.getByRole("textbox");
    const next = JSON.stringify({ schemaVersion: 1, siteContent: { ...defaultSiteContent, heroTitle: "عنوان مسودة" }, extensions: {} }, null, 2);
    fireEvent.change(editor, { target: { value: next } });
    fireEvent.click(screen.getByRole("button", { name: /معاينة قبل التطبيق/ }));
    expect(screen.getByText("لم يتم اعتماد هذه المسودة")).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("creates a backup and applies only after explicit confirmation", () => {
    const onApply = vi.fn();
    render(<OwnerCodeWorkspace content={defaultSiteContent} onApply={onApply} />);
    const editor = screen.getByRole("textbox");
    const next = JSON.stringify({ schemaVersion: 1, siteContent: { ...defaultSiteContent, heroTitle: "عنوان معتمد" }, extensions: { futurePanel: { enabled: true } } }, null, 2);
    fireEvent.change(editor, { target: { value: next } });
    fireEvent.click(screen.getByRole("button", { name: /اعتماد المسودة/ }));
    expect(window.confirm).toHaveBeenCalled();
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].heroTitle).toBe("عنوان معتمد");
    expect(JSON.parse(window.localStorage.getItem("abu-kayan-owner-code-versions") || "[]")).toHaveLength(1);
  });
});
