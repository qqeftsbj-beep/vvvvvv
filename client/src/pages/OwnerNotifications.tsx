import React, { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import OwnerModal from "@/components/OwnerModal";
import type { OwnerNotificationFeed, OwnerNotificationFilter, OwnerNotificationItem, OwnerNotificationPreferences } from "@shared/ownerNotifications";
import "./ownerNotifications.css";

export default function OwnerNotifications({ ownerPin, onOpenSubmissions, onOpenRequest }: { ownerPin: string; onOpenSubmissions: () => void; onOpenRequest?: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<OwnerNotificationFilter>("all");
  const [page, setPage] = useState(1);
  const [feed, setFeed] = useState<OwnerNotificationFeed | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = trpc.ownerNotifications.list.useMutation();
  const markRead = trpc.ownerNotifications.markRead.useMutation();
  const markAll = trpc.ownerNotifications.markAllRead.useMutation();
  const savePreferences = trpc.ownerNotifications.savePreferences.useMutation();
  const listRef = useRef(list.mutateAsync); listRef.current = list.mutateAsync;
  const requestRef = useRef({ ownerPin, filter, page }); requestRef.current = { ownerPin, filter, page };
  const alive = useRef(true);
  const inFlight = useRef(false);
  const refreshQueued = useRef(false);
  const generation = useRef(0);
  const seenIds = useRef(new Set<string>());
  const initialized = useRef(false);
  const refresh = async (announce = false) => {
    if (!ownerPin || !alive.current) return;
    if (inFlight.current) { refreshQueued.current = true; return; }
    inFlight.current = true;
    const request = { ...requestRef.current };
    const token = generation.current;
    setLoading(true);
    try {
      const next = await listRef.current({ ...request, pageSize: 20 });
      if (!alive.current || token !== generation.current) return;
      if (announce && initialized.current && next.preferences.showToast && request.page === 1 && request.filter === "all") {
        const fresh = next.items.filter(item => !item.readAt && !seenIds.current.has(item.id));
        if (fresh.length) toast(fresh.length === 1 ? fresh[0].title : `لديك ${fresh.length} إشعارات جديدة`, { description: "افتح جرس الإشعارات للاطلاع عليها." });
      }
      next.items.forEach(item => seenIds.current.add(item.id));
      if (seenIds.current.size > 500) seenIds.current = new Set(next.items.map(item => item.id));
      initialized.current = true;
      setFeed(next); setError("");
    } catch (cause) {
      if (alive.current && token === generation.current) setError(cause instanceof Error ? cause.message : "تعذر تحديث الإشعارات. حاول مجددًا.");
    } finally {
      inFlight.current = false;
      if (alive.current) setLoading(false);
      if (refreshQueued.current && alive.current) { refreshQueued.current = false; void refreshRef.current(); }
    }
  };
  const refreshRef = useRef(refresh); refreshRef.current = refresh;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; generation.current++; };
  }, []);
  useEffect(() => {
    generation.current++;
    initialized.current = false;
    void refreshRef.current();
  }, [ownerPin, filter, page]);
  useEffect(() => {
    // UI refresh only while the owner panel is open; no background server cron or push permission.
    const update = () => { if (!document.hidden) void refreshRef.current(true); };
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  const perform = async (task: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await task(); generation.current++; await refreshRef.current(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "لم يتم حفظ العملية. حاول مجددًا."); }
    finally { if (alive.current) setBusy(false); }
  };
  const openItem = async (item: OwnerNotificationItem) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!item.readAt) await markRead.mutateAsync({ ownerPin, ids: [item.id] });
      generation.current++;
      await refreshRef.current();
      setOpen(false);
      if (item.type === "submission") onOpenSubmissions();
      else if (onOpenRequest) onOpenRequest(item.href);
      else window.location.assign(item.href);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر فتح الإشعار؛ لم تتغير حالته."); }
    finally { if (alive.current) setBusy(false); }
  };
  const preferences = feed?.preferences;
  const changePreference = (key: keyof OwnerNotificationPreferences, value: boolean) => {
    if (!preferences) return;
    void perform(() => savePreferences.mutateAsync({ ownerPin, preferences: { ...preferences, [key]: value } }));
  };
  return <>
    <button type="button" className="owner-notification-bell" onClick={() => setOpen(true)} aria-label={`الإشعارات${feed?.unreadCount ? `، ${feed.unreadCount} غير مقروءة` : ""}`} title={error ? "تعذر تحديث الإشعارات" : "إشعارات المالك"}>
      <Bell size={18} aria-hidden="true" /><span>الإشعارات</span>{!!feed?.unreadCount && <b>{feed.unreadCount > 99 ? "99+" : feed.unreadCount}</b>}{error && <i aria-label="خطأ التحديث">!</i>}
    </button>
    <OwnerModal open={open} onClose={() => setOpen(false)} title="إشعارات المالك" ariaLabel="إشعارات المالك" className="owner-notifications-modal" closeDisabled={busy}>
      <div className="owner-notifications-summary" role="status"><strong>{feed?.unreadCount ?? "—"} غير مقروءة</strong><small>تحديث تلقائي كل 15 ثانية أثناء فتح اللوحة. حالة القراءة محفوظة لجميع أجهزتك.</small></div>
      <div className="owner-notifications-actions"><button type="button" onClick={() => void refreshRef.current()} disabled={loading || busy}><RefreshCw size={14} />{loading ? "جارٍ التحديث..." : "تحديث"}</button><button type="button" disabled={!feed?.unreadCount || busy} onClick={() => void perform(() => markAll.mutateAsync({ ownerPin }))}><CheckCheck size={15} />تعليم الكل كمقروء</button></div>
      <nav className="owner-notifications-filters" aria-label="تصفية الإشعارات">{([{ value: "all", label: "الكل" }, { value: "unread", label: "غير المقروءة" }, { value: "submission", label: "المشاركات" }, { value: "request", label: "الطلبات" }] as const).map(item => <button type="button" aria-pressed={filter === item.value} key={item.value} disabled={loading || busy} onClick={() => { setFilter(item.value); setPage(1); }}>{item.label}</button>)}</nav>
      {error && <div role="alert" className="owner-notifications-error">{error}<button type="button" disabled={loading} onClick={() => void refreshRef.current()}>إعادة المحاولة</button></div>}
      {!feed && loading ? <p role="status">جارٍ تحميل الإشعارات...</p> : !feed?.items.length && !error ? <p className="owner-notifications-empty">لا توجد إشعارات في هذه القائمة.</p> : <div className="owner-notifications-list">{feed?.items.map(item => <article key={item.id} className={`owner-notification-item ${item.readAt ? "is-read" : "is-unread"}`}><div><span>{item.type === "submission" ? "مشاركة زائر" : "طلب عميل"} · {item.readAt ? "مقروء" : "جديد"}</span><h3>{item.title}</h3>{item.body && <p>{item.body}</p>}<time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleString("ar-YE")}</time></div><div className="owner-notification-item-actions"><button type="button" onClick={() => void openItem(item)} disabled={busy}>فتح {item.type === "submission" ? "المشاركة" : "الطلب"}</button>{!item.readAt && <button type="button" onClick={() => void perform(() => markRead.mutateAsync({ ownerPin, ids: [item.id] }))} disabled={busy}>تعليم كمقروء</button>}</div></article>)}</div>}
      <div className="owner-notifications-pagination"><button type="button" disabled={page === 1 || loading || busy} onClick={() => setPage(current => current - 1)}>السابق</button><span>صفحة {page}</span><button type="button" disabled={!feed?.hasMore || loading || busy} onClick={() => setPage(current => current + 1)}>التالي</button></div>
      <details className="owner-notifications-settings"><summary><Settings2 size={15} />تخصيص الإشعارات</summary>{preferences && <div><label><input type="checkbox" checked={preferences.showSubmissions} disabled={busy || loading} onChange={event => changePreference("showSubmissions", event.target.checked)} />إشعارات مشاركات مساحتك الإبداعية</label><label><input type="checkbox" checked={preferences.showRequests} disabled={busy || loading} onChange={event => changePreference("showRequests", event.target.checked)} />إشعارات رسائل وطلبات العملاء</label><label><input type="checkbox" checked={preferences.showToast} disabled={busy || loading} onChange={event => changePreference("showToast", event.target.checked)} />تنبيه مرئي عند وصول إشعار جديد</label><small>الإعدادات خاصة بالمالك؛ لا تحذف أي طلب أو مشاركة ولا تغيّر الموافقة أو النشر.</small></div>}</details>
    </OwnerModal>
  </>;
}
