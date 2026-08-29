/*
  Design reminder — Luxury dark studio:
  Keep the creator practical and premium: matte midnight surfaces, antique-gold actions,
  clear Arabic RTL hierarchy, restrained motion, and no dependence on a backend for preview work.
*/

import { ChangeEvent, useEffect, useMemo, useState } from "react";
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
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type Template = {
  id: string;
  text: string;
  imageData: string;
  imageName: string;
};

type TemplateStudioProps = {
  toolName: "Gemini" | "Chat GBT";
  toolLabel: string;
};

const MAX_TEXT_LENGTH = 10000;
const OWNER_PIN = "7705";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  const [, navigate] = useLocation();
  const storageKey = `abu-kayan-templates-${toolName.toLowerCase().replace(/\s/g, "-")}`;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [text, setText] = useState("");
  const [imageData, setImageData] = useState("");
  const [imageName, setImageName] = useState("");
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Template[];
      if (Array.isArray(parsed)) {
        setTemplates(parsed);
        if (parsed[0]) {
          setActiveId(parsed[0].id);
          setText(parsed[0].text);
          setImageData(parsed[0].imageData);
          setImageName(parsed[0].imageName);
        }
      }
    } catch {
      toast.error("تعذر قراءة القوالب المحفوظة في هذا المتصفح.");
    }
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(templates));
  }, [storageKey, templates]);

  useEffect(() => {
    setIsOwner(window.sessionStorage.getItem(`${storageKey}-owner`) === "true");
  }, [storageKey]);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeId),
    [activeId, templates],
  );

  const unlockOwner = () => {
    if (pin === OWNER_PIN) {
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
    if (!isOwner) {
      toast("افتح وضع المالك لإضافة أو تعديل القوالب.");
      return;
    }
    if (!imageData && !text.trim()) {
      toast.error("أضف صورة أو نصًا قبل حفظ القالب.");
      return;
    }

    const template: Template = {
      id: activeId || makeId(),
      text: text.trim(),
      imageData,
      imageName,
    };

    setTemplates((current) => {
      const exists = current.some((item) => item.id === template.id);
      return exists
        ? current.map((item) => (item.id === template.id ? template : item))
        : [...current, template];
    });
    setActiveId(template.id);
    toast.success("تم حفظ القالب على هذا الجهاز.");
  };

  const startNewTemplate = () => {
    if (!isOwner) {
      toast("إنشاء قالب جديد متاح للمالك فقط.");
      return;
    }
    setActiveId("");
    setText("");
    setImageData("");
    setImageName("");
    setCopied(false);
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
    setTemplates((current) => current.filter((item) => item.id !== id));
    if (id === activeId) startNewTemplate();
    toast("تم حذف القالب من هذه الصفحة.");
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
              <><span><Check size={15} /> وضع المالك مفتوح — يمكنك الإضافة والتعديل</span><button type="button" onClick={lockOwner}>إغلاق</button></>
            ) : (
              <><span>الإضافة والتعديل للمالك فقط</span><div><input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") unlockOwner(); }} placeholder="رمز المالك" aria-label="رمز المالك" /><button type="button" onClick={unlockOwner}>فتح وضع المالك</button></div></>
            )}
          </div>

          <label className={`upload-zone ${!isOwner ? "is-locked" : ""}`}>
            <input type="file" accept="image/*" onChange={handleImage} disabled={!isOwner} />
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
            <button type="button" className="studio-primary-button" onClick={saveTemplate}><Check size={17} /> حفظ القالب</button>
            <button type="button" className="studio-outline-button" onClick={copyText}>{copied ? <Check size={16} /> : <Clipboard size={16} />} {copied ? "تم النسخ" : "نسخ النص"}</button>
            <button type="button" className="studio-outline-button" onClick={downloadCard}><Download size={16} /> تحميل التصميم</button>
          </div>
          <p className="studio-note"><RotateCcw size={14} /> القوالب تحفظ محليًا في هذا المتصفح، ويمكنك إضافة العدد الذي تحتاجه دون حد ثابت.</p>
        </div>

        <aside className="studio-library">
          <div className="studio-library-head"><div><span className="studio-label">المكتبة</span><h2>قوالبك المحفوظة <b>{templates.length}</b></h2></div><button type="button" onClick={startNewTemplate} aria-label="إضافة قالب"><Plus size={18} /></button></div>
          {templates.length === 0 ? (
            <div className="library-empty"><ImagePlus size={22} /><p>لم تحفظ قالبًا بعد.<br />ابدأ من المساحة المجاورة.</p></div>
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
