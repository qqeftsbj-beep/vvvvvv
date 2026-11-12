import React, { useState } from "react";
import { toast } from "sonner";
import { defaultWelcomeConfig, fromYemenInput, selectWelcomeTemplate, toYemenInput, WEEKDAY_NAMES, welcomeConfigSchema, type WelcomeConfig, type WelcomeTemplate } from "@shared/welcomeSchedule";
import WelcomeDialog from "@/components/WelcomeDialog";
import "./ownerWelcomeMessages.css";

type Props = { value: WelcomeConfig; onChange: (value: WelcomeConfig) => void; disabled?: boolean };
export default function OwnerWelcomeMessages({ value, onChange, disabled = false }: Props) {
  const [preview, setPreview] = useState<WelcomeTemplate | null>(null);
  const [previewAt, setPreviewAt] = useState(() => toYemenInput(Date.now()));
  const [dragged, setDragged] = useState<number | null>(null);
  const validation = welcomeConfigSchema.safeParse(value);
  const stamp = fromYemenInput(previewAt);
  const selected = validation.success && Number.isFinite(stamp) ? selectWelcomeTemplate(validation.data, stamp) : null;
  const patch = (id: string, changed: Partial<WelcomeTemplate>) => onChange({ ...value, templates: value.templates.map(t => t.id === id ? { ...t, ...changed } : t) });
  const move = (from: number, to: number) => {
    if (disabled || from === to || to < 0 || to >= value.templates.length) return;
    const templates = [...value.templates]; const [item] = templates.splice(from, 1); templates.splice(to, 0, item);
    onChange({ ...value, templates });
  };
  const add = (friday = false) => {
    if (value.templates.length >= 100) return toast.error("يمكنك إدارة 100 قالب ترحيبي.");
    const template: WelcomeTemplate = { ...defaultWelcomeConfig.templates[0], id: crypto.randomUUID(), name: friday ? "قالب الجمعة" : "قالب جديد", enabled: friday, title: friday ? "جمعة مباركة" : "أهلًا بك", intro: friday ? "نسأل الله لكم يومًا مليئًا بالخير." : "", body: friday ? "أهلًا بك في مساحتنا الإبداعية، ونتمنى لك جمعة طيبة ومباركة." : "اكتب رسالتك هنا.", schedule: friday ? { kind: "weekdays", days: [5], startTime: "00:00", endTime: "23:59" } : { kind: "range", startAt: Date.now(), endAt: Date.now() + 86400000 } };
    onChange({ ...value, templates: [template, ...value.templates] });
  };
  const image = async (file: File | undefined, id: string) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 2 * 1024 * 1024) return toast.error("اختر صورة PNG أو JPG أو WebP أو GIF لا تتجاوز 2 ميجابايت.");
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      patch(id, { image: data });
    } catch { toast.error("تعذر قراءة الصورة؛ حاول مرة أخرى."); }
  };
  const showPreview = (template: WelcomeTemplate | null) => {
    if (!validation.success) return toast.error(validation.error.issues[0]?.message || "صحح الحقول أولًا.");
    if (!template) return toast("لا يوجد قالب ظاهر في الموعد المحدد.");
    setPreview(template);
  };
  return <section className="owner-welcome-manager">
    <div className="owner-card-heading"><div><span className="studio-label">إدارة الرسائل</span><h2>الترحيب والقوالب المجدولة</h2></div><div className="owner-item-toolbar"><button type="button" className="owner-add" disabled={disabled} onClick={() => add()}>إضافة قالب</button><button type="button" className="owner-add" disabled={disabled} onClick={() => add(true)}>إضافة قالب الجمعة</button></div></div>
    <p className="owner-welcome-help">احفظ التعديلات من الشريط العلوي ثم «ترحيل التعديلات» لاعتمادها للزوار. جميع القوالب محفوظة في قاعدة البيانات ضمن النسخ الاحتياطية الحالية، ولا يتغير الموقع العام بمجرد التحرير.</p>
    <fieldset disabled={disabled} className="owner-welcome-settings"><label className="owner-welcome-toggle"><input type="checkbox" checked={value.enabled} onChange={e => onChange({ ...value, enabled: e.target.checked })} /> تفعيل الرسالة الترحيبية</label><p>تظهر مرة واحدة لكل جلسة تصفح. القوالب المجدولة لها أولوية على العامة؛ عند التداخل يُعرض أول قالب مجدول مناسب حسب ترتيب القائمة. جميع المواعيد بتوقيت اليمن (UTC+3)، ولا تُحسب الأعياد تلقائيًا؛ حدد فترة العيد الذي تريده.</p>
      <div className="owner-welcome-simulator"><label><span>وقت اختبار الجدولة — توقيت اليمن</span><input type="datetime-local" value={previewAt} onChange={e => setPreviewAt(e.target.value)} /></label><div><strong>{selected ? `القالب المناسب: ${selected.name}` : "لن تظهر رسالة في هذا الموعد"}</strong><button type="button" className="owner-add" onClick={() => showPreview(selected)}>معاينة الجدولة</button></div></div>
    </fieldset>
    {!validation.success && <p className="owner-save-error" role="alert">{validation.error.issues[0]?.message}</p>}
    {!value.templates.length && <p>لا توجد قوالب. أضف قالبًا لتفعيل الترحيب.</p>}
    <div className="owner-welcome-list">{value.templates.map((template, index) => <details key={template.id} className="owner-welcome-card" open={value.templates.length === 1 ? true : undefined} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragged !== null) move(dragged, index); setDragged(null); }}>
      <summary draggable={!disabled} onDragStart={e => { setDragged(index); e.dataTransfer.setData("text/plain", template.id); }} onDragEnd={() => setDragged(null)}><span className="owner-welcome-number">{index + 1}</span><strong>{template.name || "قالب بلا اسم"}</strong><small>{template.enabled ? template.schedule.kind === "always" ? "ترحيب عام" : "مجدول" : "مخفي"}</small></summary>
      <fieldset disabled={disabled} className="owner-welcome-fields"><div className="owner-item-toolbar"><button type="button" disabled={disabled || index === 0} aria-label={`رفع ${template.name}`} onClick={() => move(index, index - 1)}>↑ تقديم</button><button type="button" disabled={disabled || index === value.templates.length - 1} aria-label={`تأخير ${template.name}`} onClick={() => move(index, index + 1)}>↓ تأخير</button><button type="button" onClick={() => showPreview(template)}>معاينة القالب</button><button type="button" className="owner-delete" onClick={() => { if (window.confirm(`حذف قالب «${template.name}»؟ تبقى النسخة السابقة في النسخ الاحتياطية.`)) onChange({ ...value, templates: value.templates.filter(t => t.id !== template.id) }); }}>حذف القالب</button></div>
        <div className="owner-welcome-grid"><label><span>اسم القالب في اللوحة</span><input value={template.name} maxLength={100} onChange={e => patch(template.id, { name: e.target.value })} /></label><label className="owner-welcome-toggle"><input type="checkbox" checked={template.enabled} onChange={e => patch(template.id, { enabled: e.target.checked })} /> إظهار هذا القالب</label><label><span>عنوان الرسالة</span><input value={template.title} maxLength={200} onChange={e => patch(template.id, { title: e.target.value })} /></label><label><span>سطر تمهيدي (اختياري)</span><input value={template.intro} maxLength={500} onChange={e => patch(template.id, { intro: e.target.value })} /></label><label className="owner-welcome-wide"><span>نص الرسالة</span><textarea value={template.body} maxLength={10000} rows={4} onChange={e => patch(template.id, { body: e.target.value })} /></label><label><span>اسم الزر</span><input value={template.buttonLabel} maxLength={80} onChange={e => patch(template.id, { buttonLabel: e.target.value })} /></label><label><span>رابط الزر (اختياري؛ فارغ يعني إغلاق الرسالة)</span><input dir="ltr" value={template.buttonUrl} placeholder="/creative-space أو https://…" onChange={e => patch(template.id, { buttonUrl: e.target.value })} /></label><label><span>صورة القالب (اختيارية)</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => void image(e.target.files?.[0], template.id)} /></label><label><span>أو رابط الصورة (اختياري)</span><input dir="ltr" value={template.image.startsWith("data:") ? "" : template.image} onChange={e => patch(template.id, { image: e.target.value })} /></label>{template.image && <div className="owner-welcome-image"><img src={template.image} alt={`معاينة ${template.name}`} loading="lazy" /><button type="button" onClick={() => patch(template.id, { image: "" })}>إزالة الصورة</button></div>}
          <div className="owner-welcome-colors owner-welcome-wide">{([['backgroundColor', 'الخلفية'], ['textColor', 'النص'], ['accentColor', 'العنوان والزر']] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type="color" value={template[key]} onChange={e => patch(template.id, { [key]: e.target.value })} /></label>)}</div>
          <label className="owner-welcome-wide"><span>نوع الجدولة</span><select value={template.schedule.kind} onChange={e => patch(template.id, { schedule: e.target.value === "always" ? { kind: "always" } : e.target.value === "weekdays" ? { kind: "weekdays", days: [5], startTime: "00:00", endTime: "23:59" } : { kind: "range", startAt: Date.now(), endAt: Date.now() + 86400000 } })}><option value="always">عام — يظهر عند عدم وجود قالب مجدول مناسب</option><option value="weekdays">أيام أسبوع محددة (مثل الجمعة)</option><option value="range">فترة من تاريخ ووقت إلى تاريخ ووقت (مثل الأعياد)</option></select></label>
          {template.schedule.kind === "weekdays" && <><div className="owner-welcome-days owner-welcome-wide" role="group" aria-label="أيام العرض">{WEEKDAY_NAMES.map((day, number) => <label key={day}><input type="checkbox" checked={template.schedule.kind === "weekdays" && template.schedule.days.includes(number)} onChange={e => { const s = template.schedule; if (s.kind === "weekdays") patch(template.id, { schedule: { ...s, days: e.target.checked ? [...s.days, number] : s.days.filter(d => d !== number) } }); }} />{day}</label>)}</div><label><span>من الساعة — توقيت اليمن</span><input type="time" value={template.schedule.startTime} onChange={e => { const s = template.schedule; if (s.kind === "weekdays") patch(template.id, { schedule: { ...s, startTime: e.target.value } }); }} /></label><label><span>إلى الساعة — توقيت اليمن</span><input type="time" value={template.schedule.endTime} onChange={e => { const s = template.schedule; if (s.kind === "weekdays") patch(template.id, { schedule: { ...s, endTime: e.target.value } }); }} /></label></>}
          {template.schedule.kind === "range" && <><label><span>بداية الفترة — توقيت اليمن</span><input type="datetime-local" value={Number.isFinite(template.schedule.startAt) ? toYemenInput(template.schedule.startAt) : ""} onChange={e => { const s = template.schedule; if (s.kind === "range") patch(template.id, { schedule: { ...s, startAt: fromYemenInput(e.target.value) } }); }} /></label><label><span>نهاية الفترة — توقيت اليمن</span><input aria-label="نهاية الفترة — توقيت اليمن" type="datetime-local" value={Number.isFinite(template.schedule.endAt) ? toYemenInput(template.schedule.endAt) : ""} onChange={e => { const s = template.schedule; if (s.kind === "range") patch(template.id, { schedule: { ...s, endAt: fromYemenInput(e.target.value) + 59999 } }); }} /><small>إذا أردت نهاية اليوم، اختر 23:59. تشمل النهاية الدقيقة المحددة.</small></label></>}
        </div>
      </fieldset>
    </details>)}</div>
    {preview && <WelcomeDialog template={preview} open onClose={() => setPreview(null)} preview />}
  </section>;
}
