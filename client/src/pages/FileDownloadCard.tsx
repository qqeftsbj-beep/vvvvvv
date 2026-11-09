import React, { useState } from "react";
import { Download, FileArchive, FileText, Image as ImageIcon, Music, Play, Video } from "lucide-react";
import type { PageMedia } from "@shared/pageMedia";
import { formatFileSize } from "@shared/pageMedia";
import OwnerModal from "@/components/OwnerModal";
import "./fileDownloadCard.css";

function mediaKind(media: PageMedia) {
  if (media.mimeType.startsWith("image/")) return "image" as const;
  if (media.mimeType.startsWith("video/")) return "video" as const;
  if (media.mimeType.startsWith("audio/")) return "audio" as const;
  if (media.mimeType === "application/pdf") return "pdf" as const;
  return "file" as const;
}

function MediaIcon({ kind }: { kind: ReturnType<typeof mediaKind> }) {
  if (kind === "image") return <ImageIcon size={20} aria-hidden="true" />;
  if (kind === "video") return <Video size={20} aria-hidden="true" />;
  if (kind === "audio") return <Music size={20} aria-hidden="true" />;
  if (kind === "pdf") return <FileText size={20} aria-hidden="true" />;
  return <FileArchive size={20} aria-hidden="true" />;
}

export type FileDownloadCardProps = { media: PageMedia };

export function FileDownloadCard({ media }: FileDownloadCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const kind = mediaKind(media);
  const canPreview = kind !== "file";
  const label = media.name || media.originalName || "ملف";

  return (
    <article className="file-download-card">
      <div className="file-download-card-icon"><MediaIcon kind={kind} /></div>
      <div className="file-download-card-body">
        <h3 title={label}>{label}</h3>
        {media.description && <p>{media.description}</p>}
        <span className="file-download-card-meta">{formatFileSize(media.size)} · {media.mimeType || "ملف"}</span>
      </div>
      <div className="file-download-card-actions">
        {canPreview && <button type="button" className="file-download-preview" onClick={() => setPreviewOpen(true)}><Play size={14} /> معاينة</button>}
        <a className="file-download-link" href={media.downloadUrl} download={media.originalName || media.name} aria-label={`تنزيل ${label}`}><Download size={15} /> تنزيل</a>
      </div>
      <OwnerModal open={previewOpen} onClose={() => setPreviewOpen(false)} title={`معاينة ${label}`} ariaLabel={`معاينة ${label}`} className="file-download-owner-modal">
        <div className="file-download-preview-content">
          {kind === "image" && <img src={media.url} alt={label} />}
          {kind === "pdf" && <iframe title={`معاينة ${label}`} src={media.url} />}
          {kind === "video" && <video controls autoPlay src={media.url}><track kind="captions" /></video>}
          {kind === "audio" && <audio controls autoPlay src={media.url} />}
        </div>
      </OwnerModal>
    </article>
  );
}

export default FileDownloadCard;
