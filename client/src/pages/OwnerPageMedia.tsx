import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clipboard, Copy, Download, Eye, FileText, Folder, FolderPlus, Link2, Pencil, Play, Trash2, Upload, X } from "lucide-react";
import type { EditablePage, PageDraft } from "@/lib/siteContent";
import type { PageMedia } from "@shared/pageMedia";
import { PAGE_MEDIA_ACCEPT, PAGE_MEDIA_MAX_BYTES, canPreviewMedia, formatFileSize } from "@shared/pageMedia";
import { editablePage, updatePageDraft } from "@/lib/pageDrafts";
import { trpc } from "@/lib/trpc";
import OwnerModal from "@/components/OwnerModal";
import "./ownerPageMedia.css";

export type OwnerPageMediaProps = { page: EditablePage; ownerPin?: string; onChange: (page: EditablePage) => void; onBusyChange?: (busy: boolean) => void };

type UploadMutation = { mutateAsync: (input: Record<string, unknown>) => Promise<PageMedia> };

function useOptionalMediaMutations(): { upload: UploadMutation | null; list: { mutateAsync: (input: Record<string, unknown>) => Promise<PageMedia[]> } | null } {
  try {
    const namespace = (trpc as unknown as { pageMedia?: { upload?: { useMutation: () => UploadMutation }; list?: { useMutation: () => { mutateAsync: (input: Record<string, unknown>) => Promise<PageMedia[]> } } } }).pageMedia;
    return { upload: namespace?.upload?.useMutation() || null, list: namespace?.list?.useMutation() || null };
  } catch { return { upload: null, list: null }; }
}

export function mediaSnippet(media: PageMedia, kind: "img" | "video" | "audio" | "link" = "link") {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const label = escape(media.description || media.name || media.originalName);
  if (kind === "img") return `<img src="${media.url}" alt="${label}" />`;
  if (kind === "video") return `<video controls src="${media.url}"></video>`;
  if (kind === "audio") return `<audio controls src="${media.url}"></audio>`;
  return `<a href="${media.downloadUrl || media.url}" download="${escape(media.name || media.originalName)}">${label}</a>`;
}

export function attachStoredMedia(page: EditablePage, item: PageMedia): EditablePage {
  const current = editablePage(page);
  if ((current.media || []).some(candidate => candidate.id === item.id)) return page;
  return updatePageDraft(page, { media: [...(current.media || []), item] });
}

export function replaceMediaReferences(page: EditablePage, previousUrl: string, nextUrl: string): EditablePage {
  const replace = (value?: string) => value?.split(previousUrl).join(nextUrl);
  const current = editablePage(page);
  const next: PageDraft = {
    ...current,
    blocks: current.blocks?.map((block) => ({ ...block, image: replace(block.image), content: replace(block.content), url: replace(block.url) })),
    customCode: current.customCode ? { ...current.customCode, html: replace(current.customCode.html) || "", css: replace(current.customCode.css) || "", js: replace(current.customCode.js) || "" } : current.customCode,
    appearance: current.appearance ? { ...current.appearance, backgroundImage: replace(current.appearance.backgroundImage) } : current.appearance,
  };
  return updatePageDraft(page, next);
}

function Preview({ media, onClose }: { media: PageMedia; onClose: () => void }) {
  const content = media.mimeType.startsWith("image/") ? <img src={media.url} alt={media.description || media.name} /> : media.mimeType.startsWith("video/") ? <video controls src={media.url} /> : media.mimeType.startsWith("audio/") ? <audio controls src={media.url} /> : media.mimeType === "application/pdf" ? <iframe title={media.name} src={media.url} /> : <pre>{media.description || media.originalName}</pre>;
  return <OwnerModal open onClose={onClose} title={`معاينة ${media.name}`} ariaLabel={`معاينة ${media.name}`} className="owner-media-preview">{content}</OwnerModal>;
}

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || ""); reader.onerror = () => reject(reader.error || new Error("تعذر قراءة الملف")); reader.readAsDataURL(file); });
}

export default function OwnerPageMedia({ page, ownerPin = "", onChange, onBusyChange }: OwnerPageMediaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [folderInput, setFolderInput] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<PageMedia | null>(null);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const mutations = useOptionalMediaMutations();
  const mutation = mutations.upload;
  const [stored, setStored] = useState<PageMedia[]>([]);
  const [loadingStored, setLoadingStored] = useState(false);
  const refreshStored = async () => { if (!mutations.list || !ownerPin) return; setLoadingStored(true); try { setStored(await mutations.list.mutateAsync({ ownerPin, pageId: page.id })); } catch (error) { setErrors(current => [...current, error instanceof Error ? error.message : "تعذر استعادة قائمة الوسائط."]); } finally { setLoadingStored(false); } };
  useEffect(() => { void refreshStored(); }, [ownerPin, page.id]);
  const latestPage = useRef(page); latestPage.current = page;
  const current = editablePage(page);
  const media = current.media || [];
  const folders = current.folders || [];
  const attachedIds = new Set(media.map(item => item.id));
  const storedNotAttached = stored.filter(item => !attachedIds.has(item.id) && (!selectedFolder || item.folder === selectedFolder));
  const attachStored = (item: PageMedia) => { onChange(attachStoredMedia(page, item)); setStored(previous => previous.filter(file => file.id !== item.id)); };
  const visible = useMemo(() => media.filter((item) => !selectedFolder || item.folder === selectedFolder), [media, selectedFolder]);
  const change = (patch: Partial<PageDraft>) => onChange(updatePageDraft(page, patch));

  const addFolder = () => { const name = folderInput.trim(); if (!name || folders.includes(name)) return; change({ folders: [...folders, name] }); setFolderInput(""); };
  const renameFolder = (oldName: string) => { const name = window.prompt("اسم المجلد الجديد", oldName)?.trim(); if (!name || name === oldName || folders.includes(name)) return; change({ folders: folders.map((item) => item === oldName ? name : item), media: media.map((item) => item.folder === oldName ? { ...item, folder: name } : item) }); if (selectedFolder === oldName) setSelectedFolder(name); };
  const deleteFolder = (name: string) => { if (!window.confirm(`حذف المجلد «${name}»؟ ستُنقل ملفاته إلى الجذر.`)) return; change({ folders: folders.filter((item) => item !== name), media: media.map((item) => item.folder === name ? { ...item, folder: "" } : item) }); if (selectedFolder === name) setSelectedFolder(""); };
  const copy = async (value: string) => { try { await navigator.clipboard?.writeText(value); } catch { /* Clipboard can be unavailable in tests. */ } };
  const remove = (item: PageMedia) => { if (window.confirm(`إزالة «${item.name}» من هذه الصفحة؟ الملف الأصلي سيبقى في التخزين.`)) change({ media: media.filter((candidate) => candidate.id !== item.id) }); };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []); const replacement = replacementId; setReplacementId(null); event.target.value = ""; if (!files.length) return;
    const rejected = files.filter((file) => file.size > PAGE_MEDIA_MAX_BYTES); const accepted = files.filter((file) => file.size <= PAGE_MEDIA_MAX_BYTES);
    const nextErrors = rejected.map((file) => `${file.name}: يتجاوز الحد الأقصى 25MB.`); setErrors(nextErrors); if (!accepted.length) return;
    onBusyChange?.(true); setProgress({ current: 0, total: accepted.length }); const successful: PageMedia[] = []; const failed: string[] = [];
    try {
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index]; setProgress({ current: index + 1, total: accepted.length });
        try {
          if (!mutation) throw new Error("خدمة رفع الوسائط غير متاحة بعد.");
          const result = await mutation.mutateAsync({ ownerPin, pageId: page.id, name: file.name.replace(/\.[^.]+$/, ""), folder: selectedFolder, description: "", fileName: file.name, mimeType: file.type || ({ zip: "application/zip", pdf: "application/pdf", txt: "text/plain", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } as Record<string,string>)[file.name.split(".").pop()?.toLowerCase() || ""] || "application/octet-stream", data: await readBase64(file) });
          successful.push(result);
        } catch (error) { failed.push(`${file.name}: ${error instanceof Error ? error.message : "فشل الرفع."}`); }
      }
      if (successful.length) {
        const latest = latestPage.current;
        const latestMedia = editablePage(latest).media || [];
        const oldItem = replacement ? latestMedia.find(item => item.id === replacement) : undefined;
        const attached = oldItem ? successful.map((item, index) => index === 0 ? { ...item, name: oldItem.name, description: oldItem.description, folder: oldItem.folder } : item) : successful;
        let next = updatePageDraft(latest, { media: [...latestMedia.filter(item => !replacement || item.id !== replacement), ...attached] });
        if (replacement) {
          const old = oldItem;
          const fresh = successful[0];
          if (old && fresh) next = replaceMediaReferences(next, old.url, fresh.url);
        }
        onChange(next);
      }
      setErrors([...nextErrors, ...failed]);
    } finally { setProgress(null); onBusyChange?.(false); }
  };
  return <section className="owner-page-media" aria-label="مكتبة وسائط الصفحة"><div className="owner-media-heading"><div><strong>مكتبة الوسائط</strong><small>صور، فيديو، صوت وملفات حتى 25MB للملف الواحد.</small></div><button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(progress)}><Upload size={15} /> {progress ? `جارٍ الرفع ${progress.current}/${progress.total}` : "رفع ملفات"}</button><input ref={inputRef} hidden type="file" multiple accept={PAGE_MEDIA_ACCEPT} onChange={upload} /></div><div className="owner-media-folders"><button type="button" className={!selectedFolder ? "is-selected" : ""} onClick={() => setSelectedFolder("")}><Folder size={15} /> الكل ({media.length})</button>{folders.map((name) => <span key={name}><button type="button" className={selectedFolder === name ? "is-selected" : ""} onClick={() => setSelectedFolder(name)}><Folder size={15} /> {name}</button><button type="button" aria-label={`إعادة تسمية ${name}`} onClick={() => renameFolder(name)}><Pencil size={13} /></button><button type="button" aria-label={`حذف ${name}`} onClick={() => deleteFolder(name)}><Trash2 size={13} /></button></span>)}<input value={folderInput} onChange={(event) => setFolderInput(event.target.value)} placeholder="مجلد جديد" /><button type="button" onClick={addFolder}><FolderPlus size={15} /> إضافة</button></div>{errors.length > 0 && <div className="owner-media-errors" role="alert">{errors.map((error) => <div key={error}>{error}</div>)}</div>}<div className="owner-media-archive"><div><strong>الملفات المحفوظة في التخزين</strong><small>يمكن إعادة إرفاق ملف أزيل من الصفحة أو جرى استبداله دون إعادة رفعه.</small></div><button type="button" onClick={() => void refreshStored()} disabled={loadingStored}>{loadingStored ? "جارٍ التحديث..." : "تحديث الملفات"}</button></div>{storedNotAttached.length > 0 && <div className="owner-media-grid">{storedNotAttached.map(item => <article className="owner-media-card" key={`stored-${item.id}`}><strong>{item.name}</strong><small>{formatFileSize(item.size)} · نسخة محفوظة</small><button type="button" onClick={() => attachStored(item)}>إعادة إرفاق</button></article>)}</div>}{visible.length === 0 && storedNotAttached.length === 0 ? <p className="owner-media-empty">لا توجد ملفات في هذا المجلد بعد.</p> : <div className="owner-media-grid">{visible.map((item) => <article className="owner-media-card" key={item.id}>{item.mimeType.startsWith("image/") ? <img src={item.url} alt="" /> : item.mimeType.startsWith("video/") ? <video muted src={item.url} /> : item.mimeType.startsWith("audio/") ? <div className="owner-media-type"><Play size={20} /></div> : <div className="owner-media-type"><FileText size={20} /></div>}<strong title={item.originalName}>{item.name || item.originalName}</strong><details className="owner-media-metadata"><summary>الاسم والوصف والمجلد</summary><label><span>اسم الملف</span><input value={item.name} onChange={event => change({ media: media.map(candidate => candidate.id === item.id ? { ...candidate, name: event.target.value } : candidate) })} /></label><label><span>شرح الملف</span><textarea rows={2} value={item.description} onChange={event => change({ media: media.map(candidate => candidate.id === item.id ? { ...candidate, description: event.target.value } : candidate) })} /></label><label><span>المجلد</span><select value={item.folder} onChange={event => change({ media: media.map(candidate => candidate.id === item.id ? { ...candidate, folder: event.target.value } : candidate) })}><option value="">الجذر</option>{folders.map(folder => <option key={folder} value={folder}>{folder}</option>)}</select></label></details><small>{formatFileSize(item.size)} · {item.folder || "الجذر"}</small><div className="owner-media-actions"><button type="button" onClick={() => canPreviewMedia(item.mimeType) && setPreview(item)} disabled={!canPreviewMedia(item.mimeType)}><Eye size={13} /> معاينة</button><button type="button" onClick={() => copy(item.url)}><Link2 size={13} /> الرابط</button><button type="button" onClick={() => copy(mediaSnippet(item, item.mimeType.startsWith("image/") ? "img" : item.mimeType.startsWith("video/") ? "video" : item.mimeType.startsWith("audio/") ? "audio" : "link"))}><Copy size={13} /> HTML</button><button type="button" onClick={() => { setReplacementId(item.id); inputRef.current?.click(); }}><Upload size={13} /> استبدال</button><a href={item.downloadUrl || item.url} download={item.name || item.originalName}><Download size={13} /> تنزيل</a><button type="button" className="owner-media-danger" onClick={() => remove(item)} aria-label={`إزالة ${item.name}`}><Trash2 size={13} /></button></div></article>)}</div>}<div className="owner-media-hint"><Clipboard size={14} /> الرفع يضيف الملف إلى مسودة الصفحة؛ إزالة المرجع لا تحذف الصف أو الملف الأصلي من التخزين.</div>{preview && <Preview media={preview} onClose={() => setPreview(null)} />}</section>;
}
