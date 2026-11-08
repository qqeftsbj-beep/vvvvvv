import React, { useEffect, useMemo, useRef } from "react";
import "./CategoryStrip.css";

export type CategoryStripOption = {
  slug: string;
  name: string;
};

type CategoryStripProps = {
  categories?: readonly CategoryStripOption[];
  value: string;
  onChange: (slug: string) => void;
  ariaLabel: string;
  className?: string;
};

export default function CategoryStrip({ categories = [], value, onChange, ariaLabel, className = "" }: CategoryStripProps) {
  const tabs = useMemo(() => [{ slug: "all", name: "الكل" }, ...categories], [categories]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const activeIndex = tabs.findIndex((tab) => tab.slug === value);
    if (activeIndex < 0) onChange("all");
  }, [onChange, tabs, value]);

  const focusTab = (index: number) => {
    const nextIndex = (index + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    onChange(nextTab.slug);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className={`category-strip ${className}`.trim()} role="tablist" aria-label={ariaLabel} aria-orientation="horizontal">
      {tabs.map((tab, index) => (
        <button
          key={tab.slug}
          ref={(element) => { tabRefs.current[index] = element; }}
          type="button"
          role="tab"
          aria-selected={value === tab.slug}
          tabIndex={value === tab.slug ? 0 : -1}
          onClick={() => onChange(tab.slug)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              focusTab(index + 1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              focusTab(index - 1);
            } else if (event.key === "Home") {
              event.preventDefault();
              focusTab(0);
            } else if (event.key === "End") {
              event.preventDefault();
              focusTab(tabs.length - 1);
            }
          }}
        >
          {tab.name}
        </button>
      ))}
    </div>
  );
}
