import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';

// A layer that floats next to an anchor (menus, dropdowns, search results).
// It is drawn in the page's body so no scrolling panel can clip it, flips
// above the anchor when there is no room below, closes with Escape or a click
// outside, and follows the anchor when the page scrolls or resizes.
export function Floating({
  anchorRef, open, onClose, side = 'bottom', align = 'start', matchWidth = false, className, children, role,
}) {
  const ref = useRef(null);
  const id = useId();
  const [pos, setPos] = useState(null);

  // Only one floating layer is open at a time: opening this one closes the
  // others (a menu, the bell, the search results).
  useEffect(() => {
    if (!open) return undefined;
    window.dispatchEvent(new CustomEvent('floating-open', { detail: id }));
    const onOther = (e) => {
      if (e.detail !== id) onClose();
    };
    window.addEventListener('floating-open', onOther);
    return () => window.removeEventListener('floating-open', onOther);
  }, [open, id, onClose]);

  const place = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const el = ref.current;
    if (!anchor || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 6;
    let left;
    let top;
    if (side === 'right') {
      left = anchor.right + gap + 4;
      top = Math.min(anchor.top, vh - h - 8);
    } else {
      left = align === 'end' ? anchor.right - w : anchor.left;
      top = anchor.bottom + gap;
      if (top + h > vh - 8 && anchor.top - h - gap > 8) top = anchor.top - h - gap;
    }
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, top);
    const width = matchWidth ? anchor.width : undefined;
    setPos((p) => (p && p.left === left && p.top === top && p.width === width ? p : { left, top, width }));
  }, [anchorRef, side, align, matchWidth]);

  // Place before paint, and again after every render (content may change size).
  useLayoutEffect(() => {
    if (open) place();
  });

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, onClose, place, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      role={role}
      style={{
        position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: pos?.width, zIndex: 60,
        visibility: pos ? 'visible' : 'hidden',
      }}
      className={cn('animate-pop-in rounded-2xl bg-white shadow-pop', className)}
    >
      {children}
    </div>,
    document.body,
  );
}

// A menu of actions. `button` receives { onClick, 'aria-*' } to spread on the
// trigger it draws; `items` are { label, icon, onClick, tone, checked, hint,
// disabled } or { separator: true } or { heading: 'Text' }.
export function Menu({ button, items, align = 'end', side = 'bottom', width = 'min-w-56', header, footer }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) listRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const nodes = [...listRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const i = nodes.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        {button({ onClick: () => setOpen((o) => !o), 'aria-haspopup': 'menu', 'aria-expanded': open })}
      </span>
      <Floating anchorRef={anchorRef} open={open} onClose={close} align={align} side={side} className={cn('p-1.5', width)}>
        {header}
        <div ref={listRef} role="menu" onKeyDown={onKeyDown}>
          {items.map((item, i) => {
            if (item.separator) return <div key={i} className="my-1.5 h-px bg-slate-200" role="separator" />;
            if (item.heading) {
              return <div key={i} className="px-3 pb-1 pt-2 text-xs font-medium text-slate-500">{item.heading}</div>;
            }
            const Icon = item.icon;
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onClick?.();
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-100 ease-standard',
                  'hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45',
                  item.tone === 'danger' ? 'text-red-700 hover:bg-red-50 focus-visible:bg-red-50' : 'text-slate-800',
                )}
              >
                {Icon && <Icon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {item.sub && <span className="block truncate text-xs text-slate-500">{item.sub}</span>}
                </span>
                {item.hint && <span className="text-xs text-slate-400">{item.hint}</span>}
                {item.checked && <CheckIcon className="size-4 shrink-0 text-slate-900" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {footer}
      </Floating>
    </>
  );
}
