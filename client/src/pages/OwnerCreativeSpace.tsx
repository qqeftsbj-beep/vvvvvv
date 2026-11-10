import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, ExternalLink, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { PageMedia } from "@shared/pageMedia";
import OwnerModal from "@/components/OwnerModal";
import ContentAttachmentEditor from "./ContentAttachmentEditor";
import ContentAttachments from "./ContentAttachments";
import "./ownerWorkspaceAdmin.css";

type Status = "pending" | "approved" | "rejected";
type ReviewState = "inbox" | "saved" | "waiting" | "cancelled";
type Draft = { projectName: string; description: string; category: string; link: string; contact: string; status: Status; sortOrder: number; attachments: PageMedia[] };
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
  attachments?: PageMedia[] | null;
};
type AdminPage = { items: AnySubmission[]; hasMore: boolean; total: number; pendingCount: number; page: number };

const labels: Record<ReviewState, string> = { inbox: "الوارد", saved: "المحفوظة", waiting: "قيد الانتظار", cancelled: "الملغاة" };
const stateMeta: Record<ReviewState, { status: Status; isVisible: boolean }> = {
  inbox: { status: "pending", isVisible: false },
  saved: { status: "approved", isVisible: true },
  waiting: { status: "pending", isVisible: false },
  cancelled: { status: "rejected", isVisible: false },
};
const creativePageId = (id: number | string) => `creative:${id}`;
const newCreativeAttachmentPageId = () => `creative:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

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
  const publicCategories = trpc.creativeCategories.list.useQuery(undefined, { staleTime: 60_000 });
  const adminPage = trpc.sharedContent.adminPage.useMutation();
  const requestAdminPage=adminPage.mutateAsync as unknown as (input:{ownerPin:string;kind:"submissions";reviewState:ReviewState;page:number;pageSize:number})=>Promise<AdminPage>;
  const privateUpdate=trpc.management.workingEntityUpdate.useMutation();
  const privateRemove=trpc.management.workingEntityRemove.useMutation();
  const [privatePageData,setPrivatePageData]=useState<Partial<Record<ReviewState,AdminPage>>>({});
  const [privatePage,setPrivatePage]=useState<Record<ReviewState,number>>({inbox:1,saved:1,waiting:1,cancelled:1});
  const privatePageRef=useRef(privatePage);privatePageRef.current=privatePage;
  const seenItems=useRef<Record<number,AnySubmission>>({});
  const [pendingTotal,setPendingTotal]=useState(0);
  const [loaded,setLoaded]=useState(false);
  const refreshPrivate=async(state:ReviewState,page=1)=>{if(!ownerPin)return;const result=await requestAdminPage({ownerPin,kind:"submissions",reviewState:state,page,pageSize:12});for(const item of result.items)seenItems.current[item.id]=item;setPrivatePageData(current=>({...current,[state]:result}));setPrivatePage(current=>({...current,[state]:result.page}));setPendingTotal(result.pendingCount);setLoaded(true);};
  const refreshRef=useRef(refreshPrivate);refreshRef.current=refreshPrivate;
  useEffect(()=>{if(!ownerPin||!unlocked)return;const states=Object.keys(labels) as ReviewState[];void Promise.all(states.map(state=>refreshPrivate(state,1))).catch(e=>toast.error(e.message));const listener=()=>{void Promise.all(states.map(state=>refreshRef.current(state,privatePageRef.current[state]))).catch(()=>undefined);};window.addEventListener("abu-kayan-shared-content-updated",listener);return()=>window.removeEventListener("abu-kayan-shared-content-updated",listener);},[ownerPin,unlocked]);
  const query=ownerPin?{...legacyQuery,data:(Object.keys(labels) as ReviewState[]).flatMap(state=>privatePageData[state]?.items||[]),isLoading:!loaded}:legacyQuery;
  const categories=ownerPin?publicCategories:legacyCategories;
  const utils = trpc.useUtils();
  const update = trpc.creativeSpace.update.useMutation();
  const remove = trpc.creativeSpace.remove.useMutation();
  const createWithPin = (trpc.creativeSpace as unknown as { createWithPin: { useMutation: () => { mutateAsync: (input: unknown) => Promise<AnySubmission>; isPending?: boolean } } }).createWithPin.useMutation();
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [states, setStates] = useState<Record<number, ReviewState>>({});
  const [openSections, setOpenSections] = useState<Record<ReviewState, boolean>>({ inbox: true, saved: true, waiting: false, cancelled: false });
  const [editorOpen, setEditorOpen] = useState<Record<number, boolean>>({});
  const [addDraft,setAddDraft]=useState<Draft|null>(null);
  const [addAttachmentPageId,setAddAttachmentPageId]=useState("");
  const [adding,setAdding]=useState(false);
  const [preview, setPreview] = useState<AnySubmission | null>(null);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const savePendingRef = useRef<() => Promise<boolean>>(async () => true);
  const saveNewRef = useRef<() => Promise<boolean>>(async () => true);
  const registerRef = useRef(onSaveRegister);
  const dirtyRef = useRef(onDirtyChange);
  const workspaceChangeRef = useRef(onWorkspaceChange);
  const busyCallback=useRef(onBusyChange);busyCallback.current=onBusyChange;
  useEffect(()=>{busyCallback.current?.(Object.values(busy).some(Boolean)||adding);},[busy,adding]);
  registerRef.current = onSaveRegister;
  dirtyRef.current = onDirtyChange;
  workspaceChangeRef.current = onWorkspaceChange;
  const items = useMemo(() => (query.data || []).map((item) => normalise(item as unknown as AnySubmission)), [query.data]);

  const getDraft = (item: AnySubmission): Draft => drafts[item.id] || {
    projectName: item.projectName || "", description: item.description || "", category: item.category, link: item.link || "", contact: item.contact || "", status: item.status, sortOrder: item.sortOrder, attachments: item.attachments || [],
  };
  const getState = (item: AnySubmission): ReviewState => states[item.id] || item.reviewState || (item.status === "rejected" ? "cancelled" : item.status === "approved" && item.isVisible === 1 ? "saved" : "inbox");
  const updateCache = () => { if(ownerPin)void Promise.all((Object.keys(labels) as ReviewState[]).map(state=>refreshPrivate(state,privatePageRef.current[state]))).catch(e=>toast.error(e.message)); void utils.creativeSpace.adminList.invalidate(); void utils.creativeSpace.list.invalidate(); void (utils.creativeSpace as unknown as { page?: { invalidate: () => Promise<unknown> } }).page?.invalidate(); workspaceChangeRef.current?.(); };

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
    toast.success(nextState === "saved" ? "تم اعتماد المشاركة وإتاحتها مباشرةً." : nextState ? `تم حفظ الحالة: ${labels[nextState]}.` : "تم حفظ التعديلات وإتاحتها مباشرةً.");
    updateCache();
  };

  const persist = async (item: AnySubmission, nextState?: ReviewState) => {
    const submitted = { ...getDraft(item) };
    const targetState = nextState || (getState(item) === "inbox" ? "saved" : undefined);
    setBusy((current) => ({ ...current, [item.id]: true }));
    try { await persistDraft(item, submitted, targetState); return true; }
    catch (error) { toast.error(error instanceof Error ? `تعذر الحفظ، بقيت تعديلاتك كما هي: ${error.message}` : "تعذر الحفظ، بقيت تعديلاتك كما هي."); return false; }
    finally { setBusy((current) => ({ ...current, [item.id]: false })); }
  };

  const savePending = async () => {
    const snapshots = Object.entries(drafts).map(([id, draft]) => ({ id: Number(id), item: items.find((candidate) => candidate.id === Number(id)), draft: { ...draft } }));
    if (!snapshots.length) return addDraft ? saveNewRef.current() : true;
    const results = await Promise.all(snapshots.map(async ({ id, item, draft }) => {
      const target=item||seenItems.current[Number(id)];
      if (!target) return true;
      setBusy((current) => ({ ...current, [target.id]: true }));
      try { await persistDraft(target, draft, getState(target) === "inbox" ? "saved" : undefined); return true; }
      catch (error) { toast.error(error instanceof Error ? `تعذر حفظ ${draft.projectName || "المشاركة"}: ${error.message}` : "تعذر حفظ إحدى المشاركات، وبقيت تعديلاتك."); return false; }
      finally { setBusy((current) => ({ ...current, [target.id]: false })); }
    }));
    if(!results.every(Boolean))return false;
    return addDraft ? saveNewRef.current() : true;
  };
  savePendingRef.current = savePending;

  useEffect(() => { dirtyRef.current?.(Object.keys(drafts).length > 0 || Boolean(addDraft)); }, [drafts,addDraft]);
  useEffect(() => {
    registerRef.current?.(() => savePendingRef.current());
    return () => registerRef.current?.(null);
    // Registration intentionally happens once; refs keep inline parent callbacks current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeDraft = (item: AnySubmission, key: keyof Draft, value: string | number) => setDrafts((current) => ({ ...current, [item.id]: { ...getDraft(item), [key]: value } }));
  const saveNewCreative=async()=>{
    if(!ownerPin){toast.error("يلزم رمز المالك لإضافة محتوى مباشر.");return false;}
    if(!addDraft||!(addDraft.projectName.trim()||addDraft.description.trim()||addDraft.link.trim()||addDraft.contact.trim()||addDraft.attachments.length)){toast.error("أضف اسمًا أو وصفًا أو رابطًا أو مرفقًا واحدًا على الأقل.");return false;}
    setAdding(true);
    try{
      await createWithPin.mutateAsync({ownerPin,projectName:addDraft.projectName.trim(),description:addDraft.description.trim(),category:addDraft.category,link:addDraft.link.trim(),contact:addDraft.contact.trim(),attachments:addDraft.attachments,imageUrls:[]});
      setAddDraft(null);setAddAttachmentPageId("");toast.success("تمت إضافة المحتوى وإتاحته مباشرةً.");updateCache();return true;
    }catch(error){toast.error(error instanceof Error?`تعذرت إضافة المحتوى: ${error.message}`:"تعذرت إضافة المحتوى.");return false;}
    finally{setAdding(false);}
  };
  saveNewRef.current=saveNewCreative;
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
  const grouped = (Object.keys(labels) as ReviewState[]).reduce((acc, state) => { acc[state] = ownerPin ? (privatePageData[state]?.items||[]).map(item=>normalise(item)).filter(item=>getState(item)===state) : items.filter((item) => getState(item) === state); return acc; }, {} as Record<ReviewState, AnySubmission[]>);
  const categoryName = (slug: string) => categories.data?.find((category) => category.slug === slug)?.name || "مساحة إبداعية";
  const totalItems=ownerPin?(Object.keys(labels) as ReviewState[]).reduce((sum,state)=>sum+(privatePageData[state]?.total||0),0):items.length;
  const notificationTotal=ownerPin?pendingTotal:items.filter(item=>item.status==="pending").length;

  return <section className="owner-services-card owner-creative-workspace" aria-label="مساحة الإبداع وإدارة المشاركات">
    <div className="owner-card-heading"><div><span className="studio-label">07 / مساحة الإبداع</span><h2>مراجعة المشاركات بصريًا</h2></div><span className="owner-status"><Eye size={15} /> {totalItems} مشاركة</span></div>
    {notificationTotal > 0 && <div className="owner-pending-alert" role="status"><Bell size={18} /><strong>{notificationTotal} مشاركة قيد المراجعة</strong><span>يعرض العدد المشاركات الجديدة في الوارد التي لم تراجعها بعد. اعتمادها يتيحها مباشرةً.</span></div>}
    <p className="owner-security-note">المحتوى الذي تضيفه كمالك يُحفظ ويُتاح مباشرةً بعد تأكيد قاعدة البيانات. طلبات الزوار تبقى خاضعة للمراجعة.</p>
    {ownerPin&&<div className="owner-creative-add"><button type="button" className="owner-save" onClick={()=>{setAddAttachmentPageId(newCreativeAttachmentPageId());setAddDraft({projectName:"",description:"",category:categories.data?.[0]?.slug||"",link:"",contact:"",status:"approved",sortOrder:0,attachments:[]});}}>إضافة محتوى</button>{addDraft&&<div className="owner-creative-editor"><h3>إضافة محتوى إبداعي</h3><label><span>اسم المشروع</span><input value={addDraft.projectName} onChange={event=>setAddDraft(current=>current?{...current,projectName:event.target.value}:current)} /></label><label className="owner-creative-wide"><span>الوصف</span><textarea value={addDraft.description} onChange={event=>setAddDraft(current=>current?{...current,description:event.target.value}:current)} /></label><label><span>القسم</span><select value={addDraft.category} onChange={event=>setAddDraft(current=>current?{...current,category:event.target.value}:current)}>{categories.data?.map(category=><option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label><label><span>الرابط</span><input value={addDraft.link} onChange={event=>setAddDraft(current=>current?{...current,link:event.target.value}:current)} /></label><label><span>التواصل</span><input value={addDraft.contact} onChange={event=>setAddDraft(current=>current?{...current,contact:event.target.value}:current)} /></label><div className="owner-creative-wide"><ContentAttachmentEditor attachments={addDraft.attachments} ownerPin={ownerPin} pageId={addAttachmentPageId} onBusyChange={onBusyChange} onChange={attachments=>setAddDraft(current=>current?{...current,attachments}:current)} /></div><div className="owner-creative-editor-actions"><button type="button" className="owner-save" disabled={adding||createWithPin.isPending} onClick={()=>void saveNewCreative()}><Save size={15}/> إضافة وإتاحة</button><button type="button" className="owner-add" disabled={adding} onClick={()=>setAddDraft(null)}>إلغاء</button></div></div>}</div>}
    <div className="owner-creative-sections">
      {(Object.keys(labels) as ReviewState[]).map((state) => {
        const stateData=privatePageData[state];
        const statePage=privatePage[state];
        const stateTotal=ownerPin?(stateData?.total||0):grouped[state].length;
        return <section className="owner-creative-section" key={state}>
        <button type="button" className="owner-creative-section-toggle" aria-expanded={openSections[state]} onClick={() => setOpenSections((current) => ({ ...current, [state]: !current[state] }))}><span><strong>{labels[state]}</strong><small>{stateTotal} عنصر</small></span>{openSections[state] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
        {openSections[state] && <div className="owner-creative-list">
          {query.isLoading && <p className="owner-empty">جارٍ تحميل المشاركات...</p>}
          {!query.isLoading && !grouped[state].length && <p className="owner-empty">لا توجد عناصر في هذا القسم.</p>}
          {grouped[state].map((item) => { const draft = getDraft(item); const title = draft.projectName || "مشاركة إبداعية"; const imageUrls = imagesOf(item); return <article className="owner-creative-card" key={item.id}>
            <button type="button" className="owner-creative-preview-card" onClick={() => setPreview({...item,...getDraft(item)})} aria-label={`فتح معاينة كاملة ${title}`}><div className="owner-creative-thumb">{imageUrls[0] ? <img src={imageUrls[0]} alt="" /> : <span>بدون صورة</span>}{imageUrls.length > 1 && <b>+{imageUrls.length - 1}</b>}</div><div><small>{categoryName(draft.category)} · {labels[state]}</small><strong>{title}</strong><p>{draft.description || "بدون وصف"}</p></div><ExternalLink size={16} aria-hidden="true" /></button>
            <div className="owner-creative-card-toolbar"><span className={`owner-creative-state owner-creative-state-${state}`}>{labels[state]}</span><button type="button" className="owner-creative-detail-toggle" aria-expanded={Boolean(editorOpen[item.id])} onClick={() => setEditorOpen((current) => ({ ...current, [item.id]: !current[item.id] }))}>{editorOpen[item.id] ? "إخفاء التفاصيل" : "تحرير التفاصيل"}</button></div>
            {editorOpen[item.id] && <div className="owner-creative-editor"><label><span>اسم المشروع</span><input value={draft.projectName} onChange={(event) => changeDraft(item, "projectName", event.target.value)} /></label><label className="owner-creative-wide"><span>الوصف</span><textarea value={draft.description} onChange={(event) => changeDraft(item, "description", event.target.value)} /></label><label><span>القسم</span><select value={draft.category} onChange={(event) => changeDraft(item, "category", event.target.value)}>{categories.data?.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label><label><span>الرابط</span><input value={draft.link} onChange={(event) => changeDraft(item, "link", event.target.value)} /></label><label><span>التواصل</span><input value={draft.contact} onChange={(event) => changeDraft(item, "contact", event.target.value)} /></label><label><span>الترتيب</span><input type="number" min="0" value={draft.sortOrder} onChange={(event) => changeDraft(item, "sortOrder", Number(event.target.value))} /></label><div className="owner-creative-wide"><ContentAttachmentEditor attachments={draft.attachments} ownerPin={ownerPin} pageId={creativePageId(item.id)} onBusyChange={onBusyChange} onChange={(attachments) => setDrafts((current) => ({ ...current, [item.id]: { ...getDraft(item), attachments } }))} /></div><div className="owner-creative-editor-actions"><button type="button" className="owner-save" disabled={busy[item.id]} onClick={() => { void persist(item); }}><Save size={15} /> حفظ وإتاحة</button></div></div>}
            <div className="owner-creative-actions">{state === "inbox" && <><button type="button" className="owner-save" disabled={busy[item.id]} onClick={() => move(item, "saved")}><Check size={15} /> حفظ</button><button type="button" className="owner-add" disabled={busy[item.id]} onClick={() => move(item, "waiting")}>انتظار</button><button type="button" className="owner-delete" disabled={busy[item.id]} onClick={() => move(item, "cancelled")}><X size={15} /> إلغاء</button></>}{state === "saved" && <button type="button" className="owner-add" disabled={busy[item.id]} onClick={() => move(item, "inbox")}><EyeOff size={15} /> إلغاء الحفظ وإعادة للوارد</button>}{state === "waiting" && <><button type="button" className="owner-save" disabled={busy[item.id]} onClick={() => move(item, "saved")}><Check size={15} /> اعتماد</button><button type="button" className="owner-delete" disabled={busy[item.id]} onClick={() => move(item, "inbox")}><X size={15} /> إلغاء الحفظ وإعادة للوارد</button></>}{state === "cancelled" && <button type="button" className="owner-add" disabled={busy[item.id]} onClick={() => move(item, "inbox")}><Eye size={15} /> إلغاء الحفظ وإعادة للوارد</button>}<button type="button" className="owner-delete" disabled={busy[item.id]} onClick={() => { void deleteItem(item); }}><Trash2 size={15} /> سلة</button></div>
          </article>; })}
          {ownerPin&&<nav className="owner-creative-pagination" aria-label={`صفحات ${labels[state]}`}><button type="button" className="owner-add" disabled={statePage<=1||adminPage.isPending} onClick={()=>void refreshPrivate(state,statePage-1)}><ChevronRight size={15}/> السابق</button><span>صفحة {statePage} من {Math.max(1,Math.ceil(stateTotal/12))}</span><button type="button" className="owner-add" disabled={!stateData?.hasMore||adminPage.isPending} onClick={()=>void refreshPrivate(state,statePage+1)}>التالي <ChevronLeft size={15}/></button></nav>}
        </div>}
      </section>;})}
    </div>
    <OwnerModal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview ? (preview.projectName || "معاينة المشاركة") : "معاينة المشاركة"} ariaLabel="معاينة المشاركة الإبداعية" className="owner-creative-preview-modal">
      {preview && <div className="owner-creative-full-preview"><div className="owner-creative-gallery">{imagesOf(preview).map((url) => <img key={url} src={url} alt={preview.projectName || "صورة المشاركة"} />)}{!imagesOf(preview).length && <div className="owner-creative-no-image">لا توجد صور مرفقة</div>}</div><div className="owner-creative-full-copy"><span>{categoryName(preview.category)}</span><p>{preview.description || "بدون وصف"}</p>{preview.contact && <small>التواصل: {preview.contact}</small>}{preview.link && (safeUrl(preview.link) ? <a href={safeUrl(preview.link) || undefined} target="_blank" rel="noreferrer noopener">فتح الرابط الفعلي <ExternalLink size={14} /></a> : <small>الرابط: {preview.link}</small>)}<ContentAttachments attachments={preview.attachments} excludeUrls={imagesOf(preview)} label="مرفقات المشاركة" /></div></div>}
    </OwnerModal>
  </section>;
}
