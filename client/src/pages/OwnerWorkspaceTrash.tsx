import React, { useEffect, useMemo, useState } from "react";
import { CheckSquare, Eye, Image as ImageIcon, RotateCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import OwnerModal from "@/components/OwnerModal";
import "./ownerWorkspaceAdmin.css";

type TrashEntry = {
  id: string | number;
  kind?: string;
  title?: string;
  source?: string;
  deletedAt?: number | string | Date;
  value?: unknown;
  parentId?: string;
  index?: number;
  imageUrl?: string;
  imageUrls?: string[];
};
type TrashProps = { unlocked?: boolean; ownerPin?: string; onWorkspaceChange?: () => void };

function dateLabel(value: TrashEntry["deletedAt"]) {
  if (!value) return "التاريخ غير متاح";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "التاريخ غير متاح" : date.toLocaleString("ar-YE");
}
function displayTitle(entry: TrashEntry) { return entry.title || (typeof entry.value === "object" && entry.value && "name" in entry.value ? String((entry.value as { name?: unknown }).name || "عنصر محذوف") : "عنصر محذوف"); }
function displaySource(entry: TrashEntry) { return entry.source || entry.kind || "مساحة العمل"; }
function previewImage(entry: TrashEntry) {
  if (entry.imageUrl) return entry.imageUrl;
  if (entry.imageUrls?.[0]) return entry.imageUrls[0];
  if (typeof entry.value === "object" && entry.value) {
    const value = entry.value as { imageUrl?: unknown; imageUrls?: unknown };
    if (typeof value.imageUrl === "string") return value.imageUrl;
    if (Array.isArray(value.imageUrls) && typeof value.imageUrls[0] === "string") return value.imageUrls[0];
  }
  return null;
}
function asEntry(value: unknown, index: number): TrashEntry {
  const item = (value && typeof value === "object" ? value : {}) as Partial<TrashEntry>;
  return { ...item, id: item.id ?? `legacy-${index}`, value: item.value ?? value };
}

export default function OwnerWorkspaceTrash({ unlocked = true, ownerPin, onWorkspaceChange }: TrashProps) {
  const management = (trpc as any).management;
  const managementTrash = management?.trash?.useMutation?.();
  const legacy = (trpc as any).templates?.recycleBin?.useQuery?.(undefined, { enabled: unlocked && !(managementTrash && ownerPin), refetchOnWindowFocus: true });
  const managementRestore = management?.restoreTrash?.useMutation?.();
  const managementPurge = management?.purgeTrash?.useMutation?.();
  const legacyRestore = (trpc as any).templates?.restore?.useMutation?.();
  const legacyPurge = (trpc as any).templates?.purge?.useMutation?.();
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<TrashEntry | null>(null);
  const [loading, setLoading] = useState(false);

  const loadManagementTrash = async () => {
    if (!managementTrash || !ownerPin) return false;
    try {
      const result = await managementTrash.mutateAsync({ ownerPin });
      const list = Array.isArray(result) ? result : (result?.entries || result?.trash || []);
      setEntries(list.map(asEntry));
      return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل سلة مساحة العمل."); return true; }
  };
  useEffect(() => {
    if (!unlocked) return;
    if (managementTrash && ownerPin) { void loadManagementTrash(); return; }
    setEntries(Array.isArray(legacy?.data) ? legacy.data.map(asEntry) : []);
    // Legacy rows remain available while management APIs are being rolled out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, ownerPin, legacy?.data, Boolean(managementTrash)]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return entries.filter((entry) => !term || [displayTitle(entry), displaySource(entry), entry.kind || ""].join(" ").toLocaleLowerCase().includes(term));
  }, [entries, query]);
  const selectedEntries = filtered.filter((entry) => selected.includes(String(entry.id)));

  const restore = async (entry: TrashEntry) => {
    if (!window.confirm(`استعادة «${displayTitle(entry)}» إلى ${displaySource(entry)}؟`)) return;
    setLoading(true);
    try {
      if (managementRestore && ownerPin) await managementRestore.mutateAsync({ ownerPin, id: String(entry.id) });
      else if (legacyRestore?.mutateAsync) await legacyRestore.mutateAsync({ id: Number(entry.id) });
      else legacyRestore?.mutate?.({ id: Number(entry.id) });
      toast.success("تمت الاستعادة إلى مساحة العمل الخاصة. لن يظهر العنصر للعامة حتى النشر من الشريط الرئيسي.");
      setEntries((current) => current.filter((candidate) => String(candidate.id) !== String(entry.id)));
      setSelected((current) => current.filter((id) => id !== String(entry.id)));
      onWorkspaceChange?.();
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذرت الاستعادة، وبقي العنصر في السلة."); }
    finally { setLoading(false); }
  };
  const purge = async (entry: TrashEntry) => {
    if (!window.confirm(`حذف «${displayTitle(entry)}» نهائيًا من السلة؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    setLoading(true);
    try {
      if (managementPurge && ownerPin) await managementPurge.mutateAsync({ ownerPin, id: String(entry.id), confirm: true });
      else if (legacyPurge?.mutateAsync) await legacyPurge.mutateAsync({ id: Number(entry.id), confirm: true });
      else legacyPurge?.mutate?.({ id: Number(entry.id), confirm: true });
      toast.success("حُذف العنصر نهائيًا من السلة فقط. لم تُحذف ملفات التخزين المشتركة.");
      setEntries((current) => current.filter((candidate) => String(candidate.id) !== String(entry.id)));
      setSelected((current) => current.filter((id) => id !== String(entry.id)));
      onWorkspaceChange?.();
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر الحذف النهائي، وبقي العنصر في السلة."); }
    finally { setLoading(false); }
  };
  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const selectAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((entry) => String(entry.id)));

  if (!unlocked) return null;
  return <section className="owner-services-card owner-workspace-trash" aria-label="سلة مساحة العمل">
    <div className="owner-card-heading"><div><span className="studio-label">سلة مركزية خاصة</span><h2>المحذوفات القابلة للاستعادة</h2></div><Trash2 size={20} /></div>
    <p className="owner-security-note">الحذف العادي ينقل العنصر إلى هنا فقط. لا تُحذف ملفات التخزين أو العناصر المشتركة، والحذف النهائي يحتاج تأكيدًا مستقلًا.</p>
    {!ownerPin && managementTrash && <p className="owner-workspace-error" role="alert">يلزم إدخال PIN المالك لإدارة السلة الخاصة.</p>}
    <div className="owner-workspace-toolbar"><label className="owner-workspace-search"><Search size={16} /><input aria-label="البحث في السلة" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو القسم أو النوع" /></label><button type="button" className="owner-backups-toggle" onClick={selectAll}><CheckSquare size={15} /> {selected.length === filtered.length && filtered.length ? "إلغاء التحديد" : "تحديد الظاهر"}</button><span className="owner-workspace-selection">{filtered.length} عنصر · {selected.length} محدد</span></div>
    {!entries.length && <p className="owner-workspace-muted">السلة فارغة. ستظهر العناصر المحذوفة من نسخة العمل هنا.</p>}
    <div className="owner-workspace-grid">{filtered.map((entry) => { const image = previewImage(entry); return <article className="owner-trash-card" key={String(entry.id)}><header><input type="checkbox" checked={selected.includes(String(entry.id))} onChange={() => toggleSelected(String(entry.id))} aria-label={`تحديد ${displayTitle(entry)}`} /><div><h3>{displayTitle(entry)}</h3><p>{displaySource(entry)} · حُذف في {dateLabel(entry.deletedAt)}</p></div></header>{image ? <div className="owner-trash-preview"><img src={image} alt="" /><p>معاينة محفوظة من العنصر قبل نقله إلى السلة.</p></div> : <p><ImageIcon size={15} /> لا توجد صورة معاينة.</p>}<div className="owner-trash-meta"><span>{entry.kind || "عنصر"}</span>{entry.parentId && <span>المصدر: {entry.parentId}</span>}</div><div className="owner-trash-actions"><button type="button" onClick={() => setPreview(entry)}><Eye size={14} /> معاينة</button><button type="button" disabled={loading} onClick={() => { void restore(entry); }}><RotateCcw size={14} /> استعادة</button><button type="button" className="danger" disabled={loading} onClick={() => { void purge(entry); }}><Trash2 size={14} /> حذف نهائي</button></div></article>; })}</div>
    <OwnerModal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview ? `معاينة ${displayTitle(preview)}` : "معاينة العنصر"} ariaLabel="معاينة عنصر من السلة"><div className="owner-backup-preview">{preview && <><p><strong>القسم الأصلي:</strong> {displaySource(preview)}</p><p><strong>تاريخ الحذف:</strong> {dateLabel(preview.deletedAt)}</p>{previewImage(preview) && <img src={previewImage(preview) || undefined} alt={displayTitle(preview)} />}{preview.value !== undefined && <pre>{JSON.stringify(preview.value, null, 2)}</pre>}</>}</div></OwnerModal>
    {selectedEntries.length > 1 && <p className="owner-workspace-muted">التحديد جاهز للمعالجة الفردية مع تأكيد مستقل لكل عنصر؛ لا يتم تنفيذ حذف جماعي غير مقصود.</p>}
    {selected.length > 0 && <button type="button" className="owner-add" onClick={() => setSelected([])}><X size={14} /> مسح التحديد</button>}
  </section>;
}
