import { ArrowRight, Loader2 } from "lucide-react";
import React, { type ReactNode } from "react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { isPublishedPage, normalizeSiteContent } from "@/lib/siteContent";
import PageRenderer from "./PageRenderer";

function CustomPageState({ children }: { children: ReactNode }) {
  return <main dir="rtl" className="custom-page"><Link href="/" className="free-sites-back"><ArrowRight size={15} /> العودة للموقع</Link>{children}</main>;
}

export default function CustomPage() {
  const [, params] = useRoute("/custom/:slug");
  const content = trpc.siteContent.page.useQuery({ slug: params?.slug || "missing-page" }, { staleTime: 0, refetchInterval: 5_000, refetchOnWindowFocus: true });
  const site = normalizeSiteContent(content.data ? { pages: [content.data.page], settings: content.data.settings, customCode: content.data.customCode } : null);
  const page = site.pages.find((item) => item.slug === params?.slug && isPublishedPage(item));

  if (content.isLoading && !content.data) return <CustomPageState><div className="custom-page-loading" role="status"><Loader2 className="animate-spin" size={24} /><span>جارٍ تحميل الصفحة...</span></div></CustomPageState>;
  if (content.isError && !content.data) return <CustomPageState><div className="custom-page-error" role="alert"><h1>تعذر تحميل الصفحة</h1><p>تحقق من الاتصال ثم أعد المحاولة.</p><button type="button" onClick={() => content.refetch()}>إعادة المحاولة</button></div></CustomPageState>;
  if (!page) return <CustomPageState><div className="custom-page-error"><h1>الصفحة غير متاحة</h1><p>قد تكون الصفحة مسودة أو مخفية أو لم يعد مسارها مستخدمًا.</p></div></CustomPageState>;

  return <PageRenderer page={page} site={site} mode="live" className="custom-page-live" />;
}
