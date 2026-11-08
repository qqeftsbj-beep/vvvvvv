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
  visible?: boolean;
  order?: number;
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
  action: "contact" | "services" | "work" | "gemini" | "chat-gbt" | "free-sites" | "creative-space" | "custom-page" | "external";
  visible?: boolean;
  url?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  fontSize?: number;
  radius?: number;
  icon?: "sparkles" | "globe" | "arrow" | "message";
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
};

export type EditablePage = {
  id: string;
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  template: "directory" | "showcase" | "landing";
  visible: boolean;
  blocks?: EditablePageBlock[];
};

export type EditablePageBlock = {
  id: string;
  type: "text" | "image" | "button" | "service";
  title?: string;
  content?: string;
  image?: string;
  url?: string;
  visible?: boolean;
  order?: number;
};

export type CustomCode = { html: string; css: string; js: string; enabled: boolean };

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
  pages: EditablePage[];
  settings: SiteSettings;
  customCode?: CustomCode;
  buttonCatalogInitialized?: boolean;
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
    { number: "01", order: 1, visible: true, title: "تصاميم المناسبات", description: "بطاقات تهنئة للأعراس والتخرج والحفلات تُبنى حول اسمك، لونك، واللحظة التي تريد أن تبقى.", tag: "تصميم AI + إخراج بصري" },
    { number: "02", order: 2, visible: true, title: "الإعلانات الممولة", description: "حملة فيسبوك أوضح: رسالة مفهومة، جمهور أدق، ومحتوى يفتح باب التواصل بدل أن يمر مرورًا عابرًا.", tag: "استراتيجية + إدارة" },
    { number: "03", order: 3, visible: true, title: "المواقع وصفحات الهبوط", description: "نحوّل فكرتك إلى واجهة مرتبة، سريعة، ومتجاوبة تساعد العميل على فهمك واتخاذ الخطوة التالية.", tag: "ويب + تجربة مستخدم" },
  ],
  products: [],
  buttons: [
    { id: "hero-gemini", label: "تصاميم عبر Gemini وChatGPT", placement: "hero", action: "gemini", icon: "sparkles", visible: true, order: 1 },
    { id: "hero-chat", label: "تصاميم الأطفال", placement: "hero", action: "chat-gbt", icon: "sparkles", visible: true, order: 2 },
    { id: "hero-free-sites", label: "مواقع وخدمات مجانية مختارة", placement: "hero", action: "free-sites", icon: "globe", visible: true, order: 3 },
    { id: "hero-creative-space", label: "مساحتك للإبداع", placement: "hero", action: "creative-space", icon: "sparkles", visible: true, order: 4 },
  ],
  pages: [],
  customCode: { html: "", css: "", js: "", enabled: false },
  buttonCatalogInitialized: true,
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
    backgroundColor: "#071426",
    panelColor: "#0d1d35",
    textColor: "#f7f3ea",
    mutedColor: "#a9b7ca",
    borderColor: "#294366",
    accentColor: "#3d83e6",
    goldColor: "#d9b86c",
    backgroundImage: "",
    templatePassword: "7705",
    recycleRetentionDays: 30,
    themeMode: "dark",
  },
};

export function normalizeSiteContent(value: unknown): SiteContent {
  const saved = (value && typeof value === "object" ? value : {}) as Partial<SiteContent>;
  const legacyButtons = saved.buttonCatalogInitialized !== true;
  const savedButtons = Array.isArray(saved.buttons) ? saved.buttons : [];
  const migratedButtons = legacyButtons ? [...defaultSiteContent.buttons, ...savedButtons.filter((button) => !defaultSiteContent.buttons.some((base) => base.id === button.id))] : savedButtons;
  return {
    ...defaultSiteContent,
    ...saved,
    services: Array.isArray(saved.services) && saved.services.length ? saved.services : defaultSiteContent.services,
    products: Array.isArray(saved.products) ? saved.products : defaultSiteContent.products,
    buttons: migratedButtons,
    pages: Array.isArray(saved.pages) ? saved.pages : defaultSiteContent.pages,
    settings: { ...defaultSiteContent.settings, ...(saved.settings || {}) },
    customCode: { html: saved.customCode?.html || defaultSiteContent.customCode?.html || "", css: saved.customCode?.css || defaultSiteContent.customCode?.css || "", js: saved.customCode?.js || defaultSiteContent.customCode?.js || "", enabled: saved.customCode?.enabled === true },
    buttonCatalogInitialized: true,
  };
}

export function loadSiteContent(): SiteContent {
  if (typeof window === "undefined") return defaultSiteContent;
  try {
    const raw = window.localStorage.getItem(SITE_CONTENT_KEY);
    return raw ? normalizeSiteContent(JSON.parse(raw)) : defaultSiteContent;
  } catch {
    return defaultSiteContent;
  }
}

export function saveSiteContent(content: SiteContent) {
  window.localStorage.setItem(SITE_CONTENT_KEY, JSON.stringify(content));
  window.dispatchEvent(new Event("abu-kayan-content-updated"));
}
