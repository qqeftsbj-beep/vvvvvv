import React, { useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronUp, Eye, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { SiteContent } from "@/lib/siteContent";
import { normalizeSiteContent } from "@/lib/siteContent";
import OwnerModal from "@/components/OwnerModal";
import "./ownerWorkspaceAdmin.css";

type BackupEntry = { id: string | number; name?: string; createdAt?: number | string | Date; size?: number; type?: string; content?: unknown };
type BackupProps = { ownerPin: string; onRestore: (content: SiteContent) => void; onWorkspaceChange?: () => void };

function dateLabel(value: BackupEntry["createdAt"]) {
  if (!value) return "التاريخ غير متاح";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "التاريخ غير متاح" : date.toLocaleString("ar-YE");
}
function sizeLabel(value?: number) {
  if (!value || value < 1) return "الحجم غير متاح";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
function asEntry(value: unknown, index: number): BackupEntry {
  const item = (value && typeof value === "object" ? value : {}) as Partial<BackupEntry>;
  return { ...item, id: item.id ?? `backup-${index}` };
}

export default function OwnerBackups({ ownerPin, onRestore, onWorkspaceChange }: BackupProps) {
  const management = (trpc as any).management;
  const historyMutation = management?.history?.useMutation?.();
  const backupMutation = management?.backup?.useMutation?.();
  const versionMutation = management?.version?.useMutation?.();
  const restoreMutation = management?.restoreVersion?.useMutation?.();
  const deleteMutation = management?.deleteVersion?.useMutation?.();
  const legacyHistory = trpc.siteContent.history.useQuery({ ownerPin }, { enabled: !historyMutation, staleTime: 0, refetchOnWindowFocus: true });
  const legacyBackup = trpc.siteContent.backup.useMutation();
  const utils = trpc.useUtils();
  const [entries, setEntries] = useState<BackupEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ id: string | number; content: SiteContent | Record<string, unknown> } | null>(null);
  const [loadingId, setLoadingId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setError(null);
    if (historyMutation) {
      try {
        const result = await historyMutation.mutateAsync({ ownerPin });
        const list = Array.isArray(result) ? result : (result?.entries || result?.history || []);
        setEntries(list.map(asEntry));
      } catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر تحميل سجل النسخ."); }
      return;
    }
    setEntries((legacyHistory.data || []).map(asEntry));
  };
  useEffect(() => { void loadHistory(); }, [ownerPin, Boolean(historyMutation), legacyHistory.data]);

  const createBackup = async () => {
    setError(null);
    try {
      if (backupMutation) await backupMutation.mutateAsync({ ownerPin });
      else if (legacyBackup.mutateAsync) await legacyBackup.mutateAsync({ ownerPin });
      else legacyBackup.mutate({ ownerPin });
      toast.success("أُنشئت نسخة كاملة في السجل الخاص. لا تُنشر تلقائيًا ولا تُحذف تلقائيًا.");
      await loadHistory();
      onWorkspaceChange?.();
    } catch (reason) { const message = reason instanceof Error ? reason.message : "تعذر إنشاء النسخة الاحتياطية."; setError(message); toast.error(message); }
  };

  const view = async (entry: BackupEntry) => {
    setLoadingId(entry.id);
    setError(null);
    try {
      let value: unknown;
      if (versionMutation) value = await versionMutation.mutateAsync({ ownerPin, id: String(entry.id) });
      else value = await utils.siteContent.version.fetch({ ownerPin, id: Number(entry.id) });
      const snapshot=value && typeof value==="object" && "content" in value ? (value as {content:Record<string,unknown>}).content : (value || {}) as Record<string,unknown>;
      const content = normalizeSiteContent(snapshot);
      setSelected({ id: entry.id, content });
    } catch (reason) { const message = reason instanceof Error ? reason.message : "تعذر فتح النسخة."; setError(message); toast.error(message); }
    finally { setLoadingId(null); }
  };

  const restore = async () => {
    if (!selected) return;
    const label = entries.find((entry) => String(entry.id) === String(selected.id))?.name || `نسخة ${selected.id}`;
    if (!window.confirm(`تحميل «${label}» كمسودة خاصة؟ لن يتغير الموقع العام حتى الحفظ ثم النشر الصريح.`)) return;
    setLoadingId(selected.id);
    try {
      if (restoreMutation) {
        const result = await restoreMutation.mutateAsync({ ownerPin, id: String(selected.id) });
        if (result?.content) onRestore(normalizeSiteContent(result.content as Record<string, unknown>));
        else onRestore(normalizeSiteContent(selected.content as Record<string, unknown>));
      } else onRestore(normalizeSiteContent(selected.content as Record<string, unknown>));
      toast.success("حُمّلت النسخة كمسودة خاصة. اضغط حفظ التعديلات، ثم انشر من الشريط الرئيسي عند الحاجة.");
      setSelected(null);
      onWorkspaceChange?.();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "تعذرت الاستعادة، وبقيت النسخة محفوظة."); }
    finally { setLoadingId(null); }
  };

  const remove = async (entry: BackupEntry) => {
    const label = entry.name || `نسخة ${entry.id}`;
    if (!window.confirm(`حذف النسخة «${label}» نهائيًا؟ لن تُحذف أي نسخة أخرى.`)) return;
    setLoadingId(entry.id);
    try {
      if (!deleteMutation) { toast.error("حذف النسخ يتطلب API management.deleteVersion؛ لم تُحذف النسخة."); return; }
      await deleteMutation.mutateAsync({ ownerPin, id: String(entry.id), confirm: true });
      setEntries((current) => current.filter((candidate) => String(candidate.id) !== String(entry.id)));
      if (String(selected?.id) === String(entry.id)) setSelected(null);
      toast.success("حُذفت النسخة المحددة فقط. بقيت بقية النسخ دون تغيير.");
      onWorkspaceChange?.();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "تعذر حذف النسخة؛ بقيت محفوظة."); }
    finally { setLoadingId(null); }
  };

  const previewSummary = useMemo(() => {
    if (!selected) return null;
    const content = selected.content as Partial<SiteContent>;
    return `${content.heroTitle || "محتوى الموقع"} · ${Array.isArray(content.pages) ? content.pages.length : 0} صفحة · ${Array.isArray(content.buttons) ? content.buttons.length : 0} زر`;
  }, [selected]);

  return <section className="owner-services-card owner-workspace-backups" aria-label="النسخ الاحتياطية الخاصة">
    <div className="owner-card-heading"><div><span className="studio-label">سجل مركزي بلا حذف تلقائي</span><h2>نسخ الموقع واستعادته</h2></div><button type="button" className="owner-add" onClick={() => { void createBackup(); }} disabled={Boolean(backupMutation?.isPending || legacyBackup.isPending)}><Archive size={16} /> {backupMutation?.isPending || legacyBackup.isPending ? "جارٍ الإنشاء…" : "نسخة احتياطية الآن"}</button></div>
    <p className="owner-security-note">تُحفظ النسخ كاملة مع صفحات الموقع وإعداداته. المعاينة والاستعادة خاصة بالمالك، والاستعادة تنشئ نسخة عمل ولا تغيّر المنشور العام.</p>
    <button type="button" className="owner-backups-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />} عرض النسخ الاحتياطية <span>({entries.length})</span></button>
    {error && <p role="alert" className="owner-workspace-error">{error}</p>}
    {open && <div className="owner-backup-list">{!entries.length && <p className="owner-workspace-muted">لا توجد نسخ في السجل حتى الآن.</p>}{entries.map((entry) => <details className="owner-backup-accordion" key={String(entry.id)}><summary><span><strong>{entry.name || `نسخة ${entry.id}`}</strong><small>{dateLabel(entry.createdAt)} · {sizeLabel(entry.size)} · {entry.type || "snapshot"}</small></span><ChevronDown size={16} /></summary><div className="owner-backup-accordion-body"><div className="owner-backup-meta"><span>المعرف: {String(entry.id)}</span><span>الحجم: {sizeLabel(entry.size)}</span><span>النوع: {entry.type || "snapshot"}</span></div><div className="owner-backup-actions"><button type="button" disabled={loadingId !== null} onClick={() => { void view(entry); }}><Eye size={14} /> {loadingId === entry.id ? "جارٍ الفتح…" : "معاينة"}</button><button type="button" disabled={loadingId !== null} onClick={() => { void view(entry); }}><RotateCcw size={14} /> فتح للاستعادة</button><button type="button" className="danger" disabled={loadingId !== null} onClick={() => { void remove(entry); }}><Trash2 size={14} /> حذف هذه النسخة</button></div></div></details>)}</div>}
    <OwnerModal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `معاينة النسخة ${selected.id}` : "معاينة النسخة"} ariaLabel="معاينة نسخة احتياطية"><div className="owner-backup-preview">{selected && <><p>{previewSummary}</p><pre>{JSON.stringify(selected.content, null, 2)}</pre><div className="owner-backup-actions"><button type="button" className="owner-add" disabled={loadingId !== null} onClick={() => { void restore(); }}><RotateCcw size={14} /> تحميل كمسودة خاصة</button><button type="button" className="owner-add" onClick={() => setSelected(null)}>إغلاق</button></div></>}</div></OwnerModal>
  </section>;
}
