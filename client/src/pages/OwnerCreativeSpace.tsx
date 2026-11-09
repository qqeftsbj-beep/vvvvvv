import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import OwnerModal from "@/components/OwnerModal";
import "./ownerWorkspaceAdmin.css";

type Status = "pending" | "approved" | "rejected";
type ReviewState = "inbox" | "saved" | "waiting" | "cancelled";
type Draft = { projectName: string; description: string; category: string; link: string; contact: string; status: Status; sortOrder: number };
type CreativeProps = {
  unlocked: boolean;
  ownerPin?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveRegister?: (callback: (() => Promise<boolean>) | null) => void;
  onWorkspaceChange?: () => void;
  onBusyChange?: (busy:boolean)=>void;
};
type AnySubmission = {
  id: number;
  projectName?: string | null;
  description?: string | null;
  category: string;
  imageUrls?: string[] | string | null;
  link?: string | null;
  contact?: string | null;
  status: Status;
  isVisible: number;
  sortOrder: number;
  reviewState?: ReviewState;
};

const labels: Record<ReviewState, string> = { inbox: "الوارد", saved: "المحفوظة", waiting: "قيد الانتظار", cancelled: "الملغاة" };
const stateMeta: Record<ReviewState, { status: Status; isVisible: boolean }> = {
  inbox: { status: "pending", isVisible: false },
  saved: { status: "approved", isVisible: true },
  waiting: { status: "pending", isVisible: false },
  cancelled: { status: "rejected", isVisible: false },
};

function imagesOf(item: AnySubmission) {
  if (Array.isArray(item.imageUrls)) return item.imageUrls.filter(Boolean);
  if (typeof item.imageUrls === "string") {
    try {
      const parsed = JSON.parse(item.imageUrls);
      return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === "string" && Boolean(url)) : [];
    } catch { return item.imageUrls ? [item.imageUrls] : []; }
  }
  return [];
}

function safeUrl(value: string) {
  try {
    const url = new URL(value.trim(), window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function sameDraft(left: Draft | undefined, right: Draft) {
  return Boolean(left) && Object.keys(right).every((key) => left?.[key as keyof Draft] === right[key as keyof Draft]);
}

function normalise(item: AnySubmission): AnySubmission {
  return { ...item, projectName: item.projectName || "", description: item.description || "", link: item.link || "", contact: item.contact || "" };
}

export default function OwnerCreativeSpace({ unlocked, ownerPin, onDirtyChange, onSaveRegister, onWorkspaceChange, onBusyChange }: CreativeProps) {
  const legacyQuery = trpc.creativeSpace.adminList.useQuery(undefined, { enabled: unlocked && !ownerPin, refetchOnWindowFocus: true, refetchInterval: unlocked ? 15000 : false });
  const legacyCategories = trpc.creativeCategories.adminList.useQuery(undefined, { enabled: unlocked && !ownerPin, staleTime: 0 });
  const privateLoad=trpc.management.state.useMutation();
  const privateUpdate=trpc.management.workingEntityUpdate.useMutation();
  const privateRemove=trpc.management.workingEntityRemove.useMutation();
  const [privateItems,setPrivateItems]=useState<AnySubmission[]>([]);
  const [privateCategories,setPrivateCategories]=useState<Array<{slug:string;name:string}>>([]);
  const [loaded,setLoaded]=useState(false);
  const refreshPrivate=async()=>{if(!ownerPin)return;const state=await privateLoad.mutateAsync({ownerPin});setPrivateItems(state.collections.submissions);setPrivateCategories(state.collections.creativeCategories);setLoaded(true);};
  useEffect(()=>{if(!ownerPin||!unlocked)return;void refreshPrivate().catch(e=>toast.error(e.message));const timer=window.setInterval(()=>{void refreshPrivate().catch(()=>undefined);},15000);return()=>window.clearInterval(timer);},[ownerPin,unlocked]);
  const query=ownerPin?{...legacyQuery,data:privateItems,isLoading:!loaded}:legacyQuery;
  const categories=ownerPin?{...legacyCategories,data:privateCategories}:legacyCategories;
  const utils = trpc.useUtils();
  const update = trpc.creativeSpace.update.useMutation();
  const remove = trpc.creativeSpace.remove.useMutation();
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [states, setStates] = useState<Record<number, ReviewState>>({});
  const [openSections, setOpenSections] = useState<Record<ReviewState, boolean>>({ inbox: true, saved: true, waiting: false, cancelled: false });
  const [editorOpen, setEditorOpen] = useState<Record<number, boolean>>({});
  const [preview, setPreview] = useState<AnySubmission | null>(null);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const savePendingRef = useRef<() => Promise<boolean>>(async () => true);
  const registerRef = useRef(onSaveRegister);
  const dirtyRef = useRef(onDirtyChange);
  const workspaceChangeRef = useRef(onWorkspaceChange);
  const busyCallback=useRef(onBusyChange);busyCallback.current=onBusyChange;
  useEffect(()=>{busyCallback.current?.(Object.values(busy).some(Boolean));},[busy]);
  registerRef.current = onSaveRegister;
  dirtyRef.current = onDirtyChange;
  workspaceChangeRef.current = onWorkspaceChange;
  const items = useMemo(() => (query.data || []).map((item) => normalise(item as unknown as AnySubmission)), [query.data]);

  const getDraft = (item: AnySubmission): Draft => drafts[item.id] || {
    projectName: item.projectName || "", description: item.description || "", category: item.category, link: item.link || "", contact: item.contact || "", status: item.status, sortOrder: item.sortOrder,
  };
  const getState = (item: AnySubmission): ReviewState => states[item.id] || item.reviewState || (item.status === "rejected" ? "cancelled" : item.status === "approved" && item.isVisible === 1 ? "saved" : "inbox");
  const updateCache = () => { if(ownerPin)void refreshPrivate().catch(e=>toast.error(e.message)); void utils.creativeSpace.adminList.invalidate(); void utils.creativeSpace.list.invalidate(); workspaceChangeRef.current?.(); };

  const persistDraft = async (item: AnySubmission, submitted: Draft, nextState?: ReviewState) => {
    const state = nextState || getState(item);
    const meta = stateMeta[state];
    const payload = { id: item.id, ...submitted, status: nextState ? meta.status : submitted.status, isVisible: nextState ? meta.isVisible : item.isVisible === 1, reviewState: state, ...(ownerPin ? { ownerPin } : {}) };
    const mutateAsync = (update as unknown as { mutateAsync?: (input: unknown) => Promise<unknown> }).mutateAsync;
    if(ownerPin) await privateUpdate.mutateAsync({ownerPin,kind:"submissions",id:item.id,patch:{...payload,isVisible:payload.isVisible?1:0}});
    else if (mutateAsync) await mutateAsync(payload);
    else throw new Error("خدمة تأكيد الحفظ غير متاحة.");
    if (nextState) setStates((current) => ({ ...current, [item.id]: nextState }));
    setDrafts((current) => {
      if (sameDraft(current[item.id], submitted)) {
        const next = { ...current };
        delete next[item.id];
        return next;
      }
      return current;
    });
    toast.success(nextState ? `نُقلت إلى ${labels[nextState]} داخل مساحة العمل الخاصة. لا تظهر للعامة حتى النشر من الشريط الرئيسي.` : "حُفظت التفاصيل في مساحة العمل الخاصة. لا تظهر التعديلات للعامة حتى النشر من الشريط الرئيسي.");
    updateCache();
  };

  const persist = async (item: AnySubmission, nextState?: ReviewState) => {
    const submitted = { ...getDraft(item) };
    setBusy((current) => ({ ...current, [item.id]: true }));
    try { await persistDraft(item, submitted, nextState); return true; }
    catch (error) { toast.error(error instanceof Error ? `تعذر الحفظ، بقيت تعديلاتك كما هي: ${error.message}` : "تعذر الحفظ، بقيت تعديلاتك كما هي."); return false; }
    finally { setBusy((current) => ({ ...current, [item.id]: false })); }
  };

  const savePending = async () => {
    const snapshots = Object.entries(drafts).map(([id, draft]) => ({ item: items.find((candidate) => candidate.id === Number(id)), draft: { ...draft } }));
    if (!snapshots.length) return true;
    const results = await Promise.all(snapshots.map(async ({ item, draft }) => {
      if (!item) return true;
      setBusy((current) => ({ ...current, [item.id]: true }));
      try { await persistDraft(item, draft); return true; }
      catch (error) { toast.error(error instanceof Error ? `تعذر حفظ ${draft.projectName || "المشاركة"}: ${error.message}` : "تعذر حفظ إحدى المشاركات، وبقيت تعديلاتك."); return false; }
      finally { setBusy((current) => ({ ...current, [item.id]: false })); }
    }));
    return results.every(Boolean);
  };
  savePendingRef.current = savePending;

  useEffect(() => { dirtyRef.current?.(Object.keys(drafts).length > 0); }, [drafts]);
  useEffect(() => {
    registerRef.current?.(() => savePendingRef.current());
    return () => registerRef.current?.(null);
    // Registration intentionally happens once; refs keep inline parent callbacks current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeDraft = (item: AnySubmission, key: keyof Draft, value: string | number) => setDrafts((current) => ({ ...current, [item.id]: { ...getDraft(item), [key]: value } }));
  const move = (item: AnySubmission, state: ReviewState) => { void persist(item, state); };
  const deleteItem = async (item: AnySubmission) => {
    if (!window.confirm("سيُنقل هذا العنصر إلى سلة مساحة العمل، ولن يُحذف نهائيًا. هل تريد المتابعة؟")) return;
    setBusy((current) => ({ ...current, [item.id]: true }));
    try {
      const mutateAsync = (remove as unknown as { mutateAsync?: (input: unknown) => Promise<unknown> }).mutateAsync;
      if(ownerPin)await privateRemove.mutateAsync({ownerPin,kind:"submissions",id:item.id});
      else if (mutateAsync) await mutateAsync({ id: item.id });
      else throw new Error("خدمة تأكيد النقل إلى السلة غير متاحة.");
      toast.success("نُقلت المشاركة إلى سلة مساحة العمل. الحذف النهائي متاح من السلة فقط.");
      setDrafts(current=>{const next={...current};delete next[item.id];return next;});
      updateCache();
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر نقل المشاركة إلى السلة."); }
    finally { setBusy((current) => ({ ...current, [item.id]: false })); }
  };

  if (!unlocked) return null;
  const grouped = (Object.keys(labels) as ReviewState[]).reduce((acc, state) => { acc[state] = items.filter((item) => getState(item) === state); return acc; }, {} as Record<ReviewState, AnySubmission[]>);
  const categoryName = (slug: string) => categories.data?.find((category) => category.slug === slug)?.name || "مساحة إبداعية";

  return <section className="owner-services-card owner-creative-workspace" aria-label="مساحة الإبداع وإدارة المشاركات">
    <div className="owner-card-heading"><div><span className="studio-label">07 / مساحة الإبداع</span><h2>مراجعة المشاركات بصريًا</h2></div><span className="owner-status"><Eye size={15} /> {items.length} مشاركة</span></div>
    {grouped.inbox.length > 0 && <div className="owner-pending-alert" role="status"><Bell size={18} /><strong>{grouped.inbox.length} مشاركة جديدة في الوارد</strong><span>الحفظ والانتقال بين الأقسام لا ينشران للعامة.</span></div>}
    <p className="owner-security-note">هذه معاينة خاصة تشبه ظهور الزائر. استخدم الشريط الرئيسي لحفظ كل التعديلات أو نشر النسخة المعتمدة للعامة.</p>
    <div className="owner-creative-sections">
      {(Object.keys(labels) as ReviewState[]).map((state) => <section className="owner-creative-section" key={state}>
        <button type="button" className="owner-creative-section-toggle" aria-expanded={openSections[state]} onClick={() => setOpenSections((current) => ({ ...current, [state]: !current[state] }))}><span><strong>{labels[state]}</strong><small>{grouped[state].length} عنصر</small></span>{openSections[state] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
        {openSections[state] && <div className="owner-creative-list">
          {query.isLoading && state === "inbox" && <p className="owner-empty">جارٍ تحميل المشاركات...</p>}
          {!query.isLoading && !grouped[state].length && <p className="owner-empty">لا توجد عناصر في هذا القسم.</p>}
          {grouped[state].map((item) => { const draft = getDraft(item); const title = draft.projectName || "مشاركة إبداعية"; const imageUrls = imagesOf(item); return <article className="owner-creative-card" key={item.id}>
            <button type="button" className="owner-creative-preview-card" onClick={() => setPreview({...item,...getDraft(item)})} aria-label={`فتح معاينة كاملة ${title}`}><div className="owner-creative-thumb">{imageUrls[0] ? <img src={imageUrls[0]} alt="" /> : <span>بدون صورة</span>}{imageUrls.length > 1 && <b>+{imageUrls.length - 1}</b>}</div><div><small>{categoryName(draft.category)} · {labels[state]}</small><strong>{title}</strong><p>{draft.description || "بدون وصف"}</p></div><ExternalLink size={16} aria-hidden="true" /></button>
            <div className="owner-creative-card-toolbar"><span className={`owner-creative-state owner-creative-state-${state}`}>{labels[state]}</span><button type="button" className="owner-creative-detail-toggle" aria-expanded={Boolean(editorOpen[item.id])} onClick={() => setEditorOpen((current) => ({ ...current, [item.id]: !current[item.id] }))}>{editorOpen[item.id] ? "إخفاء التفاصيل" : "تحرير التفاصيل"}</button></div>
            {editorOpen[item.id] && <div className="owner-creative-editor"><label><span>اسم المشروع</span><input value={draft.projectName} onChange={(event) => changeDraft(item, "projectName", event.target.value)} /></label><label className="owner-creative-wide"><span>الوصف</span><textarea value={draft.description} onChange={(event) => changeDraft(item, "description", event.target.value)} /></label><label><span>القسم</span><select value={draft.category} onChange={(event) => changeDraft(item, "category", event.target.value)}>{categories.data?.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label><label><span>الرابط</span><input value={draft.link} onChange={(event) => changeDraft(item, "link", event.target.value)} /></label><label><span>التواصل</span><input value={draft.contact} onChange={(event) => changeDraft(item, "contact", event.target.value)} /></label><label><span>الترتيب</span><input type="number" min="0" value={draft.sortOrder} onChange={(event) => changeDraft(item, "sortOrder", Number(event.target.value))} /></label><div className="owner-creative-editor-actions"><button type="button" className="owner-save" disabled={busy[item.id]} onClick={() => { void persist(item); }}><Save size={15} /> حفظ التفاصيل</button></div></div>}
            <div className="owner-creative-actions">{state === "inbox" && <><button type="button" className="owner-save" disabled={busy[item.id]} onClick={() => move(item, "saved")}><Check size={15} /> حفظ</button><button type="button" className="owner-add" disabled={busy[item.id]} onClick={() => move(item, "waiting")}>انتظار</button><button type="button" className="owner-delete" disabled={busy[item.id]} onClick={() => move(item, "cancelled")}><X size={15} /> إلغاء</button></>}{state === "saved" && <button type="button" className="owner-add" disabled={busy[item.id]} onClick={() => move(item, "inbox")}><EyeOff size={15} /> إلغاء الحفظ وإعادة للوارد</button>}{state === "waiting" && <><button type="button" className="owner-save" disabled={busy[item.id]} onClick={() => move(item, "saved")}><Check size={15} /> اعتماد</button><button type="button" className="owner-delete" disabled={busy[item.id]} onClick={() => move(item, "inbox")}><X size={15} /> إلغاء الحفظ وإعادة للوارد</button></>}{state === "cancelled" && <button type="button" className="owner-add" disabled={busy[item.id]} onClick={() => move(item, "inbox")}><Eye size={15} /> إلغاء الحفظ وإعادة للوارد</button>}<button type="button" className="owner-delete" disabled={busy[item.id]} onClick={() => { void deleteItem(item); }}><Trash2 size={15} /> سلة</button></div>
          </article>; })}
        </div>}
      </section>)}
    </div>
    <OwnerModal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview ? (preview.projectName || "معاينة المشاركة") : "معاينة المشاركة"} ariaLabel="معاينة المشاركة الإبداعية" className="owner-creative-preview-modal">
      {preview && <div className="owner-creative-full-preview"><div className="owner-creative-gallery">{imagesOf(preview).map((url) => <img key={url} src={url} alt={preview.projectName || "صورة المشاركة"} />)}{!imagesOf(preview).length && <div className="owner-creative-no-image">لا توجد صور مرفقة</div>}</div><div className="owner-creative-full-copy"><span>{categoryName(preview.category)}</span><p>{preview.description || "بدون وصف"}</p>{preview.contact && <small>التواصل: {preview.contact}</small>}{preview.link && (safeUrl(preview.link) ? <a href={safeUrl(preview.link) || undefined} target="_blank" rel="noreferrer noopener">فتح الرابط الفعلي <ExternalLink size={14} /></a> : <small>الرابط: {preview.link}</small>)}</div></div>}
    </OwnerModal>
  </section>;
}
