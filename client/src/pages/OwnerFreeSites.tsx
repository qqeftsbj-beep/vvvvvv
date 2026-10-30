import { ChangeEvent, useState } from "react";
import { ArrowDown, ArrowUp, Check, Edit3, ExternalLink, ImagePlus, Link2, LockKeyhole, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

type SiteForm = {
  id?: number;
  name: string;
  url: string;
  description: string;
  additionalText: string;
  imageData?: string;
  imageName?: string;
  existingImageUrl?: string | null;
  clearImage?: boolean;
};

const emptyForm = (): SiteForm => ({ name: "", url: "", description: "", additionalText: "" });
const readImage = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function OwnerFreeSites({ unlocked }: { unlocked: boolean }) {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState<SiteForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const sitesQuery = trpc.freeSites.adminList.useQuery(undefined, { enabled: unlocked && isAuthenticated, refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const createMutation = trpc.freeSites.create.useMutation({ onSuccess: () => { utils.freeSites.adminList.invalidate(); utils.freeSites.list.invalidate(); resetForm(); toast.success("تمت إضافة الموقع وحفظه دائمًا."); } });
  const updateMutation = trpc.freeSites.update.useMutation({ onSuccess: () => { utils.freeSites.adminList.invalidate(); utils.freeSites.list.invalidate(); resetForm(); toast.success("تم تحديث الموقع."); } });
  const visibilityMutation = trpc.freeSites.setVisibility.useMutation({ onSuccess: () => { utils.freeSites.adminList.invalidate(); utils.freeSites.list.invalidate(); toast.success("تم تحديث حالة النشر."); } });
  const removeMutation = trpc.freeSites.remove.useMutation({ onSuccess: () => { utils.freeSites.adminList.invalidate(); utils.freeSites.list.invalidate(); if (editingId) resetForm(); toast.success("تم حذف الموقع."); } });
  const reorderMutation = trpc.freeSites.reorder.useMutation({ onSuccess: () => { utils.freeSites.adminList.invalidate(); utils.freeSites.list.invalidate(); } });

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختر صورة أو لقطة شاشة صالحة.");
    if (file.size > 8 * 1024 * 1024) return toast.error("حجم الصورة يجب أن يكون أقل من 8 ميغابايت.");
    const imageData = await readImage(file);
    setForm((current) => ({ ...current, imageData, imageName: file.name, clearImage: false }));
  };

  const editSite = (site: NonNullable<typeof sitesQuery.data>[number]) => {
    setEditingId(site.id);
    setForm({ id: site.id, name: site.name, url: site.url || "", description: site.description || "", additionalText: site.additionalText || "", existingImageUrl: site.imageUrl });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveSite = () => {
    if (!form.name.trim()) return toast.error("اكتب اسم الموقع أولًا.");
    const payload = { name: form.name.trim(), url: form.url.trim(), description: form.description.trim(), additionalText: form.additionalText.trim(), imageData: form.imageData, imageName: form.imageName, ...(editingId ? { id: editingId, clearImage: form.clearImage } : { sortOrder: sitesQuery.data?.length || 0, isVisible: true }) };
    if (editingId) updateMutation.mutate(payload as Parameters<typeof updateMutation.mutate>[0]);
    else createMutation.mutate(payload as Parameters<typeof createMutation.mutate>[0]);
  };

  const moveSite = (index: number, direction: -1 | 1) => {
    const sites = [...(sitesQuery.data || [])];
    const target = index + direction;
    if (target < 0 || target >= sites.length) return;
    [sites[index], sites[target]] = [sites[target], sites[index]];
    reorderMutation.mutate({ ids: sites.map((site) => site.id) });
  };

  if (!unlocked) return null;
  if (!isAuthenticated) return <section className="owner-services-card free-sites-owner-card"><div className="owner-card-heading"><div><span className="studio-label">07 / المواقع المجانية</span><h2>دليل المواقع والخدمات</h2></div><Link2 size={20} /></div><p className="owner-security-note">هذه البيانات تُحفظ في قاعدة البيانات وتظهر للزوار بعد النشر. سجّل دخول حساب المالك لإدارة المحتوى.</p><button type="button" className="owner-save" onClick={startLogin}><LockKeyhole size={16} /> تسجيل دخول المالك</button></section>;

  const busy = createMutation.isPending || updateMutation.isPending;
  return <section className="owner-services-card free-sites-owner-card">
    <div className="owner-card-heading"><div><span className="studio-label">07 / المواقع المجانية</span><h2>دليل المواقع والخدمات</h2></div><a className="owner-back free-sites-preview-link" href="/free-sites" target="_blank" rel="noreferrer"><ExternalLink size={15} /> معاينة الصفحة</a></div>
    <p className="owner-security-note">أضف الاسم والرابط والشرح والصورة عند الحاجة. أي حقل فارغ لن يظهر ولن يحجز مساحة في صفحة الدليل.</p>
    <div className="free-sites-manager-layout">
      <div className="free-sites-form">
        <div className="free-sites-form-head"><span>{editingId ? "تعديل الموقع" : "إضافة موقع جديد"}</span>{editingId && <button type="button" className="owner-ghost-action" onClick={resetForm}><X size={14} /> إلغاء التعديل</button>}</div>
        <label><span>اسم الموقع *</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="مثال: Canva" /></label>
        <label><span>الرابط الاختياري</span><input dir="ltr" value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://example.com" /></label>
        <label><span>شرح مختصر للفائدة</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="ما الذي يقدمه الموقع؟" /></label>
        <label><span>نصوص إضافية اختيارية</span><textarea value={form.additionalText} onChange={(event) => setForm((current) => ({ ...current, additionalText: event.target.value }))} placeholder="ملاحظة أو طريقة استخدام مختصرة" /></label>
        <label className="owner-image-upload free-sites-upload"><input type="file" accept="image/*" onChange={chooseImage} /><span><ImagePlus size={18} /> {form.imageData || form.existingImageUrl ? "تغيير الصورة أو اللقطة" : "إضافة صورة أو لقطة شاشة"}</span><small>{form.imageName || (form.existingImageUrl ? "صورة محفوظة حاليًا" : "اختياري — لا توجد مساحة فارغة إذا لم تضفها")}</small></label>
        {(form.imageData || form.existingImageUrl) && <div className="free-sites-image-preview"><img src={form.imageData || form.existingImageUrl || ""} alt="معاينة الصورة" /><button type="button" onClick={() => setForm((current) => ({ ...current, imageData: undefined, imageName: undefined, existingImageUrl: undefined, clearImage: true }))} aria-label="إزالة الصورة"><Trash2 size={15} /></button></div>}
        <button type="button" className="owner-save" disabled={busy} onClick={saveSite}>{editingId ? <Save size={16} /> : <Plus size={16} />} {busy ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة وحفظ"}</button>
      </div>
      <div className="free-sites-owner-list">
        <div className="free-sites-list-head"><strong>المواقع المحفوظة</strong><span>{sitesQuery.isLoading ? "جارٍ التحميل" : `${sitesQuery.data?.length || 0} عنصر`}</span></div>
        {!sitesQuery.data?.length && !sitesQuery.isLoading && <p className="owner-empty">لم تتم إضافة مواقع بعد.</p>}
        {sitesQuery.data?.map((site, index) => <article className={`free-site-owner-row ${site.isVisible ? "is-published" : "is-hidden"}`} key={site.id}>
          <div className="free-site-owner-thumb">{site.imageUrl ? <img src={site.imageUrl} alt="" /> : <Link2 size={17} />}</div>
          <div className="free-site-owner-info"><strong>{site.name}</strong><small>{site.isVisible ? "منشور للزوار" : "مخفي عن الزوار"}{site.url ? " · يحتوي رابطًا" : ""}</small></div>
          <div className="free-site-owner-actions"><button type="button" className="owner-icon-action" onClick={() => moveSite(index, -1)} disabled={index === 0 || reorderMutation.isPending} aria-label="تحريك لأعلى"><ArrowUp size={14} /></button><button type="button" className="owner-icon-action" onClick={() => moveSite(index, 1)} disabled={index === (sitesQuery.data?.length || 1) - 1 || reorderMutation.isPending} aria-label="تحريك لأسفل"><ArrowDown size={14} /></button><button type="button" className="owner-icon-action" onClick={() => visibilityMutation.mutate({ id: site.id, isVisible: !Boolean(site.isVisible) })} aria-label={site.isVisible ? "إخفاء" : "نشر"}>{site.isVisible ? <Check size={14} /> : <Upload size={14} />}</button><button type="button" className="owner-icon-action" onClick={() => editSite(site)} aria-label="تعديل"><Edit3 size={14} /></button><button type="button" className="owner-icon-action danger" onClick={() => { if (window.confirm("حذف هذا الموقع نهائيًا؟")) removeMutation.mutate({ id: site.id }); }} aria-label="حذف"><Trash2 size={14} /></button></div>
        </article>)}
      </div>
    </div>
  </section>;
}
