// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OwnerPages from "./OwnerPages";
import { defaultSiteContent, type EditablePage, type SiteContent } from "@/lib/siteContent";

function Harness({ onCreateButton = vi.fn() }: { onCreateButton?: (page: EditablePage) => void }) {
  const [pages, setPages] = useState<EditablePage[]>([]);
  return <OwnerPages pages={pages} onChange={setPages} onCreateButton={onCreateButton} site={defaultSiteContent as Pick<SiteContent, "settings" | "customCode">} />;
}

describe("OwnerPages functional management", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("creates a draft from a reusable template and persists edits through the parent callback", () => {
    const onCreateButton = vi.fn();
    render(<Harness onCreateButton={onCreateButton} />);
    fireEvent.click(screen.getByRole("button", { name: "إنشاء صفحة" }));
    expect(screen.getByText("مسودة / مخفية")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("عنوان الصفحة"), { target: { value: "صفحة حملة" } });
    expect(screen.getByText("صفحة حملة")).toBeTruthy();
    expect((screen.getByRole("button", { name: "إضافة زر مرتبط بهذه الصفحة" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("حالة النشر"), { target: { value: "published" } });
    expect(document.querySelector(".owner-page-status.published")?.textContent).toBe("منشورة");
    expect((screen.getByRole("button", { name: "إضافة زر مرتبط بهذه الصفحة" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "إضافة زر مرتبط بهذه الصفحة" }));
    expect(onCreateButton).toHaveBeenCalledTimes(1);
    expect(onCreateButton.mock.calls[0][0]).toMatchObject({ title: "صفحة حملة", status: "published" });
  });

  it("keeps page preview separate from publication and custom code isolated", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "إنشاء صفحة" }));
    fireEvent.change(screen.getByLabelText("HTML"), { target: { value: "<strong>معاينة آمنة</strong>" } });
    fireEvent.click(screen.getByRole("button", { name: "معاينة دون نشر" }));
    expect(screen.getByRole("dialog", { name: /معاينة/ })).toBeTruthy();
    expect(screen.getByText(/مسودة \/ مخفية — معاينة المالك فقط/)).toBeTruthy();
    expect(screen.getByRole("dialog").querySelector("iframe")).toBeNull();
  });

  it("deletes only after explicit confirmation", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "إنشاء صفحة" }));
    fireEvent.click(screen.getByRole("button", { name: "حذف الصفحة" }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByText("صفحة هبوط جديدة")).toBeTruthy();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "حذف الصفحة" }));
    expect(screen.getByText("لا توجد صفحات بعد")).toBeTruthy();
  });
});
