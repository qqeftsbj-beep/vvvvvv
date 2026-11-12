// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultWelcomeConfig, type WelcomeConfig } from "@shared/welcomeSchedule";
import OwnerWelcomeMessages from "./OwnerWelcomeMessages";
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
function Harness({ changed = vi.fn() }: { changed?: (value: WelcomeConfig) => void }) {
  const [value, setValue] = useState<WelcomeConfig>(() => structuredClone(defaultWelcomeConfig));
  return <OwnerWelcomeMessages value={value} onChange={next => { setValue(next); changed(next); }} />;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });
describe("OwnerWelcomeMessages", () => {
  it("edits the real configuration, enables and hides it without touching the visitor session", () => {
    const changed = vi.fn(); sessionStorage.setItem("abu-kayan-welcome-seen-session-v1", "1");
    render(<Harness changed={changed} />);
    fireEvent.change(screen.getByLabelText("عنوان الرسالة"), { target: { value: "ترحيب مخصص" } });
    expect(changed.mock.lastCall?.[0].templates[0].title).toBe("ترحيب مخصص");
    fireEvent.click(screen.getByLabelText("تفعيل الرسالة الترحيبية"));
    expect(changed.mock.lastCall?.[0].enabled).toBe(false);
    expect(sessionStorage.getItem("abu-kayan-welcome-seen-session-v1")).toBe("1");
  });
  it("creates Friday, changes its schedule, reorders and deletes only the selected template", () => {
    const changed = vi.fn(); render(<Harness changed={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "إضافة قالب الجمعة" }));
    expect(changed.mock.lastCall?.[0].templates[0].schedule).toEqual({ kind: "weekdays", days: [5], startTime: "00:00", endTime: "23:59" });
    const friday = document.querySelectorAll<HTMLDetailsElement>(".owner-welcome-card")[0]; friday.open = true;
    fireEvent.change(within(friday).getByLabelText("نوع الجدولة"), { target: { value: "range" } });
    fireEvent.change(within(friday).getByLabelText("بداية الفترة — توقيت اليمن"), { target: { value: "2026-12-01T00:00" } });
    fireEvent.change(within(friday).getByLabelText("نهاية الفترة — توقيت اليمن"), { target: { value: "2026-12-02T23:59" } });
    expect(changed.mock.lastCall?.[0].templates[0].schedule).toMatchObject({ kind: "range", startAt: Date.parse("2026-12-01T00:00:00+03:00"), endAt: Date.parse("2026-12-02T23:59:59.999+03:00") });
    fireEvent.click(within(friday).getByRole("button", { name: "تأخير قالب الجمعة" }));
    expect(changed.mock.lastCall?.[0].templates[1].name).toBe("قالب الجمعة");
    const moved = document.querySelectorAll<HTMLDetailsElement>(".owner-welcome-card")[1]; moved.open = true;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(within(moved).getByRole("button", { name: "حذف القالب" }));
    expect(changed.mock.lastCall?.[0].templates).toHaveLength(1);
    expect(changed.mock.lastCall?.[0].templates[0].id).toBe("default-welcome");
  });
  it("previews the real dialog without publishing or consuming the welcome marker", () => {
    const changed = vi.fn(); render(<Harness changed={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "معاينة القالب" }));
    expect(screen.getByRole("dialog", { name: "الرسالة الترحيبية" })).toBeTruthy();
    expect(sessionStorage.getItem("abu-kayan-welcome-seen-session-v1")).toBeNull();
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "إغلاق أهلًا بك في أبو كيان الجنيد" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
