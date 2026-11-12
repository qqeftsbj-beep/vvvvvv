import { z } from "zod";

export const WELCOME_TIME_ZONE = "Asia/Aden";
export const WEEKDAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const safeUrl = (value: string) => value === "" || /^\/(?!\/)[^\s<>"']*$/.test(value) || /^https:\/\/[^\s<>"']+$/i.test(value);
const color = z.string().regex(/^#[0-9a-f]{6}$/i, "اختر لونًا صحيحًا.");
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "الوقت غير صحيح.");
export const welcomeScheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("always") }),
  z.object({ kind: z.literal("weekdays"), days: z.array(z.number().int().min(0).max(6)).min(1, "اختر يومًا واحدًا على الأقل.").max(7), startTime: time, endTime: time }).refine(s => s.startTime <= s.endTime, "وقت النهاية يجب أن يأتي بعد وقت البداية في اليوم نفسه."),
  z.object({ kind: z.literal("range"), startAt: z.number().int().min(0).max(8640000000000000), endAt: z.number().int().min(0).max(8640000000000000) }).refine(s => s.startAt <= s.endAt, "نهاية الفترة يجب ألا تسبق بدايتها."),
]);
export const welcomeTemplateSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1, "اكتب اسم القالب.").max(100), enabled: z.boolean(),
  title: z.string().trim().min(1, "اكتب عنوان الرسالة.").max(200), intro: z.string().max(500), body: z.string().trim().min(1, "اكتب نص الرسالة.").max(10000),
  image: z.string().max(3 * 1024 * 1024).refine(value => safeUrl(value) || /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i.test(value), "صورة القالب يجب أن تكون ملف صورة أو رابط HTTPS آمنًا."),
  buttonLabel: z.string().trim().min(1, "اكتب اسم الزر.").max(80), buttonUrl: z.string().max(2000).refine(safeUrl, "رابط الزر يجب أن يكون داخليًا أو HTTPS."),
  backgroundColor: color, textColor: color, accentColor: color, schedule: welcomeScheduleSchema,
});
export const welcomeConfigSchema = z.object({ enabled: z.boolean(), templates: z.array(welcomeTemplateSchema).max(100) }).refine(c => new Set(c.templates.map(t => t.id)).size === c.templates.length, "معرّفات القوالب مكررة.");
export type WelcomeTemplate = z.infer<typeof welcomeTemplateSchema>;
export type WelcomeConfig = z.infer<typeof welcomeConfigSchema>;
export const defaultWelcomeConfig: WelcomeConfig = { enabled: true, templates: [{
  id: "default-welcome", name: "الترحيب العام", enabled: true, title: "أهلًا بك في أبو كيان الجنيد", intro: "مساحتك للأفكار والتصاميم والإبداع.",
  body: "تصفّح التصاميم والأدوات المجانية، واكتشف مشاريع المبدعين وخدمات الاستوديو. يسعدنا وجودك معنا.", image: "", buttonLabel: "ابدأ التصفح", buttonUrl: "",
  backgroundColor: "#0d1d35", textColor: "#f7f3ea", accentColor: "#d9b86c", schedule: { kind: "always" },
}] };

/** Calendar conditions are evaluated on request, not by a background cron or browser clock. */
export function selectWelcomeTemplate(config: WelcomeConfig, now = Date.now()): WelcomeTemplate | null {
  if (!config.enabled) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: WELCOME_TIME_ZONE, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now));
  const part = (type: string) => parts.find(p => p.type === type)?.value || "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part("weekday"));
  const clock = `${part("hour")}:${part("minute")}`;
  const scheduled = config.templates.find(t => {
    if (!t.enabled || t.schedule.kind === "always") return false;
    const s = t.schedule;
    return s.kind === "range" ? now >= s.startAt && now <= s.endAt : s.days.includes(weekday) && clock >= s.startTime && clock <= s.endTime;
  });
  return scheduled || config.templates.find(t => t.enabled && t.schedule.kind === "always") || null;
}
export function welcomeConfigFrom(value: unknown): WelcomeConfig {
  const parsed = welcomeConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultWelcomeConfig;
}
/** datetime-local fields are Yemen civil time; persistence always uses UTC milliseconds. */
export function toYemenInput(value: number) { return new Date(value + 3 * 60 * 60 * 1000).toISOString().slice(0, 16); }
export function fromYemenInput(value: string) { return Date.parse(`${value}:00+03:00`); }
