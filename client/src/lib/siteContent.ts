/*
  Design reminder — Shared content model:
  Keep editable content small, explicit, and Arabic-first so the owner panel remains calm and usable.
*/

export type EditableService = {
  number: string;
  title: string;
  description: string;
  tag: string;
};

export type SiteContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroAccent: string;
  heroEnding: string;
  heroLead: string;
  heroImage: string;
  primaryButton: string;
  secondaryButton: string;
  services: EditableService[];
};

export const SITE_CONTENT_KEY = "abu-kayan-site-content";

export const defaultSiteContent: SiteContent = {
  heroEyebrow: "استوديو أبو كيان / اليمن",
  heroTitle: "نخلي فكرتك",
  heroAccent: "تُرى",
  heroEnding: "قبل أن تتكلم.",
  heroLead: "نصمم حضورًا يليق بمناسبتك أو مشروعك؛ من صورة تهنئة تحفظ اللحظة، إلى إعلان يصل للشخص الصح، إلى صفحة هبوط تعرف كيف تقنع.",
  heroImage: "/manus-storage/abu-kayan-profile_85a5e4ec.jpg",
  primaryButton: "احكِ لنا عن فكرتك",
  secondaryButton: "شاهد الأعمال",
  services: [
    { number: "01", title: "تصاميم المناسبات", description: "بطاقات تهنئة للأعراس والتخرج والحفلات تُبنى حول اسمك، لونك، واللحظة التي تريد أن تبقى.", tag: "تصميم AI + إخراج بصري" },
    { number: "02", title: "الإعلانات الممولة", description: "حملة فيسبوك أوضح: رسالة مفهومة، جمهور أدق، ومحتوى يفتح باب التواصل بدل أن يمر مرورًا عابرًا.", tag: "استراتيجية + إدارة" },
    { number: "03", title: "المواقع وصفحات الهبوط", description: "نحوّل فكرتك إلى واجهة مرتبة، سريعة، ومتجاوبة تساعد العميل على فهمك واتخاذ الخطوة التالية.", tag: "ويب + تجربة مستخدم" },
  ],
};

export function loadSiteContent(): SiteContent {
  if (typeof window === "undefined") return defaultSiteContent;
  try {
    const raw = window.localStorage.getItem(SITE_CONTENT_KEY);
    if (!raw) return defaultSiteContent;
    const saved = JSON.parse(raw) as Partial<SiteContent>;
    return {
      ...defaultSiteContent,
      ...saved,
      services: Array.isArray(saved.services) && saved.services.length ? saved.services : defaultSiteContent.services,
    };
  } catch {
    return defaultSiteContent;
  }
}

export function saveSiteContent(content: SiteContent) {
  window.localStorage.setItem(SITE_CONTENT_KEY, JSON.stringify(content));
  window.dispatchEvent(new Event("abu-kayan-content-updated"));
}
