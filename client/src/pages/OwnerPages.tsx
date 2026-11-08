import React, { ChangeEvent, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, ImagePlus, MonitorPlay, Plus, Trash2 } from "lucide-react";
import type { EditablePage, EditablePageBlock, PageAppearance, SiteContent } from "@/lib/siteContent";
import { slugifyPageTitle, validatePageSlug } from "@/lib/siteContent";
import PageRenderer from "./PageRenderer";
import "./ownerPages.css";

export type OwnerPagesProps = {
  pages: EditablePage[];
  onChange: (pages: EditablePage[]) => void;
  onCreateButton?: (page: EditablePage) => void;
  site?: Pick<SiteContent, "settings" | "customCode">;
};

export type PageTemplate = "landing" | "directory" | "showcase";

const labels: Record<PageTemplate, string> = {
  landing: "صفحة هبوط",
  directory: "دليل خدمات",
  showcase: "معرض أعمال",
};

const uid = (prefix: string) => `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
const readImage = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error || new Error("تعذر قراءة الصورة"));
  reader.readAsDataURL(file);
});

export function createPageTemplate(template: PageTemplate, existingPages: EditablePage[] = []): EditablePage {
  const title = template === "directory" ? "دليل خدمات أبو كيان" : template === "showcase" ? "مختارات من أعمالنا" : "صفحة هبوط جديدة";
  const baseSlug = slugifyPageTitle(title, "page");
  let slug = baseSlug;
  let suffix = 2;
  while (existingPages.some((page) => page.slug === slug)) slug = `${baseSlug}-${suffix++}`;
  const common = { id: uid("page"), slug, title, eyebrow: template === "directory" ? "اختر ما يناسب مشروعك" : template === "showcase" ? "نماذج وتجارب بصرية" : "خطوة أوضح لفكرتك", description: template === "directory" ? "خدمات مرتبة تساعدك على اختيار البداية المناسبة والتواصل معنا بسرعة." : template === "showcase" ? "مساحة تحفظ تفاصيل المشاريع وتوضح كيف تحولت الفكرة إلى حضور بصري." : "قدّم فكرتك في صفحة مركزة مع رسالة واضحة وخطوة تالية واحدة.", template, visible: true, status: "draft" as const, useLegacyCustomCode: false, blocks: [] as EditablePageBlock[] };
  const blocks: EditablePageBlock[] = template === "directory" ? [
    { id: uid("block"), type: "service", title: "تصاميم المناسبات", content: "بطاقات ومواد بصرية تُبنى حول اسمك ولحظتك.", visible: true, order: 1 },
    { id: uid("block"), type: "service", title: "المواقع وصفحات الهبوط", content: "واجهة مرتبة تساعد العميل على فهمك واتخاذ الخطوة التالية.", visible: true, order: 2 },
    { id: uid("block"), type: "button", title: "ابدأ محادثة", url: "/#contact", visible: true, order: 3 },
  ] : template === "showcase" ? [
    { id: uid("block"), type: "image", title: "أضف صورة المشروع من محرر الصفحة", image: "", visible: true, order: 1 },
    { id: uid("block"), type: "text", title: "قصة المشروع", content: "اكتب ما الذي كان مطلوبًا، وما القرار البصري الذي جعل النتيجة أوضح.", visible: true, order: 2 },
    { id: uid("block"), type: "button", title: "اطلب مشروعًا مشابهًا", url: "/#contact", visible: true, order: 3 },
  ] : [
    { id: uid("block"), type: "text", title: "وعد واضح للزائر", content: "اشرح النتيجة التي سيحصل عليها العميل في جملة قصيرة ومباشرة.", visible: true, order: 1 },
    { id: uid("block"), type: "service", title: "ما الذي سيحدث بعد التواصل؟", content: "نراجع فكرتك، نحدد المخرج المناسب، ثم نبدأ بخطوة صغيرة قابلة للقياس.", visible: true, order: 2 },
    { id: uid("block"), type: "button", title: "تواصل الآن", url: "/#contact", visible: true, order: 3 },
  ];
  return { ...common, blocks };
}

function ImageUpload({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
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
  return <details className="owner-pages-block" open={index === 0}><summary><span className="owner-pages-drag">{String(index + 1).padStart(2, "0")}</span><strong>{block.title || "عنصر بلا عنوان"}</strong><small>{block.type}</small><ChevronDown size={16} /></summary><div className="owner-pages-block-fields"><label><span>نوع المحتوى</span><select value={block.type} onChange={(event) => update("type", event.target.value as EditablePageBlock["type"])}><option value="text">نص</option><option value="image">صورة</option><option value="button">زر</option><option value="service">خدمة</option></select></label><label><span>العنوان</span><input value={block.title || ""} onChange={(event) => update("title", event.target.value)} /></label>{block.type === "image" ? <><ImageUpload label="رفع صورة من الجهاز" value={block.image} onChange={(value) => update("image", value)} /><label className="owner-pages-wide"><span>رابط الصورة أو البيانات المحلية</span><input value={block.image || ""} onChange={(event) => update("image", event.target.value)} placeholder="https://… أو data:image/…" /></label></> : block.type === "button" ? <label className="owner-pages-wide"><span>رابط الزر (داخلي أو https)</span><input value={block.url || ""} onChange={(event) => update("url", event.target.value)} placeholder="/custom/page أو https://…" />{block.url && !/^https:\/\/[^\s]+$/i.test(block.url) && !/^\/(?!\/)/.test(block.url) && <small className="owner-pages-error">الرابط يجب أن يبدأ بـ / أو https://، ولن يُعرض إذا كان غير آمن.</small>}</label> : <label className="owner-pages-wide"><span>{block.type === "service" ? "وصف الخدمة" : "المحتوى"}</span><textarea value={block.content || ""} onChange={(event) => update("content", event.target.value)} rows={3} /></label>}<div className="owner-pages-block-actions"><button type="button" onClick={() => update("visible", block.visible === false)}>{block.visible === false ? <Eye size={15} /> : <EyeOff size={15} />} {block.visible === false ? "إظهار" : "إخفاء"}</button><button type="button" disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp size={15} /> لأعلى</button><button type="button" disabled={index === total - 1} onClick={() => onMove(1)}><ChevronDown size={15} /> لأسفل</button><button type="button" className="owner-pages-danger" onClick={onDelete}><Trash2 size={15} /> حذف العنصر</button></div></div></details>;
}

export default function OwnerPages({ pages, onChange, onCreateButton, site }: OwnerPagesProps) {
  const [preview, setPreview] = useState<EditablePage | null>(null);
  const [template, setTemplate] = useState<PageTemplate>("landing");
  const validation = useMemo(() => pages.map((page) => validatePageSlug(page.slug, pages, page.id)), [pages]);
  const updatePage = (id: string, patch: Partial<EditablePage>) => onChange(pages.map((page) => page.id === id ? { ...page, ...patch } : page));
  const addPage = () => onChange([...pages, createPageTemplate(template, pages)]);
  const deletePage = (page: EditablePage) => { if (window.confirm(`حذف صفحة «${page.title}»؟ لا يمكن التراجع عن هذا الإجراء قبل الحفظ.`)) onChange(pages.filter((item) => item.id !== page.id)); };
  const addBlock = (page: EditablePage, type: EditablePageBlock["type"]) => {
    const next: EditablePageBlock = { id: uid("block"), type, title: type === "button" ? "زر جديد" : type === "image" ? "صورة جديدة" : type === "service" ? "خدمة جديدة" : "قسم جديد", content: type === "text" || type === "service" ? "اكتب المحتوى هنا." : "", url: type === "button" ? "/" : "", visible: true, order: (page.blocks || []).length + 1 };
    updatePage(page.id, { blocks: [...(page.blocks || []), next] });
  };
  const updateBlock = (page: EditablePage, blockId: string, patch: Partial<EditablePageBlock>) => updatePage(page.id, { blocks: (page.blocks || []).map((block) => block.id === blockId ? { ...block, ...patch } : block) });
  const moveBlock = (page: EditablePage, index: number, direction: -1 | 1) => {
    const blocks = [...(page.blocks || [])];
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
    updatePage(page.id, { blocks: blocks.map((block, order) => ({ ...block, order: order + 1 })) });
  };
  const updateSlug = (page: EditablePage, slug: string) => updatePage(page.id, { slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") });

  return <section className="owner-pages-editor" dir="rtl" aria-label="محرر الصفحات"><div className="owner-pages-heading"><div><span className="owner-pages-kicker">صفحات مستقلة</span><h2>أنشئ صفحاتك وانشرها بدون لمس الكود العام</h2><p>التغييرات تعود إلى الأب كمسودة فقط؛ الحفظ المركزي يبقى مسؤولية لوحة المالك.</p></div><div className="owner-pages-create"><select value={template} onChange={(event) => setTemplate(event.target.value as PageTemplate)} aria-label="قالب الصفحة"><option value="landing">قالب هبوط</option><option value="directory">قالب دليل</option><option value="showcase">قالب معرض</option></select><button type="button" onClick={addPage}><Plus size={16} /> إنشاء صفحة</button></div></div>{pages.length === 0 && <div className="owner-pages-empty"><Plus size={22} /><strong>لا توجد صفحات بعد</strong><span>اختر قالبًا مفيدًا وأنشئ أول صفحة، ثم عدّل محتواها قبل نشرها.</span></div>}<div className="owner-pages-list">{pages.map((page, pageIndex) => <details className={`owner-page-card ${page.status === "draft" || page.visible === false ? "is-draft" : ""}`} key={page.id} open={pageIndex === 0}><summary><span className="owner-page-index">{String(pageIndex + 1).padStart(2, "0")}</span><span className="owner-page-summary"><strong>{page.title || "صفحة بلا عنوان"}</strong><small>/custom/{page.slug || "…"} · {labels[page.template]}</small></span><span className={`owner-page-status ${page.status === "draft" || page.visible === false ? "draft" : "published"}`}>{page.status === "draft" || page.visible === false ? "مسودة / مخفية" : "منشورة"}</span><ChevronDown size={18} /></summary><div className="owner-page-card-body"><div className="owner-pages-toolbar"><button type="button" onClick={() => setPreview(page)}><MonitorPlay size={15} /> معاينة مستقلة</button><button type="button" onClick={() => updatePage(page.id, { visible: page.visible === false })}>{page.visible === false ? <Eye size={15} /> : <EyeOff size={15} />} {page.visible === false ? "إظهار الصفحة" : "إخفاء الصفحة"}</button><button type="button" className="owner-pages-danger" onClick={() => deletePage(page)}><Trash2 size={15} /> حذف الصفحة</button></div><div className="owner-pages-fields"><label><span>عنوان الصفحة</span><input value={page.title} onChange={(event) => updatePage(page.id, { title: event.target.value })} /></label><label><span>المسار slug</span><input value={page.slug} onChange={(event) => updateSlug(page, event.target.value)} aria-invalid={Boolean(validation[pageIndex])} />{validation[pageIndex] && <small className="owner-pages-error">{validation[pageIndex]}</small>}</label><label><span>السطر التعريفي</span><input value={page.eyebrow} onChange={(event) => updatePage(page.id, { eyebrow: event.target.value })} /></label><label><span>القالب</span><select value={page.template} onChange={(event) => updatePage(page.id, { template: event.target.value as PageTemplate })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="owner-pages-wide"><span>وصف الصفحة</span><textarea value={page.description} onChange={(event) => updatePage(page.id, { description: event.target.value })} rows={3} /></label><label><span>حالة النشر</span><select value={page.status || "published"} onChange={(event) => updatePage(page.id, { status: event.target.value as EditablePage["status"] })}><option value="draft">مسودة</option><option value="published">منشورة</option></select></label></div><div className="owner-pages-section"><div className="owner-pages-section-heading"><div><strong>ألوان وخلفية الصفحة</strong><small>تتغلب على ألوان الموقع العام لهذه الصفحة فقط.</small></div></div><AppearanceFields appearance={page.appearance} onChange={(appearance) => updatePage(page.id, { appearance })} /><ImageUpload label="رفع خلفية الصفحة" value={page.appearance?.backgroundImage} onChange={(value) => updatePage(page.id, { appearance: { ...page.appearance, backgroundImage: value } })} /></div><div className="owner-pages-section"><div className="owner-pages-section-heading"><div><strong>محتوى الصفحة</strong><small>{(page.blocks || []).length} عناصر · عدّل أو أخفِ أو أعد الترتيب.</small></div><div className="owner-pages-add-blocks"><button type="button" onClick={() => addBlock(page, "text")}>+ نص</button><button type="button" onClick={() => addBlock(page, "image")}>+ صورة</button><button type="button" onClick={() => addBlock(page, "button")}>+ زر</button><button type="button" onClick={() => addBlock(page, "service")}>+ خدمة</button></div></div>{(page.blocks || []).map((block, index) => <BlockEditor key={block.id} block={block} index={index} total={(page.blocks || []).length} onChange={(next) => updateBlock(page, block.id, next)} onMove={(direction) => moveBlock(page, index, direction)} onDelete={() => { if (window.confirm("حذف هذا العنصر؟")) updatePage(page.id, { blocks: (page.blocks || []).filter((item) => item.id !== block.id).map((item, order) => ({ ...item, order: order + 1 })) }); }} />)}</div><div className="owner-pages-section"><div className="owner-pages-section-heading"><div><strong>كود هذه الصفحة</strong><small>معزول داخل iframe؛ في المعاينة يحتاج تشغيلًا صريحًا، وفي الموقع يعمل فقط عند التفعيل.</small></div></div><label className="owner-pages-checkbox"><input type="checkbox" checked={page.customCode?.enabled === true} onChange={(event) => updatePage(page.id, { customCode: { html: page.customCode?.html || "", css: page.customCode?.css || "", js: page.customCode?.js || "", enabled: event.target.checked } })} /> تفعيل الكود المخصص لهذه الصفحة</label><label className="owner-pages-checkbox"><input type="checkbox" checked={page.useLegacyCustomCode === true} onChange={(event) => updatePage(page.id, { useLegacyCustomCode: event.target.checked })} /> استخدام كود الموقع القديم لهذه الصفحة</label><div className="owner-pages-code-grid"><label><span>HTML</span><textarea value={page.customCode?.html || ""} onChange={(event) => updatePage(page.id, { customCode: { html: event.target.value, css: page.customCode?.css || "", js: page.customCode?.js || "", enabled: page.customCode?.enabled === true } })} rows={5} /></label><label><span>CSS</span><textarea value={page.customCode?.css || ""} onChange={(event) => updatePage(page.id, { customCode: { html: page.customCode?.html || "", css: event.target.value, js: page.customCode?.js || "", enabled: page.customCode?.enabled === true } })} rows={5} /></label><label><span>JavaScript</span><textarea value={page.customCode?.js || ""} onChange={(event) => updatePage(page.id, { customCode: { html: page.customCode?.html || "", css: page.customCode?.css || "", js: event.target.value, enabled: page.customCode?.enabled === true } })} rows={5} /></label></div></div><div className="owner-pages-footer-actions"><button type="button" onClick={() => onCreateButton?.(page)} disabled={!onCreateButton || page.status === "draft" || page.visible === false}><Plus size={15} /> إضافة زر مرتبط بهذه الصفحة</button><button type="button" onClick={() => setPreview(page)}><MonitorPlay size={15} /> معاينة دون نشر</button></div></div></details>)}</div>{preview && <div className="owner-pages-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}><div className="owner-pages-modal" role="dialog" aria-modal="true" aria-label={`معاينة ${preview.title}`}><div className="owner-pages-modal-heading"><strong>معاينة: {preview.title}</strong><button type="button" onClick={() => setPreview(null)} aria-label="إغلاق المعاينة">×</button></div><div className="owner-pages-preview-frame"><PageRenderer page={preview} site={site} mode="preview" showHidden /></div></div></div>}</section>;
}
