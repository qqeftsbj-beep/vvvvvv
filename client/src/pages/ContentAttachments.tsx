import OptimizedImage from "@/components/OptimizedImage";
import React from "react";
import { Download, FileArchive, FileText, Image as ImageIcon, Video } from "lucide-react";
import type { PageMedia } from "@shared/pageMedia";
import { formatFileSize } from "@shared/pageMedia";
import "./contentAttachments.css";

export type ContentAttachmentsProps = {
  attachments?: PageMedia[] | null;
  /** Primary card/gallery image URLs; matching attachments are omitted to prevent duplicate display. */
  excludeUrls?: Array<string | null | undefined>;
  label?: string;
};

export function uniqueAttachments(attachments: PageMedia[] | null | undefined, excludeUrls: Array<string | null | undefined> = []) {
  const seen = new Set(excludeUrls.filter((url): url is string => Boolean(url)));
  return (attachments || []).filter((media) => {
    if (!media?.url || seen.has(media.url)) return false;
    seen.add(media.url);
    return true;
  });
}

export default function ContentAttachments({ attachments, excludeUrls = [], label = "المرفقات" }: ContentAttachmentsProps) {
  const visible = uniqueAttachments(attachments, excludeUrls);
  if (!visible.length) return null;
  return <section className="content-attachments" aria-label={label}>
    {visible.map((media) => {
      const name = media.name || media.originalName || "ملف مرفق";
      const isImage = media.mimeType?.startsWith("image/");
      const isVideo = media.mimeType?.startsWith("video/");
      const isPdf = media.mimeType === "application/pdf";
      return <article className={`content-attachment content-attachment-${isImage ? "image" : isVideo ? "video" : "file"}`} key={media.id}>
        {isImage && <OptimizedImage className="content-attachment-image" src={media.url} alt={name} loading="lazy" decoding="async" />}
        {isVideo && <video className="content-attachment-video" src={media.url} controls preload="none" aria-label={`فيديو ${name}`}><track kind="captions" /></video>}
        {!isImage && !isVideo && <div className="content-attachment-file-icon" aria-hidden="true">{isPdf ? <FileText size={21} /> : <FileArchive size={21} />}</div>}
        <div className="content-attachment-info">
          <strong>{name}</strong>
          {media.description && <p>{media.description}</p>}
          <small>{isImage ? <ImageIcon size={13} aria-hidden="true" /> : isVideo ? <Video size={13} aria-hidden="true" /> : <FileText size={13} aria-hidden="true" />} {formatFileSize(media.size)}</small>
        </div>
        <a className="content-attachment-download" href={media.downloadUrl || media.url} download={media.originalName || name} aria-label={`تنزيل ${isImage ? "الصورة" : isVideo ? "الفيديو" : "الملف"}: ${name}`}><Download size={15} /> تنزيل {isImage ? "الصورة" : isVideo ? "الفيديو" : "الملف"}</a>
      </article>;
    })}
  </section>;
}
