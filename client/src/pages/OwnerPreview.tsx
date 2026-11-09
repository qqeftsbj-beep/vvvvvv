import React, { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { normalizeSiteContent } from "@/lib/siteContent";
import { editablePage } from "@/lib/pageDrafts";
import { OwnerPreviewProvider, type OwnerPreviewData, type PreviewCollections } from "@/contexts/OwnerPreviewContext";
import Home from "./Home";
import FreeSites from "./FreeSites";
import CreativeSpace from "./CreativeSpace";
import TemplateStudio from "./TemplateStudio";
import PageRenderer from "./PageRenderer";
import "./ownerWorkspace.css";

export default function OwnerPreview() {
  const load=trpc.management.state.useMutation();
  const [data,setData]=useState<Omit<OwnerPreviewData,"navigate"> | null>(null);
  const [view,setView]=useState(()=>new URLSearchParams(window.location.search).get("path") || "/");
  const [pin,setPin]=useState("");
  const [error,setError]=useState("");
  const open=async (credential:string)=>{
    setError("");
    try { const state=await load.mutateAsync({ownerPin:credential});
      setData({content:normalizeSiteContent(state.content),collections:state.collections as unknown as PreviewCollections});
    } catch(e) { setError(e instanceof Error ? e.message : "تعذر تحميل المعاينة الخاصة."); }
  };
  useEffect(()=>{ const saved=localStorage.getItem("abu-kayan-owner-pin"); if(saved) { setPin(saved); void open(saved); } },[]);
  const navigate=(url:string)=>{
    if(url.startsWith("#")){document.getElementById(url.slice(1))?.scrollIntoView({behavior:"smooth"});return;}
    if(/^\/(?!\/)/.test(url)){setView(url);window.scrollTo(0,0);return;}
    if(/^https:\/\//i.test(url))window.open(url,"_blank","noopener,noreferrer");
  };
  if(!data) return <main dir="rtl" className="owner-page owner-lock-page"><section className="owner-lock-card"><h1>معاينة نسخة العمل الخاصة</h1><p>تُحمّل البيانات بعد التحقق من رمز المالك على الخادم فقط. لا تظهر المسودات للعامة.</p><input aria-label="رمز المالك للمعاينة" type="password" value={pin} onChange={e=>setPin(e.target.value)} /><button className="owner-save" type="button" disabled={load.isPending} onClick={()=>void open(pin)}>{load.isPending ? "جارٍ التحميل…" : "فتح المعاينة"}</button>{error && <p role="alert">{error}</p>}<a href="/owner">العودة للوحة التحكم</a></section></main>;
  const path=view.split(/[?#]/)[0];
  const page=path.startsWith("/custom/") ? data.content.pages.find(item=>editablePage(item).slug===decodeURIComponent(path.slice(8))) : null;
  const capture=(e:React.MouseEvent<HTMLElement>)=>{
    const anchor=(e.target as HTMLElement).closest("a[href]"); const href=anchor?.getAttribute("href");
    if(href && /^\/(?!\/)/.test(href) && !href.startsWith("/api/") && !href.startsWith("/owner")){e.preventDefault();e.stopPropagation();navigate(href);}
  };
  return <OwnerPreviewProvider value={{...data,navigate}}><div dir="rtl" className="owner-preview-shell" onClickCapture={capture}><aside className="owner-preview-banner"><strong>معاينة خاصة — لا يراها الزوار</strong><small>البيانات المعروضة هي آخر نسخة عمل محفوظة. الإرسال العام للمشاركات معطّل في المعاينة.</small><div><button type="button" onClick={()=>navigate("/")}>البداية</button><button type="button" disabled={load.isPending} onClick={()=>void open(pin)}>تحديث المعاينة</button><a href="/owner">لوحة التحكم</a></div></aside>{path==="/" ? <Home /> : path==="/free-sites" ? <FreeSites /> : path==="/creative-space" ? <CreativeSpace /> : path==="/templates/gemini" ? <TemplateStudio toolName="Gemini" toolLabel="Gemini" /> : path==="/templates/chat-gbt" ? <TemplateStudio toolName="Chat GBT" toolLabel="Chat GBT" /> : page ? <PageRenderer page={editablePage(page)} site={data.content} mode="preview" showHidden /> : <section className="owner-page"><h2>لا توجد صفحة ضمن نسخة العمل بهذا المسار.</h2><button type="button" onClick={()=>navigate("/")}>العودة للبداية</button></section>}{error && <p role="alert">{error}</p>}</div></OwnerPreviewProvider>;
}
