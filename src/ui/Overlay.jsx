import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { Button, IconButton } from './Button.jsx';

// Shared behaviour of a layer over the page: Escape closes it, the page below
// does not scroll, and focus goes into the layer and back to where it was.
function useLayer(open, onClose, panelRef) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose, panelRef]);
}

// A panel that slides in from the right on desktops and rises from the
// bottom on phones. Used for quick forms and for "About this screen".
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'md:w-[480px]' }) {
  const panelRef = useRef(null);
  useLayer(open, onClose, panelRef);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'absolute inset-x-2 bottom-2 flex max-h-[92dvh] animate-sheet-up flex-col rounded-3xl bg-white shadow-pop outline-none',
          'md:inset-x-auto md:bottom-2 md:right-2 md:top-2 md:max-h-none md:animate-slide-in',
          width,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-7 text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <IconButton icon={XIcon} label="Close" onClick={onClose} className="-mr-2" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-3">{footer}</footer>
        )}
      </section>
    </div>,
    document.body,
  );
}

// A small centred dialog for one question.
export function Modal({ open, onClose, title, children, footer, width = 'max-w-md' }) {
  const panelRef = useRef(null);
  useLayer(open, onClose, panelRef);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('relative w-full animate-pop-in rounded-3xl bg-white p-6 shadow-pop outline-none', width)}
      >
        <h2 className="text-lg font-semibold leading-7 text-slate-900">{title}</h2>
        <div className="mt-2 text-sm text-slate-600">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </section>
    </div>,
    document.body,
  );
}

export const ConfirmDialog = ({
  open, title, children, confirmLabel = 'Confirm', tone = 'primary', onConfirm, onCancel,
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    footer={
      <>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
      </>
    }
  >
    {children}
  </Modal>
);
