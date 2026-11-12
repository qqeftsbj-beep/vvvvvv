import React, { ReactNode, CSSProperties, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './OwnerModal.css';

let lockDepth = 0;
let bodyOverflow = '';
let bodyPadding = '';
export default function OwnerModal({ open, onClose, title, children, ariaLabel, className = '', style, closeDisabled = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; ariaLabel?: string; className?: string; style?: CSSProperties; closeDisabled?: boolean }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  const disabledRef = useRef(closeDisabled); disabledRef.current = closeDisabled;
  useEffect(() => {
    if (!open) return;
    const priorFocus = document.activeElement as HTMLElement | null;
    if (lockDepth++ === 0) {
      bodyOverflow = document.body.style.overflow; bodyPadding = document.body.style.paddingRight;
      const gap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      document.body.style.overflow = 'hidden';
      if (gap < 80 && gap > 0) document.body.style.paddingRight = `${gap}px`;
    }
    ref.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      // Only the topmost portal dialog responds to keys.
      const dialogs = document.querySelectorAll('[data-owner-modal]');
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!disabledRef.current) onCloseRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') || []).filter(el => !el.closest('[hidden]'));
      if (!controls.length) { event.preventDefault(); ref.current?.focus(); return; }
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      if (--lockDepth === 0) { document.body.style.overflow = bodyOverflow; document.body.style.paddingRight = bodyPadding; }
      if (priorFocus?.isConnected) priorFocus.focus();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(<div dir="rtl" className="owner-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !closeDisabled) onClose(); }}><div ref={ref} data-owner-modal style={style} className={`owner-modal-dialog ${className}`} role="dialog" aria-modal="true" aria-label={ariaLabel} aria-labelledby={ariaLabel ? undefined : titleId} tabIndex={-1}><header className="owner-modal-top"><h2 id={titleId}>{title}</h2><button type="button" disabled={closeDisabled} onClick={onClose} aria-label={`إغلاق ${title}`}>×</button></header><div className="owner-modal-content">{children}</div></div></div>, document.body);
}
