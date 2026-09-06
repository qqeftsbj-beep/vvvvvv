/*
  Design reminder — Luxury dark studio:
  Keep the creator practical and premium: matte midnight surfaces, antique-gold actions,
  clear Arabic RTL hierarchy, restrained motion, and no dependence on a backend for preview work.
*/

import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clipboard,
  Download,
  ImagePlus,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { loadSiteContent } from "@/lib/siteContent";

type Template = {
  id: string;
  text: string;
  imageData: string;
  imageName: string;
  createdAt?: number;
  serverId?: number;
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

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });

  if (line) lines.push(line);
  return lines.slice(0, 6);
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TemplateStudio({ toolName, toolLabel }: TemplateStudioProps) {
  const storageKey = `abu-kayan-templates-${toolName.toLowerCase().replace(/\s/g, "-")}`;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const templatesQuery = trpc.templates.list.useQuery({ tool: toolName }, { refetchOnWindowFocus: true, staleTime: 0 });
  const templates = useMemo<Template[]>(() => (templatesQuery.data || []).map((item) => ({ id: String(item.id), serverId: item.id, text: item.text, imageData: item.imageUrl, imageName: item.imageName, createdAt: new Date(item.createdAt).getTime() })), [templatesQuery.data]);
  const utils = trpc.useUtils();
  const createTemplateMutation = trpc.templates.create.useMutation({ onSuccess: () => utils.templates.list.invalidate({ tool: toolName }) });
  const updateTemplateMutation = trpc.templates.update.useMutation({ onSuccess: () => utils.templates.list.invalidate({ tool: toolName }) });
  const deleteTemplateMutation = trpc.templates.remove.useMutation({ onSuccess: () => utils.templates.list.invalidate({ tool: toolName }) });
  const [activeId, setActiveId] = useState<string>("");
  const [text, setText] = useState("");
  const [imageData, setImageData] = useState("");
  const [imageName, setImageName] = useState("");
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [pin, setPin] = useState("");
  const [templatePassword, setTemplatePassword] = useState(() => loadSiteContent().settings.templatePassword);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsOwner(window.sessionStorage.getItem(`${storageKey}-owner`) === "true");
  }, [storageKey]);

  useEffect(() => {
    const syncTemplatePassword = () => setTemplatePassword(loadSiteContent().settings.templatePassword);
    window.addEventListener("abu-kayan-content-updated", syncTemplatePassword);
    return () => window.removeEventListener("abu-kayan-content-updated", syncTemplatePassword);
  }, []);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeId),
    [activeId, templates],
  );

  const unlockOwner = () => {
    if (pin === templatePassword) {
      setIsOwner(true);
      window.sessionStorage.setItem(`${storageKey}-owner`, "true");
      setPin("");
      toast.success("تم فتح وضع المالك لهذه الجلسة.");
      return;
    }
    toast.error("رمز المالك غير صحيح.");
  };

  const lockOwner = () => {
    setIsOwner(false);
    window.sessionStorage.removeItem(`${storageKey}-owner`);
    toast("تم إغلاق وضع المالك.");
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!isOwner) {
      toast("الإضافة متاحة في وضع المالك فقط.");
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختر ملف صورة صالحًا.");
      return;
    }
    try {
      setImageData(await readImage(file));
      setImageName(file.name);
    } catch {
      toast.error("تعذر تحميل الصورة.");
    }
  };

  const saveTemplate = () => {
    if (createTemplateMutation.isPending || updateTemplateMutation.isPending) return;
    if (!isOwner) return toast("افتح وضع المالك لإضافة أو تعديل القوالب.");
    if (!isAuthenticated) { startLogin(); return; }
    if (!imageData || !text.trim()) return toast.error("أضف صورة ونصًا قبل حفظ القالب المشترك.");
    if (activeTemplate?.serverId) {
      updateTemplateMutation.mutate(
        { id: activeTemplate.serverId, text: text.trim(), imageName, imageData: imageData.startsWith("data:") ? imageData : undefined },
        { onSuccess: () => toast.success("تم تحديث القالب المشترك."), onError: () => toast.error("تعذر تحديث القالب المشترك.") },
      );
      return;
    }
    createTemplateMutation.mutate(
      { tool: toolName, text: text.trim(), imageData, imageName },
      {
        onSuccess: () => {
          startNewTemplate();
          toast.success("تمت إضافة القالب وسيظهر لجميع الزوار. يمكنك الآن إنشاء قالب جديد.");
        },
        onError: () => toast.error("تعذر حفظ القالب المشترك. حاول مرة أخرى."),
      },
    );
  };

  const resetEditor = () => {
    const empty = emptyTemplateDraft();
    setActiveId(empty.activeId);
    setText(empty.text);
    setImageData(empty.imageData);
    setImageName(empty.imageName);
    setCopied(empty.copied);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  };

  const startNewTemplate = () => {
    if (!isOwner) {
      toast("إنشاء قالب جديد متاح للمالك فقط.");
      return;
    }
    resetEditor();
  };

  const selectTemplate = (template: Template) => {
    setActiveId(template.id);
    setText(template.text);
    setImageData(template.imageData);
    setImageName(template.imageName);
    setCopied(false);
  };

  const deleteTemplate = (id: string) => {
    if (!isOwner) {
      toast("حذف القوالب متاح للمالك فقط.");
      return;
    }
    if (!isAuthenticated) { startLogin(); return; }
    const serverId = templates.find((item) => item.id === id)?.serverId;
    if (serverId) deleteTemplateMutation.mutate({ id: serverId });
    if (id === activeId) startNewTemplate();
    toast("تم حذف القالب من المكتبة المشتركة.");
  };

  const copyText = async () => {
    if (!text.trim()) {
      toast.error("أضف نصًا أولًا لنسخه.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text.trim());
      setCopied(true);
      toast.success("تم نسخ النص.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("تعذر النسخ تلقائيًا؛ حدّد النص وانسخه يدويًا.");
    }
  };

  const downloadCard = async () => {
    if (!imageData && !text.trim()) {
      toast.error("أضف صورة أو نصًا قبل التحميل.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#0b0e14";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#c6a45d";
    context.fillRect(70, 70, 86, 5);
    context.font = "600 28px Arial";
    context.fillText(toolName.toUpperCase(), 70, 125);

    if (imageData) {
      const image = new Image();
      image.src = imageData;
      await new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
      });
      const frameX = 70;
      const frameY = 170;
      const frameW = 940;
      const frameH = 680;
      const ratio = Math.max(frameW / image.width, frameH / image.height);
      const drawW = image.width * ratio;
      const drawH = image.height * ratio;
      const drawX = frameX + (frameW - drawW) / 2;
      const drawY = frameY + (frameH - drawH) / 2;
      context.save();
      context.beginPath();
      context.rect(frameX, frameY, frameW, frameH);
      context.clip();
      context.drawImage(image, drawX, drawY, drawW, drawH);
      context.restore();
      context.strokeStyle = "#c6a45d";
      context.lineWidth = 2;
      context.strokeRect(frameX, frameY, frameW, frameH);
    }

    context.fillStyle = "#f7f3ea";
    context.textAlign = "right";
    context.font = "700 52px Arial";
    const lines = wrapCanvasText(context, text || "قالب أبو كيان الجنيد", 880);
    lines.forEach((line, index) => context.fillText(line, 1010, 965 + index * 72));
    context.fillStyle = "#c98567";
    context.fillRect(70, 1260, 940, 2);
    context.textAlign = "left";
    context.fillStyle = "#9fa9b8";
    context.font = "400 22px Arial";
    context.fillText(`ABU KAYAN · ${toolName}`, 70, 1305);

    const link = document.createElement("a");
    link.download = `abu-kayan-${toolName.toLowerCase().replace(/\s/g, "-")}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("تم تجهيز التصميم للتحميل.");
  };

  return (
    <main dir="rtl" className="studio-page">
      <div className="studio-orbit studio-orbit-one" aria-hidden="true" />
      <div className="studio-orbit studio-orbit-two" aria-hidden="true" />
      <header className="studio-header">
        <Link href="/" className="studio-back"><ArrowRight size={17} /> العودة للموقع</Link>
        <div className="studio-brand"><Sparkles size={17} /> أبو كيان الجنيد</div>
      </header>

      <section className="studio-hero">
        <div className="studio-kicker"><span /> مساحة {toolLabel}</div>
        <h1>قالبك جاهز<br /><em>للفكرة التالية.</em></h1>
        <p>أضف الصورة، اكتب النص أسفلها، ثم انسخ النص أو حمّل التصميم عندما يكتمل.</p>
        <div className="studio-steps">
          <span><b>01</b> صورة</span><i />
          <span><b>02</b> نص</span><i />
          <span><b>03</b> تحميل</span>
        </div>
      </section>

      <section className="studio-layout">
        <div className="studio-editor-panel">
          <div className="studio-panel-top">
            <div><span className="studio-label">القالب الحالي</span><h2>{activeTemplate ? "تعديل قالب محفوظ" : "قالب جديد"}</h2></div>
            <button type="button" className="studio-ghost-button" onClick={startNewTemplate}><Plus size={16} /> قالب جديد</button>
          </div>

          <div className={`owner-control ${isOwner ? "is-unlocked" : ""}`}>
            {isOwner ? (
              <><span><Check size={15} /> وضع المالك مفتوح — يمكنك الإضافة والتعديل</span>{!authLoading && !isAuthenticated && <button type="button" onClick={startLogin}>تسجيل دخول المالك</button>}<button type="button" onClick={lockOwner}>إغلاق</button></>
            ) : (
              <><span>الإضافة والتعديل للمالك فقط</span><div><input type="password" inputMode="numeric" maxLength={32} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") unlockOwner(); }} placeholder="رمز المالك" aria-label="رمز المالك" /><button type="button" onClick={unlockOwner}>فتح وضع المالك</button></div></>
            )}
          </div>

          <label className={`upload-zone ${!isOwner ? "is-locked" : ""}`}>
            <input ref={uploadInputRef} type="file" accept="image/*" onChange={handleImage} disabled={!isOwner} />
            {imageData ? (
              <img src={imageData} alt="المعاينة المرفوعة" className="studio-upload-preview" />
            ) : (
              <span className="upload-empty"><ImagePlus size={28} /><strong>{isOwner ? "أفلت الصورة هنا" : "الصورة محفوظة للمالك"}</strong><small>{isOwner ? "أو اضغط لاختيار صورة من جهازك" : "افتح وضع المالك لإضافة صورة"}</small><span className="upload-chip"><Upload size={14} /> {isOwner ? "رفع صورة" : "مقفل"}</span></span>
            )}
          </label>
          {imageName && <div className="file-name">{imageName}</div>}

          <label className="studio-field">
            <span>النص أسفل الصورة</span>
            <textarea value={text} maxLength={MAX_TEXT_LENGTH} readOnly={!isOwner} onChange={(event) => setText(event.target.value)} placeholder="اكتب التهنئة أو النص الذي تريد الاحتفاظ به..." />
            <small>{text.length.toLocaleString("ar-EG")} / 10,000</small>
          </label>

          <div className="template-card-preview">
            <div className="template-card-image">{imageData ? <img src={imageData} alt="" /> : <ImagePlus size={28} />}</div>
            <p>{text || "سيظهر النص هنا تحت الصورة"}</p>
            <span>أبو كيان الجنيد · {toolName}</span>
          </div>

          <div className="studio-action-row">
            <button type="button" className="studio-primary-button" onClick={saveTemplate} disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}><Check size={17} /> {createTemplateMutation.isPending || updateTemplateMutation.isPending ? "جارٍ الحفظ..." : "حفظ القالب"}</button>
            <button type="button" className="studio-outline-button" onClick={copyText}>{copied ? <Check size={16} /> : <Clipboard size={16} />} {copied ? "تم النسخ" : "نسخ النص"}</button>
            <button type="button" className="studio-outline-button" onClick={downloadCard}><Download size={16} /> تحميل التصميم</button>
          </div>
          <p className="studio-note"><RotateCcw size={14} /> القوالب المشتركة تظهر لجميع الزوار، والإضافة والتعديل متاحان للمالك بعد تسجيل الدخول.</p>
        </div>

        <aside className="studio-library">
          <div className="studio-library-head"><div><span className="studio-label">المكتبة</span><h2>القوالب المشتركة <b>{templates.length}</b></h2></div></div>
          {templates.length === 0 ? (
            <div className="library-empty"><ImagePlus size={22} /><p>لا توجد قوالب منشورة بعد.<br />سيظهر أحدث قالب هنا أولًا.</p></div>
          ) : (
            <div className="library-list">
              {templates.map((template, index) => (
                <div className={`library-item ${template.id === activeId ? "is-active" : ""}`} key={template.id}>
                  <button type="button" className="library-select" onClick={() => selectTemplate(template)}><span className="library-thumb">{template.imageData ? <img src={template.imageData} alt="" /> : <Sparkles size={16} />}</span><span><b>قالب {String(index + 1).padStart(2, "0")}</b><small>{template.text || "بدون نص"}</small></span></button>
                  <button type="button" className="library-delete" onClick={() => deleteTemplate(template.id)} aria-label="حذف القالب"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
