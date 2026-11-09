type Snapshot = { content: Record<string, any>; collections: Record<string, any[]> };
type Change = { kind: string; label: string; added: number; updated: number; removed: number };

function canonical(value: any): string {
  const clean = (item: any): any => {
    if (Array.isArray(item)) return item.map(clean);
    if (item && typeof item === "object") return Object.fromEntries(Object.keys(item).sort().filter(key => !["updatedAt", "draftSavedAt"].includes(key)).map(key => [key, clean(item[key])]));
    return item;
  };
  return JSON.stringify(clean(value));
}
function compare(kind: string, label: string, before: any[], after: any[]): Change {
  const key = (item: any, index: number) => String(item?.id ?? item?.slug ?? item?.number ?? index);
  const previous = new Map(before.map((item, i) => [key(item, i), canonical(item)]));
  const next = new Map(after.map((item, i) => [key(item, i), canonical(item)]));
  return { kind, label, added: Array.from(next.keys()).filter(id => !previous.has(id)).length, removed: Array.from(previous.keys()).filter(id => !next.has(id)).length, updated: Array.from(next).filter(([id, value]) => previous.has(id) && previous.get(id) !== value).length };
}

/** Both inputs must already be materialized as approved public snapshots. */
export function buildPublicationChanges(before: Snapshot, after: Snapshot): Change[] {
  const result: Change[] = [];
  for (const [kind, label] of Object.entries({ templates: "التصاميم والقوالب", freeSites: "المواقع المجانية", submissions: "المشاركات المعتمدة", templateCategories: "أقسام التصاميم", creativeCategories: "أقسام الإبداع" })) result.push(compare(kind, label, before.collections[kind] || [], after.collections[kind] || []));
  for (const [kind, label] of Object.entries({ pages: "الصفحات المعتمدة", buttons: "الأزرار", services: "الخدمات", products: "المنتجات" })) result.push(compare(kind, label, before.content[kind] || [], after.content[kind] || []));
  const arrays = new Set(["pages", "buttons", "services", "products"]);
  const fields = new Set([...Object.keys(before.content), ...Object.keys(after.content)]);
  const changed = Array.from(fields).filter(key => !arrays.has(key) && canonical(before.content[key]) !== canonical(after.content[key])).length;
  result.push({ kind: "settings", label: "النصوص والمظهر والإعدادات", added: 0, updated: changed, removed: 0 });
  return result.filter(change => change.added + change.updated + change.removed > 0);
}
