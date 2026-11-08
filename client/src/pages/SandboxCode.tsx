import React, { useMemo, useState } from "react";
import "./sandboxCode.css";

export type SandboxCodeValue = { html: string; css: string; js: string; enabled: boolean };
export type SandboxCodeMode = "preview" | "live" | "test";

export function buildSandboxDocument(code: Pick<SandboxCodeValue, "html" | "css" | "js">, executeScript: boolean) {
  const html = code.html.replace(/<\/script/gi, "<\\/script");
  const css = code.css.replace(/<\/style/gi, "<\\/style");
  const script = executeScript ? `<script>${code.js.replace(/<\/script/gi, "<\\/script")}</script>` : "";
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob:; style-src 'unsafe-inline' https:; script-src 'unsafe-inline'; font-src https: data:; connect-src 'none'; frame-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';"><style>html,body{margin:0;min-height:100%;font-family:Arial,sans-serif}img{max-width:100%;height:auto}button,input,textarea,select{font:inherit}${css}</style></head><body>${html}${script}</body></html>`;
}

export function SandboxCode({ code, mode = "preview", title = "الكود المخصص", className = "" }: { code?: SandboxCodeValue; mode?: SandboxCodeMode; title?: string; className?: string }) {
  const [runToken, setRunToken] = useState(0);
  const hasCode = Boolean(code && (code.html.trim() || code.css.trim() || code.js.trim()));
  const executeScript = mode === "live" ? code?.enabled === true : runToken > 0;
  const srcDoc = useMemo(() => code ? buildSandboxDocument(code, executeScript) : "", [code, executeScript]);
  if (!code || !hasCode) return null;

  return (
    <section className={`sandbox-code ${className}`} aria-label={title}>
      <div className="sandbox-code-heading">
        <div><span className="sandbox-code-kicker">مساحة معزولة</span><strong>{title}</strong></div>
        {mode !== "live" && <button type="button" onClick={() => setRunToken((value) => value + 1)}>{runToken ? "تشغيل الكود مرة أخرى" : "تشغيل المعاينة"}</button>}
      </div>
      {mode !== "live" && !runToken && <p className="sandbox-code-note">لن يعمل JavaScript حتى تضغط زر التشغيل. لا يملك الإطار صلاحية الوصول إلى الموقع أو واجهات API.</p>}
      {(mode === "live" || runToken > 0) && <iframe key={runToken} title={title} className="sandbox-code-frame" sandbox="allow-scripts" srcDoc={srcDoc} />}
    </section>
  );
}

export default SandboxCode;
