import { ArrowRight, ArrowUpRight, ExternalLink, Sparkles } from "lucide-react";
import React from "react";
import { Link } from "wouter";
import type { EditablePage, EditablePageBlock, SiteContent } from "@/lib/siteContent";
import { isPublishedPage, isSafePageUrl } from "@/lib/siteContent";
import SandboxCode from "./SandboxCode";
import "./pageRenderer.css";

export type PageRendererMode = "preview" | "live";
export type PageRendererProps = {
  page: EditablePage;
  site?: Pick<SiteContent, "settings" | "customCode">;
  mode?: PageRendererMode;
  showHidden?: boolean;
  className?: string;
};

function pageCode(page: EditablePage, site: PageRendererProps["site"]) {
  if (page.customCode) return page.customCode;
  if (page.useLegacyCustomCode !== false) return site?.customCode;
  return undefined;
}

export function renderPageBlock(block: EditablePageBlock, mode: PageRendererMode = "live") {
  if (block.visible === false && mode === "live") return null;
  const key = block.id;
  if (block.type === "image" && block.image) {
    return <figure key={key} className="page-renderer-block page-renderer-image"><img src={block.image} alt={block.title || ""} loading="lazy" />{block.title && <figcaption>{block.title}</figcaption>}</figure>;
  }
  if (block.type === "button" && block.url && isSafePageUrl(block.url)) {
    const isInternal = block.url.startsWith("/");
    const label = block.title || (isInternal ? "فتح الصفحة" : "فتح الرابط");
    return isInternal ? <Link key={key} href={block.url} className="page-renderer-button">{label}<ArrowUpRight size={15} /></Link> : <a key={key} href={block.url} target="_blank" rel="noreferrer" className="page-renderer-button">{label}<ExternalLink size={15} /></a>;
  }
  if (block.type === "service") {
    return <article key={key} className="page-renderer-block page-renderer-service"><span className="page-renderer-label">خدمة</span>{block.title && <h3>{block.title}</h3>}{block.content && <p>{block.content}</p>}</article>;
  }
  if (block.title || block.content) {
    return <article key={key} className="page-renderer-block page-renderer-text">{block.title && <h3>{block.title}</h3>}{block.content && <p>{block.content}</p>}</article>;
  }
  return null;
}

export function PageRenderer({ page, site, mode = "live", showHidden = mode === "preview", className = "" }: PageRendererProps) {
  const appearance = page.appearance || {};
  const settings = site?.settings;
  const hidden = !isPublishedPage(page);
  const blocks = [...(page.blocks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const code = pageCode(page, site);
  const style = {
    "--page-bg": appearance.backgroundColor || settings?.backgroundColor || "#071426",
    "--page-panel": appearance.panelColor || settings?.panelColor || "#0d1d35",
    "--page-text": appearance.textColor || settings?.textColor || "#f7f3ea",
    "--page-muted": appearance.mutedColor || settings?.mutedColor || "#a9b7ca",
    "--page-accent": appearance.accentColor || settings?.accentColor || "#d9b86c",
    ...(appearance.backgroundImage ? { backgroundImage: `linear-gradient(rgba(7,20,38,.82),rgba(7,20,38,.92)),url(${JSON.stringify(appearance.backgroundImage)})` } : {}),
  } as React.CSSProperties;
  if (hidden && !showHidden) return null;

  return (
    <main dir="rtl" className={`page-renderer ${hidden ? "is-hidden" : ""} ${className}`} style={style} data-page-slug={page.slug}>
      {hidden && <div className="page-renderer-preview-badge">مسودة / مخفية — معاينة المالك فقط</div>}
      <header className="page-renderer-header"><span className="page-renderer-brand"><Sparkles size={16} /> أبو كيان الجنيد</span><div className="page-renderer-header-end"><span className="page-renderer-path">/custom/{page.slug}</span>{mode === "live" && <Link href="/" className="page-renderer-back"><ArrowRight size={15} /> العودة للموقع</Link>}</div></header>
      <section className="page-renderer-hero"><span className="page-renderer-label">{page.eyebrow}</span><h1>{page.title}</h1>{page.description && <p>{page.description}</p>}</section>
      <section className="page-renderer-content"><div className="page-renderer-card"><h2>{page.template === "directory" ? "دليل مرتب لاكتشاف الأفضل." : page.template === "showcase" ? "مساحة لعرض التفاصيل." : "صفحة جاهزة لفكرتك."}</h2><div className="page-renderer-block-list">{blocks.length ? blocks.map((block) => renderPageBlock(block, mode)) : <p className="page-renderer-empty">أضف نصوصًا وصورًا وأزرارًا من محرر الصفحة.</p>}</div></div></section>
      {code?.enabled && (code.html.trim() || code.css.trim() || code.js.trim()) && <SandboxCode code={code} mode={mode === "live" ? "live" : "preview"} title={`الكود المخصص · ${page.title}`} />}
    </main>
  );
}

export default PageRenderer;
