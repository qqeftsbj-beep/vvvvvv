import { describe, expect, it } from 'vitest';
import { resolvePageTitle } from './usePageTitle';
import { mediaPreviewSrc, mediaPreviewSrcSet } from '@/lib/mediaPreview';

describe('published page headings', () => {
  it('uses the current published button name and does not hard-code the old template names', () => {
    expect(resolvePageTitle('/templates/gemini', 'Default', { buttons: [{ action: 'gemini', label: 'تصاميم عبر ChatGPT وGemini', visible: true }] })).toBe('تصاميم عبر ChatGPT وGemini');
  });
  it('uses internal and custom-page destination labels while ignoring hidden and unrelated buttons', () => {
    expect(resolvePageTitle('/custom/school', 'Default', { buttons: [{ action: 'custom-page', url: '/custom/school', label: 'Hidden', visible: false }, { action: 'internal', url: '/custom/school', label: 'التعليم' }] })).toBe('التعليم');
    expect(resolvePageTitle('/free-sites', 'المواقع المجانية', { buttons: [{ action: 'gemini', label: 'Other' }] })).toBe('المواقع المجانية');
  });
  it('uses a published page title without exposing draft page names', () => {
    expect(resolvePageTitle('/custom/school', 'Default', { pages: [{ slug: 'school', title: 'التعليم', status: 'published' }] })).toBe('التعليم');
    expect(resolvePageTitle('/custom/school', 'Default', { pages: [{ slug: 'school', title: 'Draft', status: 'draft' }] })).toBe('Default');
  });
});
describe('non-destructive display derivatives', () => {
  it('generates bounded responsive derivatives only for approved internal image paths', () => {
    expect(mediaPreviewSrc('/manus-storage/a/photo.jpg', 360)).toBe('/api/media-preview/storage?key=a%2Fphoto.jpg&width=360');
    expect(mediaPreviewSrcSet('/manus-storage/photo.png')).toContain('1280w');
    expect(mediaPreviewSrc('https://unrelated.example/photo.jpg')).toBe('https://unrelated.example/photo.jpg');
    expect(mediaPreviewSrc('/manus-storage/movie.mp4')).toBe('/manus-storage/movie.mp4');
    expect(mediaPreviewSrc('/manus-storage/animation.gif')).toBe('/manus-storage/animation.gif');
    expect(mediaPreviewSrc(undefined)).toBeUndefined();
  });
});
