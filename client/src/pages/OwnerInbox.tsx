/*
  Design reminder — Message inbox:
  A quiet, readable archive for local demo leads, using the same midnight and antique-gold system.
*/

import { useEffect, useState } from "react";
import { ArrowRight, Inbox, LockKeyhole, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { InboxLead } from "@/components/ChatAssistant";

const INBOX_KEY = "abu-kayan-inbox";
const OWNER_PANEL_KEY = "abu-kayan-owner-panel";

export default function OwnerInbox() {
  const [unlocked, setUnlocked] = useState(false);
  const [leads, setLeads] = useState<InboxLead[]>([]);

  useEffect(() => {
    setUnlocked(window.sessionStorage.getItem(OWNER_PANEL_KEY) === "true");
    const load = () => setLeads(JSON.parse(window.localStorage.getItem(INBOX_KEY) || "[]") as InboxLead[]);
    load();
    window.addEventListener("abu-kayan-inbox-updated", load);
    return () => window.removeEventListener("abu-kayan-inbox-updated", load);
  }, []);

  const removeLead = (id: string) => {
    const next = leads.filter((lead) => lead.id !== id);
    setLeads(next);
    window.localStorage.setItem(INBOX_KEY, JSON.stringify(next));
  };

  if (!unlocked) {
    return <main dir="rtl" className="owner-page owner-lock-page"><div className="owner-lock-card"><div className="owner-lock-icon"><LockKeyhole size={25} /></div><span className="studio-label">صندوق الرسائل</span><h1>الوصول مقفل</h1><p>افتح لوحة المالك أولًا من المسار المخفي في الموقع.</p><Link href="/owner" className="owner-save"><LockKeyhole size={16} /> فتح لوحة المالك</Link></div></main>;
  }

  return (
    <main dir="rtl" className="owner-page">
      <header className="owner-header"><div><span className="studio-label">أبو كيان الجنيد</span><h1>صندوق الرسائل</h1></div><Link href="/owner" className="owner-back"><ArrowRight size={15} /> لوحة التحكم</Link></header>
      <section className="owner-services-card inbox-card"><div className="owner-card-heading"><div><span className="studio-label"><Inbox size={14} /> الطلبات المحفوظة</span><h2>رسائل العملاء <b>{leads.length}</b></h2></div></div>
        {leads.length === 0 ? <div className="library-empty"><Inbox size={24} /><p>لا توجد رسائل محفوظة بعد.<br />ستظهر طلبات العملاء هنا من المحادثة التجريبية.</p></div> : <div className="inbox-list">{leads.map((lead) => <article className="inbox-lead" key={lead.id}><div><span>{new Date(lead.createdAt).toLocaleString("ar-YE")}</span><h3>{lead.name}</h3><a href={`tel:${lead.phone.replace(/\s/g, "")}`}>{lead.phone}</a></div><p>{lead.request}</p><button type="button" className="owner-delete" onClick={() => removeLead(lead.id)} aria-label="حذف الرسالة"><Trash2 size={16} /></button></article>)}</div>}
      </section>
    </main>
  );
}
