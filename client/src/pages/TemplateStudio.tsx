import OptimizedImage from "@/components/OptimizedImage";
/*
  Shared template library: public browsing, owner-only creation, image/video media,
  one-click copy/download, and a clean return to the library after saving.
*/

import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clipboard,
  Download,
  FileVideo,
  ImagePlus,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { loadSiteContent } from "@/lib/siteContent";
import { useTheme } from "@/contexts/ThemeContext";
import CategoryStrip from "@/components/CategoryStrip";
import OwnerModal from "@/components/OwnerModal";
import "./TemplateStudio.css";
import { usePageTitle } from "@/hooks/usePageTitle";

type MediaType = "image" | "video";

type Template = {
  id: string;
  serverId?: number;
  text: string;
  mediaData: string;
  previewData: string;
  mediaName: string;
  mediaType: MediaType;
  category: string;
  createdAt?: number;
};

type TemplateStudioProps = {
  toolName: "Gemini" | "Chat GBT";
  toolLabel: string;
};

export type TemplateDraftState = {
  activeId: string;
  text: string;
  imageData: string;
  imageName: string;
  copied: boolean;
};

export function emptyTemplateDraft(): TemplateDraftState {
  return { activeId: "", text: "", imageData: "", imageName: "", copied: false };
}

const MAX_TEXT_LENGTH = 10000;

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = testLine;
  });
  if (line) lines.push(line);
  return lines.slice(0, 6);
}

function readMedia(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function mediaTypeForFile(file: File): MediaType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export default function TemplateStudio({ toolName, toolLabel }: TemplateStudioProps) {
  const [isOwner, setIsOwner] = useState(false);
  const storageKey = `abu-kayan-templates-${toolName.toLowerCase().replace(/\s/g, "-")}`;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pagePath = toolName === "Gemini" ? "/templates/gemini" : "/templates/chat-gbt";
  const fallbackTitle = toolName === "Gemini" ? "تصاميم عبر Gemini وChatGPT" : "تصاميم الأطفال";
  const pageTitle = usePageTitle(pagePath, fallbackTitle);
  const categoriesQuery = trpc.templateCategories.list.useQuery({ tool: toolName }, { refetchOnWindowFocus: true, staleTime: 0 });
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [loadedPages, setLoadedPages] = useState<Array<{ page: number; items: Array<{ id: number; text: string; imageUrl: string; previewUrl?: string | null; imageName: string; mediaType: string; category: string | null; createdAt: string | Date }> }>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchTerm.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);
  const templateQueryInput = { tool: toolName, page, pageSize: 12, ...(selectedCategory === "all" ? {} : { category: selectedCategory }), ...(searchQuery ? { search: searchQuery } : {}) };
  const templatesQuery = trpc.templates.page.useQuery(templateQueryInput, { refetchOnWindowFocus: true, staleTime: 0 });
  const sharedId = new URLSearchParams(window.location.search).get("template");
  const directTemplateId = sharedId && /^\d+$/.test(sharedId) ? Number(sharedId) : 0;
  const directTemplateQuery = trpc.templates.byId.useQuery({ id: directTemplateId, tool: toolName }, { enabled: directTemplateId > 0, staleTime: 30_000 });
  const sourceRows = [...loadedPages.flatMap((loadedPage) => loadedPage.items), ...(directTemplateQuery.data && !loadedPages.some((loadedPage) => loadedPage.items.some((item) => String(item.id) === String(directTemplateQuery.data!.id))) ? [directTemplateQuery.data] : [])];
  const templates = useMemo<Template[]>(() => sourceRows.map((item) => ({
    id: String(item.id),
    serverId: item.id,
    text: item.text,
    mediaData: item.imageUrl,
    previewData: item.previewUrl || item.imageUrl,
    mediaName: item.imageName,
    mediaType: (item.mediaType === "video" ? "video" : "image") as MediaType,
    category: item.category || "other",
    createdAt: new Date(item.createdAt).getTime(),
  })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [sourceRows]);
  const utils = trpc.useUtils();
  const invalidateTemplates = () => { setLoadedPages([]); setPage(1); void utils.templates.page.invalidate(); };
  useEffect(() => {
    const refreshActiveTemplates = () => {
      setLoadedPages([]);
      void utils.templates.page.invalidate();
      if (directTemplateId > 0) void utils.templates.byId.invalidate({ id: directTemplateId, tool: toolName });
    };
    window.addEventListener("abu-kayan-shared-content-updated", refreshActiveTemplates);
    return () => window.removeEventListener("abu-kayan-shared-content-updated", refreshActiveTemplates);
  }, [directTemplateId, toolName, utils]);
  const createTemplateMutation = trpc.templates.create.useMutation({ onSuccess: invalidateTemplates });
  const updateTemplateMutation = trpc.templates.update.useMutation({ onSuccess: invalidateTemplates });
  const deleteTemplateMutation = trpc.templates.remove.useMutation({ onSuccess: invalidateTemplates });
  const [activeId, setActiveId] = useState("");
  const [text, setText] = useState("");
  const [mediaData, setMediaData] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [draftCategory, setDraftCategory] = useState("other");
  const [copiedId, setCopiedId] = useState("");
  const [expandedTextIds, setExpandedTextIds] = useState<string[]>([]);
  const [pin, setPin] = useState("");
  const [editorVisible, setEditorVisible] = useState(false);
  const [templatePassword, setTemplatePassword] = useState(() => loadSiteContent().settings.templatePassword);
  useEffect(() => {
    const result = templatesQuery.data;
    if (!result || result.page !== page) return;
    setLoadedPages((current) => current.some((loadedPage) => loadedPage.page === result.page) ? current.map((loadedPage) => loadedPage.page === result.page ? result : loadedPage) : [...current, result]);
  }, [templatesQuery.data, page]);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [confirmTemplateClose, setConfirmTemplateClose] = useState(false);
  const draftBaseline = useRef(JSON.stringify(["", "", "", "image", "other"]));
  const draftSignature = JSON.stringify([text, mediaData, mediaName, mediaType, draftCategory]);
  const templateDirty = isOwner && editorVisible && draftSignature !== draftBaseline.current;
  const closeEditor = () => {
    if (createTemplateMutation.isPending || updateTemplateMutation.isPending) return;
    if (templateDirty) { setConfirmTemplateClose(true); return; }
    setEditorVisible(false);
  };
  useEffect(() => {
    if (!templateDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [templateDirty]);

  useEffect(() => setIsOwner(window.sessionStorage.getItem(`${storageKey}-owner`) === "true"), [storageKey]);

  useEffect(() => {
    const syncTemplatePassword = () => setTemplatePassword(loadSiteContent().settings.templatePassword);
    window.addEventListener("abu-kayan-content-updated", syncTemplatePassword);
    return () => window.removeEventListener("abu-kayan-content-updated", syncTemplatePassword);
  }, []);

  const activeTemplate = useMemo(() => templates.find((template) => template.id === activeId), [activeId, templates]);
  const visibleCategories = categoriesQuery.data || [];
  const categoryNames = useMemo(() => new Map(visibleCategories.map((category) => [category.slug, category.name])), [visibleCategories]);
  const visibleTemplateItems = templates;
  const changeFilters = (category: string, search: string) => {
    setSelectedCategory(category);
    setSearchTerm(search);
    setLoadedPages([]);
    setPage(1);
  };

  useEffect(() => {
    if (draftCategory !== "other" || !visibleCategories.length) return;
    setDraftCategory(visibleCategories[0]?.slug || "other");
  }, [draftCategory, visibleCategories]);

  useEffect(() => {
    if (selectedCategory === "all" || visibleCategories.some((category) => category.slug === selectedCategory)) return;
    setSelectedCategory("all");
  }, [selectedCategory, visibleCategories]);

  useEffect(() => {
    if (!directTemplateId || !directTemplateQuery.data) return;
    setActiveId(String(directTemplateId));
  }, [directTemplateId, directTemplateQuery.data]);

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(`template-${activeId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeId, templates]);

  const resetEditor = () => {
    setActiveId("");
    setText("");
    setMediaData("");
    setMediaName("");
    setMediaType("image");
    setDraftCategory(visibleCategories[0]?.slug || "other");
    draftBaseline.current = JSON.stringify(["", "", "", "image", visibleCategories[0]?.slug || "other"]);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  };

  const unlockOwner = () => {
    if (pin === templatePassword) {
      setIsOwner(true);
      setEditorVisible(true);
      window.sessionStorage.setItem(`${storageKey}-owner`, "true");
      setPin("");
      resetEditor();
      toast.success("تم فتح محرر إضافة القوالب لهذه الجلسة.");
      return;
    }
    toast.error("كلمة مرور القوالب غير صحيحة.");
  };

  const lockOwner = () => {
    if (templateDirty) { setConfirmTemplateClose(true); return; }
    setIsOwner(false);
    setEditorVisible(false);
    window.sessionStorage.removeItem(`${storageKey}-owner`);
    resetEditor();
    toast("تم إغلاق محرر القوالب.");
  };

  const openCreator = () => {
    if (editorVisible && templateDirty) return closeEditor();
    resetEditor();
    setEditorVisible(true);
    if (isOwner) toast("المحرر جاهز لإضافة قالب جديد.");
  };

  const handleMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!isOwner) return toast("الإضافة متاحة بعد إدخال كلمة المرور.");
    const file = event.target.files?.[0];
    if (!file) return;
    const nextType = mediaTypeForFile(file);
    if (!nextType) return toast.error("اختر صورة أو فيديو صالحًا.");
    if (file.size > 30 * 1024 * 1024) return toast.error("حجم الملف يجب ألا يتجاوز 30 ميجابايت.");
    try {
      setMediaType(nextType);
      setMediaData(await readMedia(file));
      setMediaName(file.name);
    } catch {
      toast.error("تعذر تحميل الوسيط.");
    }
  };

  const saveTemplate = () => {
    if (createTemplateMutation.isPending || updateTemplateMutation.isPending) return;
    if (!isOwner) return toast("اضغط إضافة قالب جديد وأدخل كلمة المرور أولًا.");
    if (!mediaData || !text.trim()) return toast.error("أضف صورة أو فيديو ونصًا قبل الحفظ.");
    if (!draftCategory.trim()) return toast.error("اختر قسم التصميم قبل الحفظ.");
    const payload = { tool: toolName, category: draftCategory, text: text.trim(), mediaType, mediaData, imageName: mediaName || `abu-kayan-${mediaType}`, ownerPassword: templatePassword };
    if (activeTemplate?.serverId) {
      // Existing templates use a storage URL. Upload only when a new local file was selected.
      const newMedia = mediaData.startsWith("data:") ? { mediaData } : {};
      updateTemplateMutation.mutate(
        { id: activeTemplate.serverId, category: draftCategory, text: payload.text, mediaType, ...newMedia, imageName: payload.imageName, ownerPassword: templatePassword },
        { onSuccess: () => { setConfirmTemplateClose(false); setEditorVisible(false); resetEditor(); toast.success("تم حفظ تحديث القالب وأصبح متاحًا للجميع."); }, onError: (error) => toast.error(error.message || "تعذر تحديث القالب المشترك.") },
      );
      return;
    }
    createTemplateMutation.mutate(payload, {
      onSuccess: () => { setConfirmTemplateClose(false); setEditorVisible(false); resetEditor(); toast.success("تم حفظ القالب وأصبح متاحًا للجميع."); },
      onError: (error) => toast.error(error.message || "تعذر حفظ القالب المشترك. حاول مرة أخرى."),
    });
  };

  const selectTemplate = (template: Template) => {
    setActiveId(template.id);
    if (isOwner) {
      setEditorVisible(true);
      setText(template.text);
      setMediaData(template.mediaData);
      setMediaName(template.mediaName);
      setMediaType(template.mediaType);
      setDraftCategory(template.category);
      draftBaseline.current = JSON.stringify([template.text, template.mediaData, template.mediaName, template.mediaType, template.category]);
    }
  };

  const deleteTemplate = (id: string) => {
    if (!isOwner) return toast("الحذف متاح للمالك بعد فتح محرر القوالب.");
    if (!window.confirm("هل تريد نقل هذا القالب إلى سلة المحذوفات؟ يمكنك استعادته من لوحة المالك.")) return;
    const serverId = templates.find((item) => item.id === id)?.serverId;
    if (!serverId) return;
    deleteTemplateMutation.mutate({ id: serverId, ownerPassword: templatePassword }, {
      onSuccess: () => { if (id === activeId) { resetEditor(); setEditorVisible(false); } toast.success("تم نقل القالب إلى سلة المحذوفات."); },
      onError: () => toast.error("تعذر نقل القالب إلى سلة المحذوفات."),
    });
  };

  const copyValue = async (value: string, id: string) => {
    if (!value.trim()) return toast.error("لا يوجد نص لنسخه.");
    try {
      await navigator.clipboard.writeText(value.trim());
      setCopiedId(id);
      toast.success("تم نسخ النص.");
      window.setTimeout(() => setCopiedId(""), 1600);
    } catch { toast.error("تعذر النسخ تلقائيًا."); }
  };

  const downloadMedia = (template: Template) => {
    if (!template.mediaData) return toast.error("لا يوجد ملف للتحميل.");
    const link = document.createElement("a");
    link.download = template.mediaName || `abu-kayan-${template.mediaType}`;
    link.href = template.mediaData;
    link.click();
    toast.success("تم تجهيز الملف للتحميل.");
  };

  const templateUrl = (template: Template) => `${window.location.origin}${window.location.pathname}?template=${encodeURIComponent(template.id)}`;

  const shareTemplate = async (template: Template) => {
    const url = templateUrl(template);
    try {
      const canShare = typeof navigator !== "undefined" && typeof (navigator as Navigator & { share?: unknown }).share === "function";
      if (canShare) {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ title: `قالب أبو كيان الجنيد · ${toolName}`, text: template.text.slice(0, 120), url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopiedId(`share-${template.id}`);
      toast.success(canShare ? "تم فتح خيارات المشاركة." : "تم نسخ رابط القالب.");
      window.setTimeout(() => setCopiedId(""), 1600);
    } catch {
      try { await navigator.clipboard.writeText(url); toast.success("تم نسخ رابط القالب."); } catch { toast.error("تعذرت مشاركة الرابط."); }
    }
  };

  const toggleText = (id: string) => setExpandedTextIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const downloadEditor = async () => {
    if (mediaType === "video") {
      downloadMedia({ id: "draft", text, mediaData, previewData: mediaData, mediaName: mediaName || "abu-kayan-video", mediaType, category: draftCategory });
      return;
    }
    if (!mediaData && !text.trim()) return toast.error("أضف صورة أو نصًا قبل التحميل.");
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#0b0e14"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#c6a45d"; context.fillRect(70, 70, 86, 5);
    context.font = "600 28px Arial"; context.fillText(toolName.toUpperCase(), 70, 125);
    if (mediaData) {
      const image = new Image(); image.src = mediaData;
      await new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); });
      const frameX = 70; const frameY = 170; const frameW = 940; const frameH = 680;
      const ratio = Math.max(frameW / image.width, frameH / image.height);
      const drawW = image.width * ratio; const drawH = image.height * ratio;
      context.save(); context.beginPath(); context.rect(frameX, frameY, frameW, frameH); context.clip(); context.drawImage(image, frameX + (frameW - drawW) / 2, frameY + (frameH - drawH) / 2, drawW, drawH); context.restore();
      context.strokeStyle = "#c6a45d"; context.lineWidth = 2; context.strokeRect(frameX, frameY, frameW, frameH);
    }
    context.fillStyle = "#f7f3ea"; context.textAlign = "right"; context.font = "700 52px Arial";
    wrapCanvasText(context, text || "قالب أبو كيان الجنيد", 880).forEach((line, index) => context.fillText(line, 1010, 965 + index * 72));
    context.fillStyle = "#c98567"; context.fillRect(70, 1260, 940, 2); context.textAlign = "left"; context.fillStyle = "#9fa9b8"; context.font = "400 22px Arial"; context.fillText(`ABU KAYAN · ${toolName}`, 70, 1305);
    const link = document.createElement("a"); link.download = `abu-kayan-${toolName.toLowerCase().replace(/\s/g, "-")}-${Date.now()}.png`; link.href = canvas.toDataURL("image/png"); link.click(); toast.success("تم تجهيز التصميم للتحميل.");
  };

  const renderMedia = (source: string, type: MediaType, className = "", lazy = false, originalSource = source) => type === "video" ? <video src={source} className={className} controls muted playsInline preload="none" /> : <OptimizedImage src={originalSource} previewSrc={source !== originalSource ? source : undefined} alt="صورة قالب التصميم" className={className} loading={lazy ? "lazy" : undefined} decoding={lazy ? "async" : undefined} />;

  return <main dir="rtl" className="studio-page">
    <div className="studio-orbit studio-orbit-one" aria-hidden="true" /><div className="studio-orbit studio-orbit-two" aria-hidden="true" />
    <header className="studio-header"><Link href="/" className="studio-back"><ArrowRight size={17} /> العودة للموقع</Link><div className="studio-header-actions"><button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}>{theme === "light" ? <Moon size={15} /> : <Sun size={15} />}</button><div className="studio-brand"><Sparkles size={17} /> أبو كيان الجنيد</div></div></header>
    <section className="studio-hero"><div className="studio-kicker"><span /> مساحة {toolLabel}</div><h1>{pageTitle}</h1><p>تصفح القوالب المنشورة، وانسخ النص أو حمّل الملف من البطاقة. لإضافة قالب جديد استخدم الزر العلوي وأدخل كلمة المرور.</p><div className="studio-steps"><span><b>01</b> إضافة</span><i /><span><b>02</b> صورة أو فيديو</span><i /><span><b>03</b> نشر</span></div></section>
    <div className="studio-create-toolbar" aria-label="أدوات القوالب"><div><span className="studio-label">مساحة الإنشاء</span><strong>أضف تصميمًا جديدًا من أي مكان.</strong></div><button type="button" className="studio-primary-button" onClick={openCreator}><Plus size={16} /> إضافة قالب جديد</button></div>
    <section className="studio-layout library-only">
      <OwnerModal open={editorVisible} onClose={closeEditor} title={activeTemplate ? "تعديل قالب محفوظ" : "قالب جديد"} className="template-owner-modal" closeDisabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}><div className="studio-editor-panel">
        <span className="studio-label">المحرر الخاص بالمالك · صورة أو فيديو ونص</span>
        <div className={`owner-control ${isOwner ? "is-unlocked" : ""}`}>
          {isOwner ? <><span><Check size={15} /> وضع المالك مفتوح</span>{!authLoading && !isAuthenticated && <button type="button" onClick={startLogin}>تسجيل دخول المالك</button>}<button type="button" onClick={lockOwner}>إغلاق المحرر</button></> : <><span>أدخل كلمة المرور لفتح الإضافة</span><div><input type="password" inputMode="numeric" maxLength={32} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") unlockOwner(); }} placeholder="كلمة مرور القوالب" aria-label="كلمة مرور القوالب" /><button type="button" onClick={unlockOwner}>فتح الإضافة</button></div></>}
        </div>
        {isOwner && <>
          <label className="upload-zone"><input ref={uploadInputRef} type="file" accept="image/*,video/*" onChange={handleMedia} /><span className="upload-empty"><ImagePlus size={28} /><strong>{mediaData ? "تغيير الصورة أو الفيديو" : "ارفع صورة أو فيديو"}</strong><small>الصورة أو الفيديو سيظهران مع النص في بطاقة واحدة.</small><span className="upload-chip"><Upload size={14} /> اختيار ملف</span></span></label>
          {mediaName && <div className="file-name">{mediaName} · {mediaType === "video" ? "فيديو" : "صورة"}</div>}
          <label className="studio-field"><span>النص أسفل الوسيط</span><textarea value={text} maxLength={MAX_TEXT_LENGTH} onChange={(event) => setText(event.target.value)} placeholder="اكتب التهنئة أو النص الذي تريد الاحتفاظ به..." /><small>{text.length.toLocaleString("ar-EG")} / 10,000</small></label>
          <label className="studio-field"><span>قسم التصميم</span><select required aria-required="true" aria-label="قسم التصميم" value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>{activeTemplate && !visibleCategories.some((category) => category.slug === activeTemplate.category) && <option value={activeTemplate.category}>{categoryNames.get(activeTemplate.category) || activeTemplate.category}</option>}{!visibleCategories.length && <option value="other">أخرى</option>}{visibleCategories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select><small>اختر القسم الذي سيظهر فيه التصميم للزوار.</small></label>
          <div className="template-card-preview"><div className="template-card-image">{mediaData ? renderMedia(mediaData, mediaType) : <ImagePlus size={28} />}</div><p>{text || "سيظهر النص هنا تحت الصورة أو الفيديو"}</p><span>أبو كيان الجنيد · {toolName}</span></div>
          <div className="studio-action-row"><button type="button" className="studio-primary-button" onClick={saveTemplate} disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}><Check size={17} /> {createTemplateMutation.isPending || updateTemplateMutation.isPending ? "جارٍ الحفظ..." : "حفظ القالب"}</button><button type="button" className="studio-outline-button" onClick={() => copyValue(text, "draft")}>{copiedId === "draft" ? <Check size={16} /> : <Clipboard size={16} />} {copiedId === "draft" ? "تم النسخ" : "نسخ النص"}</button><button type="button" className="studio-outline-button" onClick={downloadEditor}><Download size={16} /> تحميل</button></div>
        </>}
      </div></OwnerModal>
      <OwnerModal open={confirmTemplateClose} onClose={() => setConfirmTemplateClose(false)} title="تعديلات القالب غير محفوظة" closeDisabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}><p>لن تُفقد المسودة إلا إذا اخترت المغادرة دون حفظ.</p><div className="owner-item-toolbar"><button type="button" className="owner-save" onClick={saveTemplate}>حفظ القالب ومغادرة</button><button type="button" className="owner-delete" onClick={() => { setConfirmTemplateClose(false); setEditorVisible(false); resetEditor(); }}>مغادرة دون حفظ</button><button type="button" className="owner-add" onClick={() => setConfirmTemplateClose(false)}>العودة إلى التحرير</button></div></OwnerModal>
      <aside className="studio-library">
        <div className="studio-library-head">
          <div><span className="studio-label">المكتبة المشتركة · الأحدث أولًا</span><h2>القوالب المشتركة <b>{templatesQuery.data?.total ?? visibleTemplateItems.length}</b></h2></div>
        </div>
        <label className="template-search"><Search size={17} /><input value={searchTerm} onChange={(event) => changeFilters(selectedCategory, event.target.value)} placeholder="ابحث في القوالب..." aria-label="ابحث في القوالب" />{searchTerm && <button type="button" aria-label="مسح البحث" onClick={() => changeFilters(selectedCategory, "")}><X size={15} /></button>}</label>
        <CategoryStrip categories={visibleCategories} value={selectedCategory} onChange={(category) => changeFilters(category, searchTerm)} ariaLabel="أقسام التصاميم" className="template-category-strip" />
        {templatesQuery.isLoading && visibleTemplateItems.length === 0 ? <div className="library-empty" role="status">جارٍ تحميل القوالب...</div> : visibleTemplateItems.length === 0 ? <div className="library-empty"><ImagePlus size={22} /><p>لا توجد قوالب منشورة في هذا القسم بعد.<br />اضغط «إضافة قالب جديد» للبدء.</p></div> : <div className="library-list">
          {visibleTemplateItems.map((template, index) => {
            const isExpanded = expandedTextIds.includes(template.id);
            const isLong = template.text.length > 240;
            const visibleText = isExpanded || !isLong ? template.text : `${template.text.slice(0, 240).trimEnd()}…`;
            return <article id={`template-${template.id}`} data-template-id={template.id} className={`library-item ${template.id === activeId ? "is-active" : ""}`} key={template.id}>
              <button type="button" className="library-media-button" onClick={() => selectTemplate(template)} aria-label={`فتح قالب ${index + 1}`}>
                <span className="library-item-media">{template.previewData ? renderMedia(template.previewData, template.previewData !== template.mediaData ? "image" : template.mediaType, "", true, template.mediaData) : <Sparkles size={28} />}</span>
              </button>
              <div className="library-item-body">
                <div className="library-item-heading"><span><b>قالب {String(index + 1).padStart(2, "0")}</b><small>{categoryNames.get(template.category) || "أخرى"} · {template.mediaType === "video" ? <><FileVideo size={11} /> فيديو</> : "صورة"}</small></span><time>{template.createdAt ? new Date(template.createdAt).toLocaleDateString("ar-YE") : ""}</time></div>
                <div className="whatsapp-message"><p>{visibleText || "بدون نص"}</p>{isLong && <button type="button" className="read-more-button" onClick={() => toggleText(template.id)}>{isExpanded ? "عرض أقل" : "قراءة المزيد"}</button>}</div>
                <div className="library-item-actions"><button type="button" onClick={() => copyValue(template.text, template.id)} aria-label="نسخ نص القالب">{copiedId === template.id ? <Check size={13} /> : <Clipboard size={13} />}<span>نسخ النص</span></button><button type="button" onClick={() => downloadMedia(template)} aria-label="تحميل القالب"><Download size={13} /><span>تحميل</span></button><button type="button" onClick={() => shareTemplate(template)} aria-label="مشاركة رابط القالب">{copiedId === `share-${template.id}` ? <Check size={13} /> : <Share2 size={13} />}<span>مشاركة</span></button>{isOwner && <button type="button" onClick={() => deleteTemplate(template.id)} aria-label="حذف القالب"><Trash2 size={13} /><span>حذف</span></button>}</div>
                <div className="template-direct-link"><span>{templateUrl(template)}</span><button type="button" onClick={() => shareTemplate(template)}>نسخ الرابط</button></div>
              </div>
            </article>;
          })}
        </div>}
        {templatesQuery.data?.hasMore && <button type="button" className="template-load-more" disabled={templatesQuery.isFetching} onClick={() => setPage((current) => current + 1)}>{templatesQuery.isFetching ? "جارٍ تحميل المزيد..." : "تحميل المزيد"}</button>}
      </aside>
    </section>
    <p className="studio-note"><RotateCcw size={14} /> بعد الحفظ يظهر القالب مباشرة لجميع الزوار، ويمكنهم نسخ النص أو تحميل الوسيط من البطاقة.</p>
  </main>;
}
