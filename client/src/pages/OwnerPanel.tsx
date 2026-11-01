/*
  Owner control room: every major visual and content decision is editable here.
*/

import { ChangeEvent, useEffect, useState } from "react";
import { ArrowRight, Check, ImagePlus, LockKeyhole, LogOut, Moon, Plus, RotateCcw, Save, Sun, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { EditableButton, EditablePage, EditableProduct, EditableService, SiteContent, defaultSiteContent, loadSiteContent, normalizeSiteContent, saveSiteContent } from "@/lib/siteContent";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import OwnerCodeWorkspace from "./OwnerCodeWorkspace";
import OwnerFreeSites from "./OwnerFreeSites";
import OwnerCreativeSpace from "./OwnerCreativeSpace";

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
  "free-sites": "افتح المواقع المجانية",
  "creative-space": "افتح مساحتك للإبداع",
  "custom-page": "افتح صفحة قابلة لإعادة الاستخدام",
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
  const [draggedButton, setDraggedButton] = useState<number | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const siteContentQuery = trpc.siteContent.get.useQuery(undefined, { refetchOnWindowFocus: false });
  const siteContentSave = trpc.siteContent.save.useMutation({ onError: (error) => toast.error(error.message || "تعذر مزامنة إعدادات الموقع.") });
  const recycleQuery = trpc.templates.recycleBin.useQuery(undefined, { enabled: unlocked && isAuthenticated, refetchOnWindowFocus: false });
  const retentionQuery = trpc.templates.retentionDays.useQuery(undefined, { enabled: unlocked && isAuthenticated, refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const restoreMutation = trpc.templates.restore.useMutation({ onSuccess: () => utils.templates.recycleBin.invalidate() });
  const purgeMutation = trpc.templates.purge.useMutation({ onSuccess: () => utils.templates.recycleBin.invalidate() });
  const cleanupMutation = trpc.templates.cleanup.useMutation({ onSuccess: (result) => { utils.templates.recycleBin.invalidate(); toast.success(`تم تفريغ ${result.deleted} قالب منتهي.`); } });
  const setRetentionMutation = trpc.templates.setRetentionDays.useMutation({ onSuccess: () => { utils.templates.retentionDays.invalidate(); toast.success("تم حفظ مدة الاحتفاظ في قاعدة البيانات."); } });

  useEffect(() => setUnlocked(window.sessionStorage.getItem("abu-kayan-owner-panel") === "true"), []);
  useEffect(() => { if (siteContentQuery.data) setContent(normalizeSiteContent(siteContentQuery.data)); }, [siteContentQuery.data]);

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
  useEffect(() => {
    if (retentionQuery.data) updateSetting("recycleRetentionDays", retentionQuery.data as SiteContent["settings"]["recycleRetentionDays"]);
  }, [retentionQuery.data]);
  const updateService = <K extends keyof EditableService>(index: number, key: K, value: EditableService[K]) => setContent((current) => ({ ...current, services: current.services.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const updateProduct = <K extends keyof EditableProduct>(index: number, key: K, value: EditableProduct[K]) => setContent((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const updateButton = <K extends keyof EditableButton>(index: number, key: K, value: EditableButton[K]) => setContent((current) => ({ ...current, buttons: current.buttons.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const updatePage = <K extends keyof EditablePage>(index: number, key: K, value: EditablePage[K]) => setContent((current) => ({ ...current, pages: current.pages.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const addPage = () => setContent((current) => ({ ...current, pages: [...current.pages, { id: crypto.randomUUID(), slug: `page-${current.pages.length + 1}`, title: "صفحة جديدة", eyebrow: "قالب أبو كيان", description: "اكتب وصف الصفحة هنا.", template: "landing", visible: true }] }));
  const removePage = (index: number) => setContent((current) => ({ ...current, pages: current.pages.filter((_, i) => i !== index) }));
  const moveButton = (from: number, to: number) => setContent((current) => { if (from === to || to < 0 || to >= current.buttons.length) return current; const buttons = [...current.buttons]; const [moved] = buttons.splice(from, 1); buttons.splice(to, 0, moved); return { ...current, buttons: buttons.map((button, index) => ({ ...button, order: index + 1 })) }; });

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
    siteContentSave.mutate({ ownerPin: getOwnerPin(), content: content as unknown as Record<string, unknown> });
    if (content.settings.themeMode !== theme) toggleTheme();
    if (isAuthenticated) setRetentionMutation.mutate({ retentionDays: content.settings.recycleRetentionDays });
    toast.success("تم حفظ تعديلات الموقع ومزامنتها للجميع.");
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
    siteContentSave.mutate({ ownerPin: getOwnerPin(), content: content as unknown as Record<string, unknown> });
    toast.success("تم حفظ كلمة مرور إضافة القوالب.");
  };
  const applyCodeSettings = (next: SiteContent, _extensions: Record<string, unknown>, label: string) => {
    saveSiteContent(next);
    siteContentSave.mutate({ ownerPin: getOwnerPin(), content: next as unknown as Record<string, unknown> });
    setContent(next);
    if (next.settings.themeMode !== theme) toggleTheme();
    toast.success(`${label} بنجاح.`);
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
        <label><span>مدة بقاء المحذوفات</span><select value={content.settings.recycleRetentionDays} onChange={(e) => updateSetting("recycleRetentionDays", Number(e.target.value) as SiteContent["settings"]["recycleRetentionDays"])}><option value={30}>30 يومًا</option><option value={60}>60 يومًا</option><option value={180}>6 أشهر</option><option value={365}>سنة</option></select></label>
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

    <section className="owner-services-card"><div className="owner-card-heading"><div><span className="studio-label">05 / الأزرار والصفحات</span><h2>تحكم بالسحب والإفلات والقوالب الجاهزة</h2></div><div className="owner-header-actions"><button type="button" className="owner-add" onClick={addButton}><Plus size={16} /> إضافة زر</button><button type="button" className="owner-add" onClick={addPage}><Plus size={16} /> صفحة جديدة</button></div></div><p className="owner-security-note">اسحب أي زر إلى مكانه، أخفه دون مساحة فارغة، أو اربطه بصفحة جاهزة. كل التغييرات تُحفظ في قاعدة البيانات عند الضغط على حفظ.</p><div className="owner-button-list">{content.buttons.length === 0 && <p className="owner-empty">لا توجد أزرار مخصصة بعد.</p>}{content.buttons.map((button, index) => <div className="owner-button-row" key={button.id} draggable onDragStart={() => setDraggedButton(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedButton !== null) moveButton(draggedButton, index); setDraggedButton(null); }}><span className="owner-drag-handle" title="اسحب لإعادة الترتيب">⋮⋮</span><label><span>اسم الزر</span><input value={button.label} onChange={(e) => updateButton(index, "label", e.target.value)} /></label><label><span>الموضع</span><select value={button.placement} onChange={(e) => updateButton(index, "placement", e.target.value as EditableButton["placement"])}>{Object.entries(placementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>يفتح</span><select value={button.action} onChange={(e) => updateButton(index, "action", e.target.value as EditableButton["action"])}>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{button.action === "custom-page" && <label><span>الصفحة</span><select value={button.url || ""} onChange={(e) => updateButton(index, "url", e.target.value)}><option value="">اختر صفحة</option>{content.pages.map((page) => <option key={page.id} value={`/custom/${page.slug}`}>{page.title}</option>)}</select></label>}{button.action === "external" && <label><span>الرابط</span><input value={button.url || ""} onChange={(e) => updateButton(index, "url", e.target.value)} placeholder="https://" /></label>}<label><span>الظهور</span><select value={button.visible === false ? "hidden" : "visible"} onChange={(e) => updateButton(index, "visible", e.target.value === "visible")}><option value="visible">ظاهر</option><option value="hidden">مخفي</option></select></label><label><span>حجم الخط</span><input type="number" min="9" max="24" value={button.fontSize ?? 12} onChange={(e) => updateButton(index, "fontSize", Number(e.target.value))} /></label><label><span>استدارة الزر</span><input type="number" min="0" max="40" value={button.radius ?? content.settings.buttonRadius} onChange={(e) => updateButton(index, "radius", Number(e.target.value))} /></label><label><span>لون الخلفية</span><input type="color" value={button.backgroundColor || content.settings.goldColor} onChange={(e) => updateButton(index, "backgroundColor", e.target.value)} /></label><label><span>لون النص</span><input type="color" value={button.textColor || content.settings.backgroundColor} onChange={(e) => updateButton(index, "textColor", e.target.value)} /></label><label><span>لون الإطار</span><input type="color" value={button.borderColor || content.settings.goldColor} onChange={(e) => updateButton(index, "borderColor", e.target.value)} /></label><button type="button" className="owner-delete" onClick={() => removeAt("buttons", index)} aria-label="حذف الزر"><Trash2 size={16} /></button></div>)}</div><div className="owner-pages-list"><div className="owner-card-heading"><div><span className="studio-label">قوالب الصفحات</span><h3>صفحات قابلة لإعادة الاستخدام</h3></div></div>{content.pages.length === 0 && <p className="owner-empty">أنشئ صفحة من قالب جاهز لتظهر هنا.</p>}{content.pages.map((page, index) => <div className="owner-page-row" key={page.id}><label><span>العنوان</span><input value={page.title} onChange={(e) => updatePage(index, "title", e.target.value)} /></label><label><span>المسار</span><input value={page.slug} onChange={(e) => updatePage(index, "slug", e.target.value.replace(/[^a-zA-Z0-9-]/g, "-"))} /></label><label><span>القالب</span><select value={page.template} onChange={(e) => updatePage(index, "template", e.target.value as EditablePage["template"])}><option value="landing">واجهة هبوط</option><option value="directory">دليل</option><option value="showcase">معرض</option></select></label><label><span>السطر التعريفي</span><input value={page.eyebrow} onChange={(e) => updatePage(index, "eyebrow", e.target.value)} /></label><label className="owner-wide"><span>الوصف</span><textarea value={page.description} onChange={(e) => updatePage(index, "description", e.target.value)} /></label><label><span>الحالة</span><select value={page.visible ? "visible" : "hidden"} onChange={(e) => updatePage(index, "visible", e.target.value === "visible")}><option value="visible">منشورة</option><option value="hidden">مخفية</option></select></label><button type="button" className="owner-delete" onClick={() => removePage(index)} aria-label="حذف الصفحة"><Trash2 size={16} /></button></div>)}</div><button type="button" className="owner-save owner-save-bottom" onClick={save}><Save size={16} /> حفظ الأزرار والصفحات</button></section>

    <OwnerFreeSites unlocked={unlocked} />
    <OwnerCreativeSpace unlocked={unlocked} />

    <OwnerCodeWorkspace content={content} onApply={applyCodeSettings} />

    <section className="owner-services-card recycle-bin-card"><div className="owner-card-heading"><div><span className="studio-label">06 / سلة المحذوفات</span><h2>استعادة القوالب المحذوفة</h2></div><Trash2 size={20} /></div><p className="owner-security-note">تُنقل القوالب المحذوفة إلى هنا أولًا. اختر مدة الاحتفاظ من إعدادات الشكل، ثم اضغط التفريغ لحذف ما تجاوز المدة نهائيًا.</p>{!isAuthenticated ? <div className="recycle-login"><p>يلزم تسجيل دخول حساب المالك لإدارة القوالب المشتركة.</p><button type="button" className="owner-save" onClick={startLogin}><LockKeyhole size={16} /> تسجيل دخول المالك</button></div> : <><div className="recycle-toolbar"><span>{recycleQuery.isLoading ? "جارٍ التحميل..." : `${recycleQuery.data?.length || 0} قالب في السلة`}</span><button type="button" className="owner-add" disabled={cleanupMutation.isPending || !recycleQuery.data?.length} onClick={() => cleanupMutation.mutate({ retentionDays: content.settings.recycleRetentionDays })}><Trash2 size={15} /> تفريغ المنتهية</button></div><div className="recycle-list">{!recycleQuery.data?.length && !recycleQuery.isLoading && <p className="owner-empty">سلة المحذوفات فارغة.</p>}{recycleQuery.data?.map((item) => <div className="recycle-row" key={item.id}><div><strong>{item.imageName}</strong><small>{item.tool} · حُذف في {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString("ar-YE") : "—"}</small></div><div className="recycle-actions"><button type="button" className="owner-add" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate({ id: item.id })}><RotateCcw size={14} /> استعادة</button><button type="button" className="owner-delete" disabled={purgeMutation.isPending} onClick={() => { if (window.confirm("حذف نهائي؟ لا يمكن التراجع عن هذا الإجراء.")) purgeMutation.mutate({ id: item.id }); }}><Trash2 size={14} /> حذف نهائي</button></div></div>)}</div></>}</section>
  </main>;
}
