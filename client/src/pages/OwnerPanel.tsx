/*
  Owner control room: every major visual and content decision is editable here.
*/

import { ChangeEvent, useEffect, useState } from "react";
import { ArrowRight, Check, ImagePlus, LockKeyhole, LogOut, Moon, Plus, Save, Sun, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { EditableButton, EditableProduct, EditableService, SiteContent, defaultSiteContent, loadSiteContent, saveSiteContent } from "@/lib/siteContent";

const DEFAULT_OWNER_PIN = "770562";
const OWNER_PIN_KEY = "abu-kayan-owner-pin";
const getOwnerPin = () => window.localStorage.getItem(OWNER_PIN_KEY) || DEFAULT_OWNER_PIN;
const readImage = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const actionLabels: Record<EditableButton["action"], string> = {
  contact: "انتقل إلى التواصل",
  services: "انتقل إلى الخدمات",
  work: "انتقل إلى الأعمال",
  gemini: "افتح Gemini",
  "chat-gbt": "افتح Chat GBT",
  external: "رابط خارجي",
};
const placementLabels: Record<EditableButton["placement"], string> = {
  header: "الهيدر",
  hero: "واجهة البداية",
  services: "قسم الخدمات",
  contact: "قسم التواصل",
};

export default function OwnerPanel() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [content, setContent] = useState<SiteContent>(() => loadSiteContent());
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const { theme, toggleTheme } = useTheme();

  useEffect(() => setUnlocked(window.sessionStorage.getItem("abu-kayan-owner-panel") === "true"), []);

  const unlock = () => {
    if (pin === getOwnerPin()) {
      window.sessionStorage.setItem("abu-kayan-owner-panel", "true");
      setUnlocked(true);
      setPin("");
      toast.success("تم فتح لوحة المالك.");
    } else toast.error("كلمة السر غير صحيحة.");
  };

  const logout = () => {
    window.sessionStorage.removeItem("abu-kayan-owner-panel");
    setUnlocked(false);
    toast("تم إغلاق لوحة المالك.");
  };

  const update = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => setContent((current) => ({ ...current, [key]: value }));
  const updateSetting = <K extends keyof SiteContent["settings"]>(key: K, value: SiteContent["settings"][K]) => setContent((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  const updateService = <K extends keyof EditableService>(index: number, key: K, value: EditableService[K]) => setContent((current) => ({ ...current, services: current.services.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const updateProduct = <K extends keyof EditableProduct>(index: number, key: K, value: EditableProduct[K]) => setContent((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const updateButton = <K extends keyof EditableButton>(index: number, key: K, value: EditableButton[K]) => setContent((current) => ({ ...current, buttons: current.buttons.map((item, i) => i === index ? { ...item, [key]: value } : item) }));

  const addService = () => setContent((current) => ({ ...current, services: [...current.services, { number: String(current.services.length + 1).padStart(2, "0"), title: "خدمة جديدة", description: "اكتب وصف الخدمة هنا.", tag: "وصف مختصر" }] }));
  const addProduct = () => setContent((current) => ({ ...current, products: [...current.products, { id: crypto.randomUUID(), title: "منتج جديد", description: "اكتب وصف المنتج هنا.", price: "" }] }));
  const addButton = () => setContent((current) => ({ ...current, buttons: [...current.buttons, { id: crypto.randomUUID(), label: "زر جديد", placement: "hero", action: "contact", backgroundColor: current.settings.goldColor, textColor: current.settings.backgroundColor, borderColor: current.settings.goldColor, fontSize: 12, radius: current.settings.buttonRadius, order: current.buttons.length + 1 }] }));
  const removeAt = (key: "services" | "products" | "buttons", index: number) => setContent((current) => ({ ...current, [key]: current[key].filter((_, i) => i !== index) } as SiteContent));

  const handleImage = async (event: ChangeEvent<HTMLInputElement>, key: "heroImage" | "backgroundImage") => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختر صورة صالحة.");
    const image = await readImage(file);
    if (key === "heroImage") update("heroImage", image); else updateSetting("backgroundImage", image);
  };
  const handleServiceImage = async (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختر صورة صالحة للخدمة.");
    updateService(index, "image", await readImage(file));
  };
  const handleProductImage = async (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختر صورة صالحة للمنتج.");
    updateProduct(index, "image", await readImage(file));
  };

  const save = () => {
    saveSiteContent(content);
    if (content.settings.themeMode !== theme) toggleTheme();
    toast.success("تم حفظ تعديلات الموقع على هذا الجهاز.");
  };
  const changePassword = () => {
    if (currentPin !== getOwnerPin()) return toast.error("كلمة المرور الحالية غير صحيحة.");
    if (newPin.length < 6) return toast.error("اجعل كلمة المرور الجديدة 6 أرقام أو أكثر.");
    if (newPin !== confirmPin) return toast.error("تأكيد كلمة المرور غير مطابق.");
    window.localStorage.setItem(OWNER_PIN_KEY, newPin);
    setCurrentPin(""); setNewPin(""); setConfirmPin("");
    toast.success("تم تغيير كلمة مرور المالك بنجاح.");
  };
  const saveTemplatePassword = () => {
    const password = content.settings.templatePassword.trim();
    if (password.length < 4) return toast.error("اجعل كلمة مرور القوالب 4 أرقام أو أكثر.");
    saveSiteContent(content);
    toast.success("تم حفظ كلمة مرور إضافة القوالب.");
  };

  if (!unlocked) return <main dir="rtl" className="owner-page owner-lock-page"><div className="owner-lock-card"><button type="button" className="theme-toggle owner-lock-theme" onClick={toggleTheme} aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}>{theme === "light" ? <Moon size={15} /> : <Sun size={15} />}</button><div className="owner-lock-icon"><LockKeyhole size={25} /></div><span className="studio-label">منطقة خاصة بالمالك</span><h1>لوحة التحكم</h1><p>أدخل كلمة السر للوصول إلى أدوات تعديل الموقع.</p><input autoFocus type="password" inputMode="numeric" value={pin} maxLength={32} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") unlock(); }} placeholder="كلمة السر" aria-label="كلمة السر" /><button type="button" className="owner-save" onClick={unlock}><LockKeyhole size={16} /> فتح اللوحة</button><Link href="/" className="owner-back"><ArrowRight size={15} /> العودة للموقع</Link></div></main>;

  return <main dir="rtl" className="owner-page">
    <header className="owner-header"><div><span className="studio-label">أبو كيان الجنيد · محرر شامل</span><h1>لوحة التحكم</h1></div><div className="owner-header-actions"><button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}>{theme === "light" ? <Moon size={15} /> : <Sun size={15} />}</button><Link href="/" className="owner-back"><ArrowRight size={15} /> معاينة الموقع</Link><button type="button" className="owner-logout" onClick={logout}><LogOut size={15} /> إغلاق</button></div></header>

    <div className="owner-editor-grid">
      <section className="owner-main-card">
        <div className="owner-card-heading"><div><span className="studio-label">01 / الهوية</span><h2>المحتوى والصورة</h2></div><button type="button" className="owner-save" onClick={save}><Save size={16} /> حفظ</button></div>
        <div className="owner-fields">
          <label><span>السطر التعريفي</span><input value={content.heroEyebrow} onChange={(e) => update("heroEyebrow", e.target.value)} /></label>
          <label><span>عنوان البداية</span><input value={content.heroTitle} onChange={(e) => update("heroTitle", e.target.value)} /></label>
          <label><span>الكلمة المميزة</span><input value={content.heroAccent} onChange={(e) => update("heroAccent", e.target.value)} /></label>
          <label><span>تكملة العنوان</span><input value={content.heroEnding} onChange={(e) => update("heroEnding", e.target.value)} /></label>
          <label className="owner-wide"><span>الوصف الرئيسي</span><textarea value={content.heroLead} onChange={(e) => update("heroLead", e.target.value)} maxLength={10000} /><small>{content.heroLead.length.toLocaleString("ar-EG")} / 10,000</small></label>
          <label><span>نص الزر الرئيسي</span><input value={content.primaryButton} onChange={(e) => update("primaryButton", e.target.value)} /></label>
          <label><span>نص زر الأعمال</span><input value={content.secondaryButton} onChange={(e) => update("secondaryButton", e.target.value)} /></label>
        </div>
        <label className="owner-image-upload"><input type="file" accept="image/*" onChange={(e) => handleImage(e, "heroImage")} /><span><ImagePlus size={18} /> تغيير صورة البداية</span><small>تُحفظ محليًا للمعاينة.</small></label>
        <div className="owner-image-preview"><img src={content.heroImage || defaultSiteContent.heroImage} alt="معاينة" /></div>
      </section>
      <aside className="owner-side-card"><span className="studio-label">حالة التحرير</span><h2>وضع المالك مفتوح</h2><p>كل حقل أدناه ينعكس على المعاينة بعد الحفظ. الحفظ الحالي محلي في هذا المتصفح.</p><div className="owner-status"><Check size={16} /> تحرير شامل مسموح</div><Link href="/owner/inbox" className="owner-inbox-link">فتح صندوق الرسائل</Link></aside>
    </div>

    <section className="owner-settings-card">
      <div className="owner-card-heading"><div><span className="studio-label">02 / الشكل الكامل</span><h2>الخطوط والألوان والخلفية والحجوم</h2></div><button type="button" className="owner-save" onClick={save}><Save size={16} /> حفظ الهوية</button></div>
      <div className="owner-fields settings-fields">
        <label><span>خط النصوص</span><select value={content.settings.fontFamily} onChange={(e) => updateSetting("fontFamily", e.target.value as SiteContent["settings"]["fontFamily"])}><option value="Cairo">Cairo</option><option value="Tajawal">Tajawal</option><option value="Noto Kufi Arabic">Noto Kufi Arabic</option><option value="system">خط الجهاز</option></select></label>
        <label><span>خط العناوين</span><select value={content.settings.headingFontFamily} onChange={(e) => updateSetting("headingFontFamily", e.target.value as SiteContent["settings"]["headingFontFamily"])}><option value="Cairo">Cairo</option><option value="Tajawal">Tajawal</option><option value="Noto Kufi Arabic">Noto Kufi Arabic</option><option value="system">خط الجهاز</option></select></label>
        <label><span>الوضع عند الحفظ</span><select value={content.settings.themeMode} onChange={(e) => updateSetting("themeMode", e.target.value as SiteContent["settings"]["themeMode"])}><option value="dark">داكن كامل</option><option value="light">فاتح كامل</option></select></label>
        <label><span>حجم الخط الأساسي</span><input type="number" min="12" max="24" value={content.settings.baseFontSize} onChange={(e) => updateSetting("baseFontSize", Number(e.target.value))} /></label>
        <label><span>وزن الخط</span><input type="number" min="300" max="900" step="100" value={content.settings.fontWeight} onChange={(e) => updateSetting("fontWeight", Number(e.target.value))} /></label>
        <label><span>ارتفاع السطر</span><input type="number" min="1.2" max="2.6" step=".1" value={content.settings.lineHeight} onChange={(e) => updateSetting("lineHeight", Number(e.target.value))} /></label>
        <label><span>مقياس العناوين</span><input type="number" min=".75" max="1.5" step=".05" value={content.settings.headingScale} onChange={(e) => updateSetting("headingScale", Number(e.target.value))} /></label>
        <label><span>مسافة الأقسام</span><input type="number" min="40" max="180" value={content.settings.sectionGap} onChange={(e) => updateSetting("sectionGap", Number(e.target.value))} /></label>
        <label><span>استدارة الأزرار</span><input type="number" min="0" max="40" value={content.settings.buttonRadius} onChange={(e) => updateSetting("buttonRadius", Number(e.target.value))} /></label>
        <label><span>استدارة البطاقات</span><input type="number" min="0" max="40" value={content.settings.cardRadius} onChange={(e) => updateSetting("cardRadius", Number(e.target.value))} /></label>
        <label><span>لون الخلفية</span><input type="color" value={content.settings.backgroundColor} onChange={(e) => updateSetting("backgroundColor", e.target.value)} /></label>
        <label><span>لون البطاقات</span><input type="color" value={content.settings.panelColor} onChange={(e) => updateSetting("panelColor", e.target.value)} /></label>
        <label><span>لون النص</span><input type="color" value={content.settings.textColor} onChange={(e) => updateSetting("textColor", e.target.value)} /></label>
        <label><span>لون النص الثانوي</span><input type="color" value={content.settings.mutedColor} onChange={(e) => updateSetting("mutedColor", e.target.value)} /></label>
        <label><span>لون الإطارات</span><input type="color" value={content.settings.borderColor} onChange={(e) => updateSetting("borderColor", e.target.value)} /></label>
        <label><span>لون الإبراز</span><input type="color" value={content.settings.accentColor} onChange={(e) => updateSetting("accentColor", e.target.value)} /></label>
        <label><span>الذهبي</span><input type="color" value={content.settings.goldColor} onChange={(e) => updateSetting("goldColor", e.target.value)} /></label>
      </div>
      <label className="owner-image-upload"><input type="file" accept="image/*" onChange={(e) => handleImage(e, "backgroundImage")} /><span><ImagePlus size={18} /> إضافة أو تغيير خلفية</span><small>الصورة تُستخدم كخلفية زخرفية للمعاينة.</small></label>
    </section>

    <section className="owner-settings-card owner-security-card"><div className="owner-card-heading"><div><span className="studio-label">03 / الأمان</span><h2>كلمات المرور</h2></div><LockKeyhole size={20} /></div><p className="owner-security-note">تغيير كلمة مرور لوحة المالك وكلمة مرور إضافة القوالب من مكان واحد.</p><div className="owner-fields settings-fields"><label><span>كلمة المرور الحالية</span><input type="password" inputMode="numeric" value={currentPin} maxLength={32} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))} /></label><label><span>كلمة المرور الجديدة</span><input type="password" inputMode="numeric" value={newPin} maxLength={32} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} /></label><label><span>تأكيد الجديدة</span><input type="password" inputMode="numeric" value={confirmPin} maxLength={32} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))} /></label></div><div className="owner-template-password"><label><span>كلمة مرور إضافة القوالب والتصاميم</span><input type="password" inputMode="numeric" value={content.settings.templatePassword} maxLength={32} onChange={(e) => updateSetting("templatePassword", e.target.value.replace(/\D/g, ""))} placeholder="7705" /></label><small>تُستخدم قبل فتح محرر إضافة صورة أو فيديو في صفحتي Gemini وChat GBT.</small></div><div className="owner-header-actions"><button type="button" className="owner-save" onClick={saveTemplatePassword}><LockKeyhole size={16} /> حفظ كلمة مرور القوالب</button><button type="button" className="owner-save" onClick={changePassword}><LockKeyhole size={16} /> تغيير كلمة مرور المالك</button></div></section>

    <section className="owner-services-card"><div className="owner-card-heading"><div><span className="studio-label">04 / الخدمات والمنتجات</span><h2>محتوى قابل للتعديل بالكامل</h2></div><div className="owner-header-actions"><button type="button" className="owner-add" onClick={addService}><Plus size={16} /> خدمة</button><button type="button" className="owner-add" onClick={addProduct}><Plus size={16} /> منتج</button></div></div><div className="owner-service-list">
      {content.services.map((service, index) => <div className="owner-service-row" key={`service-${index}`}><span className="owner-service-number">{service.number}</span><label><span>رقم الخدمة</span><input value={service.number} onChange={(e) => updateService(index, "number", e.target.value)} /></label><label><span>اسم الخدمة</span><input value={service.title} onChange={(e) => updateService(index, "title", e.target.value)} /></label><label className="owner-wide"><span>الوصف</span><textarea value={service.description} onChange={(e) => updateService(index, "description", e.target.value)} /></label><label><span>التصنيف</span><input value={service.tag} onChange={(e) => updateService(index, "tag", e.target.value)} /></label><label className="owner-image-upload compact-upload"><input type="file" accept="image/*" onChange={(e) => handleServiceImage(e, index)} /><span><ImagePlus size={15} /> صورة الخدمة</span></label>{service.image && <img className="owner-inline-image" src={service.image} alt="" />}<button type="button" className="owner-delete" onClick={() => removeAt("services", index)} aria-label="حذف الخدمة"><Trash2 size={16} /></button></div>)}
      {content.products.map((product, index) => <div className="owner-service-row product-row" key={product.id}><span className="owner-service-number">منتج</span><label><span>اسم المنتج</span><input value={product.title} onChange={(e) => updateProduct(index, "title", e.target.value)} /></label><label className="owner-wide"><span>الوصف</span><textarea value={product.description} onChange={(e) => updateProduct(index, "description", e.target.value)} /></label><label><span>السعر أو العبارة</span><input value={product.price} onChange={(e) => updateProduct(index, "price", e.target.value)} /></label><label className="owner-image-upload compact-upload"><input type="file" accept="image/*" onChange={(e) => handleProductImage(e, index)} /><span><ImagePlus size={15} /> صورة المنتج</span></label>{product.image && <img className="owner-inline-image" src={product.image} alt="" />}<button type="button" className="owner-delete" onClick={() => removeAt("products", index)} aria-label="حذف المنتج"><Trash2 size={16} /></button></div>)}
    </div></section>

    <section className="owner-services-card"><div className="owner-card-heading"><div><span className="studio-label">05 / الأزرار</span><h2>الاسم والمكان والشكل والإجراء</h2></div><button type="button" className="owner-add" onClick={addButton}><Plus size={16} /> إضافة زر</button></div><div className="owner-button-list">{content.buttons.length === 0 && <p className="owner-empty">لا توجد أزرار مخصصة بعد. أضف زرًا واختر موضعه وإجراءه.</p>}{content.buttons.map((button, index) => <div className="owner-button-row" key={button.id}><label><span>اسم الزر</span><input value={button.label} onChange={(e) => updateButton(index, "label", e.target.value)} /></label><label><span>الموضع</span><select value={button.placement} onChange={(e) => updateButton(index, "placement", e.target.value as EditableButton["placement"])}>{Object.entries(placementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>ماذا يفعل؟</span><select value={button.action} onChange={(e) => updateButton(index, "action", e.target.value as EditableButton["action"])}>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{button.action === "external" && <label><span>الرابط</span><input value={button.url || ""} onChange={(e) => updateButton(index, "url", e.target.value)} placeholder="https://" /></label>}<label><span>ترتيب الظهور</span><input type="number" min="0" value={button.order ?? index + 1} onChange={(e) => updateButton(index, "order", Number(e.target.value))} /></label><label><span>حجم الخط</span><input type="number" min="9" max="24" value={button.fontSize ?? 12} onChange={(e) => updateButton(index, "fontSize", Number(e.target.value))} /></label><label><span>استدارة الزر</span><input type="number" min="0" max="40" value={button.radius ?? content.settings.buttonRadius} onChange={(e) => updateButton(index, "radius", Number(e.target.value))} /></label><label><span>لون الخلفية</span><input type="color" value={button.backgroundColor || content.settings.goldColor} onChange={(e) => updateButton(index, "backgroundColor", e.target.value)} /></label><label><span>لون النص</span><input type="color" value={button.textColor || content.settings.backgroundColor} onChange={(e) => updateButton(index, "textColor", e.target.value)} /></label><label><span>لون الإطار</span><input type="color" value={button.borderColor || content.settings.goldColor} onChange={(e) => updateButton(index, "borderColor", e.target.value)} /></label><button type="button" className="owner-delete" onClick={() => removeAt("buttons", index)} aria-label="حذف الزر"><Trash2 size={16} /></button></div>)}</div><button type="button" className="owner-save owner-save-bottom" onClick={save}><Save size={16} /> حفظ كل التعديلات</button></section>
  </main>;
}
