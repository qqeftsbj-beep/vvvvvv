import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeSiteContent } from "@/lib/siteContent";

export default function CustomPage() {
  const [, params] = useRoute("/custom/:slug");
  const content = trpc.siteContent.get.useQuery(undefined, { staleTime: 30_000 });
  const page = normalizeSiteContent(content.data).pages.find((item) => item.slug === params?.slug && item.visible);
  if (!page) return <main dir="rtl" className="custom-page"><Link href="/" className="free-sites-back"><ArrowRight size={15} /> العودة للموقع</Link><h1>الصفحة غير متاحة</h1></main>;
  return <main dir="rtl" className={`custom-page custom-page-${page.template}`}><header className="custom-page-header"><Link href="/" className="free-sites-back"><ArrowRight size={15} /> العودة للموقع</Link><span><Sparkles size={16} /> أبو كيان الجنيد</span></header><section className="custom-page-hero"><span className="studio-label"><span className="free-sites-dot" /> {page.eyebrow}</span><h1>{page.title}</h1><p>{page.description}</p></section><section className="custom-page-body"><div className="custom-page-card"><h2>{page.template === "directory" ? "دليل مرتب لاكتشاف الأفضل." : page.template === "showcase" ? "مساحة لعرض التفاصيل." : "صفحة جاهزة لفكرتك."}</h2><p>هذه الصفحة مبنية من قالب قابل لإعادة الاستخدام ويمكن تعديل محتواها وأزرارها من لوحة المالك.</p><Link href="/" className="creative-space-cta">العودة إلى الاستوديو <ExternalLink size={15} /></Link></div></section></main>;
}
