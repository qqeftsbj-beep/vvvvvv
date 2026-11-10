import React, { useRef, useState } from "react";
import { FilePlus2, Trash2, Upload } from "lucide-react";
import type { PageMedia } from "@shared/pageMedia";
import { PAGE_MEDIA_ACCEPT, PAGE_MEDIA_MAX_BYTES, formatFileSize } from "@shared/pageMedia";
import { trpc } from "@/lib/trpc";
import "./contentAttachments.css";

export type ContentAttachmentEditorProps = {
  attachments: PageMedia[];
  onChange: (attachments: PageMedia[]) => void;
  ownerPin?: string;
  pageId: string;
  onBusyChange?: (busy: boolean) => void;
};

type UploadMutation = { mutateAsync: (input: Record<string, unknown>) => Promise<PageMedia> };
function useUploadMutation(): UploadMutation | null {
  try {
    const namespace = (trpc as unknown as { pageMedia?: { upload?: { useMutation: () => UploadMutation } } }).pageMedia;
    return namespace?.upload?.useMutation() || null;
  } catch { return null; }
}

const MIME_BY_EXTENSION: Record<string, string> = { zip: "application/zip", pdf: "application/pdf", txt: "text/plain", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
function fileMime(file: File) { return file.type || MIME_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() || ""] || "application/octet-stream"; }
function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
    reader.onerror = () => reject(reader.error || new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export default function ContentAttachmentEditor({ attachments, onChange, ownerPin = "", pageId, onBusyChange }: ContentAttachmentEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useUploadMutation();
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const rejected = files.filter((file) => file.size > PAGE_MEDIA_MAX_BYTES);
    const accepted = files.filter((file) => file.size <= PAGE_MEDIA_MAX_BYTES);
    if (rejected.length) setError(`${rejected.map((file) => `${file.name}: يتجاوز الحد الأقصى 25MB.`).join(" ")}`);
    else setError("");
    if (!accepted.length) return;
    if (!mutation) { setError("خدمة رفع المرفقات غير متاحة."); return; }
    onBusyChange?.(true);
    setProgress({ current: 0, total: accepted.length });
    const uploaded: PageMedia[] = [];
    const failed: string[] = [];
    try {
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index];
        setProgress({ current: index + 1, total: accepted.length });
        try {
          const item = await mutation.mutateAsync({ ownerPin, pageId, name: file.name.replace(/\.[^.]+$/, "") || file.name, fileName: file.name, mimeType: fileMime(file), data: await readBase64(file), folder: "", description: "" });
          uploaded.push(item);
        } catch (cause) { failed.push(`${file.name}: ${cause instanceof Error ? cause.message : "فشل الرفع."}`); }
      }
      if (uploaded.length) onChange([...attachments, ...uploaded]);
      setError([rejected.map((file) => `${file.name}: يتجاوز الحد الأقصى 25MB.`), failed].flat().join(" "));
    } finally { setProgress(null); onBusyChange?.(false); }
  };

  return <section className="content-attachment-editor" aria-label="المرفقات الاختيارية">
    <div className="content-attachment-editor-heading"><strong>مرفقات اختيارية</strong><small>صورة أو فيديو أو ملف · حتى 25MB للملف</small></div>
    <label className="content-attachment-upload"><input ref={inputRef} type="file" multiple accept={PAGE_MEDIA_ACCEPT} onChange={(event) => { void upload(event); }} disabled={Boolean(progress)} /><Upload size={16} /> {progress ? `جارٍ الرفع ${progress.current}/${progress.total}` : <><FilePlus2 size={15} /> رفع مرفقات</>}</label>
    {error && <div className="content-attachment-error" role="alert">{error}</div>}
    {!attachments.length && <small className="content-attachment-editor-note">اختياري — يمكنك الحفظ دون أي مرفقات.</small>}
    {attachments.length > 0 && <div className="content-attachment-editor-list">{attachments.map((item) => <div className="content-attachment-editor-item" key={item.id}>
      {item.mimeType.startsWith("image/") ? <img src={item.previewUrl || item.url} alt="" /> : item.mimeType.startsWith("video/") ? <video src={item.previewUrl || item.url} preload="none" muted /> : <span aria-hidden="true"><FilePlus2 size={20} /></span>}
      <span><strong>{item.name || item.originalName}</strong><small>{formatFileSize(item.size)} · {item.mimeType}</small></span>
      <button type="button" aria-label={`إزالة ${item.name || item.originalName}`} onClick={() => onChange(attachments.filter((candidate) => candidate.id !== item.id))}><Trash2 size={15} /></button>
    </div>)}</div>}
  </section>;
}
