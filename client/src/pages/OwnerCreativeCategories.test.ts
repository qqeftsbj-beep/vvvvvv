import { describe, expect, it } from "vitest";
import { reorderCategoryIds } from "./OwnerCreativeCategories";

describe("creative category ordering", () => {
  it("moves a category and preserves the remaining order", () => {
    expect(reorderCategoryIds([10, 20, 30], 2, 0)).toEqual([30, 10, 20]);
    expect(reorderCategoryIds([10, 20, 30], 0, 2)).toEqual([20, 30, 10]);
  });

  it("returns the same ordering for an invalid drop", () => {
    expect(reorderCategoryIds([10, 20], -1, 1)).toEqual([10, 20]);
    expect(reorderCategoryIds([10, 20], 1, 1)).toEqual([10, 20]);
  });
});
