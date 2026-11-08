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
  action: "contact" | "services" | "work" | "gemini" | "chat-gbt" | "free-sites" | "creative-space" | "custom-page" | "internal" | "external";
  target?: "_self" | "_blank";
  size?: "small" | "medium" | "large";
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

export type PageAppearance = {
  backgroundColor?: string;
  panelColor?: string;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
  backgroundImage?: string;
};

export type EditablePage = {
  id: string;
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  template: "directory" | "showcase" | "landing";
  visible: boolean;
  /** Pages without a status are legacy published pages. */
  status?: "draft" | "published";
  appearance?: PageAppearance;
  /** A page can own its code, independent from the legacy site-level code. */
  customCode?: CustomCode;
  /** New pages set this false; omitted means preserve legacy site customCode behavior. */
  useLegacyCustomCode?: boolean;
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

const PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_HTTPS_PATTERN = /^https:\/\/[^\s]+$/i;

export type SitePageValidationError = { index: number; field: "id" | "slug"; message: string };
export type SitePageValidation = {
  valid: boolean;
  errors: SitePageValidationError[];
  bySlug: Record<string, number>;
};

export function slugifyPageTitle(value: string, fallback = "page") {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || fallback;
}

export function validatePageSlug(slug: string, pages: EditablePage[] = [], pageId?: string) {
  const candidate = slug.trim();
  if (!candidate) return "اكتب مسار الصفحة.";
  if (candidate.length > 80) return "مسار الصفحة يجب ألا يتجاوز 80 حرفًا.";
  if (!PAGE_SLUG_PATTERN.test(candidate)) return "استخدم حروفًا إنجليزية صغيرة وأرقامًا وفواصل شرطية فقط.";
  if (pages.some((page) => page.id !== pageId && page.slug.toLowerCase() === candidate.toLowerCase())) return "هذا المسار مستخدم في صفحة أخرى.";
  return null;
}

export function validateSitePages(pages: EditablePage[]): SitePageValidation {
  const errors: SitePageValidationError[] = [];
  const bySlug: Record<string, number> = {};
  const byId: Record<string, number> = {};
  pages.forEach((page, index) => {
    if (!page.id.trim()) errors.push({ index, field: "id", message: "كل صفحة تحتاج معرّفًا." });
    else if (byId[page.id] !== undefined) errors.push({ index, field: "id", message: "معرّف الصفحة مكرر." });
    else byId[page.id] = index;
    const slugError = validatePageSlug(page.slug, pages, page.id);
    if (slugError) errors.push({ index, field: "slug", message: slugError });
    const normalizedSlug = page.slug.trim().toLowerCase();
    if (normalizedSlug) bySlug[normalizedSlug] = index;
  });
  return { valid: errors.length === 0, errors, bySlug };
}

export function isSafePageUrl(value: string | undefined | null): value is string {
  if (!value) return false;
  const url = value.trim();
  const hasMarkup = ["<", ">", '"', "'"].some((character) => url.includes(character));
  if (url.startsWith("/") && !url.startsWith("//") && !hasMarkup) return true;
  return SAFE_HTTPS_PATTERN.test(url) && !hasMarkup;
}

export function isPublishedPage(page: EditablePage) {
  return page.visible !== false && page.status !== "draft";
}

/** Rename a page and update managed internal button/block links without touching external URLs. */
export function updatePageSlugInSiteContent(content: SiteContent, pageId: string, nextSlug: string): SiteContent {
  const page = content.pages.find((item) => item.id === pageId);
  if (!page) return content;
  const oldUrl = `/custom/${page.slug}`;
  const newUrl = `/custom/${nextSlug}`;
  return {
    ...content,
    pages: content.pages.map((item) => item.id === pageId ? { ...item, slug: nextSlug } : item),
    buttons: content.buttons.map((button) => button.url === oldUrl ? { ...button, url: newUrl } : button),
  };
}

export function updatePageSlugReferences(content: SiteContent, previousSlug: string, nextSlug: string): SiteContent {
  const oldUrl = `/custom/${previousSlug}`;
  const newUrl = `/custom/${nextSlug}`;
  return {
    ...content,
    buttons: content.buttons.map((button) => button.url === oldUrl ? { ...button, url: newUrl } : button),
    pages: content.pages.map((page) => ({
      ...page,
      blocks: page.blocks?.map((block) => block.url === oldUrl ? { ...block, url: newUrl } : block),
    })),
  };
}

export function normalizeSiteContent(value: unknown): SiteContent {
  const saved = (value && typeof value === "object" ? value : {}) as Partial<SiteContent>;
  const legacyButtons = saved.buttonCatalogInitialized !== true;
  const savedButtons = Array.isArray(saved.buttons) ? saved.buttons : [];
  const migratedButtons = legacyButtons ? [...defaultSiteContent.buttons, ...savedButtons.filter((button) => !defaultSiteContent.buttons.some((base) => base.id === button.id))] : savedButtons;
  const savedCode = saved.customCode && typeof saved.customCode === "object" ? saved.customCode as Partial<CustomCode> : {};
  return {
    ...defaultSiteContent,
    ...saved,
    services: Array.isArray(saved.services) && saved.services.length ? saved.services : defaultSiteContent.services,
    products: Array.isArray(saved.products) ? saved.products : defaultSiteContent.products,
    buttons: migratedButtons,
    pages: Array.isArray(saved.pages) ? saved.pages : defaultSiteContent.pages,
    settings: { ...defaultSiteContent.settings, ...(saved.settings || {}) },
    // Spread the saved object so optional/future code metadata is not discarded.
    customCode: { ...defaultSiteContent.customCode, ...savedCode, html: typeof savedCode.html === "string" ? savedCode.html : "", css: typeof savedCode.css === "string" ? savedCode.css : "", js: typeof savedCode.js === "string" ? savedCode.js : "", enabled: savedCode.enabled === true },
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
