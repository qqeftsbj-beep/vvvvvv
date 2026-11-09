/*
  Design reminder — Message inbox:
  A compact, readable owner archive with filters that stay comfortable on mobile.
  Server records and the old browser archive are intentionally shown as separate stores.
*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Inbox, LockKeyhole, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { Link } from "wouter";
import { InboxLead, LeadStatus } from "@/components/ChatAssistant";
import { trpc } from "@/lib/trpc";
import type { CustomerRequest, CustomerRequestPage } from "@shared/ownerNotifications";
import "./ownerInbox.css";

const INBOX_KEY = "abu-kayan-inbox";
const IMPORTED_KEY = "abu-kayan-inbox-imported";
const OWNER_PANEL_KEY = "abu-kayan-owner-panel";
const OWNER_PIN_KEY = "abu-kayan-owner-pin";
const DEFAULT_OWNER_PIN = "770562";
type DateFilter = "all" | "today" | "7d" | "30d";
type StatusFilter = LeadStatus | "all";

type Mutation<TInput, TResult> = { mutateAsync: (input: TInput) => Promise<TResult>; isPending?: boolean };
type CustomerInboxClient = {
  customerInbox?: {
    list?: { useMutation: () => Mutation<ListInput, CustomerRequestPage> };
    setStatus?: { useMutation: () => Mutation<{ ownerPin: string; id: string; status: LeadStatus }, { success: true }> };
    remove?: { useMutation: () => Mutation<{ ownerPin: string; id: string; confirm: true }, { success: true }> };
    importLegacy?: { useMutation: () => Mutation<{ ownerPin: string; items: InboxLead[] }, { success: true; imported: number }> };
  };
};

type ListInput = {
  ownerPin: string;
  search: string;
  status: StatusFilter;
  date: DateFilter;
  page: number;
  pageSize: number;
};

type LocalLead = InboxLead & { imported?: boolean };

const statusLabels: Record<LeadStatus, string> = { new: "جديد", contacted: "تمت المتابعة", completed: "مكتمل" };
const statusOrder: LeadStatus[] = ["new", "contacted", "completed"];

function getOwnerPin() {
  return window.localStorage.getItem(OWNER_PIN_KEY) || DEFAULT_OWNER_PIN;
}

function readLocalLeads(): LocalLead[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(INBOX_KEY) || "[]") as Partial<InboxLead>[];
    return Array.isArray(raw) ? raw.filter((lead): lead is InboxLead => Boolean(lead?.id)).map((lead) => ({
      ...lead,
      name: lead.name || "عميل من الموقع",
      phone: lead.phone || "غير محدد",
      request: lead.request || "",
      source: lead.source || "المحادثة التجريبية",
      status: lead.status || "new",
      createdAt: lead.createdAt || new Date(0).toISOString(),
    })) : [];
  } catch {
    return [];
  }
}

function writeLocalLeads(leads: LocalLead[]) {
  window.localStorage.setItem(INBOX_KEY, JSON.stringify(leads));
  window.dispatchEvent(new Event("abu-kayan-inbox-updated"));
}

function readImportedIds() {
  try {
    const value = JSON.parse(window.localStorage.getItem(IMPORTED_KEY) || "[]");
    return new Set<string>(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeImportedIds(ids: Set<string>) {
  window.localStorage.setItem(IMPORTED_KEY, JSON.stringify(Array.from(ids)));
}

function dateMatches(createdAt: string, dateFilter: DateFilter) {
  if (dateFilter === "all") return true;
  const days = dateFilter === "today" ? 1 : dateFilter === "7d" ? 7 : 30;
  return Date.now() - new Date(createdAt).getTime() <= days * 86400000;
}

function useInboxMutations() {
  const client = trpc as unknown as CustomerInboxClient;
  const unavailable = <TInput, TResult>() => ({
    isPending: false,
    mutateAsync: async (_input: TInput) => { throw new Error("خدمة صندوق الرسائل غير متاحة الآن."); },
  }) as Mutation<TInput, TResult>;
  const mutations = {
    list: client.customerInbox?.list?.useMutation?.() ?? unavailable<ListInput, CustomerRequestPage>(),
    setStatus: client.customerInbox?.setStatus?.useMutation?.() ?? unavailable<{ ownerPin: string; id: string; status: LeadStatus }, { success: true }>(),
    remove: client.customerInbox?.remove?.useMutation?.() ?? unavailable<{ ownerPin: string; id: string; confirm: true }, { success: true }>(),
    importLegacy: client.customerInbox?.importLegacy?.useMutation?.() ?? unavailable<{ ownerPin: string; items: InboxLead[] }, { success: true; imported: number }>(),
  };
  return useMemo(() => mutations, [mutations.importLegacy, mutations.list, mutations.remove, mutations.setStatus]);
}

function localMatches(lead: LocalLead, searchTerm: string, statusFilter: StatusFilter, dateFilter: DateFilter) {
  const query = searchTerm.trim().toLocaleLowerCase();
  return (statusFilter === "all" || lead.status === statusFilter)
    && dateMatches(lead.createdAt, dateFilter)
    && (!query || lead.name.toLocaleLowerCase().includes(query) || lead.phone.toLocaleLowerCase().includes(query) || lead.request.toLocaleLowerCase().includes(query));
}

export default function OwnerInbox() {
  const [unlocked, setUnlocked] = useState(false);
  const [localLeads, setLocalLeads] = useState<LocalLead[]>([]);
  const [serverPage, setServerPage] = useState<CustomerRequestPage>({ items: [], total: 0, hasMore: false, page: 1 });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [serverPageNumber, setServerPageNumber] = useState(1);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [actionError, setActionError] = useState("");
  const [importing, setImporting] = useState(false);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);
  const mutations = useInboxMutations();

  const loadServer = useCallback(async (page = 1) => {
    if (!unlocked || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setServerError("");
    try {
      const result = await mutations.list.mutateAsync({
        ownerPin: getOwnerPin(),
        search: searchTerm.trim(),
        status: statusFilter,
        date: dateFilter,
        page,
        pageSize: 20,
      });
      if (!mountedRef.current) return;
      setServerPage(result);
      setServerPageNumber(result.page || page);
    } catch (error) {
      if (mountedRef.current) setServerError(error instanceof Error ? error.message : "تعذر تحميل الرسائل من الخادم.");
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [dateFilter, mutations.list, searchTerm, statusFilter, unlocked]);

  useEffect(() => {
    mountedRef.current = true;
    const loadLocal = () => setLocalLeads(readLocalLeads());
    setUnlocked(window.sessionStorage.getItem(OWNER_PANEL_KEY) === "true");
    loadLocal();
    window.addEventListener("abu-kayan-inbox-updated", loadLocal);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("abu-kayan-inbox-updated", loadLocal);
    };
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    setServerPageNumber(1);
    void loadServer(1);
  }, [dateFilter, searchTerm, statusFilter, unlocked]); // loadServer is intentionally the stable central fetch for these filters.

  useEffect(() => {
    if (!unlocked) return;
    const interval = window.setInterval(() => void loadServer(serverPageNumber), 15000);
    const onFocus = () => void loadServer(serverPageNumber);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadServer, serverPageNumber, unlocked]);

  const filteredLocalLeads = useMemo(() => localLeads.filter((lead) => localMatches(lead, searchTerm, statusFilter, dateFilter)), [dateFilter, localLeads, searchTerm, statusFilter]);

  const updateLocalStatus = (id: string) => {
    const lead = localLeads.find((item) => item.id === id);
    if (!lead) return;
    const nextStatus = statusOrder[(statusOrder.indexOf(lead.status) + 1) % statusOrder.length];
    const next = localLeads.map((item) => item.id === id ? { ...item, status: nextStatus } : item);
    setLocalLeads(next);
    writeLocalLeads(next);
  };

  const removeLocal = (id: string) => {
    if (!window.confirm("حذف هذه الرسالة المحلية من هذا الجهاز؟ لن يؤثر ذلك على نسخة الخادم.")) return;
    const next = localLeads.filter((lead) => lead.id !== id);
    setLocalLeads(next);
    writeLocalLeads(next);
  };

  const updateServerStatus = async (record: CustomerRequest) => {
    const nextStatus = statusOrder[(statusOrder.indexOf(record.status) + 1) % statusOrder.length];
    setActionError("");
    try {
      await mutations.setStatus.mutateAsync({ ownerPin: getOwnerPin(), id: record.id, status: nextStatus });
      setServerPage((current) => ({ ...current, items: current.items.map((item) => item.id === record.id ? { ...item, status: nextStatus } : item) }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تعذر تغيير حالة الرسالة.");
    }
  };

  const removeServer = async (record: CustomerRequest) => {
    if (!window.confirm("تأكيد حذف هذه الرسالة من صندوق الخادم؟")) return;
    setActionError("");
    try {
      await mutations.remove.mutateAsync({ ownerPin: getOwnerPin(), id: record.id, confirm: true });
      setServerPage((current) => ({ ...current, items: current.items.filter((item) => item.id !== record.id), total: Math.max(0, current.total - 1) }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تعذر حذف الرسالة من الخادم.");
    }
  };

  const importLocal = async () => {
    const importedIds = readImportedIds();
    const candidates = localLeads.filter((lead) => !importedIds.has(lead.id));
    if (!candidates.length) {
      setActionError("لا توجد رسائل محلية جديدة للاستيراد.");
      return;
    }
    setImporting(true);
    setActionError("");
    try {
      for (let index = 0; index < candidates.length; index += 100) {
        const chunk = candidates.slice(index, index + 100);
        const result = await mutations.importLegacy.mutateAsync({ ownerPin: getOwnerPin(), items: chunk });
        if (!result?.success) throw new Error("لم يؤكد الخادم استيراد الرسائل.");
        chunk.forEach((lead) => importedIds.add(lead.id));
      }
      writeImportedIds(importedIds);
      await loadServer(1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تعذر استيراد الرسائل المحلية. لم تُحذف النسخ الأصلية.");
    } finally {
      setImporting(false);
    }
  };

  const serverItems = serverPage.items || [];
  const serverCountLabel = `${serverPage.total || 0}`;

  if (!unlocked) {
    return <main dir="rtl" className="owner-page owner-lock-page"><div className="owner-lock-card"><div className="owner-lock-icon"><LockKeyhole size={25} /></div><span className="studio-label">صندوق الرسائل</span><h1>الوصول مقفل</h1><p>افتح لوحة المالك أولًا من المسار المخفي في الموقع.</p><Link href="/owner" className="owner-save"><LockKeyhole size={16} /> فتح لوحة المالك</Link></div></main>;
  }

  return (
    <main dir="rtl" className="owner-page">
      <header className="owner-header"><div><span className="studio-label">أبو كيان الجنيد</span><h1>صندوق الرسائل</h1></div><Link href="/owner" className="owner-back"><ArrowRight size={15} /> لوحة التحكم</Link></header>
      <section className="owner-services-card inbox-card">
        <div className="owner-card-heading"><div><span className="studio-label"><Inbox size={14} /> الطلبات المحفوظة</span><h2>رسائل الخادم <b>{serverCountLabel}</b></h2></div><button type="button" className="inbox-refresh" onClick={() => void loadServer(serverPageNumber)} disabled={loading}><RefreshCw size={14} className={loading ? "inbox-spin" : ""} /> تحديث</button></div>
        <div className="inbox-filters" aria-label="تصفية الرسائل">
          <label className="inbox-search"><span>بحث بالاسم أو الهاتف</span><div><Search size={15} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="اكتب اسم الزبون أو الرقم" /></div></label>
          <label><span>حالة الطلب</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">كل الحالات</option><option value="new">جديد</option><option value="contacted">تمت المتابعة</option><option value="completed">مكتمل</option></select></label>
          <label><span>التاريخ</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}><option value="all">كل التواريخ</option><option value="today">آخر 24 ساعة</option><option value="7d">آخر 7 أيام</option><option value="30d">آخر 30 يومًا</option></select></label>
        </div>
        {serverError && <div className="inbox-error" role="alert"><span>{serverError}</span><button type="button" onClick={() => void loadServer(serverPageNumber)}>إعادة المحاولة</button></div>}
        {actionError && <div className="inbox-error" role="alert"><span>{actionError}</span><button type="button" onClick={() => setActionError("")}>إغلاق</button></div>}
        {loading && !serverItems.length ? <div className="library-empty" role="status"><RefreshCw className="inbox-spin" size={24} /><p>جارٍ تحميل رسائل الخادم…</p></div> : !serverItems.length ? <div className="library-empty"><Inbox size={24} /><p>لا توجد رسائل خادم تطابق التصفية الحالية.</p></div> : <div className="inbox-list">{serverItems.map((record) => <article className="inbox-lead inbox-server-lead" key={`server-${record.id}`}><div><span>خادم الموقع · {new Date(record.createdAt).toLocaleString("ar-YE")}</span><h3>{record.name}</h3><a href={`tel:${record.phone.replace(/\s/g, "")}`}>{record.phone}</a></div><div className="inbox-lead-body"><p>{record.request}</p><button type="button" className={`status-action status-${record.status}`} onClick={() => void updateServerStatus(record)} title="اضغط لتغيير حالة الطلب"><Check size={12} /> {statusLabels[record.status]}<small>اضغط للتغيير</small></button></div><button type="button" className="owner-delete" onClick={() => void removeServer(record)} aria-label="حذف الرسالة من الخادم"><Trash2 size={16} /></button></article>)}</div>}
        <div className="inbox-pagination"><button type="button" onClick={() => void loadServer(serverPageNumber - 1)} disabled={loading || serverPageNumber <= 1}><ChevronRight size={15} /> السابق</button><span>صفحة {serverPage.page || serverPageNumber}</span><button type="button" onClick={() => void loadServer(serverPageNumber + 1)} disabled={loading || !serverPage.hasMore}><ChevronLeft size={15} /> التالي</button></div>
      </section>

      <section className="owner-services-card inbox-card inbox-local-card">
        <details open={localLeads.length > 0}><summary><span><Inbox size={14} /> الأرشيف المحلي القديم</span><b>{filteredLocalLeads.length}<small> / {localLeads.length}</small></b></summary>
          <p className="inbox-local-note">هذه نسخ محفوظة على هذا الجهاز فقط. لا تُحذف عند الاستيراد، ويمكنك استيرادها للخادم على دفعات.</p>
          <button type="button" className="owner-save inbox-import" onClick={() => void importLocal()} disabled={importing || !localLeads.length}><Upload size={15} /> {importing ? "جارٍ الاستيراد…" : "استيراد الرسائل المحلية"}</button>
          {!filteredLocalLeads.length ? <div className="library-empty"><Inbox size={22} /><p>{localLeads.length ? "لا توجد رسائل محلية تطابق التصفية الحالية." : "لا توجد رسائل محلية قديمة."}</p></div> : <div className="inbox-list">{filteredLocalLeads.map((lead) => <article className="inbox-lead inbox-local-lead" key={`local-${lead.id}`}><div><span>على هذا الجهاز · {new Date(lead.createdAt).toLocaleString("ar-YE")}</span><h3>{lead.name}</h3><a href={`tel:${lead.phone.replace(/\s/g, "")}`}>{lead.phone}</a></div><div className="inbox-lead-body"><p>{lead.request}</p><button type="button" className={`status-action status-${lead.status}`} onClick={() => updateLocalStatus(lead.id)} title="اضغط لتغيير حالة الطلب"><Check size={12} /> {statusLabels[lead.status]}<small>محلي · اضغط للتغيير</small></button></div><button type="button" className="owner-delete" onClick={() => removeLocal(lead.id)} aria-label="حذف الرسالة المحلية"><Trash2 size={16} /></button></article>)}</div>}
        </details>
      </section>
    </main>
  );
}
