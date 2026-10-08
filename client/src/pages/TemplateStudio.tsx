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
  Sparkles,
  Sun,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { loadSiteContent } from "@/lib/siteContent";
import { useTheme } from "@/contexts/ThemeContext";

type MediaType = "image" | "video";

type Template = {
  id: string;
  serverId?: number;
  text: string;
  mediaData: string;
  mediaName: string;
  mediaType: MediaType;
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
  const storageKey = `abu-kayan-templates-${toolName.toLowerCase().replace(/\s/g, "-")}`;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const templatesQuery = trpc.templates.list.useQuery({ tool: toolName }, { refetchOnWindowFocus: true, staleTime: 0 });
  const templates = useMemo<Template[]>(() => (templatesQuery.data || []).map((item) => ({
    id: String(item.id),
    serverId: item.id,
    text: item.text,
    mediaData: item.imageUrl,
    mediaName: item.imageName,
    mediaType: (item.mediaType === "video" ? "video" : "image") as MediaType,
    createdAt: new Date(item.createdAt).getTime(),
  })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [templatesQuery.data]);
  const utils = trpc.useUtils();
  const createTemplateMutation = trpc.templates.create.useMutation({ onSuccess: () => utils.templates.list.invalidate({ tool: toolName }) });
  const updateTemplateMutation = trpc.templates.update.useMutation({ onSuccess: () => utils.templates.list.invalidate({ tool: toolName }) });
  const deleteTemplateMutation = trpc.templates.remove.useMutation({ onSuccess: () => utils.templates.list.invalidate({ tool: toolName }) });
  const [activeId, setActiveId] = useState("");
  const [text, setText] = useState("");
  const [mediaData, setMediaData] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [copiedId, setCopiedId] = useState("");
  const [expandedTextIds, setExpandedTextIds] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [pin, setPin] = useState("");
  const [editorVisible, setEditorVisible] = useState(false);
  const [templatePassword, setTemplatePassword] = useState(() => loadSiteContent().settings.templatePassword);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setIsOwner(window.sessionStorage.getItem(`${storageKey}-owner`) === "true"), [storageKey]);

  useEffect(() => {
    const syncTemplatePassword = () => setTemplatePassword(loadSiteContent().settings.templatePassword);
    window.addEventListener("abu-kayan-content-updated", syncTemplatePassword);
    return () => window.removeEventListener("abu-kayan-content-updated", syncTemplatePassword);
  }, []);

  const activeTemplate = useMemo(() => templates.find((template) => template.id === activeId), [activeId, templates]);

  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search).get("template");
    if (!sharedId || !templates.some((template) => template.id === sharedId)) return;
    setActiveId(sharedId);
    const timer = window.setTimeout(() => document.getElementById(`template-${sharedId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    return () => window.clearTimeout(timer);
  }, [templates]);

  const resetEditor = () => {
    setActiveId("");
    setText("");
    setMediaData("");
    setMediaName("");
    setMediaType("image");
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
    setIsOwner(false);
    setEditorVisible(false);
    window.sessionStorage.removeItem(`${storageKey}-owner`);
    resetEditor();
    toast("تم إغلاق محرر القوالب.");
  };

  const openCreator = () => {
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
    if (authLoading) return toast("جارٍ التحقق من جلسة المالك...");
    if (!isAuthenticated) { startLogin(); return; }
    if (!mediaData || !text.trim()) return toast.error("أضف صورة أو فيديو ونصًا قبل الحفظ.");
    const payload = { tool: toolName, text: text.trim(), mediaType, mediaData, imageName: mediaName || `abu-kayan-${mediaType}` };
    if (activeTemplate?.serverId) {
      // Existing templates use a storage URL. Upload only when a new local file was selected.
      const newMedia = mediaData.startsWith("data:") ? { mediaData } : {};
      updateTemplateMutation.mutate(
        { id: activeTemplate.serverId, text: payload.text, mediaType, ...newMedia, imageName: payload.imageName },
        { onSuccess: () => { setEditorVisible(false); resetEditor(); toast.success("تم تحديث القالب وإعادته إلى المكتبة."); }, onError: () => toast.error("تعذر تحديث القالب المشترك.") },
      );
      return;
    }
    createTemplateMutation.mutate(payload, {
      onSuccess: () => { setEditorVisible(false); resetEditor(); toast.success("تمت إضافة القالب إلى المكتبة المشتركة."); },
      onError: () => toast.error("تعذر حفظ القالب المشترك. حاول مرة أخرى."),
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
    }
  };

  const deleteTemplate = (id: string) => {
    if (!isOwner) return toast("الحذف متاح للمالك بعد فتح محرر القوالب.");
    if (!isAuthenticated) { startLogin(); return; }
    if (!window.confirm("هل تريد نقل هذا القالب إلى سلة المحذوفات؟ يمكنك استعادته من لوحة المالك.")) return;
    const serverId = templates.find((item) => item.id === id)?.serverId;
    if (!serverId) return;
    deleteTemplateMutation.mutate({ id: serverId }, {
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
      downloadMedia({ id: "draft", text, mediaData, mediaName: mediaName || "abu-kayan-video", mediaType });
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

  const renderMedia = (source: string, type: MediaType, className = "") => type === "video" ? <video src={source} className={className} controls muted playsInline preload="metadata" /> : <img src={source} alt="" className={className} />;

  return <main dir="rtl" className="studio-page">
    <div className="studio-orbit studio-orbit-one" aria-hidden="true" /><div className="studio-orbit studio-orbit-two" aria-hidden="true" />
    <header className="studio-header"><Link href="/" className="studio-back"><ArrowRight size={17} /> العودة للموقع</Link><div className="studio-header-actions"><button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}>{theme === "light" ? <Moon size={15} /> : <Sun size={15} />}</button><div className="studio-brand"><Sparkles size={17} /> أبو كيان الجنيد</div></div></header>
    <section className="studio-hero"><div className="studio-kicker"><span /> مساحة {toolLabel}</div><h1>مكتبة تصاميم<br /><em>تتوسع معك.</em></h1><p>تصفح القوالب المنشورة، وانسخ النص أو حمّل الملف من البطاقة. لإضافة قالب جديد استخدم الزر العلوي وأدخل كلمة المرور.</p><div className="studio-steps"><span><b>01</b> إضافة</span><i /><span><b>02</b> صورة أو فيديو</span><i /><span><b>03</b> نشر</span></div></section>
    <section className={`studio-layout ${editorVisible ? "has-editor" : "library-only"}`}>
      {editorVisible && <div className="studio-editor-panel" role="dialog" aria-modal="true" aria-labelledby="template-editor-title">
        <div className="studio-panel-top"><div><span className="studio-label">المحرر الخاص بالمالك</span><h2 id="template-editor-title">{activeTemplate ? "تعديل قالب محفوظ" : "قالب جديد"}</h2></div><div className="studio-panel-actions"><button type="button" className="studio-ghost-button" onClick={openCreator}><Plus size={16} /> قالب جديد</button><button type="button" className="studio-close-button" onClick={() => { setEditorVisible(false); resetEditor(); }} aria-label="إغلاق محرر القالب">×</button></div></div>
        <div className={`owner-control ${isOwner ? "is-unlocked" : ""}`}>
          {isOwner ? <><span><Check size={15} /> وضع المالك مفتوح</span>{!authLoading && !isAuthenticated && <button type="button" onClick={startLogin}>تسجيل دخول المالك</button>}<button type="button" onClick={lockOwner}>إغلاق المحرر</button></> : <><span>أدخل كلمة المرور لفتح الإضافة</span><div><input type="password" inputMode="numeric" maxLength={32} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") unlockOwner(); }} placeholder="كلمة مرور القوالب" aria-label="كلمة مرور القوالب" /><button type="button" onClick={unlockOwner}>فتح الإضافة</button></div></>}
        </div>
        {isOwner && <>
          <label className="upload-zone"><input ref={uploadInputRef} type="file" accept="image/*,video/*" onChange={handleMedia} /><span className="upload-empty"><ImagePlus size={28} /><strong>{mediaData ? "تغيير الصورة أو الفيديو" : "ارفع صورة أو فيديو"}</strong><small>الصورة أو الفيديو سيظهران مع النص في بطاقة واحدة.</small><span className="upload-chip"><Upload size={14} /> اختيار ملف</span></span></label>
          {mediaName && <div className="file-name">{mediaName} · {mediaType === "video" ? "فيديو" : "صورة"}</div>}
          <label className="studio-field"><span>النص أسفل الوسيط</span><textarea value={text} maxLength={MAX_TEXT_LENGTH} onChange={(event) => setText(event.target.value)} placeholder="اكتب التهنئة أو النص الذي تريد الاحتفاظ به..." /><small>{text.length.toLocaleString("ar-EG")} / 10,000</small></label>
          <div className="template-card-preview"><div className="template-card-image">{mediaData ? renderMedia(mediaData, mediaType) : <ImagePlus size={28} />}</div><p>{text || "سيظهر النص هنا تحت الصورة أو الفيديو"}</p><span>أبو كيان الجنيد · {toolName}</span></div>
          <div className="studio-action-row"><button type="button" className="studio-primary-button" onClick={saveTemplate} disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}><Check size={17} /> {createTemplateMutation.isPending || updateTemplateMutation.isPending ? "جارٍ الحفظ..." : "حفظ ونشر القالب"}</button><button type="button" className="studio-outline-button" onClick={() => copyValue(text, "draft")}>{copiedId === "draft" ? <Check size={16} /> : <Clipboard size={16} />} {copiedId === "draft" ? "تم النسخ" : "نسخ النص"}</button><button type="button" className="studio-outline-button" onClick={downloadEditor}><Download size={16} /> تحميل</button></div>
        </>}
      </div>}
      <aside className="studio-library">
        <div className="studio-library-head">
          <div><span className="studio-label">المكتبة السابقة · الأحدث أولًا</span><h2>القوالب المشتركة <b>{templates.length}</b></h2></div>
          <button type="button" className="studio-primary-button studio-new-template" onClick={openCreator}><Plus size={16} /> إضافة قالب جديد</button>
        </div>
        {templates.length === 0 ? <div className="library-empty"><ImagePlus size={22} /><p>لا توجد قوالب منشورة بعد.<br />اضغط «إضافة قالب جديد» للبدء.</p></div> : <div className="library-list">
          {templates.map((template, index) => {
            const isExpanded = expandedTextIds.includes(template.id);
            const isLong = template.text.length > 240;
            const visibleText = isExpanded || !isLong ? template.text : `${template.text.slice(0, 240).trimEnd()}…`;
            return <article id={`template-${template.id}`} data-template-id={template.id} className={`library-item ${template.id === activeId ? "is-active" : ""}`} key={template.id}>
              <button type="button" className="library-media-button" onClick={() => selectTemplate(template)} aria-label={`فتح قالب ${index + 1}`}>
                <span className="library-item-media">{template.mediaData ? renderMedia(template.mediaData, template.mediaType) : <Sparkles size={28} />}</span>
              </button>
              <div className="library-item-body">
                <div className="library-item-heading"><span><b>قالب {String(index + 1).padStart(2, "0")}</b><small>{template.mediaType === "video" ? <><FileVideo size={11} /> فيديو</> : "صورة"}</small></span><time>{template.createdAt ? new Date(template.createdAt).toLocaleDateString("ar-YE") : ""}</time></div>
                <div className="whatsapp-message"><p>{visibleText || "بدون نص"}</p>{isLong && <button type="button" className="read-more-button" onClick={() => toggleText(template.id)}>{isExpanded ? "عرض أقل" : "قراءة المزيد"}</button>}</div>
                <div className="library-item-actions"><button type="button" onClick={() => copyValue(template.text, template.id)} aria-label="نسخ نص القالب">{copiedId === template.id ? <Check size={13} /> : <Clipboard size={13} />}<span>نسخ النص</span></button><button type="button" onClick={() => downloadMedia(template)} aria-label="تحميل القالب"><Download size={13} /><span>تحميل</span></button><button type="button" onClick={() => shareTemplate(template)} aria-label="مشاركة رابط القالب">{copiedId === `share-${template.id}` ? <Check size={13} /> : <Share2 size={13} />}<span>مشاركة</span></button>{isOwner && <button type="button" onClick={() => deleteTemplate(template.id)} aria-label="حذف القالب"><Trash2 size={13} /><span>حذف</span></button>}</div>
                <div className="template-direct-link"><span>{templateUrl(template)}</span><button type="button" onClick={() => shareTemplate(template)}>نسخ الرابط</button></div>
              </div>
            </article>;
          })}
        </div>}
      </aside>
    </section>
    <p className="studio-note"><RotateCcw size={14} /> بعد الحفظ يعود القالب مباشرة إلى المكتبة السابقة، ويستطيع الزائر نسخ النص أو تحميل الوسيط من البطاقة.</p>
  </main>;
}
