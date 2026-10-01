'use client';

import { useEffect, useRef } from 'react';

// Navigation API typing for the browser versions newer than our DOM declarations.
type TraverseEvent = Event & {
  navigationType: string;
  destination: { sameDocument: boolean; url: string; key: string };
};
type Navigation = EventTarget & { traverseTo: (key: string) => { finished: Promise<unknown> } };

export function useAdminNavigationGuard(dirty: boolean, busy: boolean, onBlocked: () => void, askDiscard: () => Promise<boolean>) {
  const leaveApproved = useRef(false);

  useEffect(() => {
    const navigation = (window as Window & { navigation?: Navigation }).navigation;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (leaveApproved.current || (!dirty && !busy)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const mayLeave = async () => {
      if (leaveApproved.current) return true;
      if (busy) {
        onBlocked();
        return false;
      }
      return !dirty || await askDiscard();
    };
    const onClick = async (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const next = new URL(link.href);
      if (next.origin === location.origin && next.pathname === location.pathname && next.search === location.search && next.hash) return;
      if (!dirty && !busy && navigation) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (await mayLeave()) {
        // A document navigation keeps this guard effective across Next Link
        // transitions, without patching the router or adding history entries.
        leaveApproved.current = true;
        window.location.assign(next.href);
      }
    };
    const onNavigate = (event: Event) => {
      const next = event as TraverseEvent;
      if (leaveApproved.current || (!dirty && !busy)) return;
      if (next.navigationType !== 'traverse' || !next.destination.sameDocument || !event.cancelable) return;
      const target = new URL(next.destination.url);
      if (target.pathname === location.pathname && target.search === location.search) return;
      event.preventDefault();
      void mayLeave().then((approved) => {
        if (!approved) return;
        leaveApproved.current = true;
        void navigation?.traverseTo(next.destination.key).finished.catch(() => { leaveApproved.current = false; });
      });
    };
    if (dirty || busy) window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onClick, true);
    navigation?.addEventListener('navigate', onNavigate);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onClick, true);
      navigation?.removeEventListener('navigate', onNavigate);
    };
  }, [dirty, busy, onBlocked, askDiscard]);

  return () => { leaveApproved.current = true; };
}
