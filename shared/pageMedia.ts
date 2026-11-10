export type PageMedia = {
  id: string;
  pageId: string;
  name: string;
  originalName: string;
  folder: string;
  description: string;
  mimeType: string;
  size: number;
  url: string;
  downloadUrl: string;
  previewUrl?: string;
  key: string;
  createdAt: number;
};
export const PAGE_MEDIA_MAX_BYTES = 25 * 1024 * 1024;
export const PAGE_MEDIA_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mp3,.wav,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt';
export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
export function canPreviewMedia(mimeType: string) {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/') || mimeType === 'application/pdf' || mimeType === 'text/plain';
}
