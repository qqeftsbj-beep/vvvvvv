// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSiteContent } from "@/lib/siteContent";

vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast };
});

import OwnerCodeWorkspace, { makeExport } from "./OwnerCodeWorkspace";

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
    expect(screen.getByText(/ملف JSON يحتوي فقط على إعدادات/)).toBeTruthy();
    const editor = screen.getByLabelText("وثيقة الإعدادات JSON");
    const next = JSON.stringify({ schemaVersion: 1, siteContent: { ...defaultSiteContent, heroTitle: "عنوان مسودة" }, extensions: {} }, null, 2);
    fireEvent.change(editor, { target: { value: next } });
    fireEvent.click(screen.getByRole("button", { name: /معاينة ومقارنة/ }));
    expect(screen.getByText("لم يتم اعتماد هذه المسودة")).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("creates a backup and applies only after explicit confirmation", () => {
    const onApply = vi.fn();
    render(<OwnerCodeWorkspace content={defaultSiteContent} onApply={onApply} />);
    const editor = screen.getByLabelText("وثيقة الإعدادات JSON");
    const next = JSON.stringify({ schemaVersion: 1, siteContent: { ...defaultSiteContent, heroTitle: "عنوان معتمد" }, extensions: { futurePanel: { enabled: true } } }, null, 2);
    fireEvent.change(editor, { target: { value: next } });
    fireEvent.click(screen.getByRole("button", { name: /تطبيق بعد الموافقة/ }));
    expect(window.confirm).toHaveBeenCalled();
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].heroTitle).toBe("عنوان معتمد");
    expect(JSON.parse(window.localStorage.getItem("abu-kayan-owner-code-versions") || "[]")).toHaveLength(1);
  });

  it("exports a versioned safe document without passwords or customer secrets", () => {
    const exported = makeExport(defaultSiteContent, { futurePanel: { enabled: true } });
    expect(exported.documentType).toBe("abu-kayan-site-settings");
    expect(exported.schemaVersion).toBe(1);
    expect(exported.exportVersion).toBe("1.0.0");
    expect(exported.exportedAt).toBeTruthy();
    expect(exported.siteContent.settings).not.toHaveProperty("templatePassword");
    expect(exported.excludedSecrets).toContain("API keys");
    expect(exported.extensions).toEqual({ futurePanel: { enabled: true } });
  });

  it("starts a download and loads an uploaded file as an unapplied draft", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:test");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const onApply = vi.fn();
    render(<OwnerCodeWorkspace content={defaultSiteContent} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: /تنزيل ملف إعدادات الموقع/ }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    const file = new File([JSON.stringify({ schemaVersion: 1, siteContent: { ...defaultSiteContent, heroTitle: "عنوان مرفوع" }, extensions: {} })], "settings.json", { type: "application/json" });
    fireEvent.change(screen.getAllByLabelText(/رفع واستيراد ملف|استعادة نسخة احتياطية/)[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/الملف المحمل كمسودة: settings.json/)).toBeTruthy());
    expect(onApply).not.toHaveBeenCalled();
  });
});
