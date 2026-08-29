/*
  Design reminder — Owner control room:
  A private, quiet editor for the dark luxury brand. Make every control explicit,
  keep the owner flow calm on mobile, and never imply client-side PIN security is server security.
*/

import { ChangeEvent, useEffect, useState } from "react";
import { ArrowRight, Check, ImagePlus, LockKeyhole, LogOut, Plus, Save, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { SiteContent, defaultSiteContent, loadSiteContent, saveSiteContent } from "@/lib/siteContent";

const OWNER_PIN = "770562";

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OwnerPanel() {
  const [, navigate] = useLocation();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [content, setContent] = useState<SiteContent>(() => loadSiteContent());

  useEffect(() => {
    setUnlocked(window.sessionStorage.getItem("abu-kayan-owner-panel") === "true");
  }, []);

  const unlock = () => {
    if (pin === OWNER_PIN) {
      window.sessionStorage.setItem("abu-kayan-owner-panel", "true");
      setUnlocked(true);
      setPin("");
      toast.success("تم فتح لوحة المالك.");
      return;
    }
    toast.error("كلمة السر غير صحيحة.");
  };

  const logout = () => {
    window.sessionStorage.removeItem("abu-kayan-owner-panel");
    setUnlocked(false);
    toast("تم إغلاق لوحة المالك.");
  };

  const update = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
    setContent((current) => ({ ...current, [key]: value }));
  };

  const updateService = (index: number, key: "title" | "description" | "tag", value: string) => {
    setContent((current) => ({
      ...current,
      services: current.services.map((service, serviceIndex) => serviceIndex === index ? { ...service, [key]: value } : service),
    }));
  };

  const addService = () => {
    setContent((current) => ({
      ...current,
      services: [...current.services, { number: String(current.services.length + 1).padStart(2, "0"), title: "خدمة جديدة", description: "اكتب وصف الخدمة هنا.", tag: "وصف مختصر" }],
    }));
  };

  const removeService = (index: number) => {
    setContent((current) => ({
      ...current,
      services: current.services.filter((_, serviceIndex) => serviceIndex !== index).map((service, serviceIndex) => ({ ...service, number: String(serviceIndex + 1).padStart(2, "0") })),
    }));
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختر صورة صالحة.");
      return;
    }
    update("heroImage", await readImage(file));
  };

  const save = () => {
    saveSiteContent(content);
    toast.success("تم حفظ تعديلات الموقع على هذا الجهاز.");
  };

  if (!unlocked) {
    return (
      <main dir="rtl" className="owner-page owner-lock-page">
        <div className="owner-lock-card">
          <div className="owner-lock-icon"><LockKeyhole size={25} /></div>
          <span className="studio-label">منطقة خاصة بالمالك</span>
          <h1>لوحة التحكم</h1>
          <p>أدخل كلمة السر للوصول إلى أدوات تعديل الموقع.</p>
          <input autoFocus type="password" inputMode="numeric" value={pin} maxLength={6} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") unlock(); }} placeholder="كلمة السر" aria-label="كلمة السر" />
          <button type="button" className="owner-save" onClick={unlock}><LockKeyhole size={16} /> فتح اللوحة</button>
          <Link href="/" className="owner-back"><ArrowRight size={15} /> العودة للموقع</Link>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="owner-page">
      <header className="owner-header">
        <div><span className="studio-label">أبو كيان الجنيد</span><h1>لوحة التحكم</h1></div>
        <div className="owner-header-actions"><Link href="/" className="owner-back"><ArrowRight size={15} /> معاينة الموقع</Link><button type="button" className="owner-logout" onClick={logout}><LogOut size={15} /> إغلاق</button></div>
      </header>

      <section className="owner-grid">
        <div className="owner-main-card">
          <div className="owner-card-heading"><div><span className="studio-label">الواجهة الرئيسية</span><h2>المحتوى والصورة</h2></div><button type="button" className="owner-save" onClick={save}><Save size={16} /> حفظ التعديلات</button></div>
          <div className="owner-fields">
            <label><span>السطر التعريفي</span><input value={content.heroEyebrow} onChange={(event) => update("heroEyebrow", event.target.value)} /></label>
            <label><span>عنوان البداية</span><input value={content.heroTitle} onChange={(event) => update("heroTitle", event.target.value)} /></label>
            <label><span>الكلمة المميزة</span><input value={content.heroAccent} onChange={(event) => update("heroAccent", event.target.value)} /></label>
            <label><span>تكملة العنوان</span><input value={content.heroEnding} onChange={(event) => update("heroEnding", event.target.value)} /></label>
            <label className="owner-wide"><span>الوصف</span><textarea value={content.heroLead} onChange={(event) => update("heroLead", event.target.value)} maxLength={10000} /><small>{content.heroLead.length.toLocaleString("ar-EG")} / 10,000</small></label>
            <label><span>نص الزر الرئيسي</span><input value={content.primaryButton} onChange={(event) => update("primaryButton", event.target.value)} /></label>
            <label><span>نص زر الأعمال</span><input value={content.secondaryButton} onChange={(event) => update("secondaryButton", event.target.value)} /></label>
          </div>
          <label className="owner-image-upload"><input type="file" accept="image/*" onChange={handleImage} /><span><ImagePlus size={19} /> تغيير صورة البداية</span><small>يمكنك اختيار صورة من جهازك وستحفظ محليًا للمعاينة.</small></label>
          <div className="owner-image-preview"><img src={content.heroImage || defaultSiteContent.heroImage} alt="معاينة صورة البداية" /></div>
        </div>

        <aside className="owner-side-card"><span className="studio-label">حالة الحماية</span><h2>وضع المالك مفتوح</h2><p>أنت الآن في وضع التحرير. الحفظ محلي في هذا المتصفح، بينما تظل المعاينة العامة متاحة للزوار.</p><div className="owner-status"><Check size={16} /> تحرير مسموح</div><Link href="/owner/inbox" className="owner-inbox-link">فتح صندوق الرسائل</Link></aside>
      </section>

      <section className="owner-services-card">
        <div className="owner-card-heading"><div><span className="studio-label">الخدمات</span><h2>أضف أو عدّل خدماتك</h2></div><button type="button" className="owner-add" onClick={addService}><Plus size={16} /> إضافة خدمة</button></div>
        <div className="owner-service-list">
          {content.services.map((service, index) => (
            <div className="owner-service-row" key={`${service.number}-${index}`}>
              <span className="owner-service-number">{service.number}</span>
              <label><span>اسم الخدمة</span><input value={service.title} onChange={(event) => updateService(index, "title", event.target.value)} /></label>
              <label><span>الوصف</span><textarea value={service.description} onChange={(event) => updateService(index, "description", event.target.value)} /></label>
              <label><span>التصنيف</span><input value={service.tag} onChange={(event) => updateService(index, "tag", event.target.value)} /></label>
              <button type="button" className="owner-delete" onClick={() => removeService(index)} aria-label="حذف الخدمة"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <button type="button" className="owner-save owner-save-bottom" onClick={save}><Save size={16} /> حفظ كل التعديلات</button>
      </section>
    </main>
  );
}
