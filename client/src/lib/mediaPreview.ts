export function mediaPreviewSrc(source: string | null | undefined, width: 360 | 720 | 1280 = 720): string | undefined {
  if (!source) return undefined;
  const storage = source.match(/^\/manus-storage\/([^?#]+)$/);
  if (storage && /\.(jpe?g|png|webp)$/i.test(storage[1])) {
    let key: string;
    try { key = decodeURIComponent(storage[1]); } catch { return source; }
    return `/api/media-preview/storage?key=${encodeURIComponent(key)}&width=${width}`;
  }
  const file = source.match(/^\/api\/page-media\/([a-f0-9-]{36})$/i);
  if (file) return `/api/media-preview/file/${file[1]}?width=${width}`;
  return source;
}
export function mediaPreviewSrcSet(source: string | null | undefined): string | undefined {
  if (!source || mediaPreviewSrc(source, 360) === source) return undefined;
  return ([360, 720, 1280] as const).map(width => `${mediaPreviewSrc(source, width)} ${width}w`).join(', ');
}
