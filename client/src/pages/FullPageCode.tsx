import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Download, Play } from "lucide-react";
import type { CustomCode, EditablePage } from "@/lib/siteContent";
import FileDownloadCard from "./FileDownloadCard";
import "./fullPageCode.css";

export const PAGE_CODE_BRIDGE = "abu-kayan-page-bridge-v1";
const MAX_MESSAGE_TEXT = 2048;
const MAX_FRAME_HEIGHT = 100_000;

type SectionLink = { id: string; label: string };
type BridgeMessage = {
  protocol?: unknown;
  type?: unknown;
  height?: unknown;
  url?: unknown;
  name?: unknown;
  id?: unknown;
};

export type FullPageCodeProps = {
  page: EditablePage;
  code?: CustomCode;
  mode?: "preview" | "live";
  showHidden?: boolean;
  sectionLinks?: SectionLink[];
  onNavigate?: (url: string) => void;
  onDownload?: (url: string, name?: string) => void;
};

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape only wrapper terminators; JS strings retain their original runtime value. */
export function escapeScriptEndTags(value: string) {
  return value.replace(/<\/script/gi, "<\\/script");
}

function escapeStyleEndTags(value: string) {
  return value.replace(/<\/style/gi, "<\\/style");
}

function currentOrigin() {
  return typeof window === "undefined" ? "https://example.invalid" : window.location.origin;
}

function safeOrigin(origin: string) {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : "https://example.invalid";
  } catch {
    return "https://example.invalid";
  }
}

function makeSecurityHead(origin: string, css: string) {
  // A trailing slash grants the descendants of this route, not just the exact path.
  const apiMedia = `${origin}/api/page-media/`;
  const policy = [
    "default-src 'none'",
    `base-uri ${origin}`,
    "object-src 'none'",
    "child-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "form-action 'none'",
    "navigate-to 'none'",
    "connect-src 'none'",
    "script-src 'unsafe-inline'",
    `style-src 'unsafe-inline' https: ${apiMedia}`,
    `img-src https: data: blob: ${apiMedia}`,
    `media-src https: data: blob: ${apiMedia}`,
    `font-src https: data: ${apiMedia}`,
  ].join("; ");
  const baseHref = escapeAttribute(origin + "/");
  return `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}"><base href="${baseHref}"><style data-page-code-style>html,body{margin:0;min-height:0;font-family:Arial,sans-serif}img,video{max-width:100%;height:auto}button,input,textarea,select{font:inherit}${escapeStyleEndTags(css)}</style>`;
}

function makeBridgeScript(origin: string) {
  const encodedOrigin = JSON.stringify(origin).replace(/<\/script/gi, "<\\/script");
  return `
<script data-page-code-bridge>
(function(){
  "use strict";
  var PROTOCOL=${JSON.stringify(PAGE_CODE_BRIDGE)}, BASE=${encodedOrigin} + "/", MAX=${MAX_MESSAGE_TEXT};
  function send(message){
    try { var payload=JSON.stringify(message); if(payload.length<=MAX) window.parent.postMessage(Object.assign({protocol:PROTOCOL}, message), "*"); } catch (_) {}
  }
  function bounded(value){ return typeof value === "string" && value.length > 0 && value.length <= MAX; }
  function asUrl(raw){ try { return new URL(raw, BASE); } catch (_) { return null; } }
  function allowedUrl(url){ return !!url && (url.protocol === "https:" || (url.origin === BASE.slice(0,-1) && url.protocol === "http:")); }
  document.addEventListener("click", function(event){
    var node=event.target;
    var anchor=node && node.closest ? node.closest("a") : null;
    if(!anchor) return;
    var rawDownload=anchor.getAttribute("data-download-url") || (anchor.hasAttribute("download") ? anchor.getAttribute("href") : "");
    if(rawDownload){
      var download=asUrl(rawDownload);
      if(download && allowedUrl(download) && (download.origin === BASE.slice(0,-1) ? download.pathname.indexOf("/api/page-media") === 0 : download.protocol === "https:")){
        event.preventDefault(); send({type:"download",url:download.href,name:anchor.getAttribute("download") || ""});
      } else { event.preventDefault(); }
      return;
    }
    var raw=anchor.getAttribute("href");
    if(!raw || raw.charAt(0)==="#") return;
    var url=asUrl(raw);
    if(!url || !allowedUrl(url)) { event.preventDefault(); return; }
    event.preventDefault();
    if(url.origin === BASE.slice(0,-1)) {
      var path=url.pathname + url.search + url.hash;
      if(path.charAt(0)==="/" && bounded(path)) send({type:"navigate",url:path});
    } else if(url.protocol === "https:" && bounded(url.href)) {
      send({type:"navigate",url:url.href});
    }
  }, true);
  window.addEventListener("message", function(event){
    var data=event.data;
    if(!data || data.protocol !== PROTOCOL || data.type !== "scroll" || !bounded(data.id) || !/^[A-Za-z][A-Za-z0-9_:-]{0,120}$/.test(data.id)) return;
    var target=document.getElementById(data.id); if(target) target.scrollIntoView({behavior:"smooth",block:"start"});
  });
  function report(){
    var root=document.documentElement, body=document.body;
    var height=Math.ceil(Math.max(body ? body.scrollHeight : 0, body ? body.offsetHeight : 0, 1));
    if(height > 0 && height <= ${MAX_FRAME_HEIGHT}) send({type:"resize",height:height});
  }
  if(window.ResizeObserver){ var observer=new ResizeObserver(report); observer.observe(document.documentElement); if(document.body) observer.observe(document.body); }
  window.addEventListener("load", report); window.addEventListener("resize", report); setTimeout(report,0); setTimeout(report,250);
})();
</script>`;
}

function injectIntoFullDocument(html: string, injection: string, bridge: string) {
  let result = html;
  const head = html.match(/<head\b[^>]*>/i);
  if (head && head.index !== undefined) {
    const position = head.index + head[0].length;
    result = `${html.slice(0, position)}${injection}${html.slice(position)}`;
  } else {
    const htmlTag = html.match(/<html\b[^>]*>/i);
    if (htmlTag && htmlTag.index !== undefined) {
      const position = htmlTag.index + htmlTag[0].length;
      result = `${html.slice(0, position)}<head>${injection}</head>${html.slice(position)}`;
    } else {
      result = `<!doctype html><html lang="ar" dir="rtl"><head>${injection}</head><body>${html}</body></html>`;
    }
  }
  if (/<\/body\s*>/i.test(result)) return result.replace(/<\/body\s*>/i, `${bridge}</body>`);
  if (/<\/html\s*>/i.test(result)) return result.replace(/<\/html\s*>/i, `${bridge}</html>`);
  return `${result}${bridge}`;
}

export function buildFullPageCodeDocument(code: Pick<CustomCode, "html" | "css" | "js">, origin = currentOrigin()) {
  const trustedOrigin = safeOrigin(origin);
  const injection = makeSecurityHead(trustedOrigin, code.css || "");
  const bridge = makeBridgeScript(trustedOrigin);
  const html = code.html || "";
  const hasDocument = /<!doctype\s+html|<html\b/i.test(html);
  const script = code.js?.trim() ? `<script data-page-code-user>${escapeScriptEndTags(code.js)}</script>` : "";
  const fullBridge = `${script}${bridge}`;
  if (hasDocument) return injectIntoFullDocument(html, injection, fullBridge);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${injection}</head><body>${html}${fullBridge}</body></html>`;
}

function isInternalPath(value: string) {
  return /^\/(?!\/)/.test(value) && value.length <= MAX_MESSAGE_TEXT;
}

export function isTrustedFullPageCodeMessage(event: MessageEvent<unknown>, frame: HTMLIFrameElement | null): event is MessageEvent<BridgeMessage> {
  if (!frame || event.source !== frame.contentWindow || !event.data || typeof event.data !== "object") return false;
  const message = event.data as BridgeMessage;
  return message.protocol === PAGE_CODE_BRIDGE && typeof message.type === "string";
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && value.length <= MAX_MESSAGE_TEXT;
  } catch {
    return false;
  }
}

export function FullPageCode({ page, code, mode = "live", sectionLinks = [], onNavigate, onDownload }: FullPageCodeProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [runToken, setRunToken] = useState(0);
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const hasCode = Boolean(code && (code.html.trim() || code.css.trim() || code.js.trim()));
  const isPreview = mode === "preview";
  const pageSections = sectionLinks.length ? sectionLinks : (page.navItems || []);
  const shouldRender = hasCode && (isPreview ? runToken > 0 : code?.enabled === true);
  const srcDoc = useMemo(() => (code && shouldRender ? buildFullPageCodeDocument(code) : ""), [code, shouldRender, runToken]);

  useEffect(() => {
    setFrameHeight(null);
  }, [srcDoc]);

  useEffect(() => {
    const listener = (event: MessageEvent<unknown>) => {
      if (!isTrustedFullPageCodeMessage(event, frameRef.current)) return;
      const message = event.data as BridgeMessage;
      if (message.type === "resize") {
        const height = typeof message.height === "number" && Number.isFinite(message.height) ? Math.round(message.height) : 0;
        if (height >= 1 && height <= MAX_FRAME_HEIGHT) setFrameHeight(height);
        return;
      }
      if (message.type === "navigate" && typeof message.url === "string" && message.url.length <= MAX_MESSAGE_TEXT) {
        if (isInternalPath(message.url)) {
          onNavigate?.(message.url);
          if (!onNavigate) {
            window.history.pushState({}, "", message.url);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        } else if (safeExternalUrl(message.url)) {
          onNavigate?.(message.url);
          if (!onNavigate) window.open(message.url, "_blank", "noopener,noreferrer");
        }
        return;
      }
      if (message.type === "download" && typeof message.url === "string" && message.url.length <= MAX_MESSAGE_TEXT) {
        try {
          const url = new URL(message.url, window.location.origin);
          const valid = url.origin === window.location.origin && url.pathname.startsWith("/api/page-media") || url.protocol === "https:";
          if (!valid) return;
          onDownload?.(url.href, typeof message.name === "string" ? message.name.slice(0, 160) : undefined);
          if (!onDownload) window.open(url.href, "_blank", "noopener,noreferrer");
        } catch {
          /* Ignore malformed bridge messages. */
        }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [onDownload, onNavigate]);

  const sendSectionLink = (id: string) => {
    if (!/^[A-Za-z][A-Za-z0-9_:-]{0,120}$/.test(id) || !frameRef.current?.contentWindow) return;
    frameRef.current.contentWindow.postMessage({ protocol: PAGE_CODE_BRIDGE, type: "scroll", id }, "*");
  };

  return (
    <div className="full-page-code" dir="rtl" data-page-slug={page.slug}>
      <header className="full-page-code-header">
        <span className="full-page-code-brand">أبو كيان الجنيد</span>
        <div className="full-page-code-header-end">
          {pageSections.length > 0 && <nav className="full-page-code-sections" aria-label="أقسام الصفحة">{pageSections.filter((item) => item.id && item.label).slice(0, 12).map((item) => <button key={item.id} type="button" onClick={() => sendSectionLink(item.id)}>{item.label}</button>)}</nav>}
          <span className="full-page-code-path">/custom/{page.slug}</span>
          <a className="full-page-code-back" href="/"><ArrowRight size={15} /> العودة للموقع</a>
        </div>
      </header>
      {!hasCode && <p className="full-page-code-notice">لا يوجد كود مخصص لهذه الصفحة بعد.</p>}
      {hasCode && !shouldRender && <div className="full-page-code-notice"><strong>{isPreview ? "المعاينة لا تشغّل الكود تلقائيًا." : "الكود المخصص غير مفعّل."}</strong><span>يعمل الكود داخل إطار معزول فقط بعد التفعيل في الموقع أو الضغط على التشغيل في المعاينة. لا يملك الكود وصولًا إلى الموقع أو واجهات API.</span>{isPreview && <button type="button" onClick={() => setRunToken((token) => token + 1)}><Play size={15} /> تشغيل المعاينة</button>}</div>}
      {shouldRender && <iframe ref={frameRef} key={runToken} title={`الكود المخصص · ${page.title}`} className="full-page-code-frame" sandbox="allow-scripts" srcDoc={srcDoc} referrerPolicy="no-referrer" style={frameHeight ? { height: `${Math.max(frameHeight, 1)}px` } : undefined} />}
      {page.showDownloads !== false && (page.media || []).length > 0 && <section className="full-page-code-downloads" aria-label="ملفات الصفحة"><div className="full-page-code-downloads-heading"><div><span>ملفات الصفحة</span><h2>تنزيلات ومواد مرفقة</h2></div><Download size={18} /></div><div className="full-page-code-download-grid">{(page.media || []).map((media) => <FileDownloadCard key={media.id} media={media} />)}</div></section>}
      <footer className="full-page-code-footer"><span>أبو كيان الجنيد · {page.footerText || "للإبداع والحلول الرقمية"}</span><a href="/">العودة إلى الموقع</a></footer>
    </div>
  );
}

export default FullPageCode;
