// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OwnerButtons from "./OwnerButtons";
import { defaultSiteContent, type EditableButton } from "@/lib/siteContent";
import { buttonDestination, isSafeDestination } from "@/lib/buttonRouting";

const seed: EditableButton[] = [
  { id: "first", label: "زر أول", placement: "hero", action: "contact", visible: true, order: 1 },
  { id: "second", label: "زر ثان", placement: "hero", action: "internal", url: "/free-sites", visible: true, order: 2 },
];
function Harness({ onChangeSpy }: { onChangeSpy?: (buttons: EditableButton[]) => void }) {
  const [buttons, setButtons] = useState(seed);
  const update = (next: EditableButton[]) => { setButtons(next); onChangeSpy?.(next); };
  return <OwnerButtons buttons={buttons} pages={[]} settings={defaultSiteContent.settings} onChange={update} />;
}

describe("OwnerButtons management", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("edits labels and orders using touch-friendly move actions", () => {
    const onChange = vi.fn(); render(<Harness onChangeSpy={onChange} />);
    fireEvent.click(screen.getByText("زر ثان"));
    fireEvent.click(screen.getByRole("button", { name: "تقديم زر ثان" }));
    expect(onChange).toHaveBeenCalled();
    const titles = Array.from(document.querySelectorAll(".owner-managed-summary strong")).map((node) => node.textContent);
    expect(titles).toEqual(["زر ثان", "زر أول"]);
    fireEvent.change(screen.getByDisplayValue("زر ثان"), { target: { value: "زر محدث" } });
    expect(screen.getByText("زر محدث")).toBeTruthy();
    const openRow = document.querySelector(".owner-managed-item[open]")!;
    const visibility = Array.from(openRow.querySelectorAll("select")).find((select) => select.value === "visible");
    fireEvent.change(visibility!, { target: { value: "hidden" } });
    expect(screen.getByText((_, element) => element?.tagName === "SMALL" && element.textContent?.includes("مخفي") === true)).toBeTruthy();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(openRow.querySelector("button.owner-delete")!);
    expect(screen.queryByText("زر محدث")).toBeNull();
  });

  it("adds a button with an expanded editor and validates the selected destination", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /إضافة زر/ }));
    expect(screen.getByDisplayValue("زر جديد")).toBeTruthy();
    const selects = Array.from(document.querySelectorAll(".owner-managed-item[open] select"));
    fireEvent.change(selects[1], { target: { value: "custom-page" } });
    expect(screen.getByText("اختر الصفحة أو صفحة الهبوط")).toBeTruthy();
  });
});

describe("button destination safety", () => {
  it("allows app paths and HTTPS but rejects executable and protocol-relative URLs", () => {
    expect(isSafeDestination("/custom/landing" )).toBe(true);
    expect(isSafeDestination("https://example.org/page")).toBe(true);
    expect(isSafeDestination("//example.org")).toBe(false);
    expect(isSafeDestination("javascript:alert(1)")).toBe(false);
  });
  it("uses the page target and existing route mapping", () => {
    expect(buttonDestination({ ...seed[0], action: "custom-page", url: "/custom/landing", target: "_self" })).toEqual({ url: "/custom/landing", target: "_self" });
    expect(buttonDestination({ ...seed[0], action: "gemini" })).toEqual({ url: "/templates/gemini", target: "_self" });
  });
});
