/*
  Design reminder — Message inbox:
  A compact, readable owner archive with filters that stay comfortable on mobile.
*/

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Inbox, LockKeyhole, Search, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { InboxLead, LeadStatus } from "@/components/ChatAssistant";

const INBOX_KEY = "abu-kayan-inbox";
const OWNER_PANEL_KEY = "abu-kayan-owner-panel";
type DateFilter = "all" | "today" | "7d" | "30d";

const statusLabels: Record<LeadStatus, string> = { new: "جديد", contacted: "تمت المتابعة", completed: "مكتمل" };

function normalizeLeads() {
  const raw = JSON.parse(window.localStorage.getItem(INBOX_KEY) || "[]") as Partial<InboxLead>[];
  return raw.map((lead) => ({ ...lead, status: lead.status || "new" })) as InboxLead[];
}

export default function OwnerInbox() {
  const [unlocked, setUnlocked] = useState(false);
  const [leads, setLeads] = useState<InboxLead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setUnlocked(window.sessionStorage.getItem(OWNER_PANEL_KEY) === "true");
    const load = () => setLeads(normalizeLeads());
    load();
    window.addEventListener("abu-kayan-inbox-updated", load);
    return () => window.removeEventListener("abu-kayan-inbox-updated", load);
  }, []);

  const updateStatus = (id: string, status: LeadStatus) => {
    const next = leads.map((lead) => lead.id === id ? { ...lead, status } : lead);
    setLeads(next);
    window.localStorage.setItem(INBOX_KEY, JSON.stringify(next));
  };

  const cycleStatus = (lead: InboxLead) => {
    const order: LeadStatus[] = ["new", "contacted", "completed"];
    const nextStatus = order[(order.indexOf(lead.status || "new") + 1) % order.length];
    updateStatus(lead.id, nextStatus);
  };

  const removeLead = (id: string) => {
    const next = leads.filter((lead) => lead.id !== id);
    setLeads(next);
    window.localStorage.setItem(INBOX_KEY, JSON.stringify(next));
  };

  const filteredLeads = useMemo(() => {
    const now = Date.now();
    const days = dateFilter === "today" ? 1 : dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 0;
    const query = searchTerm.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      const matchesDate = !days || now - new Date(lead.createdAt).getTime() <= days * 86400000;
      const matchesSearch = !query || lead.name.toLowerCase().includes(query) || lead.phone.toLowerCase().includes(query);
      return matchesStatus && matchesDate && matchesSearch;
    });
  }, [dateFilter, leads, searchTerm, statusFilter]);

  if (!unlocked) {
    return <main dir="rtl" className="owner-page owner-lock-page"><div className="owner-lock-card"><div className="owner-lock-icon"><LockKeyhole size={25} /></div><span className="studio-label">صندوق الرسائل</span><h1>الوصول مقفل</h1><p>افتح لوحة المالك أولًا من المسار المخفي في الموقع.</p><Link href="/owner" className="owner-save"><LockKeyhole size={16} /> فتح لوحة المالك</Link></div></main>;
  }

  return (
    <main dir="rtl" className="owner-page">
      <header className="owner-header"><div><span className="studio-label">أبو كيان الجنيد</span><h1>صندوق الرسائل</h1></div><Link href="/owner" className="owner-back"><ArrowRight size={15} /> لوحة التحكم</Link></header>
      <section className="owner-services-card inbox-card">
        <div className="owner-card-heading"><div><span className="studio-label"><Inbox size={14} /> الطلبات المحفوظة</span><h2>رسائل العملاء <b>{filteredLeads.length}<small> / {leads.length}</small></b></h2></div></div>
        <div className="inbox-filters" aria-label="تصفية الرسائل">
          <label className="inbox-search"><span>بحث بالاسم أو الهاتف</span><div><Search size={15} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="اكتب اسم الزبون أو الرقم" /></div></label>
          <label><span>حالة الطلب</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "all")}><option value="all">كل الحالات</option><option value="new">جديد</option><option value="contacted">تمت المتابعة</option><option value="completed">مكتمل</option></select></label>
          <label><span>التاريخ</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}><option value="all">كل التواريخ</option><option value="today">آخر 24 ساعة</option><option value="7d">آخر 7 أيام</option><option value="30d">آخر 30 يومًا</option></select></label>
        </div>
        {filteredLeads.length === 0 ? <div className="library-empty"><Inbox size={24} /><p>{leads.length ? "لا توجد رسائل تطابق التصفية الحالية." : <>لا توجد رسائل محفوظة بعد.<br />ستظهر طلبات العملاء هنا من المحادثة التجريبية.</>}</p></div> : <div className="inbox-list">{filteredLeads.map((lead) => <article className="inbox-lead" key={lead.id}><div><span>{new Date(lead.createdAt).toLocaleString("ar-YE")}</span><h3>{lead.name}</h3><a href={`tel:${lead.phone.replace(/\s/g, "")}`}>{lead.phone}</a></div><div className="inbox-lead-body"><p>{lead.request}</p><button type="button" className={`status-action status-${lead.status || "new"}`} onClick={() => cycleStatus(lead)} title="اضغط لتغيير حالة الطلب"><Check size={12} /> {statusLabels[lead.status || "new"]}<small>اضغط للتغيير</small></button></div><button type="button" className="owner-delete" onClick={() => removeLead(lead.id)} aria-label="حذف الرسالة"><Trash2 size={16} /></button></article>)}</div>}
      </section>
    </main>
  );
}
