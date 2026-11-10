import { useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useOwnerPreview } from '@/contexts/OwnerPreviewContext';

type NavigationButton = { label?: string; action?: string; url?: string; visible?: boolean; order?: number };
type NavigationPage = { slug?: string; title?: string; visible?: boolean; status?: string };
const paths: Record<string, string> = { gemini: '/templates/gemini', 'chat-gbt': '/templates/chat-gbt', 'free-sites': '/free-sites', 'creative-space': '/creative-space' };
function pathname(value: string) {
  try { return new URL(value, 'https://navigation.invalid').pathname.replace(/\/$/, '') || '/'; }
  catch { return ''; }
}
export function resolvePageTitle(path: string, fallback: string, navigation?: { buttons?: NavigationButton[]; pages?: NavigationPage[] } | null) {
  const target = pathname(path);
  const button = [...(navigation?.buttons || [])].filter(item => item.visible !== false).sort((a,b) => (a.order || 0) - (b.order || 0)).find(item => {
    const url = ['internal', 'custom-page'].includes(item.action || '') ? item.url : paths[item.action || ''];
    return url && pathname(url) === target && item.label?.trim();
  });
  if (button?.label?.trim()) return button.label.trim();
  const page = navigation?.pages?.find(item => item.visible !== false && item.status !== 'draft' && pathname(`/custom/${item.slug}`) === target);
  return page?.title?.trim() || fallback;
}
export function usePageTitle(path: string, fallback: string) {
  const preview = useOwnerPreview();
  const query = trpc.siteContent.navigation.useQuery(undefined, { enabled: !preview, staleTime: 60_000, refetchOnWindowFocus: true });
  const navigation = preview ? preview.content : query.data;
  const title = resolvePageTitle(path, fallback, navigation);
  useEffect(() => { document.title = `${title} | أبو كيان الجنيد`; }, [title]);
  return title;
}
