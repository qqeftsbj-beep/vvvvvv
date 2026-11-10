import React, { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { mediaPreviewSrc, mediaPreviewSrcSet } from '@/lib/mediaPreview';

type Props = ImgHTMLAttributes<HTMLImageElement> & { originalSrc?: string; previewSrc?: string; fullSize?: boolean; previewWidth?: 360 | 720 | 1280 };
/** The original stays available for full-size viewing/download. Failed derivatives fall back once. */
export default function OptimizedImage({ src, originalSrc, previewSrc, previewWidth = 720, fullSize = false, loading = 'lazy', decoding = 'async', srcSet, sizes, onError, ...props }: Props) {
  const original = originalSrc || src;
  const [fallback, setFallback] = useState(false);
  useEffect(() => setFallback(false), [original, previewSrc]);
  const display = previewSrc || mediaPreviewSrc(original, previewWidth) || original;
  return <img {...props} src={fallback || fullSize ? original : display} srcSet={fallback || fullSize ? undefined : srcSet || (!previewSrc ? mediaPreviewSrcSet(original) : undefined)} sizes={sizes || '(max-width: 680px) 92vw, 720px'} loading={loading} decoding={decoding} onError={event => { if (!fallback && display !== original) setFallback(true); else onError?.(event); }} />;
}
