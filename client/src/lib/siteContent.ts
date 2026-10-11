/*
  Shared editable site model for the owner control room.
  Every visual value is explicit so the preview can be changed without code edits.
*/

export type EditableService = {
  number: string;
  title: string;
  description: string;
  tag: string;
  image?: string;
};

export type EditableProduct = {
  id: string;
  title: string;
  description: string;
  price: string;
  image?: string;
};

export type EditableButton = {
  id: string;
  label: string;
  placement: "hero" | "services" | "contact" | "header";
  action: "contact" | "services" | "work" | "gemini" | "chat-gbt" | "external";
  url?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  fontSize?: number;
  radius?: number;
  order?: number;
};

export type SiteSettings = {
  fontFamily: "Cairo" | "Tajawal" | "Noto Kufi Arabic" | "system";
  headingFontFamily: "Cairo" | "Tajawal" | "Noto Kufi Arabic" | "system";
  baseFontSize: number;
  headingScale: number;
  fontWeight: number;
  lineHeight: number;
  sectionGap: number;
  buttonRadius: number;
  cardRadius: number;
  backgroundColor: string;
  panelColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  accentColor: string;
  goldColor: string;
  backgroundImage: string;
  templatePassword: string;
  recycleRetentionDays: 30 | 60 | 180 | 365;
  themeMode: "dark" | "light";
  customCss: string;
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
  products: EditableProduct[];
  buttons: EditableButton[];
  settings: SiteSettings;
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
  products: [],
  buttons: [],
  settings: {
    fontFamily: "Cairo",
    headingFontFamily: "Noto Kufi Arabic",
    baseFontSize: 16,
    headingScale: 1,
    fontWeight: 500,
    lineHeight: 1.7,
    sectionGap: 96,
    buttonRadius: 0,
    cardRadius: 0,
    backgroundColor: "#080b11",
    panelColor: "#111722",
    textColor: "#f7f3ea",
    mutedColor: "#9fa9b8",
    borderColor: "#343b48",
    accentColor: "#ca8467",
    goldColor: "#d5b36a",
    backgroundImage: "",
    templatePassword: "7705",
    recycleRetentionDays: 30,
    themeMode: "dark",
    customCss: "",
  },
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
      products: Array.isArray(saved.products) ? saved.products : defaultSiteContent.products,
      buttons: Array.isArray(saved.buttons) ? saved.buttons : defaultSiteContent.buttons,
      settings: { ...defaultSiteContent.settings, ...(saved.settings || {}) },
    };
  } catch {
    return defaultSiteContent;
  }
}

export function saveSiteContent(content: SiteContent) {
  window.localStorage.setItem(SITE_CONTENT_KEY, JSON.stringify(content));
  window.dispatchEvent(new Event("abu-kayan-content-updated"));
}
