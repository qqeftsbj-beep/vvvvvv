// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CategoryStrip from "./CategoryStrip";

describe("CategoryStrip", () => {
  afterEach(() => cleanup());

  it("renders all categories with one active accessible tab", () => {
    render(<CategoryStrip categories={[{ slug: "one", name: "قسم طويل واضح" }, { slug: "two", name: "قسم ثانٍ" }]} value="one" onChange={vi.fn()} ariaLabel="الأقسام" />);

    expect(screen.getByRole("tablist", { name: "الأقسام" })).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "قسم طويل واضح" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "الكل" }).getAttribute("aria-selected")).toBe("false");
  });

  it("moves selection and focus with arrow keys", () => {
    const onChange = vi.fn();
    render(<CategoryStrip categories={[{ slug: "one", name: "الأول" }, { slug: "two", name: "الثاني" }]} value="one" onChange={onChange} ariaLabel="الأقسام" />);

    const active = screen.getByRole("tab", { name: "الأول" });
    active.focus();
    fireEvent.keyDown(active, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("two");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "الثاني" }));
  });
});
