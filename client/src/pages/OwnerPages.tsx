import React, { ChangeEvent, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, ImagePlus, MonitorPlay, Plus, Save, Trash2, Upload } from "lucide-react";
import type { EditablePage, EditablePageBlock, PageAppearance, PageDraft, SiteContent } from "@/lib/siteContent";
import { slugifyPageTitle, validatePageSlug } from "@/lib/siteContent";
import { beginPageDraft, editablePage, markPageDraftSaved, publishPage, updatePageDraft } from "@/lib/pageDrafts";
import PageRenderer from "./PageRenderer";
import OwnerPageMedia from "./OwnerPageMedia";
import OwnerModal from "@/components/OwnerModal";
import "./ownerPages.css";

export type PageTemplate = "landing" | "directory" | "showcase" | "code";
type ButtonPlacement = "hero" | "header" | "services" | "contact";

export type OwnerPagesProps = {
  pages: EditablePage[];
  onChange: (pages: EditablePage[]) => void;
  onCreateButton?: (page: EditablePage, placement?: ButtonPlacement) => void;
  site?: Pick<SiteContent, "settings" | "customCode">;
  onSave?: () => Promise<boolean>;
  onCommit?: (pages: EditablePage[]) => Promise<boolean>;
  ownerPin?: string;
  onBusyChange?: (busy: boolean) => void;
  onEditState?: (editing: boolean) => void;
};

const labels: Record<PageTemplate, string> = {
  landing: "صفحة هبوط",
  directory: "دليل خدمات",
  showcase: "معرض أعمال",
  code: "صفحة كود كاملة",
};

const uid = (prefix: string) => `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
const readImage = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error || new Error("تعذر قراءة الصورة"));
  reader.readAsDataURL(file);
});

export function createPageTemplate(template: PageTemplate, existingPages: EditablePage[] = []): EditablePage {
  const title = template === "directory" ? "دليل خدمات أبو كيان" : template === "showcase" ? "مختارات من أعمالنا" : template === "code" ? "صفحة كود جديدة" : "صفحة هبوط جديدة";
  const baseSlug = slugifyPageTitle(title, "page");
  let slug = baseSlug;
  let suffix = 2;
  while (existingPages.some((page) => page.slug === slug)) slug = `${baseSlug}-${suffix++}`;
  const page: EditablePage = {
    id: uid("page"), slug, title,
    eyebrow: template === "directory" ? "اختر ما يناسب مشروعك" : template === "showcase" ? "نماذج وتجارب بصرية" : template === "code" ? "HTML · CSS · JavaScript" : "خطوة أوضح لفكرتك",
    description: template === "directory" ? "خدمات مرتبة تساعدك على اختيار البداية المناسبة والتواصل معنا بسرعة." : template === "showcase" ? "مساحة تحفظ تفاصيل المشاريع وتوضح كيف تحولت الفكرة إلى حضور بصري." : template === "code" ? "ابنِ الصفحة كاملة بالكود المخصص دون قيود القوالب." : "قدّم فكرتك في صفحة مركزة مع رسالة واضحة وخطوة تالية واحدة.",
    template: template === "code" ? "landing" : template, renderMode: template === "code" ? "code" : "blocks", visible: true, status: "draft", useLegacyCustomCode: false, blocks: [],
  };
  if (template === "code") return { ...page, customCode: { html: "", css: "", js: "", enabled: true } };
  const blocks: EditablePageBlock[] = template === "directory"
    ? [{ id: uid("block"), type: "service", title: "تصاميم المناسبات", content: "بطاقات ومواد بصرية تُبنى حول اسمك ولحظتك.", visible: true, order: 1 }, { id: uid("block"), type: "service", title: "المواقع وصفحات الهبوط", content: "واجهة مرتبة تساعد العميل على فهمك واتخاذ الخطوة التالية.", visible: true, order: 2 }, { id: uid("block"), type: "button", title: "ابدأ محادثة", url: "/#contact", visible: true, order: 3 }]
    : template === "showcase"
      ? [{ id: uid("block"), type: "text", title: "أضف قصة المشروع", content: "اكتب ما الذي كان مطلوبًا، وما القرار البصري الذي جعل النتيجة أوضح.", visible: true, order: 1 }, { id: uid("block"), type: "button", title: "اطلب مشروعًا مشابهًا", url: "/#contact", visible: true, order: 2 }]
      : [{ id: uid("block"), type: "text", title: "وعد واضح للزائر", content: "اشرح النتيجة التي سيحصل عليها العميل في جملة قصيرة ومباشرة.", visible: true, order: 1 }, { id: uid("block"), type: "service", title: "ما الذي سيحدث بعد التواصل؟", content: "نراجع فكرتك، نحدد المخرج المناسب، ثم نبدأ بخطوة صغيرة قابلة للقياس.", visible: true, order: 2 }, { id: uid("block"), type: "button", title: "تواصل الآن", url: "/#contact", visible: true, order: 3 }];
  return { ...page, blocks };
}

function ImageUpload({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    onChange(await readImage(file));
    event.target.value = "";
  };
  return <label className="owner-pages-upload"><input type="file" accept="image/*" onChange={upload} /><span><ImagePlus size={15} /> {label}</span>{value && <img src={value} alt="" />}</label>;
}

function AppearanceFields({ appearance, onChange }: { appearance?: PageAppearance; onChange: (appearance: PageAppearance) => void }) {
  const colors: Array<[keyof PageAppearance, string]> = [["backgroundColor", "الخلفية"], ["panelColor", "البطاقات"], ["textColor", "النص"], ["mutedColor", "النص الثانوي"], ["accentColor", "الإبراز"]];
  return <div className="owner-pages-color-grid">{colors.map(([key, label]) => <label key={key}><span>{label}</span><input type="color" value={appearance?.[key] || "#071426"} onChange={(event) => onChange({ ...appearance, [key]: event.target.value })} /></label>)}</div>;
}

function BlockEditor({ block, index, total, onChange, onMove, onDelete }: { block: EditablePageBlock; index: number; total: number; onChange: (next: EditablePageBlock) => void; onMove: (direction: -1 | 1) => void; onDelete: () => void }) {
  const update = <K extends keyof EditablePageBlock>(key: K, value: EditablePageBlock[K]) => onChange({ ...block, [key]: value });
  return <details className="owner-pages-block" open={index === 0} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}>
    <summary><span className="owner-pages-drag">{String(index + 1).padStart(2, "0")}</span><strong>{block.title || "عنصر بلا عنوان"}</strong><small>{block.type}</small><ChevronDown size={16} /></summary>
    <div className="owner-pages-block-fields">
      <label><span>نوع المحتوى</span><select value={block.type} onChange={(event) => update("type", event.target.value as EditablePageBlock["type"])}><option value="text">نص</option><option value="image">صورة</option><option value="button">زر</option><option value="service">خدمة</option></select></label>
      <label><span>العنوان</span><input value={block.title || ""} onChange={(event) => update("title", event.target.value)} /></label>
      {block.type === "image" ? <><ImageUpload label="رفع صورة من الجهاز" value={block.image} onChange={(value) => update("image", value)} /><label className="owner-pages-wide"><span>رابط الصورة</span><input value={block.image || ""} onChange={(event) => update("image", event.target.value)} /></label></> : block.type === "button" ? <label className="owner-pages-wide"><span>رابط الزر</span><input value={block.url || ""} onChange={(event) => update("url", event.target.value)} placeholder="/custom/page أو https://…" /></label> : <label className="owner-pages-wide"><span>{block.type === "service" ? "وصف الخدمة" : "المحتوى"}</span><textarea value={block.content || ""} onChange={(event) => update("content", event.target.value)} rows={3} /></label>}
      <div className="owner-pages-block-actions"><button type="button" onClick={() => update("visible", block.visible === false)}>{block.visible === false ? <Eye size={15} /> : <EyeOff size={15} />} {block.visible === false ? "إظهار" : "إخفاء"}</button><button type="button" disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp size={15} /> لأعلى</button><button type="button" disabled={index === total - 1} onClick={() => onMove(1)}><ChevronDown size={15} /> لأسفل</button><button type="button" className="owner-pages-danger" onClick={onDelete}><Trash2 size={15} /> حذف العنصر</button></div>
    </div>
  </details>;
}

type CardProps = {
  page: EditablePage; pageIndex: number; pages: EditablePage[]; validation?: string | null; site?: OwnerPagesProps["site"]; ownerPin?: string; busy: boolean; onChange: OwnerPagesProps["onChange"]; onEditState?: OwnerPagesProps["onEditState"]; onBusyChange?: OwnerPagesProps["onBusyChange"]; onCreateButton?: OwnerPagesProps["onCreateButton"]; setPreview: (page: EditablePage) => void; updatePage: (page: EditablePage, patch: Partial<PageDraft>) => void; deletePage: (page: EditablePage) => void; movePage: (index: number, direction: -1 | 1) => void; saveDraft: (page: EditablePage) => void; publish: (page: EditablePage) => void;
};

function PageCard({ page, pageIndex, pages, validation, ownerPin, busy, onChange, onEditState, onBusyChange, onCreateButton, setPreview, updatePage, deletePage, movePage, saveDraft, publish }: CardProps) {
  const edit = editablePage(page);
  const hasDraft = Boolean(page.draft);
  const isPublished = page.status !== "draft" && page.visible !== false && !hasDraft;
  const [placement, setPlacement] = useState<ButtonPlacement>("hero");
  const addBlock = (type: EditablePageBlock["type"]) => {
    const next: EditablePageBlock = { id: uid("block"), type, title: type === "button" ? "زر جديد" : type === "image" ? "صورة جديدة" : type === "service" ? "خدمة جديدة" : "قسم جديد", content: type === "text" || type === "service" ? "اكتب المحتوى هنا." : "", url: type === "button" ? "/" : "", visible: true, order: (edit.blocks || []).length + 1 };
    updatePage(page, { blocks: [...(edit.blocks || []), next] });
  };
  const updateBlock = (blockId: string, patch: Partial<EditablePageBlock>) => updatePage(page, { blocks: (edit.blocks || []).map((block) => block.id === blockId ? { ...block, ...patch } : block) });
  const moveBlock = (index: number, direction: -1 | 1) => { const blocks = [...(edit.blocks || [])]; const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= blocks.length) return; [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]]; updatePage(page, { blocks: blocks.map((block, order) => ({ ...block, order: order + 1 })) }); };
  const updateSlug = (slug: string) => updatePage(page, { slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") });
  return <details className={`owner-page-card ${edit.status === "draft" || edit.visible === false || hasDraft ? "is-draft" : ""}`} open={pageIndex === 0} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(pageIndex))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = Number(event.dataTransfer.getData("text/plain")); if (!Number.isInteger(from) || from === pageIndex) return; const next = [...pages]; const [moved] = next.splice(from, 1); next.splice(pageIndex, 0, moved); onChange(next.map((item, order) => ({ ...item, order: order + 1 }))); }}>
    <summary><span className="owner-page-index">{String(pageIndex + 1).padStart(2, "0")}</span><span className="owner-page-summary"><strong>{edit.title || "صفحة بلا عنوان"}</strong><small>/custom/{edit.slug || "…"} · {labels[edit.renderMode === "code" ? "code" : edit.template]}</small></span><span className={`owner-page-status ${edit.status === "draft" || edit.visible === false || hasDraft ? "draft" : "published"}`}>{edit.status === "draft" || edit.visible === false || hasDraft ? "مسودة / مخفية" : "منشورة"}</span><ChevronDown size={18} /></summary>
    <div className="owner-page-card-body">
      <div className="owner-pages-toolbar"><button type="button" onClick={() => setPreview(edit)}><MonitorPlay size={15} /> معاينة مستقلة</button><button type="button" onClick={() => movePage(pageIndex, -1)} disabled={pageIndex === 0}><ChevronUp size={15} /> لأعلى</button><button type="button" onClick={() => movePage(pageIndex, 1)} disabled={pageIndex === pages.length - 1}><ChevronDown size={15} /> لأسفل</button><button type="button" onClick={() => updatePage(page, { visible: edit.visible === false })}>{edit.visible === false ? <Eye size={15} /> : <EyeOff size={15} />} {edit.visible === false ? "إظهار الصفحة" : "إخفاء الصفحة"}</button><button type="button" className="owner-pages-danger" onClick={() => deletePage(page)}><Trash2 size={15} /> حذف الصفحة</button></div>
      <div className="owner-pages-fields"><label><span>عنوان الصفحة</span><input value={edit.title} onChange={(event) => updatePage(page, { title: event.target.value })} /></label><label><span>المسار slug</span><input value={edit.slug} onChange={(event) => updateSlug(event.target.value)} aria-invalid={Boolean(validation)} />{validation && <small className="owner-pages-error">{validation}</small>}</label><label><span>السطر التعريفي</span><input value={edit.eyebrow} onChange={(event) => updatePage(page, { eyebrow: event.target.value })} /></label><label><span>طريقة البناء</span><select value={edit.renderMode || "blocks"} onChange={(event) => updatePage(page, { renderMode: event.target.value as EditablePage["renderMode"] })}><option value="blocks">الكتل المرئية</option><option value="code">كود كامل</option></select></label><label className="owner-pages-wide"><span>وصف الصفحة</span><textarea value={edit.description} onChange={(event) => updatePage(page, { description: event.target.value })} rows={3} /></label><label><span>حالة النشر</span><select value={edit.status || "published"} onChange={(event) => updatePage(page, { status: event.target.value as EditablePage["status"] })}><option value="draft">مسودة</option><option value="published">منشورة</option></select></label></div>
      <div className="owner-pages-section"><div className="owner-pages-section-heading"><div><strong>ألوان وخلفية الصفحة</strong><small>تتغلب على ألوان الموقع العام لهذه الصفحة فقط.</small></div></div><AppearanceFields appearance={edit.appearance} onChange={(appearance) => updatePage(page, { appearance })} /><ImageUpload label="رفع خلفية الصفحة" value={edit.appearance?.backgroundImage} onChange={(value) => updatePage(page, { appearance: { ...edit.appearance, backgroundImage: value } })} /></div>
      {edit.renderMode !== "code" && <div className="owner-pages-section"><div className="owner-pages-section-heading"><div><strong>محتوى الصفحة</strong><small>{(edit.blocks || []).length} عناصر · عدّل أو أخفِ أو أعد الترتيب.</small></div><div className="owner-pages-add-blocks"><button type="button" onClick={() => addBlock("text")}>+ نص</button><button type="button" onClick={() => addBlock("image")}>+ صورة</button><button type="button" onClick={() => addBlock("button")}>+ زر</button><button type="button" onClick={() => addBlock("service")}>+ خدمة</button></div></div>{(edit.blocks || []).map((block, index) => <BlockEditor key={block.id} block={block} index={index} total={(edit.blocks || []).length} onChange={(next) => updateBlock(block.id, next)} onMove={(direction) => moveBlock(index, direction)} onDelete={() => { if (window.confirm("حذف هذا العنصر؟")) updatePage(page, { blocks: (edit.blocks || []).filter((item) => item.id !== block.id).map((item, order) => ({ ...item, order: order + 1 })) }); }} />)}</div>}
      {edit.renderMode === "code" && <div className="owner-pages-section"><div className="owner-pages-section-heading"><div><strong>روابط أعلى الصفحة والتذييل</strong><small>اربط روابط القائمة بمعرّفات عناصر HTML مثل #services، وسيبقى التنقل داخل الصفحة.</small></div></div><label className="owner-pages-wide"><span>روابط التنقل (كل سطر: العنوان | المعرّف)</span><textarea rows={4} value={(edit.navItems || []).map(item => `${item.label} | ${item.id}`).join("\n")} onChange={event => updatePage(page, { navItems: event.target.value.split("\n").map(line => line.split("|")).filter(parts => parts.length >= 2).map(parts => ({ label: parts[0].trim(), id: parts.slice(1).join("|").trim() })).filter(item => item.label && /^[A-Za-z][A-Za-z0-9_:-]{0,120}$/.test(item.id)) })} placeholder="الخدمات | services\nتواصل معنا | contact" /></label><label className="owner-pages-wide"><span>وصف التذييل (اختياري)</span><input value={edit.footerText || ""} onChange={event => updatePage(page, { footerText: event.target.value })} placeholder="للإبداع والحلول الرقمية" /></label><label className="owner-pages-checkbox"><input type="checkbox" checked={edit.showDownloads !== false} onChange={event => updatePage(page, { showDownloads: event.target.checked })} /> عرض ملفات التنزيل أسفل الصفحة</label></div>}
      <div className="owner-pages-section"><div className="owner-pages-section-heading"><div><strong>كود هذه الصفحة</strong><small>HTML وCSS وJavaScript معزولة داخل مساحة الصفحة.</small></div></div><label className="owner-pages-checkbox"><input type="checkbox" checked={edit.customCode?.enabled === true} onChange={(event) => updatePage(page, { customCode: { html: edit.customCode?.html || "", css: edit.customCode?.css || "", js: edit.customCode?.js || "", enabled: event.target.checked } })} /> تفعيل الكود المخصص</label><div className="owner-pages-code-grid"><label><span>HTML</span><textarea value={edit.customCode?.html || ""} onChange={(event) => updatePage(page, { customCode: { html: event.target.value, css: edit.customCode?.css || "", js: edit.customCode?.js || "", enabled: edit.customCode?.enabled === true } })} rows={7} /></label><label><span>CSS</span><textarea value={edit.customCode?.css || ""} onChange={(event) => updatePage(page, { customCode: { html: edit.customCode?.html || "", css: event.target.value, js: edit.customCode?.js || "", enabled: edit.customCode?.enabled === true } })} rows={7} /></label><label><span>JavaScript</span><textarea value={edit.customCode?.js || ""} onChange={(event) => updatePage(page, { customCode: { html: edit.customCode?.html || "", css: edit.customCode?.css || "", js: event.target.value, enabled: edit.customCode?.enabled === true } })} rows={7} /></label></div></div>
      <OwnerPageMedia page={page} ownerPin={ownerPin} onBusyChange={onBusyChange} onChange={(next) => { onEditState?.(true); onChange(pages.map((item) => item.id === page.id ? next : item)); }} />
      <div className="owner-pages-footer-actions"><label className="owner-pages-placement"><span>موضع الزر المرتبط</span><select value={placement} onChange={(event) => setPlacement(event.target.value as ButtonPlacement)}><option value="hero">واجهة البداية</option><option value="header">الهيدر</option><option value="services">الخدمات</option><option value="contact">التواصل</option></select></label><button type="button" onClick={() => onCreateButton?.(edit, placement)} disabled={!onCreateButton || !isPublished}><Plus size={15} /> إضافة زر مرتبط بهذه الصفحة</button><button type="button" onClick={() => saveDraft(page)} disabled={busy}><Save size={15} /> حفظ المسودة</button>{(hasDraft || edit.status === "draft") && <button type="button" className="owner-pages-publish" onClick={() => publish(page)} disabled={busy}><Upload size={15} /> اعتماد للترحيل</button>}<button type="button" onClick={() => setPreview(edit)}><MonitorPlay size={15} /> معاينة دون نشر</button></div>
    </div>
  </details>;
}

export default function OwnerPages({ pages, onChange, onCreateButton, site, onSave, onCommit, ownerPin, onBusyChange, onEditState }: OwnerPagesProps) {
  const [preview, setPreview] = useState<EditablePage | null>(null);
  const [template, setTemplate] = useState<PageTemplate>("landing");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const validation = useMemo(() => pages.map((page) => validatePageSlug(editablePage(page).slug, pages, page.id)), [pages]);
  const setBusyState = (value: boolean) => { setBusy(value); onBusyChange?.(value); };
  const updatePage = (page: EditablePage, patch: Partial<PageDraft>) => { onEditState?.(true); onChange(pages.map((item) => item.id === page.id ? updatePageDraft(item, patch) : item)); };
  const addPage = () => { onEditState?.(true); onChange([...pages, createPageTemplate(template, pages)]); };
  const deletePage = (page: EditablePage) => { if (window.confirm(`حذف صفحة «${editablePage(page).title}»؟ سيُنقل العنصر إلى سلة المحذوفات الخاصة قبل الترحيل.`)) onChange(pages.filter((item) => item.id !== page.id)); };
  const movePage = (index: number, direction: -1 | 1) => { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= pages.length) return; const next = [...pages]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; onChange(next.map((page, order) => ({ ...page, order: order + 1 }))); };
  const commit = async (next: EditablePage[]) => { if (onCommit) return onCommit(next); if (onSave) return onSave(); onChange(next); return true; };
  const saveDraft = async (page: EditablePage) => { setBusyState(true); setMessage(""); const next = pages.map((item) => item.id === page.id ? markPageDraftSaved(item) : item); try { const ok = await commit(next); if (ok) { if (!onCommit) onChange(next); setMessage("تم حفظ المسودة بعد تأكيد التخزين."); } else { onChange(pages); setMessage("تعذر حفظ المسودة؛ بقيت التعديلات محليًا."); } } catch (error) { onChange(pages); setMessage(`تعذر حفظ المسودة: ${error instanceof Error ? error.message : "خطأ اتصال"}`); } finally { setBusyState(false); } };
  const publish = async (page: EditablePage) => { setBusyState(true); setMessage(""); const next = pages.map((item) => item.id === page.id ? publishPage(item) : item); try { const ok = await commit(next); if (ok) { if (!onCommit) onChange(next); setMessage("حُفظت الصفحة واعتمدت في نسخة العمل فقط. انشرها للعامة من زر ترحيل التعديلات."); } else { onChange(pages); setMessage("لم يؤكد الخادم النشر؛ بقيت المسودة ولم يتغير الإصدار العام."); } } catch (error) { onChange(pages); setMessage(`لم تُنشر الصفحة؛ المسودة محفوظة محليًا. ${error instanceof Error ? error.message : "خطأ اتصال"}`); } finally { setBusyState(false); } };
  return <section className="owner-pages-editor" dir="rtl" aria-label="محرر الصفحات"><div className="owner-pages-heading"><div><span className="owner-pages-kicker">صفحات مستقلة</span><h2>أنشئ صفحاتك وانشرها بدون لمس الكود العام</h2><p>التعديلات على الصفحة المنشورة تبقى داخل مسودة مستقلة حتى تحفظ نسختك الخاصة وترحّلها من الشريط العلوي.</p></div><div className="owner-pages-create"><select value={template} onChange={(event) => setTemplate(event.target.value as PageTemplate)} aria-label="قالب الصفحة">{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={addPage}><Plus size={16} /> إنشاء صفحة</button></div></div>{message && <div className="owner-pages-message" role="status">{message}</div>}{pages.length === 0 && <div className="owner-pages-empty"><Plus size={22} /><strong>لا توجد صفحات بعد</strong><span>اختر قالبًا مفيدًا وأنشئ أول صفحة، ثم عدّل محتواها قبل نشرها.</span></div>}<div className="owner-pages-list">{pages.map((page, pageIndex) => <PageCard key={page.id} page={page} pageIndex={pageIndex} pages={pages} validation={validation[pageIndex]} site={site} ownerPin={ownerPin} busy={busy} onChange={onChange} onEditState={onEditState} onBusyChange={(value) => { setBusy(value); onBusyChange?.(value); }} onCreateButton={onCreateButton} setPreview={setPreview} updatePage={updatePage} deletePage={deletePage} movePage={movePage} saveDraft={saveDraft} publish={publish} />)}</div>{preview && <OwnerModal open onClose={() => setPreview(null)} title={`معاينة: ${preview.title}`} ariaLabel={`معاينة ${preview.title}`} className="owner-pages-preview-modal"><div className="owner-pages-preview-frame"><PageRenderer page={preview} site={site} mode="preview" showHidden /></div></OwnerModal>}</section>;
}
