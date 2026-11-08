/*
  Owner control room: every major visual and content decision is editable here.
*/

import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ImagePlus, LockKeyhole, LogOut, Moon, Plus, RotateCcw, Save, Search, Sun, Trash2, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { EditableButton, EditablePage, EditableProduct, EditableService, SiteContent, defaultSiteContent, loadSiteContent, normalizeSiteContent, saveSiteContent, validateSitePages, updatePageSlugReferences } from "@/lib/siteContent";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import OwnerCodeWorkspace from "./OwnerCodeWorkspace";
import OwnerFreeSites from "./OwnerFreeSites";
import OwnerCreativeSpace from "./OwnerCreativeSpace";
import OwnerCreativeCategories from "./OwnerCreativeCategories";
import OwnerTemplateCategories from "./OwnerTemplateCategories";
import OwnerButtons from "./OwnerButtons";
import OwnerPages from "./OwnerPages";
import OwnerBackups from "./OwnerBackups";
import "./OwnerPanel.mobile.css";

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
  gemini: "تصاميم عبر Gemini وChatGPT",
  "chat-gbt": "تصاميم الأطفال",
  "free-sites": "افتح المواقع المجانية",
  "creative-space": "افتح مساحتك للإبداع",
  "custom-page": "افتح صفحة قابلة لإعادة الاستخدام",
  internal: "صفحة داخلية أخرى",
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
  const [draggedService, setDraggedService] = useState<number | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(loadSiteContent()));
  const [searchTerm, setSearchTerm] = useState("");
  const [activePanelTab, setActivePanelTab] = useState("identity");
  const [saveError, setSaveError] = useState("");
  const [leaveAction, setLeaveAction] = useState<{ url?: string; logout?: boolean } | null>(null);
  const contentRef = useRef(content); contentRef.current = content;
  const savedRef = useRef(savedSnapshot); savedRef.current = savedSnapshot;
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const siteContentQuery = trpc.siteContent.get.useQuery(undefined, { refetchOnWindowFocus: false });
  const siteContentSave = trpc.siteContent.save.useMutation();
  const ownerSearchQuery = trpc.ownerSearch.query.useQuery({ term: searchTerm.trim(), page: 1, pageSize: 20 }, { enabled: unlocked && searchTerm.trim().length >= 2, staleTime: 1000, refetchOnWindowFocus: false });
  const recycleQuery = trpc.templates.recycleBin.useQuery(undefined, { enabled: unlocked && isAuthenticated, refetchOnWindowFocus: false });
  const retentionQuery = trpc.templates.retentionDays.useQuery(undefined, { enabled: unlocked && isAuthenticated, refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const restoreMutation = trpc.templates.restore.useMutation({ onSuccess: () => utils.templates.recycleBin.invalidate() });
  const purgeMutation = trpc.templates.purge.useMutation({ onSuccess: () => utils.templates.recycleBin.invalidate() });
  const cleanupMutation = trpc.templates.cleanup.useMutation({ onSuccess: (result) => { utils.templates.recycleBin.invalidate(); toast.success(`تم تفريغ ${result.deleted} قالب منتهي.`); } });
  const setRetentionMutation = trpc.templates.setRetentionDays.useMutation({ onSuccess: () => { utils.templates.retentionDays.invalidate(); toast.success("تم حفظ مدة الاحتفاظ في قاعدة البيانات."); } });

  useEffect(() => setUnlocked(window.sessionStorage.getItem("abu-kayan-owner-panel") === "true"), []);
  useEffect(() => { if (siteContentQuery.data && JSON.stringify(contentRef.current) === savedRef.current) { const next = normalizeSiteContent(siteContentQuery.data); setContent(next); setSavedSnapshot(JSON.stringify(next)); } }, [siteContentQuery.data]);
  const hasUnsavedChanges = useMemo(() => JSON.stringify(content) !== savedSnapshot, [content, savedSnapshot]);
  const localSearchResults = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    if (term.length < 2) return [] as Array<{ id: string; title: string; subtitle: string; section: "identity" | "appearance" | "buttons" | "pages" | "services" }>;
    const matches = (value: unknown) => String(value ?? "").toLocaleLowerCase().includes(term);
    return [
      ...(matches(content.heroTitle) || matches(content.heroLead) ? [{ id: "hero", title: content.heroTitle, subtitle: "محتوى الواجهة الرئيسية", section: "identity" as const }] : []),
      ...(content.services.filter((item) => matches(item.title) || matches(item.description) || matches(item.tag)).map((item, index) => ({ id: `service-${index}`, title: item.title, subtitle: item.description, section: "services" as const }))),
      ...(content.buttons.filter((item) => matches(item.label) || matches(item.action)).map((item) => ({ id: item.id, title: item.label, subtitle: `زر · ${actionLabels[item.action]}`, section: "buttons" as const }))),
      ...(content.pages.filter((item) => matches(item.title) || matches(item.description) || matches(item.slug)).map((item) => ({ id: item.id, title: item.title, subtitle: `صفحة · /custom/${item.slug}`, section: "pages" as const }))),
      ...(matches(content.settings.fontFamily) || matches(content.settings.themeMode) ? [{ id: "settings", title: "إعدادات المظهر", subtitle: "الخطوط والألوان والوضع", section: "appearance" as const }] : []),
    ].slice(0, 12);
  }, [content, searchTerm]);
  useEffect(() => {
    if (!hasUnsavedChanges) { window.onbeforeunload = null; return; }
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const unlock = () => {
    if (pin === getOwnerPin()) {
      window.sessionStorage.setItem("abu-kayan-owner-panel", "true");
      setUnlocked(true);
      setPin("");
      toast.success("تم فتح لوحة المالك.");
    } else toast.error("كلمة السر غير صحيحة.");
  };

  const logoutNow = () => {
    window.sessionStorage.removeItem("abu-kayan-owner-panel");
    setUnlocked(false);
    toast("تم إغلاق لوحة المالك.");
  };

  const logout = () => { if (hasUnsavedChanges) setLeaveAction({ logout: true }); else logoutNow(); };
  const changePages = (pages: EditablePage[]) => setContent((current) => {
    let next = { ...current, pages };
    for (const oldPage of current.pages) { const renamed = pages.find((page) => page.id === oldPage.id); if (renamed && renamed.slug !== oldPage.slug) next = updatePageSlugReferences(next, oldPage.slug, renamed.slug); }
    return next;
  });
  const createPageButton = (page: EditablePage) => { setContent((current) => ({ ...current, buttons: [...current.buttons, { id: crypto.randomUUID(), label: page.title, action: "custom-page", url: `/custom/${page.slug}`, placement: "hero", visible: true, icon: "arrow", order: current.buttons.length + 1 }] })); setActivePanelTab("buttons"); toast("تم إنشاء الزر وربطه بالصفحة. احفظ التعديلات لتزامن الربط."); };
  const update = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => setContent((current) => ({ ...current, [key]: value }));
  const updateSetting = <K extends keyof SiteContent["settings"]>(key: K, value: SiteContent["settings"][K]) => setContent((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  useEffect(() => {
    if (retentionQuery.data) updateSetting("recycleRetentionDays", retentionQuery.data as SiteContent["settings"]["recycleRetentionDays"]);
  }, [retentionQuery.data]);
  const updateService = <K extends keyof EditableService>(index: number, key: K, value: EditableService[K]) => setContent((current) => ({ ...current, services: current.services.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const updateProduct = <K extends keyof EditableProduct>(index: number, key: K, value: EditableProduct[K]) => setContent((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const updateButton = <K extends keyof EditableButton>(index: number, key: K, value: EditableButton[K]) => setContent((current) => ({ ...current, buttons: current.buttons.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const updatePage = <K extends keyof EditablePage>(index: number, key: K, value: EditablePage[K]) => setContent((current) => ({ ...current, pages: current.pages.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const addPage = () => setContent((current) => ({ ...current, pages: [...current.pages, { id: crypto.randomUUID(), slug: `page-${current.pages.length + 1}`, title: "صفحة جديدة", eyebrow: "قالب أبو كيان", description: "اكتب وصف الصفحة هنا.", template: "landing", visible: true, blocks: [] }] }));
  const removePage = (index: number) => setContent((current) => ({ ...current, pages: current.pages.filter((_, i) => i !== index) }));
  const updatePageBlock = <K extends keyof NonNullable<EditablePage["blocks"]>[number]>(pageIndex: number, blockIndex: number, key: K, value: NonNullable<EditablePage["blocks"]>[number][K]) => setContent((current) => ({ ...current, pages: current.pages.map((page, index) => index === pageIndex ? { ...page, blocks: (page.blocks || []).map((block, itemIndex) => itemIndex === blockIndex ? { ...block, [key]: value } : block) } : page) }));
  const addPageBlock = (pageIndex: number, type: NonNullable<EditablePage["blocks"]>[number]["type"]) => setContent((current) => ({ ...current, pages: current.pages.map((page, index) => index === pageIndex ? { ...page, blocks: [...(page.blocks || []), { id: crypto.randomUUID(), type, title: type === "button" ? "زر الصفحة" : "عنوان القسم", content: type === "text" ? "اكتب محتوى القسم هنا." : "", url: type === "button" ? "/" : "", visible: true, order: (page.blocks || []).length + 1 }] } : page) }));
  const removePageBlock = (pageIndex: number, blockIndex: number) => setContent((current) => ({ ...current, pages: current.pages.map((page, index) => index === pageIndex ? { ...page, blocks: (page.blocks || []).filter((_, itemIndex) => itemIndex !== blockIndex) } : page) }));
  const moveService = (from: number, to: number) => setContent((current) => { if (from === to || to < 0 || to >= current.services.length) return current; const services = [...current.services]; const [moved] = services.splice(from, 1); services.splice(to, 0, moved); return { ...current, services: services.map((service, index) => ({ ...service, order: index + 1, number: String(index + 1).padStart(2, "0") })) }; });
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

  const persist = async (next: SiteContent = contentRef.current): Promise<boolean> => {
    const validation = validateSitePages(next.pages);
    if (!validation.valid) { const message = validation.errors[0].message; setSaveError(message); toast.error(message); return false; }
    const sent = JSON.stringify(next);
    setSaveError("");
    try {
      const result = await siteContentSave.mutateAsync({ ownerPin: getOwnerPin(), content: next as unknown as Record<string, unknown> });
      if (!result.success || !result.content) throw new Error("لم يؤكد الخادم تخزين التعديلات.");
      const confirmed = normalizeSiteContent(result.content);
      saveSiteContent(confirmed);
      setSavedSnapshot(JSON.stringify(confirmed));
      setContent((current) => JSON.stringify(current) === sent ? confirmed : current);
      if (confirmed.settings.themeMode !== theme) toggleTheme();
      if (isAuthenticated) setRetentionMutation.mutate({ retentionDays: confirmed.settings.recycleRetentionDays });
      await utils.siteContent.get.invalidate();
      toast.success("تم تأكيد حفظ التعديلات في قاعدة البيانات ومزامنتها للجميع.");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر الحفظ المركزي.";
      setSaveError(`${message} — التعديلات ما زالت في اللوحة ولم تُفقد. حاول مجددًا.`);
      toast.error(message); return false;
    }
  };
  const save = () => { void persist(); };
  const changePassword = () => {
    if (currentPin !== getOwnerPin()) return toast.error("كلمة المرور الحالية غير صحيحة.");
    if (newPin.length < 6) return toast.error("اجعل كلمة المرور الجديدة 6 أرقام أو أكثر.");
    if (newPin !== confirmPin) return toast.error("تأكيد كلمة المرور غير مطابق.");
    window.localStorage.setItem(OWNER_PIN_KEY, newPin);
    setCurrentPin(""); setNewPin(""); setConfirmPin("");
    toast.success("تم تغيير كلمة مرور المالك بنجاح.");
  };
  const saveTemplatePassword = () => { if (content.settings.templatePassword.trim().length < 4) return toast.error("اجعل كلمة مرور القوالب 4 أرقام أو أكثر."); void persist(); };
  const applyCodeSettings = async (next: SiteContent, extensions: Record<string, unknown>, _label: string) => {
    const withExtensions = { ...next, extensions } as SiteContent;
    setContent(withExtensions); contentRef.current = withExtensions;
    return persist(withExtensions);
  };
  const completeLeave = (action: { url?: string; logout?: boolean }) => { setLeaveAction(null); if (action.logout) logoutNow(); else if (action.url) window.location.assign(action.url); };
  const captureNavigation = (event: React.MouseEvent<HTMLElement>) => {
    const anchor = (event.target as HTMLElement).closest("a[href]");
    const url = anchor?.getAttribute("href");
    if (hasUnsavedChanges && url && !url.startsWith("#") && anchor?.getAttribute("target") !== "_blank") { event.preventDefault(); event.stopPropagation(); setLeaveAction({ url }); }
  };
  const openSearchResult = (result: NonNullable<typeof ownerSearchQuery.data>["items"][number]) => {
    if (result.url) { window.location.href = result.url; return; }
    const sectionId = result.section === "free-sites" ? "owner-free-sites" : result.section === "creative" ? "owner-creative-submissions" : "owner-creative-categories";
    setActivePanelTab(result.section === "free-sites" ? "free-sites" : result.section === "creative" ? "submissions" : "creative-categories");
    const section = document.getElementById(sectionId) as HTMLDetailsElement | null;
    if (section) { section.open = true; section.scrollIntoView({ behavior: "smooth", block: "start" }); }
    setSearchTerm("");
  };
  const openLocalSearchResult = (sectionId: string) => { setActivePanelTab(sectionId); const section = document.getElementById(`owner-${sectionId}`) as HTMLDetailsElement | null; if (section) { section.open = true; section.scrollIntoView({ behavior: "smooth", block: "start" }); } setSearchTerm(""); };

  if (!unlocked) return <main dir="rtl" className="owner-page owner-lock-page"><div className="owner-lock-card"><button type="button" className="theme-toggle owner-lock-theme" onClick={toggleTheme} aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}>{theme === "light" ? <Moon size={15} /> : <Sun size={15} />}</button><div className="owner-lock-icon"><LockKeyhole size={25} /></div><span className="studio-label">منطقة خاصة بالمالك</span><h1>لوحة التحكم</h1><p>أدخل كلمة السر للوصول إلى أدوات تعديل الموقع.</p><input autoFocus type="password" inputMode="numeric" value={pin} maxLength={32} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") unlock(); }} placeholder="كلمة السر" aria-label="كلمة السر" /><button type="button" className="owner-save" onClick={unlock}><LockKeyhole size={16} /> فتح اللوحة</button><Link href="/" className="owner-back"><ArrowRight size={15} /> العودة للموقع</Link></div></main>;

  return <main dir="rtl" className="owner-page owner-tabbed" onClickCapture={captureNavigation}>
    <header className="owner-header"><div><span className="studio-label">أبو كيان الجنيد · محرر شامل</span><h1>لوحة التحكم</h1></div><div className="owner-header-actions"><button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}>{theme === "light" ? <Moon size={15} /> : <Sun size={15} />}</button><Link href="/" className="owner-back"><ArrowRight size={15} /> معاينة الموقع</Link><button type="button" className="owner-logout" onClick={logout}><LogOut size={15} /> إغلاق</button></div></header>
    <div className={`owner-save-bar ${hasUnsavedChanges ? "is-dirty" : "is-clean"}`}><div><strong>{hasUnsavedChanges ? "لديك تعديلات غير محفوظة" : "كل التعديلات محفوظة"}</strong><small>{hasUnsavedChanges ? "احفظ قبل مغادرة اللوحة حتى تظهر التغييرات لجميع الأجهزة." : "المزامنة الأخيرة مؤكدة من قاعدة البيانات."}</small></div><button type="button" className="owner-save" onClick={save} disabled={!hasUnsavedChanges || siteContentSave.isPending}><Save size={16} /> {siteContentSave.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button></div>
    <nav className="owner-tabs" role="tablist" aria-label="أقسام لوحة التحكم">{[{ id: "identity", label: "الموقع العام" }, { id: "appearance", label: "الألوان والخطوط" }, { id: "security", label: "الأمان" }, { id: "services", label: "الخدمات والمنتجات" }, { id: "buttons", label: "الأزرار" }, { id: "pages", label: "إدارة الصفحات" }, { id: "free-sites", label: "المواقع المجانية" }, { id: "submissions", label: "المشاركات" }, { id: "creative-categories", label: "أقسام الإبداع" }, { id: "template-gemini", label: "تصاميم Gemini" }, { id: "template-chat", label: "تصاميم الأطفال" }, { id: "code", label: "الأكواد المخصصة" }, { id: "backup", label: "النسخ الاحتياطية" }].map((tab) => <button type="button" role="tab" id={`owner-tab-${tab.id}`} aria-selected={activePanelTab === tab.id} aria-controls={({"identity":"owner-identity","appearance":"owner-appearance","security":"owner-security","services":"owner-services","buttons":"owner-buttons","pages":"owner-pages","free-sites":"owner-free-sites","submissions":"owner-creative-submissions","creative-categories":"owner-creative-categories","template-gemini":"owner-template-categories-gemini","template-chat":"owner-template-categories-chat","code":"owner-code-panel","backup":"owner-recycle-panel"} as Record<string, string>)[tab.id]} key={tab.id} onClick={() => setActivePanelTab(tab.id)}>{tab.label}</button>)}</nav>
    {saveError && <div role="alert" className="owner-save-error">{saveError}</div>}
    <section className="owner-search-panel" aria-label="البحث الشامل"><div className="owner-search-heading"><div><span className="studio-label">بحث سريع</span><strong>ابحث في محتوى الموقع كله</strong></div><Search size={18} /></div><div className="owner-search-input"><Search size={17} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="ابحث في الأقسام، الأزرار، القوالب، المواقع والمشاركات..." aria-label="البحث الشامل" />{searchTerm && <button type="button" onClick={() => setSearchTerm("")} aria-label="مسح البحث"><X size={15} /></button>}</div>{searchTerm.trim().length === 1 && <small className="owner-search-hint">اكتب حرفين على الأقل لبدء البحث.</small>}{searchTerm.trim().length >= 2 && <div className="owner-search-results">{localSearchResults.map((result) => <button type="button" className="owner-search-result" key={`local-${result.id}`} onClick={() => openLocalSearchResult(result.section)}><span><strong>{result.title}</strong><small>{result.subtitle}</small></span><em>إعداد الموقع</em></button>)}{ownerSearchQuery.isLoading && <span className="owner-search-empty">جارٍ البحث...</span>}{!ownerSearchQuery.isLoading && !ownerSearchQuery.data?.items.length && !localSearchResults.length && <span className="owner-search-empty">لا توجد نتائج مطابقة.</span>}{ownerSearchQuery.data?.items.map((result) => <button type="button" className="owner-search-result" key={`${result.kind}-${result.id}`} onClick={() => openSearchResult(result)}><span><strong>{result.title}</strong><small>{result.subtitle}</small></span><em>{result.kind === "template" ? "قالب" : result.kind === "free-site" ? "موقع" : result.kind === "submission" ? "مشاركة" : "قسم"}</em></button>)}{ownerSearchQuery.data?.hasMore && <small className="owner-search-hint">توجد نتائج إضافية؛ ضيّق عبارة البحث لنتيجة أدق.</small>}</div>}</section>

    <details id="owner-identity" className="owner-panel-section" hidden={activePanelTab !== "identity"} open={activePanelTab === "identity"} role="tabpanel" aria-labelledby="owner-tab-identity" aria-controls="owner-panel-tab-identity"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>01</span><strong>الهوية والمحتوى</strong><small>العناوين، الأزرار الأساسية، والصورة الرئيسية</small></summary><div className="owner-editor-grid">
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
        <label className="owner-image-upload"><input type="file" accept="image/*" onChange={(e) => handleImage(e, "heroImage")} /><span><ImagePlus size={18} /> تغيير صورة البداية</span><small>تُرفع إلى التخزين المركزي عند حفظ التعديلات.</small></label>
        <div className="owner-image-preview"><img src={content.heroImage || defaultSiteContent.heroImage} alt="معاينة" /></div>
      </section>
      <aside className="owner-side-card"><span className="studio-label">حالة التحرير</span><h2>وضع المالك مفتوح</h2><p>كل حقل أدناه ينعكس على المعاينة بعد الحفظ. الحفظ مركزي ويُؤكد من قاعدة البيانات قبل عرض رسالة النجاح.</p><div className="owner-status"><Check size={16} /> تحرير شامل مسموح</div><Link href="/owner/inbox" className="owner-inbox-link">فتح صندوق الرسائل</Link></aside>
    </div></details>

    <details id="owner-appearance" className="owner-panel-section" hidden={activePanelTab !== "appearance"} open={activePanelTab === "appearance"} role="tabpanel" aria-labelledby="owner-tab-appearance"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>02</span><strong>المظهر العام</strong><small>الخطوط، الألوان، الخلفية، والأحجام</small></summary><section className="owner-settings-card">
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
    </section></details>

    <details id="owner-security" className="owner-panel-section" hidden={activePanelTab !== "security"} open={activePanelTab === "security"} role="tabpanel" aria-labelledby="owner-tab-security"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>03</span><strong>الأمان وكلمات المرور</strong><small>حماية لوحة المالك وإضافة القوالب</small></summary><section className="owner-settings-card owner-security-card"><div className="owner-card-heading"><div><span className="studio-label">03 / الأمان</span><h2>كلمات المرور</h2></div><LockKeyhole size={20} /></div><p className="owner-security-note">تغيير كلمة مرور لوحة المالك وكلمة مرور إضافة القوالب من مكان واحد.</p><div className="owner-fields settings-fields"><label><span>كلمة المرور الحالية</span><input type="password" inputMode="numeric" value={currentPin} maxLength={32} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))} /></label><label><span>كلمة المرور الجديدة</span><input type="password" inputMode="numeric" value={newPin} maxLength={32} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} /></label><label><span>تأكيد الجديدة</span><input type="password" inputMode="numeric" value={confirmPin} maxLength={32} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))} /></label></div><div className="owner-template-password"><label><span>كلمة مرور إضافة القوالب والتصاميم</span><input type="password" inputMode="numeric" value={content.settings.templatePassword} maxLength={32} onChange={(e) => updateSetting("templatePassword", e.target.value.replace(/\D/g, ""))} placeholder="7705" /></label><small>تُستخدم قبل فتح محرر إضافة صورة أو فيديو في صفحتي Gemini وChat GBT.</small></div><div className="owner-header-actions"><button type="button" className="owner-save" onClick={saveTemplatePassword}><LockKeyhole size={16} /> حفظ كلمة مرور القوالب</button><button type="button" className="owner-save" onClick={changePassword}><LockKeyhole size={16} /> تغيير كلمة مرور المالك</button></div></section></details>

    <details id="owner-services" className="owner-panel-section" hidden={activePanelTab !== "services"} open={activePanelTab === "services"} role="tabpanel" aria-labelledby="owner-tab-services"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>04</span><strong>الخدمات والمنتجات</strong><small>إضافة، تعديل، ترتيب، وإخفاء المحتوى</small></summary><section className="owner-services-card"><div className="owner-card-heading"><div><span className="studio-label">04 / الخدمات والمنتجات</span><h2>محتوى قابل للتعديل بالكامل</h2></div><div className="owner-header-actions"><button type="button" className="owner-add" onClick={addService}><Plus size={16} /> خدمة</button><button type="button" className="owner-add" onClick={addProduct}><Plus size={16} /> منتج</button></div></div><div className="owner-service-list">
      {content.services.map((service, index) => <div className="owner-service-row" key={`service-${index}`} draggable onDragStart={() => setDraggedService(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedService !== null) moveService(draggedService, index); setDraggedService(null); }}><span className="owner-service-number owner-drag-handle">⋮⋮ {service.number}</span><label><span>رقم الخدمة</span><input value={service.number} onChange={(e) => updateService(index, "number", e.target.value)} /></label><label><span>اسم الخدمة</span><input value={service.title} onChange={(e) => updateService(index, "title", e.target.value)} /></label><label className="owner-wide"><span>الوصف</span><textarea value={service.description} onChange={(e) => updateService(index, "description", e.target.value)} /></label><label><span>التصنيف</span><input value={service.tag} onChange={(e) => updateService(index, "tag", e.target.value)} /></label><label><span>الظهور</span><select value={service.visible === false ? "hidden" : "visible"} onChange={(e) => updateService(index, "visible", e.target.value === "visible")}><option value="visible">ظاهر</option><option value="hidden">مخفي</option></select></label><label className="owner-image-upload compact-upload"><input type="file" accept="image/*" onChange={(e) => handleServiceImage(e, index)} /><span><ImagePlus size={15} /> صورة الخدمة</span></label>{service.image && <img className="owner-inline-image" src={service.image} alt="" />}<button type="button" className="owner-delete" onClick={() => removeAt("services", index)} aria-label="حذف الخدمة"><Trash2 size={16} /></button></div>)}
      {content.products.map((product, index) => <div className="owner-service-row product-row" key={product.id}><span className="owner-service-number">منتج</span><label><span>اسم المنتج</span><input value={product.title} onChange={(e) => updateProduct(index, "title", e.target.value)} /></label><label className="owner-wide"><span>الوصف</span><textarea value={product.description} onChange={(e) => updateProduct(index, "description", e.target.value)} /></label><label><span>السعر أو العبارة</span><input value={product.price} onChange={(e) => updateProduct(index, "price", e.target.value)} /></label><label className="owner-image-upload compact-upload"><input type="file" accept="image/*" onChange={(e) => handleProductImage(e, index)} /><span><ImagePlus size={15} /> صورة المنتج</span></label>{product.image && <img className="owner-inline-image" src={product.image} alt="" />}<button type="button" className="owner-delete" onClick={() => removeAt("products", index)} aria-label="حذف المنتج"><Trash2 size={16} /></button></div>)}
    </div></section></details>

    <details id="owner-buttons" className="owner-panel-section" hidden={activePanelTab !== "buttons"} open={activePanelTab === "buttons"} role="tabpanel" aria-labelledby="owner-tab-buttons"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>05</span><strong>إدارة الأزرار</strong><small>الوجهات، ترتيب الظهور، والمظهر</small></summary><OwnerButtons buttons={content.buttons} pages={content.pages} settings={content.settings} onChange={(buttons) => update("buttons", buttons)} /></details>
    <details id="owner-pages" className="owner-panel-section" hidden={activePanelTab !== "pages"} open={activePanelTab === "pages"} role="tabpanel" aria-labelledby="owner-tab-pages"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>06</span><strong>إدارة الصفحات</strong><small>صفحات مستقلة، معاينة، أكواد وروابط</small></summary><OwnerPages pages={content.pages} site={content} onChange={changePages} onCreateButton={createPageButton} /></details>

    <details id="owner-free-sites" className="owner-panel-section" hidden={activePanelTab !== "free-sites"} open={activePanelTab === "free-sites"} role="tabpanel" aria-labelledby="owner-tab-free-sites"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>06</span><strong>المواقع والخدمات المجانية</strong><small>إدارة الدليل والصور والظهور</small></summary><OwnerFreeSites unlocked={unlocked} /></details>

    <details id="owner-creative-submissions" className="owner-panel-section" hidden={activePanelTab !== "submissions"} open={activePanelTab === "submissions"} role="tabpanel" aria-labelledby="owner-tab-submissions"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>07</span><strong>مراجعة المشاركات</strong><small>مشاركات مساحتك الإبداعية والموافقة عليها</small></summary><OwnerCreativeSpace unlocked={unlocked} /></details>

    <details id="owner-creative-categories" className="owner-panel-section" hidden={activePanelTab !== "creative-categories"} open={activePanelTab === "creative-categories"} role="tabpanel" aria-labelledby="owner-tab-creative-categories"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>08</span><strong>أقسام الإبداع</strong><small>إضافة الأقسام وترتيبها وإخفاؤها</small></summary><OwnerCreativeCategories unlocked={unlocked} /></details>

    <details id="owner-template-categories-gemini" className="owner-panel-section" hidden={activePanelTab !== "template-gemini"} open={activePanelTab === "template-gemini"} role="tabpanel" aria-labelledby="owner-tab-template-gemini"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>09</span><strong>أقسام تصاميم Gemini وChatGPT</strong><small>إضافة الأقسام وترتيبها وإخفاؤها ونقل القوالب إليها</small></summary><OwnerTemplateCategories tool="Gemini" /></details>

    <details id="owner-template-categories-chat" className="owner-panel-section" hidden={activePanelTab !== "template-chat"} open={activePanelTab === "template-chat"} role="tabpanel" aria-labelledby="owner-tab-template-chat"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>10</span><strong>أقسام تصاميم الأطفال</strong><small>إدارة مستقلة لأقسام ChatGPT</small></summary><OwnerTemplateCategories tool="Chat GBT" /></details>

    <details id="owner-code-panel" className="owner-panel-section" hidden={activePanelTab !== "code"} open={activePanelTab === "code"} role="tabpanel" aria-labelledby="owner-tab-code"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>11</span><strong>الإعدادات البرمجية</strong><small>إدارة الإعدادات القابلة للتطبيق بأمان</small></summary><OwnerCodeWorkspace content={content} onApply={applyCodeSettings} /></details>

    <details id="owner-recycle-panel" className="owner-panel-section" hidden={activePanelTab !== "backup"} open={activePanelTab === "backup"} role="tabpanel" aria-labelledby="owner-tab-backup"><summary className="owner-section-summary" onClick={(event) => event.preventDefault()}><span>12</span><strong>النسخ الاحتياطية وسلة المحذوفات</strong><small>حفظ واستعادة إعدادات الموقع والقوالب المحذوفة</small></summary><OwnerBackups ownerPin={getOwnerPin()} onRestore={(next) => { setContent(next); toast("حُمّلت النسخة كمسودة. اضغط حفظ التعديلات للاعتماد."); }} /><section className="owner-services-card recycle-bin-card"><div className="owner-card-heading"><div><span className="studio-label">06 / سلة المحذوفات</span><h2>استعادة القوالب المحذوفة</h2></div><Trash2 size={20} /></div><p className="owner-security-note">تُنقل القوالب المحذوفة إلى هنا أولًا. اختر مدة الاحتفاظ من إعدادات الشكل، ثم اضغط التفريغ لحذف ما تجاوز المدة نهائيًا.</p>{!isAuthenticated ? <div className="recycle-login"><p>يلزم تسجيل دخول حساب المالك لإدارة القوالب المشتركة.</p><button type="button" className="owner-save" onClick={startLogin}><LockKeyhole size={16} /> تسجيل دخول المالك</button></div> : <><div className="recycle-toolbar"><span>{recycleQuery.isLoading ? "جارٍ التحميل..." : `${recycleQuery.data?.length || 0} قالب في السلة`}</span><button type="button" className="owner-add" disabled={cleanupMutation.isPending || !recycleQuery.data?.length} onClick={() => cleanupMutation.mutate({ retentionDays: content.settings.recycleRetentionDays })}><Trash2 size={15} /> تفريغ المنتهية</button></div><div className="recycle-list">{!recycleQuery.data?.length && !recycleQuery.isLoading && <p className="owner-empty">سلة المحذوفات فارغة.</p>}{recycleQuery.data?.map((item) => <div className="recycle-row" key={item.id}><div><strong>{item.imageName}</strong><small>{item.tool} · حُذف في {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString("ar-YE") : "—"}</small></div><div className="recycle-actions"><button type="button" className="owner-add" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate({ id: item.id })}><RotateCcw size={14} /> استعادة</button><button type="button" className="owner-delete" disabled={purgeMutation.isPending} onClick={() => { if (window.confirm("حذف نهائي؟ لا يمكن التراجع عن هذا الإجراء.")) purgeMutation.mutate({ id: item.id }); }}><Trash2 size={14} /> حذف نهائي</button></div></div>)}</div></>}</section></details>
    {leaveAction && <div className="owner-navigation-modal" role="dialog" aria-modal="true" aria-label="تعديلات غير محفوظة"><div className="owner-navigation-card"><h2>هل تحفظ التعديلات قبل المغادرة؟</h2><p>توجد تغييرات لم يُؤكد حفظها في قاعدة البيانات.</p><div className="owner-item-toolbar"><button type="button" className="owner-save" disabled={siteContentSave.isPending} onClick={async () => { if (await persist()) completeLeave(leaveAction); }}>حفظ ومغادرة</button><button type="button" className="owner-delete" onClick={() => { setContent(JSON.parse(savedSnapshot)); completeLeave(leaveAction); }}>مغادرة دون حفظ</button><button type="button" className="owner-add" onClick={() => setLeaveAction(null)}>البقاء في الصفحة</button></div>{saveError && <p role="alert">{saveError}</p>}</div></div>}
  </main>;
}
