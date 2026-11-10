import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
export function useSharedContentSync() {
  const stamp = trpc.sharedContent.revision.useQuery(undefined, { refetchInterval: 2000, refetchIntervalInBackground: false, refetchOnWindowFocus: true, retry: 1 });
  const utils = trpc.useUtils();
  const last = useRef<{ revision: number; navigationRevision?: number } | null>(null);
  useEffect(() => {
    if (!stamp.data) return;
    const next = stamp.data;
    const previous = last.current;
    last.current = next;
    if (!previous) return;
    if (previous.revision !== next.revision) {
      window.dispatchEvent(new Event('abu-kayan-shared-content-updated'));
      void utils.templates.invalidate();
      void utils.freeSites.invalidate();
      void utils.creativeSpace.invalidate();
      void utils.templateCategories.invalidate();
      void utils.creativeCategories.invalidate();
    }
    if (previous.navigationRevision !== next.navigationRevision) {
      void utils.siteContent.navigation.invalidate();
      void utils.siteContent.get.invalidate();
      void utils.siteContent.page.invalidate();
    }
  }, [stamp.data, utils]);
}
