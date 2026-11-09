import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Edit3, ExternalLink, ImagePlus, Link2, LockKeyhole, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
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

export default function OwnerFreeSites({ unlocked, ownerPin, onDirtyChange, onSaveRegister, onWorkspaceChange }: { unlocked: boolean; ownerPin?: string; onDirtyChange?: (dirty:boolean)=>void; onSaveRegister?:(callback:(()=>Promise<boolean>)|null)=>void; onWorkspaceChange?:()=>void }) {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState<SiteForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const sitesQuery = trpc.freeSites.adminList.useQuery(undefined, { enabled: unlocked && !ownerPin && isAuthenticated, refetchOnWindowFocus: false });
  const pinList=trpc.freeSites.adminListWithPin.useMutation();
  const pinCreate=trpc.freeSites.createWithPin.useMutation();
  const pinUpdate=trpc.freeSites.updateWithPin.useMutation();
  const pinVisibility=trpc.freeSites.setVisibilityWithPin.useMutation();
  const pinRemove=trpc.freeSites.removeWithPin.useMutation();
  const pinReorder=trpc.freeSites.reorderWithPin.useMutation();
  const [privateSites,setPrivateSites]=useState<NonNullable<typeof sitesQuery.data>>([]);
  const [privateLoaded,setPrivateLoaded]=useState(false);
  const refreshPrivate=async()=>{if(!ownerPin)return;const rows=await pinList.mutateAsync({ownerPin});setPrivateSites(rows as NonNullable<typeof sitesQuery.data>);setPrivateLoaded(true);};
  useEffect(()=>{if(!ownerPin||!unlocked)return;void refreshPrivate().catch(error=>toast.error(error instanceof Error?error.message:"تعذر تحميل نسخة المواقع الخاصة."));const timer=window.setInterval(()=>{void refreshPrivate().catch(()=>undefined);},15000);return()=>window.clearInterval(timer);},[ownerPin,unlocked]);
  const sites=ownerPin?privateSites:(sitesQuery.data||[]);
  const loading=ownerPin?!privateLoaded:sitesQuery.isLoading;
  const [formBaseline,setFormBaseline]=useState(()=>JSON.stringify(emptyForm()));
  const callbacks=useRef({onDirtyChange,onSaveRegister,onWorkspaceChange}); callbacks.current={onDirtyChange,onSaveRegister,onWorkspaceChange};
  const latestForm=useRef(form);latestForm.current=form;
  const dirty=JSON.stringify(form)!==formBaseline;
  const dirtyRef=useRef(dirty); dirtyRef.current=dirty;
  const saveRef=useRef<()=>Promise<boolean>>(async()=>true);
  useEffect(()=>{callbacks.current.onDirtyChange?.(dirty);},[dirty]);
  useEffect(()=>{callbacks.current.onSaveRegister?.(()=>saveRef.current());return()=>{callbacks.current.onSaveRegister?.(null);callbacks.current.onDirtyChange?.(false);};},[]);
  const utils = trpc.useUtils();
  const createMutation = trpc.freeSites.create.useMutation({ onSuccess: () => { utils.freeSites.adminList.invalidate(); utils.freeSites.list.invalidate(); if(ownerPin)void refreshPrivate(); callbacks.current.onWorkspaceChange?.(); toast.success("حُفظ الموقع في نسخة العمل الخاصة، ولم يُنشر بعد."); } });
  const updateMutation = trpc.freeSites.update.useMutation({ onSuccess: () => { utils.freeSites.adminList.invalidate(); utils.freeSites.list.invalidate(); if(ownerPin)void refreshPrivate(); callbacks.current.onWorkspaceChange?.(); toast.success("حُفظ تعديل الموقع بشكل خاص."); } });
  const visibilityMutation = trpc.freeSites.setVisibility.useMutation({ onSuccess: () => { utils.freeSites.adminList.invalidate(); utils.freeSites.list.invalidate(); if(ownerPin)void refreshPrivate(); callbacks.current.onWorkspaceChange?.(); toast.success("حُفظت حالة الظهور في نسخة العمل الخاصة."); } });
  const removeMutation = trpc.freeSites.remove.useMutation({ onSuccess: () => { utils.freeSites.adminList.invalidate(); utils.freeSites.list.invalidate(); if (editingId) resetForm(); callbacks.current.onWorkspaceChange?.(); toast.success("نُقل الموقع إلى سلة محذوفات نسخة العمل."); } });
  const reorderMutation = trpc.freeSites.reorder.useMutation({ onSuccess: () => { utils.freeSites.adminList.invalidate(); utils.freeSites.list.invalidate(); } });

  function resetForm() {
    setForm(emptyForm());
    setFormBaseline(JSON.stringify(emptyForm()));
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
    const next={ id: site.id, name: site.name, url: site.url || "", description: site.description || "", additionalText: site.additionalText || "", existingImageUrl: site.imageUrl };
    setForm(next);setFormBaseline(JSON.stringify(next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveSite = async ():Promise<boolean> => {
    if (!dirtyRef.current) return true;
    if (!form.name.trim()) { toast.error("اكتب اسم الموقع أولًا.");return false; }
    const sent=JSON.stringify(form);
    const payload = { name: form.name.trim(), url: form.url.trim(), description: form.description.trim(), additionalText: form.additionalText.trim(), imageData: form.imageData, imageName: form.imageName, ...(editingId ? { id: editingId, clearImage: form.clearImage } : { sortOrder: sites.length || 0, isVisible: true }) };
    try {
      if (ownerPin) { if(editingId) await pinUpdate.mutateAsync({ownerPin,...payload,id:editingId}); else await pinCreate.mutateAsync({ownerPin,...payload}); await refreshPrivate(); callbacks.current.onWorkspaceChange?.(); }
      else if (editingId) await updateMutation.mutateAsync(payload as Parameters<typeof updateMutation.mutateAsync>[0]);
      else await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0]);
      if(JSON.stringify(latestForm.current)===sent)resetForm();
      else setFormBaseline(sent);
      return true;
    } catch(error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ الموقع. بقيت البيانات في النموذج.");return false; }
  };
  saveRef.current=saveSite;

  const moveSite = (index: number, direction: -1 | 1) => {
    const ordered = [...sites];
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    if(ownerPin)void pinReorder.mutateAsync({ownerPin,ids:ordered.map(site=>site.id)}).then(rows=>{setPrivateSites(rows as NonNullable<typeof sitesQuery.data>);callbacks.current.onWorkspaceChange?.();}).catch(error=>toast.error(error instanceof Error?error.message:"تعذر حفظ الترتيب."));else reorderMutation.mutate({ ids: ordered.map((site) => site.id) });
  };

  if (!unlocked) return null;
  if (!isAuthenticated && !ownerPin) return <section className="owner-services-card free-sites-owner-card"><div className="owner-card-heading"><div><span className="studio-label">07 / المواقع المجانية</span><h2>دليل المواقع والخدمات</h2></div><LockKeyhole size={20} /></div><p className="owner-security-note">سجّل دخول حساب المالك لإدارة المحتوى.</p></section>;

  const busy = createMutation.isPending || updateMutation.isPending || pinCreate.isPending || pinUpdate.isPending;
  const changeVisibility=(id:number,isVisible:boolean)=>{if(ownerPin)void pinVisibility.mutateAsync({ownerPin,id,isVisible}).then(()=>refreshPrivate()).then(()=>callbacks.current.onWorkspaceChange?.()).catch(error=>toast.error(error instanceof Error?error.message:"تعذر تحديث الظهور."));else visibilityMutation.mutate({id,isVisible});};
  const deleteSite=(id:number)=>{if(ownerPin)void pinRemove.mutateAsync({ownerPin,id}).then(()=>{if(editingId===id)resetForm();return refreshPrivate();}).then(()=>callbacks.current.onWorkspaceChange?.()).catch(error=>toast.error(error instanceof Error?error.message:"تعذر نقل الموقع إلى السلة."));else removeMutation.mutate({id});};
  return <section className="owner-services-card free-sites-owner-card">
    <div className="owner-card-heading"><div><span className="studio-label">07 / المواقع المجانية</span><h2>دليل المواقع والخدمات</h2></div><a className="owner-back free-sites-preview-link" href="/owner/preview?path=/free-sites" target="_blank" rel="noreferrer"><ExternalLink size={15} /> معاينة الصفحة</a></div>
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
        <div className="free-sites-list-head"><strong>المواقع المحفوظة</strong><span>{loading ? "جارٍ التحميل" : `${sites.length} عنصر`}</span></div>
        {!sites.length && !loading && <p className="owner-empty">لم تتم إضافة مواقع بعد.</p>}
        {sites.map((site, index) => <article className={`free-site-owner-row ${site.isVisible ? "is-published" : "is-hidden"}`} key={site.id}>
          <div className="free-site-owner-thumb">{site.imageUrl ? <img src={site.imageUrl} alt="" /> : <Link2 size={17} />}</div>
          <div className="free-site-owner-info"><strong>{site.name}</strong><small>{site.isVisible ? "معتمد للترحيل" : "مخفي في نسخة العمل"}{site.url ? " · يحتوي رابطًا" : ""}</small></div>
          <div className="free-site-owner-actions"><button type="button" className="owner-icon-action" onClick={() => moveSite(index, -1)} disabled={index === 0 || (ownerPin?pinReorder.isPending:reorderMutation.isPending)} aria-label="تحريك لأعلى"><ArrowUp size={14} /></button><button type="button" className="owner-icon-action" onClick={() => moveSite(index, 1)} disabled={index === (sites.length || 1) - 1 || (ownerPin?pinReorder.isPending:reorderMutation.isPending)} aria-label="تحريك لأسفل"><ArrowDown size={14} /></button><button type="button" className="owner-icon-action" onClick={() => changeVisibility(site.id, !Boolean(site.isVisible))} aria-label={site.isVisible ? "إخفاء" : "نشر"}>{site.isVisible ? <Check size={14} /> : <Upload size={14} />}</button><button type="button" className="owner-icon-action" onClick={() => editSite(site)} aria-label="تعديل"><Edit3 size={14} /></button><button type="button" className="owner-icon-action danger" onClick={() => { if (window.confirm("نقل هذا الموقع إلى سلة المحذوفات الخاصة؟ لن يتغير الموقع العام قبل الترحيل.")) deleteSite(site.id); }} aria-label="حذف"><Trash2 size={14} /></button></div>
        </article>)}
      </div>
    </div>
  </section>;
}
