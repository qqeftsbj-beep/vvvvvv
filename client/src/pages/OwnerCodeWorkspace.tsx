import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Archive, Check, Clipboard, Download, Eye, FileCode2, History, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { SiteContent } from "@/lib/siteContent";

type WorkspaceDocument = {
  schemaVersion: 1;
  siteContent: SiteContent;
  extensions: Record<string, unknown>;
};
type CodeVersion = { id: string; createdAt: string; label: string; document: WorkspaceDocument };

const VERSIONS_KEY = "abu-kayan-owner-code-versions";
const EXTENSIONS_KEY = "abu-kayan-owner-code-extensions";
const SOURCE_MANIFEST = [
  ["client/src/lib/siteContent.ts", "نموذج إعدادات الموقع الحالية", "قابل للإدارة هنا عبر JSON"],
  ["client/src/pages/TemplateStudio.tsx", "استوديو القوالب والصور والفيديو", "إدارته من صفحة القوالب"],
  ["client/src/pages/Home.tsx", "الصفحة العامة", "تتطلب بيئة المشروع لإضافة صفحة جديدة"],
  ["client/src/pages/OwnerPanel.tsx", "لوحة المالك", "تتطلب بيئة المشروع لتغيير الكود"],
  ["server/routers.ts", "إجراءات الخادم والصلاحيات", "تتطلب بيئة المشروع والنشر"],
  ["drizzle/schema.ts", "مخطط قاعدة البيانات", "تتطلب ترحيلًا من بيئة المشروع"],
] as const;

function isSiteContent(value: unknown): value is SiteContent {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SiteContent>;
  return typeof item.heroTitle === "string" && Array.isArray(item.services) && Array.isArray(item.products) && Array.isArray(item.buttons) && Boolean(item.settings && typeof item.settings === "object");
}
function normalize(value: unknown, extensions: Record<string, unknown>): WorkspaceDocument | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<WorkspaceDocument> & Partial<SiteContent>;
  if (isSiteContent(item)) return { schemaVersion: 1, siteContent: item, extensions };
  if (isSiteContent(item.siteContent)) return { schemaVersion: 1, siteContent: item.siteContent, extensions: item.extensions && typeof item.extensions === "object" ? item.extensions as Record<string, unknown> : extensions };
  return null;
}
function readVersions(): CodeVersion[] {
  try { const value = JSON.parse(window.localStorage.getItem(VERSIONS_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}
function readExtensions(): Record<string, unknown> {
  try { const value = JSON.parse(window.localStorage.getItem(EXTENSIONS_KEY) || "{}"); return value && typeof value === "object" ? value : {}; } catch { return {}; }
}
function stringify(value: unknown) { return JSON.stringify(value, null, 2); }

export default function OwnerCodeWorkspace({ content, onApply }: { content: SiteContent; onApply: (next: SiteContent, extensions: Record<string, unknown>, label: string) => void }) {
  const [extensions, setExtensions] = useState<Record<string, unknown>>(() => readExtensions());
  const [draft, setDraft] = useState(() => stringify({ schemaVersion: 1, siteContent: content, extensions: readExtensions() }));
  const [preview, setPreview] = useState<WorkspaceDocument | null>(null);
  const [versions, setVersions] = useState<CodeVersion[]>(() => readVersions());
  const [importName, setImportName] = useState("");

  useEffect(() => { setDraft(stringify({ schemaVersion: 1, siteContent: content, extensions })); }, [content, extensions]);
  const parsedDraft = useMemo(() => { try { return normalize(JSON.parse(draft), extensions); } catch { return null; } }, [draft, extensions]);
  const changedAreas = useMemo(() => {
    if (!parsedDraft) return [];
    const keys = ["heroEyebrow", "heroTitle", "heroAccent", "heroEnding", "heroLead", "heroImage", "primaryButton", "secondaryButton", "services", "products", "buttons", "settings"] as const;
    return keys.filter((key) => JSON.stringify(content[key]) !== JSON.stringify(parsedDraft.siteContent[key]));
  }, [content, parsedDraft]);

  const saveVersion = (document: WorkspaceDocument, label: string) => {
    const next = [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), label, document }, ...versions].slice(0, 12);
    window.localStorage.setItem(VERSIONS_KEY, JSON.stringify(next));
    setVersions(next);
  };
  const showPreview = () => { if (!parsedDraft) return toast.error("المسودة ليست بصيغة صحيحة أو لا تطابق نموذج الموقع."); setPreview(parsedDraft); toast.success("تم تجهيز المعاينة دون اعتمادها."); };
  const applyDraft = () => {
    if (!parsedDraft) return toast.error("صحح البيانات قبل الاعتماد.");
    if (!window.confirm("سيتم حفظ نسخة احتياطية من الإعدادات الحالية ثم اعتماد المسودة. هل تريد المتابعة؟")) return;
    saveVersion({ schemaVersion: 1, siteContent: content, extensions }, "نسخة تلقائية قبل الاعتماد");
    window.localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(parsedDraft.extensions));
    setExtensions(parsedDraft.extensions);
    onApply(parsedDraft.siteContent, parsedDraft.extensions, "اعتماد مسودة الإعدادات البرمجية");
    setPreview(null);
  };
  const exportDraft = () => { const blob = new Blob([draft], { type: "application/json;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "abu-kayan-settings-workspace.json"; anchor.click(); URL.revokeObjectURL(url); toast.success("تم تصدير وثيقة الإعدادات."); };
  const copyDraft = async () => { await navigator.clipboard.writeText(draft); toast.success("تم نسخ وثيقة الإعدادات."); };
  const importDraft = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const parsed = normalize(JSON.parse(await file.text()), extensions); if (!parsed) throw new Error("invalid"); setDraft(stringify(parsed)); setImportName(file.name); setPreview(null); toast.success("تم تحميل الملف كمسودة فقط. راجع الفروقات قبل الاعتماد."); } catch { toast.error("الملف غير صالح أو لا يطابق نموذج الإعدادات."); } finally { event.target.value = ""; }
  };
  const restoreVersion = (version: CodeVersion) => { if (!window.confirm("استعادة هذه النسخة؟ سيتم حفظ الحالة الحالية أولًا.")) return; saveVersion({ schemaVersion: 1, siteContent: content, extensions }, "نسخة تلقائية قبل الاستعادة"); window.localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(version.document.extensions)); setExtensions(version.document.extensions); onApply(version.document.siteContent, version.document.extensions, `استعادة ${version.label}`); setPreview(null); };
  const createBackup = () => { saveVersion({ schemaVersion: 1, siteContent: content, extensions }, "نسخة يدوية"); toast.success("تم حفظ نسخة احتياطية محلية."); };

  return <section className="owner-settings-card owner-code-workspace" id="owner-code-settings">
    <div className="owner-card-heading"><div><span className="studio-label">07 / الإعدادات البرمجية</span><h2>مساحة التطوير الآمنة</h2></div><FileCode2 size={20} /></div>
    <p className="owner-code-notice">تدير هذه المساحة الإعدادات التي يدعمها الموقع فعليًا، دون تشغيل كود عشوائي أو الادعاء بتعديل ملفات المصدر من المتصفح. ملفات React وCSS والخادم تُعدّل وتُنشر من بيئة المشروع فقط.</p>
    <div className="owner-code-scope"><div><strong>متاح من داخل الموقع</strong><span>إعدادات البداية، الخدمات، المنتجات، الأزرار، الألوان، الخطوط، وحقول امتدادات مستقبلية محفوظة في وثيقة واحدة.</span></div><div><strong>يتطلب بيئة التطوير</strong><span>إضافة صفحات أو نوافذ جديدة، تعديل TSX/CSS، تغيير الراوتر أو قاعدة البيانات، ونشر نسخة جديدة.</span></div></div>
    <div className="owner-code-capabilities"><span><Check size={14} /> القوالب: تُدار من استوديو Gemini وChat GBT الحالي</span><span><Check size={14} /> الأزرار والخدمات: قابلة للتعديل في إعدادات الموقع</span><span><Check size={14} /> النوافذ والصفحات الجديدة: غير مدعومة من runtime الحالي</span></div>
    <div className="owner-code-toolbar"><button type="button" className="owner-save" onClick={showPreview}><Eye size={15} /> معاينة قبل التطبيق</button><button type="button" className="owner-add" onClick={applyDraft}><Check size={15} /> اعتماد المسودة</button><button type="button" className="owner-add" onClick={copyDraft}><Clipboard size={15} /> نسخ</button><button type="button" className="owner-add" onClick={exportDraft}><Download size={15} /> تصدير</button><label className="owner-add owner-code-file"><input type="file" accept="application/json,.json" onChange={importDraft} /><Upload size={15} /> استيراد</label></div>
    {importName && <small className="owner-code-file-name">المسودة المحملة: {importName}</small>}
    <label className="owner-code-editor-label"><span>وثيقة الإعدادات القابلة للتوسعة — لا تُطبق تلقائيًا</span><textarea className="owner-code-editor" dir="ltr" spellCheck={false} value={draft} onChange={(event) => { setDraft(event.target.value); setPreview(null); }} /></label>
    <div className="owner-code-diff"><div><strong>صحة المسودة</strong><span className={parsedDraft ? "code-valid" : "code-invalid"}>{parsedDraft ? "صالحة للمراجعة" : "JSON غير صالح"}</span></div><div><strong>الأجزاء المتغيرة</strong><span>{changedAreas.length ? changedAreas.join(" · ") : "لا توجد تغييرات"}</span></div><div><strong>الامتدادات</strong><span>{Object.keys(parsedDraft?.extensions || {}).length} إعداد قابل للتوسعة</span></div></div>
    {preview && <div className="owner-code-preview"><div className="owner-code-preview-head"><div><span className="studio-label">معاينة قبل التطبيق</span><strong>لم يتم اعتماد هذه المسودة</strong></div><button type="button" className="owner-delete" onClick={() => setPreview(null)} aria-label="إغلاق المعاينة">×</button></div><p>الأجزاء التي ستتأثر: {changedAreas.length ? changedAreas.join("، ") : "لا توجد تغييرات"}.</p><pre>{stringify(preview)}</pre></div>}
    <div className="owner-code-history"><div className="owner-code-history-head"><div><span className="studio-label">النسخ الاحتياطية وسجل الإصدارات</span><strong><History size={15} /> آخر {versions.length} نسخة محلية</strong></div><button type="button" className="owner-add" onClick={createBackup}><Archive size={15} /> إنشاء نسخة</button></div>{versions.length === 0 ? <p className="owner-empty">لا توجد نسخ بعد. تُنشأ نسخة تلقائية قبل الاعتماد أو الاستعادة.</p> : <div className="owner-code-version-list">{versions.map((version) => <div className="owner-code-version" key={version.id}><div><strong>{version.label}</strong><small>{new Date(version.createdAt).toLocaleString("ar-YE")}</small></div><button type="button" className="owner-add" onClick={() => restoreVersion(version)}><RotateCcw size={14} /> استعادة</button></div>)}</div>}</div>
    <div className="owner-source-list"><span className="studio-label">حدود الوصول إلى ملفات المصدر</span>{SOURCE_MANIFEST.map(([path, description, status]) => <div className="owner-source-row" key={path}><code>{path}</code><span>{description}</span><small>{status}</small></div>)}</div>
  </section>;
}
