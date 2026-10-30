import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Globe2, ImageOff, Moon, Sun } from "lucide-react";
import React from "react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";

export default function FreeSites() {
  const { theme, toggleTheme } = useTheme();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const sitesQuery = trpc.freeSites.list.useQuery(undefined, { staleTime: 30_000 });
  const sites = sitesQuery.data || [];

  const copyUrl = async (id: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success("تم نسخ الرابط.");
      window.setTimeout(() => setCopiedId((current) => current === id ? null : current), 1600);
    } catch {
      toast.error("تعذر نسخ الرابط من هذا المتصفح.");
    }
  };

  return (
    <main dir="rtl" className="free-sites-page">
      <header className="free-sites-header">
        <Link href="/" className="free-sites-back"><ArrowRight size={15} /> العودة للموقع</Link>
        <Link href="/" className="free-sites-brand"><Globe2 size={17} /> أبو كيان الجنيد</Link>
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}>{theme === "light" ? <Moon size={15} /> : <Sun size={15} />}</button>
      </header>

      <section className="free-sites-hero">
        <span className="studio-label"><span className="free-sites-dot" /> دليل مختار</span>
        <h1>مواقع وخدمات<br /><em>مجانية مختارة.</em></h1>
        <p>أدوات ومواقع عملية اخترناها لتساعدك في التصميم، الإنتاج، التسويق، والعمل اليومي دون تعقيد.</p>
        <div className="free-sites-steps"><span><b>01</b> اكتشف</span><i /><span><b>02</b> اقرأ الفائدة</span><i /><span><b>03</b> افتح الرابط</span></div>
      </section>

      <section className="free-sites-library" aria-live="polite">
        {sitesQuery.isLoading && <div className="free-sites-empty"><Globe2 size={26} /><p>جارٍ تحميل الدليل...</p></div>}
        {!sitesQuery.isLoading && sites.length === 0 && <div className="free-sites-empty"><ImageOff size={26} /><p>سيظهر هنا أول موقع مجاني يتم اختياره وإضافته من لوحة المالك.</p></div>}
        {sites.map((site) => (
          <article className="free-site-card" key={site.id}>
            {site.imageUrl && <div className="free-site-media"><img src={site.imageUrl} alt={`لقطة ${site.name}`} loading="lazy" /></div>}
            <div className="free-site-content">
              <div className="free-site-heading"><span className="free-site-index">{String(site.sortOrder + 1).padStart(2, "0")}</span><h2>{site.name}</h2></div>
              {site.description && <p className="free-site-description">{site.description}</p>}
              {site.additionalText && <p className="free-site-extra">{site.additionalText}</p>}
              {site.url && <div className="free-site-actions"><a className="free-site-open" href={site.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> فتح الموقع <ArrowLeft size={15} /></a><button type="button" className="free-site-copy" onClick={() => copyUrl(site.id, site.url || "")}>{copiedId === site.id ? <Check size={15} /> : <Copy size={15} />} {copiedId === site.id ? "تم النسخ" : "نسخ الرابط"}</button></div>}
            </div>
          </article>
        ))}
      </section>

      <footer className="free-sites-footer"><span>أبو كيان الجنيد</span><span>اختيارات عملية · اليمن / أونلاين</span><Link href="/"><ArrowLeft size={15} /> الصفحة الرئيسية</Link></footer>
    </main>
  );
}
