import { useEffect, useRef } from 'react';
export type LeaveRequest = { url?: string; logout?: boolean; historyBack?: boolean };

export function useUnsavedNavigation(dirty: boolean, onRequest: (request: LeaveRequest) => void) {
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const requestRef = useRef(onRequest); requestRef.current = onRequest;
  const allowed = useRef(false);
  const bypassRef = useRef<(request: LeaveRequest) => void>(() => undefined);
  useEffect(() => {
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    const push = originalPush.bind(window.history);
    const replace = originalReplace.bind(window.history);
    let restoring = false;
    let pendingLeave: LeaveRequest | null = null;
    const samePath = (url: string | URL | null | undefined) => !url || new URL(String(url), location.href).pathname === location.pathname && new URL(String(url), location.href).search === location.search;
    const guardedPush: History['pushState'] = (data, unused, url) => {
      if (dirtyRef.current && !allowed.current && !samePath(url)) { requestRef.current({ url: String(url) }); return; }
      push(data, unused, url);
    };
    const guardedReplace: History['replaceState'] = (data, unused, url) => {
      if (dirtyRef.current && !allowed.current && !samePath(url)) { requestRef.current({ url: String(url) }); return; }
      replace(data, unused, url);
    };
    window.history.pushState = guardedPush;
    window.history.replaceState = guardedReplace;
    const executeLeave = (request: LeaveRequest) => {
      allowed.current = true;
      if (request.historyBack) window.history.go(-1);
      else if (request.url) window.location.assign(request.url);
    };
    const click = (event: MouseEvent) => {
      if (!dirtyRef.current || allowed.current || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement)?.closest?.('a[href]');
      const href = anchor?.getAttribute('href');
      if (!href || href.startsWith('#') || anchor?.getAttribute('target') === '_blank' || anchor?.hasAttribute('download')) return;
      if (samePath(href)) return;
      event.preventDefault(); event.stopImmediatePropagation(); requestRef.current({ url: href });
    };
    const back = (event: PopStateEvent) => {
      // The restoration event must not reach the router or open the dialog again.
      if (restoring) {
        event.stopImmediatePropagation();
        restoring = false;
        if (pendingLeave) { const request = pendingLeave; pendingLeave = null; executeLeave(request); }
        return;
      }
      if (!dirtyRef.current || allowed.current) return;
      event.stopImmediatePropagation();
      restoring = true;
      requestRef.current({ historyBack: true });
      window.history.forward();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirtyRef.current && !allowed.current) { event.preventDefault(); event.returnValue = ''; } };
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', back, true);
    window.addEventListener('beforeunload', beforeUnload);
    bypassRef.current = request => {
      if (restoring) pendingLeave = request;
      else executeLeave(request);
    };
    return () => {
      document.removeEventListener('click', click, true);
      window.removeEventListener('popstate', back, true);
      window.removeEventListener('beforeunload', beforeUnload);
      if (window.history.pushState === guardedPush) window.history.pushState = originalPush;
      if (window.history.replaceState === guardedReplace) window.history.replaceState = originalReplace;
    };
  }, []);
  return { allowLeave: (request: LeaveRequest) => bypassRef.current(request) };
}
