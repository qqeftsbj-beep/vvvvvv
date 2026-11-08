import { describe, expect, it } from "vitest";
import { reorderTemplateCategoryIds } from "./OwnerTemplateCategories";

describe("template category ordering", () => {
  it("moves a category while preserving every category", () => {
    expect(reorderTemplateCategoryIds([1, 2, 3, 4], 3, 1)).toEqual([1, 4, 2, 3]);
    expect(reorderTemplateCategoryIds([1, 2, 3], 0, 0)).toEqual([1, 2, 3]);
    expect(reorderTemplateCategoryIds([1, 2, 3], -1, 2)).toEqual([1, 2, 3]);
  });
});
