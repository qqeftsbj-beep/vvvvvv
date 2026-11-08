import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Archive, Check, Clipboard, Download, Eye, FileCode2, History, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { SiteContent } from "@/lib/siteContent";

type ExportDocument = {
  documentType: "abu-kayan-site-settings";
  schemaVersion: 1;
  exportVersion: string;
  exportedAt: string;
  scope: string[];
  siteContent: Omit<Partial<SiteContent>, "settings"> & { settings: Omit<SiteContent["settings"], "templatePassword"> };
  extensions: Record<string, unknown>;
  excludedSecrets: string[];
};
type WorkspaceDocument = { schemaVersion: 1; siteContent: SiteContent; extensions: Record<string, unknown> };
type CodeVersion = { id: string; createdAt: string; label: string; document: WorkspaceDocument };

const VERSIONS_KEY = "abu-kayan-owner-code-versions";
const EXTENSIONS_KEY = "abu-kayan-owner-code-extensions";
const EXPORT_VERSION = "1.0.0";
const SOURCE_MANIFEST = [
  ["client/src/lib/siteContent.ts", "نموذج إعدادات الموقع الحالية", "قابل للإدارة هنا عبر JSON"],
  ["client/src/pages/TemplateStudio.tsx", "استوديو القوالب والصور والفيديو", "إدارته من صفحة القوالب"],
  ["client/src/pages/Home.tsx", "الصفحة العامة", "تتطلب بيئة المشروع لإضافة صفحة جديدة"],
  ["client/src/pages/OwnerPanel.tsx", "لوحة المالك", "تتطلب بيئة المشروع لتغيير الكود"],
  ["server/routers.ts", "إجراءات الخادم والصلاحيات", "تتطلب بيئة المشروع والنشر"],
  ["drizzle/schema.ts", "مخطط قاعدة البيانات", "تتطلب ترحيلًا من بيئة المشروع"],
] as const;
const CONTENT_KEYS = ["heroEyebrow", "heroTitle", "heroAccent", "heroEnding", "heroLead", "heroImage", "primaryButton", "secondaryButton", "services", "products", "buttons", "settings"] as const;

function isSiteContent(value: unknown): value is SiteContent {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SiteContent>;
  return typeof item.heroTitle === "string" && Array.isArray(item.services) && Array.isArray(item.products) && Array.isArray(item.buttons) && Boolean(item.settings && typeof item.settings === "object");
}
function readVersions(): CodeVersion[] { try { const value = JSON.parse(window.localStorage.getItem(VERSIONS_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }
function readExtensions(): Record<string, unknown> { try { const value = JSON.parse(window.localStorage.getItem(EXTENSIONS_KEY) || "{}"); return value && typeof value === "object" ? value : {}; } catch { return {}; } }
function stringify(value: unknown) { return JSON.stringify(value, null, 2); }
function stripSecrets(content: SiteContent): ExportDocument["siteContent"] {
  const { templatePassword: _templatePassword, ...safeSettings } = content.settings;
  return { ...content, settings: safeSettings };
}
export function makeExport(content: SiteContent, extensions: Record<string, unknown>): ExportDocument {
  return { documentType: "abu-kayan-site-settings", schemaVersion: 1, exportVersion: EXPORT_VERSION, exportedAt: new Date().toISOString(), scope: ["siteContent", "services", "products", "buttons", "settings", "extensions"], siteContent: stripSecrets(content), extensions, excludedSecrets: ["settings.templatePassword", "server environment variables", "API keys", "customer messages"] };
}
function normalize(value: unknown, current: SiteContent, fallbackExtensions: Record<string, unknown>): WorkspaceDocument | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ExportDocument> & Partial<WorkspaceDocument> & Partial<SiteContent>;
  if (item.schemaVersion !== undefined && item.schemaVersion !== 1) return null;
  const incoming = (item as { siteContent?: unknown }).siteContent;
  const rawContent = isSiteContent(item) ? item : isSiteContent(incoming) ? incoming : null;
  if (!rawContent) return null;
  const safeContent = rawContent as SiteContent;
  const merged: SiteContent = { ...current, ...safeContent, settings: { ...current.settings, ...safeContent.settings, templatePassword: current.settings.templatePassword }, services: Array.isArray(safeContent.services) ? safeContent.services : current.services, products: Array.isArray(safeContent.products) ? safeContent.products : current.products, buttons: Array.isArray(safeContent.buttons) ? safeContent.buttons : current.buttons };
  const incomingExtensions = (item as { extensions?: unknown }).extensions;
  return { schemaVersion: 1, siteContent: merged, extensions: incomingExtensions && typeof incomingExtensions === "object" ? incomingExtensions as Record<string, unknown> : fallbackExtensions };
}

export default function OwnerCodeWorkspace({ content, onApply }: { content: SiteContent; onApply: (next: SiteContent, extensions: Record<string, unknown>, label: string) => void }) {
  const [extensions, setExtensions] = useState<Record<string, unknown>>(() => readExtensions());
  const [draft, setDraft] = useState(() => stringify(makeExport(content, readExtensions())));
  const [preview, setPreview] = useState<WorkspaceDocument | null>(null);
  const [versions, setVersions] = useState<CodeVersion[]>(() => readVersions());
  const [importName, setImportName] = useState("");
  const [draftSource, setDraftSource] = useState("الحالة الحالية");
  const [codeEditor, setCodeEditor] = useState(() => ({ html: content.customCode?.html || "", css: content.customCode?.css || "", js: content.customCode?.js || "", enabled: content.customCode?.enabled === true }));

  useEffect(() => { setDraft(stringify(makeExport(content, extensions))); }, [content, extensions]);
  useEffect(() => { setCodeEditor({ html: content.customCode?.html || "", css: content.customCode?.css || "", js: content.customCode?.js || "", enabled: content.customCode?.enabled === true }); }, [content.customCode]);
  const parsedDraft = useMemo(() => { try { return normalize(JSON.parse(draft), content, extensions); } catch { return null; } }, [draft, content, extensions]);
  const changes = useMemo(() => {
    if (!parsedDraft) return { added: [], changed: [], removed: [] };
    const added: string[] = [], changed: string[] = [], removed: string[] = [];
    for (const key of CONTENT_KEYS) {
      const before = content[key]; const after = parsedDraft.siteContent[key];
      if (Array.isArray(before) && Array.isArray(after)) {
        if (after.length > before.length) added.push(`${key} (+${after.length - before.length})`);
        if (after.length < before.length) removed.push(`${key} (-${before.length - after.length})`);
        if (JSON.stringify(before) !== JSON.stringify(after) && after.length === before.length) changed.push(key);
      } else if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(key);
    }
    if (JSON.stringify(extensions) !== JSON.stringify(parsedDraft.extensions)) changed.push("extensions");
    return { added, changed, removed };
  }, [content, extensions, parsedDraft]);
  const changeCount = changes.added.length + changes.changed.length + changes.removed.length;

  const saveVersion = (document: WorkspaceDocument, label: string) => { const next = [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), label, document }, ...versions].slice(0, 12); window.localStorage.setItem(VERSIONS_KEY, JSON.stringify(next)); setVersions(next); };
  const showPreview = () => { if (!parsedDraft) return toast.error("الملف غير صالح أو لا يطابق إصدار المخطط 1."); setPreview(parsedDraft); toast.success("تم تجهيز المقارنة والمعاينة دون اعتمادها."); };
  const applyDraft = () => { if (!parsedDraft) return toast.error("صحح الملف قبل الاعتماد."); if (!window.confirm("سيتم حفظ نسخة احتياطية ثم تطبيق التغييرات المعروضة. هل تريد المتابعة؟")) return; saveVersion({ schemaVersion: 1, siteContent: content, extensions }, "نسخة تلقائية قبل الاستيراد"); window.localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(parsedDraft.extensions)); setExtensions(parsedDraft.extensions); onApply(parsedDraft.siteContent, parsedDraft.extensions, `تطبيق ملف ${draftSource}`); setPreview(null); toast.success("تم تطبيق التغييرات المعتمدة."); };
  const downloadJson = (value: unknown, filename: string, success: string) => { const blob = new Blob([stringify(value)], { type: "application/json;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); toast.success(success); };
  const exportSettings = () => downloadJson(makeExport(content, extensions), "abu-kayan-site-settings.json", "تم تنزيل ملف إعدادات الموقع المنقّح.");
  const exportBackup = () => { saveVersion({ schemaVersion: 1, siteContent: content, extensions }, "نسخة احتياطية قبل التنزيل"); downloadJson(makeExport(content, extensions), "abu-kayan-site-backup.json", "تم تنزيل نسخة احتياطية وحفظها في السجل."); };
  const copyDraft = async () => { await navigator.clipboard.writeText(draft); toast.success("تم نسخ بيانات الإعدادات."); };
  const readAsDraft = async (file: File, label: string) => { try { const parsed = normalize(JSON.parse(await file.text()), content, extensions); if (!parsed) throw new Error("invalid"); setDraft(stringify({ ...makeExport(parsed.siteContent, parsed.extensions), importedFrom: file.name })); setImportName(file.name); setDraftSource(label); setPreview(null); toast.success("تم تحميل الملف كمسودة فقط؛ لم يُطبّق أي تغيير."); } catch { toast.error("الملف غير صالح، أو إصداره غير مدعوم، أو لا يطابق إعدادات الموقع."); } };
  const importDraft = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) await readAsDraft(file, "ملف إعدادات مستورد"); event.target.value = ""; };
  const restoreVersion = (version: CodeVersion) => { if (!window.confirm("استعادة هذه النسخة؟ ستُحفظ الحالة الحالية أولًا.")) return; saveVersion({ schemaVersion: 1, siteContent: content, extensions }, "نسخة تلقائية قبل الاستعادة"); window.localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(version.document.extensions)); setExtensions(version.document.extensions); onApply(version.document.siteContent, version.document.extensions, `استعادة ${version.label}`); setPreview(null); };
  const createBackup = () => { saveVersion({ schemaVersion: 1, siteContent: content, extensions }, "نسخة يدوية"); toast.success("تم حفظ نسخة احتياطية محلية."); };
  const updateCodeEditor = (key: "html" | "css" | "js" | "enabled", value: string | boolean) => { const next = { ...codeEditor, [key]: value }; setCodeEditor(next); try { const raw = JSON.parse(draft) as Record<string, unknown>; const siteContent = (raw.siteContent && typeof raw.siteContent === "object" ? raw.siteContent : raw) as Record<string, unknown>; raw.siteContent = { ...siteContent, customCode: next }; setDraft(stringify(raw)); } catch { /* keep the visible editor usable while JSON is being repaired */ } };

  return <section className="owner-settings-card owner-code-workspace" id="owner-code-settings">
    <div className="owner-card-heading"><div><span className="studio-label">07 / الإعدادات البرمجية</span><h2>مساحة التطوير الآمنة</h2></div><FileCode2 size={20} /></div>
    <p className="owner-code-notice">ملف JSON يحتوي فقط على إعدادات وبيانات يستطيع النظام إدارتها فعليًا. لا يحتوي على كلمات المرور أو مفاتيح API أو أسرار الخادم أو رسائل العملاء، ولا يحتوي على ملفات TSX/CSS أو مصدر المشروع الكامل.</p>
    <div className="owner-code-scope"><div><strong>متاح من داخل الموقع</strong><span>الهوية، الألوان، الخطوط، الخدمات، المنتجات، الأزرار، إعدادات القوالب القابلة للتصدير، والامتدادات المستقبلية.</span></div><div><strong>يتطلب بيئة التطوير</strong><span>إضافة صفحات أو نوافذ جديدة، تعديل TSX/CSS، تغيير الخادم أو قاعدة البيانات، ونشر نسخة جديدة.</span></div></div>
    <div className="owner-code-capabilities"><span><Check size={14} /> لا يوجد تطبيق تلقائي عند الرفع</span><span><Check size={14} /> الإصدار والتاريخ ونطاق التصدير داخل الملف</span><span><Check size={14} /> كلمة مرور القوالب تبقى محليًا ولا تُصدّر</span></div>
    <div className="owner-code-toolbar"><button type="button" className="owner-save" onClick={showPreview}><Eye size={15} /> معاينة ومقارنة</button><button type="button" className="owner-add" onClick={applyDraft}><Check size={15} /> تطبيق بعد الموافقة</button><button type="button" className="owner-add" onClick={copyDraft}><Clipboard size={15} /> نسخ بيانات الإعدادات</button><button type="button" className="owner-add" onClick={exportSettings}><Download size={15} /> تنزيل ملف إعدادات الموقع</button><label className="owner-add owner-code-file"><input type="file" accept="application/json,.json" onChange={importDraft} /><Upload size={15} /> رفع واستيراد ملف</label></div>
    <div className="owner-code-toolbar"><button type="button" className="owner-add" onClick={exportBackup}><Archive size={15} /> تنزيل نسخة احتياطية</button><label className="owner-add owner-code-file"><input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readAsDraft(file, "نسخة احتياطية مستعادة"); event.target.value = ""; }} /><RotateCcw size={15} /> استعادة نسخة احتياطية</label></div>
    {importName && <small className="owner-code-file-name">الملف المحمل كمسودة: {importName}</small>}
    <div className="owner-custom-code-editor"><div className="owner-code-preview-head"><div><span className="studio-label">HTML / CSS / JavaScript</span><strong>كود مخصص داخل iframe معزول</strong></div><label className="owner-code-toggle"><input type="checkbox" checked={codeEditor.enabled} onChange={(event) => updateCodeEditor("enabled", event.target.checked)} /> تفعيل بعد الاعتماد</label></div><p className="owner-security-note">لن يصل هذا الكود إلى جلسة المالك أو قاعدة البيانات. لا يُفعّل إلا بعد المعاينة والموافقة، ويُعرض داخل sandbox مستقل.</p><label className="owner-code-editor-label"><span>HTML</span><textarea className="owner-code-editor owner-code-editor-small" dir="ltr" spellCheck={false} value={codeEditor.html} onChange={(event) => updateCodeEditor("html", event.target.value)} placeholder="<section>...</section>" /></label><label className="owner-code-editor-label"><span>CSS</span><textarea className="owner-code-editor owner-code-editor-small" dir="ltr" spellCheck={false} value={codeEditor.css} onChange={(event) => updateCodeEditor("css", event.target.value)} placeholder=".my-card { ... }" /></label><label className="owner-code-editor-label"><span>JavaScript</span><textarea className="owner-code-editor owner-code-editor-small" dir="ltr" spellCheck={false} value={codeEditor.js} onChange={(event) => updateCodeEditor("js", event.target.value)} placeholder="document.querySelector(...)" /></label></div>
    <label className="owner-code-editor-label"><span>وثيقة الإعدادات — عدّلها خارجيًا ثم ارفعها، ولا تُطبق إلا بعد المعاينة والموافقة</span><textarea aria-label="وثيقة الإعدادات JSON" className="owner-code-editor" dir="ltr" spellCheck={false} value={draft} onChange={(event) => { setDraft(event.target.value); setPreview(null); }} /></label>
    <div className="owner-code-diff"><div><strong>صحة الملف</strong><span className={parsedDraft ? "code-valid" : "code-invalid"}>{parsedDraft ? "صالح للمراجعة · schema 1" : "JSON غير صالح أو إصدار غير مدعوم"}</span></div><div><strong>الإضافات</strong><span>{changes.added.length ? changes.added.join(" · ") : "لا توجد"}</span></div><div><strong>التعديلات</strong><span>{changes.changed.length ? changes.changed.join(" · ") : "لا توجد"}</span></div><div><strong>المحذوفات</strong><span>{changes.removed.length ? changes.removed.join(" · ") : "لا توجد"}</span></div><div><strong>إجمالي العناصر المتأثرة</strong><span>{changeCount}</span></div></div>
    {preview && <div className="owner-code-preview"><div className="owner-code-preview-head"><div><span className="studio-label">معاينة قبل التطبيق</span><strong>لم يتم اعتماد هذه المسودة</strong></div><button type="button" className="owner-delete" onClick={() => setPreview(null)} aria-label="إغلاق المعاينة">×</button></div><p>الإضافات: {changes.added.join("، ") || "لا توجد"} · التعديلات: {changes.changed.join("، ") || "لا توجد"} · المحذوفات: {changes.removed.join("، ") || "لا توجد"}</p><pre>{stringify(preview)}</pre></div>}
    <div className="owner-code-history"><div className="owner-code-history-head"><div><span className="studio-label">النسخ الاحتياطية وسجل الإصدارات</span><strong><History size={15} /> آخر {versions.length} نسخة محلية</strong></div><button type="button" className="owner-add" onClick={createBackup}><Archive size={15} /> إنشاء نسخة</button></div>{versions.length === 0 ? <p className="owner-empty">لا توجد نسخ بعد. تُنشأ نسخة تلقائية قبل الاستيراد أو الاستعادة.</p> : <div className="owner-code-version-list">{versions.map((version) => <div className="owner-code-version" key={version.id}><div><strong>{version.label}</strong><small>{new Date(version.createdAt).toLocaleString("ar-YE")}</small></div><button type="button" className="owner-add" onClick={() => restoreVersion(version)}><RotateCcw size={14} /> استعادة</button></div>)}</div>}</div>
    <div className="owner-source-list"><span className="studio-label">حدود الوصول إلى ملفات المصدر</span>{SOURCE_MANIFEST.map(([path, description, status]) => <div className="owner-source-row" key={path}><code>{path}</code><span>{description}</span><small>{status}</small></div>)}</div>
  </section>;
}
