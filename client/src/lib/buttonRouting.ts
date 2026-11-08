import type { EditableButton } from "./siteContent";

export const existingDestinations = [
  { url: "/", label: "الصفحة الرئيسية" },
  { url: "/templates/gemini", label: "تصاميم عبر Gemini وChatGPT" },
  { url: "/templates/chat-gbt", label: "تصاميم الأطفال" },
  { url: "/free-sites", label: "المواقع والخدمات المجانية" },
  { url: "/creative-space", label: "مساحتك الإبداعية" },
] as const;
export function isSafeDestination(url: string) {
  const value = url.trim();
  if (!value || /[\u0000-\u0020\\]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  if (/^#[\w-]+$/.test(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
export function buttonDestination(
  button: EditableButton
): { url: string; target: "_self" | "_blank" } | null {
  const routes: Record<string, string> = {
    gemini: "/templates/gemini",
    "chat-gbt": "/templates/chat-gbt",
    "free-sites": "/free-sites",
    "creative-space": "/creative-space",
    services: "#services",
    work: "#work",
    contact: "#contact",
  };
  const url =
    (["custom-page", "external", "internal"].includes(button.action)
      ? button.url
      : routes[button.action]
    )?.trim() || "";
  if (!isSafeDestination(url)) return null;
  return {
    url,
    target:
      button.target || (button.action === "external" ? "_blank" : "_self"),
  };
}
