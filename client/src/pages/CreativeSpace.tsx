import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Send, Sparkles, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const readDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
type GalleryState = { urls: string[]; index: number } | null;
type FormState = { projectName: string; description: string; category: string; link: string; contact: string };
const emptyForm: FormState = { projectName: "", description: "", category: "", link: "", contact: "" };

export default function CreativeSpace() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [gallery, setGallery] = useState<GalleryState>(null);
  const submissions = trpc.creativeSpace.list.useQuery(undefined, { staleTime: 30_000 });
  const categories = trpc.creativeCategories.list.useQuery(undefined, { staleTime: 60_000 });
  const create = trpc.creativeSpace.create.useMutation({
    onSuccess: () => { setForm(emptyForm); setImages([]); setFormOpen(false); setSent(true); submissions.refetch(); toast.success("تم إرسال مشاركتك للمراجعة."); },
    onError: (error) => toast.error(error.message || "تعذر إرسال المشاركة.")
  });

  useEffect(() => {
    if (!gallery) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setGallery(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [gallery]);
  useEffect(() => {
    if (!formOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setFormOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [formOpen]);
  useEffect(() => {
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") { setPreviewUrls([]); return; }
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  const visibleSubmissions = useMemo(() => activeCategory === "all" ? submissions.data || [] : (submissions.data || []).filter((item) => item.category === activeCategory), [activeCategory, submissions.data]);
  const selectedCategoryName = categories.data?.find((category) => category.slug === form.category)?.name || "لم يتم اختيار قسم";
  const chooseImages = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    if (selected.length > 4) return toast.error("يمكنك إضافة 4 صور كحد أقصى.");
    setImages(selected);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.description.trim()) return toast.error("تعريف المشروع مطلوب قبل الإرسال.");
    if (!form.category) return toast.error("اختر القسم الذي ينتمي إليه مشروعك.");
    const imageData = await Promise.all(images.map(readDataUrl));
    create.mutate({ ...form, imageData });
  };
  const openGallery = (urls: string[], index: number) => { if (urls.length) setGallery({ urls, index }); };
  const moveGallery = (direction: 1 | -1) => setGallery((current) => current ? { ...current, index: (current.index + direction + current.urls.length) % current.urls.length } : current);
  const previewTitle = form.projectName.trim() || "مشاركة إبداعية";
  const preview = <aside className="creative-live-preview" aria-label="معاينة المشاركة"><div className="creative-live-preview-heading"><span className="studio-label">02 / معاينة مباشرة</span><span className="creative-live-dot">تتحدث تلقائيًا</span></div><article className="creative-space-card creative-preview-card">{previewUrls.length > 0 && <div className={`creative-space-gallery ${previewUrls.length === 1 ? "is-single" : "is-grid"}`}>{previewUrls.map((url) => <div className="creative-space-image-button" key={url}><img src={url} alt="معاينة الصورة" /></div>)}</div>}<div className="creative-space-card-body"><span className="creative-space-card-kicker">{selectedCategoryName}</span><h3>{previewTitle}</h3><p>{form.description.trim() || "سيظهر تعريف مشروعك هنا بعد كتابته."}</p>{form.contact.trim() && <small>{form.contact}</small>}{form.link.trim() && <a href={form.link} onClick={(event) => event.preventDefault()}>زيارة المشروع <ExternalLink size={14} /></a>}</div></article></aside>;
  const formModal = formOpen && <div className="creative-submit-modal" role="dialog" aria-modal="true" aria-label="إضافة مشروع" onClick={() => setFormOpen(false)}><div className="creative-submit-modal-content" onClick={(event) => event.stopPropagation()}><form id="submit" className="creative-space-form creative-space-form-modal" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}><button type="button" className="creative-modal-close" onClick={() => setFormOpen(false)} aria-label="إغلاق"><X size={20} /></button><div className="creative-space-form-heading"><span className="studio-label">01 / أرسل مشاركتك</span><h2>عرّف الناس بما تصنع.</h2><p>التعريف والقسم إجباريان. بقية الحقول اختيارية.</p></div>{sent && <div className="creative-space-success"><Check size={17} /> وصلت مشاركتك وستظهر بعد الموافقة عليها.</div>}<label><span>اسم المشروع أو الخدمة (اختياري)</span><input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} maxLength={255} placeholder="مثال: استوديو ورد" /></label><label><span>التعريف بالمشروع <b>*</b></span><textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={5000} placeholder="اكتب وصفًا مختصرًا وواضحًا..." /></label><label><span>القسم <b>*</b></span><select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="" disabled>اختر القسم الذي ينتمي إليه مشروعك</option>{categories.data?.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select><small className="creative-field-hint">اختر من الأقسام المتاحة حتى تصل مشاركتك إلى جمهورها المناسب.</small></label><label><span>رابط المشروع أو الحساب (اختياري)</span><input type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" /></label><label><span>بيانات التواصل (اختياري)</span><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={500} placeholder="واتساب أو بريد إلكتروني" /></label><label className="creative-space-upload"><input type="file" accept="image/*" multiple onChange={chooseImages} /><span><ImagePlus size={18} /> أضف صورًا للمشروع</span><small>{images.length ? `${images.length} صور مختارة` : "اختياري · حتى 4 صور"}</small></label><button className="creative-space-submit" type="submit" disabled={create.isPending}>{create.isPending ? "جارٍ الإرسال..." : "إرسال للمراجعة"} <Send size={15} /></button></form>{preview}</div></div>;

  return <main dir="rtl" className="creative-space-page"><header className="creative-space-header"><Link href="/" className="free-sites-back"><ArrowRight size={15} /> العودة للموقع</Link><div className="creative-space-brand"><Sparkles size={17} /> مساحتك للإبداع</div><span className="creative-space-mark">أبو كيان الجنيد</span></header><section className="creative-space-hero"><span className="studio-label"><span className="free-sites-dot" /> مساحة للظهور</span><h1>شارك فكرتك<br /><em>بشكل يليق بها.</em></h1><p>قدّم مشروعك أو موهبتك أو خدمتك. نراجع المشاركات بعناية قبل عرضها للزوار.</p><button type="button" className="creative-space-cta" onClick={() => setFormOpen(true)}><Send size={16} /> أضف مشروعك <ArrowLeft size={15} /></button>{sent && <div className="creative-space-success creative-space-success-inline"><Check size={17} /> وصلت مشاركتك وستظهر بعد الموافقة عليها.</div>}</section><section className="creative-space-layout"><div className="creative-space-library"><div className="creative-space-list-heading"><span className="studio-label">01 / المشاركات المنشورة</span><h2>مساحات صنعتها أفكار جميلة.</h2></div><div className="creative-category-tabs"><button type="button" className={activeCategory === "all" ? "is-active" : ""} onClick={() => setActiveCategory("all")}>الكل</button>{categories.data?.map((category) => <button type="button" className={activeCategory === category.slug ? "is-active" : ""} key={category.slug} onClick={() => setActiveCategory(category.slug)}>{category.name}</button>)}</div>{submissions.isLoading && <p className="creative-space-empty">جارٍ تحميل المشاركات...</p>}{!submissions.isLoading && !visibleSubmissions.length && <p className="creative-space-empty">ستظهر المشاركات المعتمدة هنا قريبًا.</p>}{visibleSubmissions.map((item) => { const title = item.projectName || "مشاركة إبداعية"; return <article className="creative-space-card" key={item.id}>{item.imageUrls?.length ? <div className={`creative-space-gallery ${item.imageUrls.length === 1 ? "is-single" : "is-grid"}`}>{item.imageUrls.map((url, index) => <button type="button" className="creative-space-image-button" key={url} onClick={() => openGallery(item.imageUrls || [], index)} aria-label={`تكبير صورة ${title}`}><img src={url} alt={title} loading="lazy" /></button>)}</div> : null}<div className="creative-space-card-body"><span className="creative-space-card-kicker">{categories.data?.find((category) => category.slug === item.category)?.name || "مساحة إبداعية"}</span><h3>{title}</h3>{item.description && <p>{item.description}</p>}{item.contact && <small>{item.contact}</small>}{item.link && <a href={item.link} target="_blank" rel="noreferrer">زيارة المشروع <ExternalLink size={14} /></a>}</div></article>; })}</div></section>{formModal}{gallery && <div className="creative-gallery-modal" role="dialog" aria-modal="true" aria-label="عارض الصور" onClick={() => setGallery(null)}><button type="button" className="creative-gallery-close" onClick={() => setGallery(null)} aria-label="إغلاق"><X size={20} /></button>{gallery.urls.length > 1 && <button type="button" className="creative-gallery-next creative-gallery-prev" onClick={(event) => { event.stopPropagation(); moveGallery(-1); }} aria-label="الصورة السابقة"><ChevronRight size={25} /></button>}<img src={gallery.urls[gallery.index]} alt="عرض مكبر" onClick={(event) => event.stopPropagation()} />{gallery.urls.length > 1 && <button type="button" className="creative-gallery-next" onClick={(event) => { event.stopPropagation(); moveGallery(1); }} aria-label="الصورة التالية"><ChevronLeft size={25} /></button>}<span className="creative-gallery-count">{gallery.index + 1} / {gallery.urls.length}</span></div>}</main>;
}
