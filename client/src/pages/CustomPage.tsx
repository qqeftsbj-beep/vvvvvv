import { ArrowRight, ExternalLink, Image as ImageIcon, Sparkles } from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeSiteContent } from "@/lib/siteContent";

function safeCodeDocument(code: { html: string; css: string; js: string }) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;font-family:Arial,sans-serif;color:#f7f3ea;background:#071426;padding:24px}img{max-width:100%;height:auto}${code.css}</style></head><body>${code.html}<script>${code.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}

function PageBlock({ block }: { block: NonNullable<ReturnType<typeof normalizeSiteContent>["pages"]>[number]["blocks"] extends infer Blocks ? Blocks extends Array<infer Block> ? Block : never : never }) {
  if (block.visible === false) return null;
  if (block.type === "image" && block.image) return <figure className="custom-page-block custom-page-block-image"><img src={block.image} alt={block.title || ""} loading="lazy" /><figcaption>{block.title}</figcaption></figure>;
  if (block.type === "button" && block.url) return block.url.startsWith("/") ? <Link href={block.url} className="creative-space-cta custom-page-block-button">{block.title || "فتح الصفحة"}<ExternalLink size={15} /></Link> : <a href={block.url} target="_blank" rel="noreferrer" className="creative-space-cta custom-page-block-button">{block.title || "فتح الرابط"}<ExternalLink size={15} /></a>;
  if (block.type === "service") return <article className="custom-page-block custom-page-service"><span className="studio-label">خدمة</span>{block.title && <h3>{block.title}</h3>}{block.content && <p>{block.content}</p>}</article>;
  if (block.title || block.content) return <article className="custom-page-block custom-page-text">{block.title && <h3>{block.title}</h3>}{block.content && <p>{block.content}</p>}</article>;
  return null;
}

export default function CustomPage() {
  const [, params] = useRoute("/custom/:slug");
  const content = trpc.siteContent.get.useQuery(undefined, { staleTime: 30_000 });
  const site = normalizeSiteContent(content.data);
  const page = site.pages.find((item) => item.slug === params?.slug && item.visible);
  if (!page) return <main dir="rtl" className="custom-page"><Link href="/" className="free-sites-back"><ArrowRight size={15} /> العودة للموقع</Link><h1>الصفحة غير متاحة</h1></main>;
  const blocks = [...(page.blocks || [])].filter((block) => block.visible !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  const code = site.customCode;
  return <main dir="rtl" className={`custom-page custom-page-${page.template}`}>
    <header className="custom-page-header"><Link href="/" className="free-sites-back"><ArrowRight size={15} /> العودة للموقع</Link><span><Sparkles size={16} /> أبو كيان الجنيد</span></header>
    <section className="custom-page-hero"><span className="studio-label"><span className="free-sites-dot" /> {page.eyebrow}</span><h1>{page.title}</h1><p>{page.description}</p></section>
    <section className="custom-page-body"><div className="custom-page-card"><h2>{page.template === "directory" ? "دليل مرتب لاكتشاف الأفضل." : page.template === "showcase" ? "مساحة لعرض التفاصيل." : "صفحة جاهزة لفكرتك."}</h2><p>هذه الصفحة مبنية من قالب قابل لإعادة الاستخدام ويمكن تعديل عناصرها من لوحة المالك.</p>{blocks.length > 0 ? <div className="custom-page-block-list">{blocks.map((block) => <PageBlock key={block.id} block={block} />)}</div> : <p className="custom-page-empty">أضف نصوصًا وصورًا وأزرارًا من لوحة المالك لتظهر هنا.</p>}<Link href="/" className="creative-space-cta">العودة إلى الاستوديو <ExternalLink size={15} /></Link></div></section>
    {code?.enabled && (code.html || code.css || code.js) && <section className="custom-page-code"><div className="studio-label"><ImageIcon size={14} /> مساحة مخصصة</div><iframe title="معاينة الكود المخصص" sandbox="allow-scripts" srcDoc={safeCodeDocument(code)} /></section>}
  </main>;
}
