import { CheckIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { dismiss, useToasts } from '@/store/toast.js';

// Short messages after an action, at the bottom of the screen (above the
// phone's bottom bar). One dark capsule each; an action such as "Undo" is a
// button inside it.
export function Toaster() {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex max-w-full animate-pop-in items-center gap-3 rounded-full bg-slate-900 py-2 pl-4 pr-2 text-sm text-white shadow-pop"
        >
          {t.tone === 'error' ? (
            <TriangleAlertIcon className="size-4 shrink-0 text-red-300" aria-hidden="true" />
          ) : (
            <CheckIcon className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
          )}
          <span className="min-w-0 truncate">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action.onClick();
                dismiss(t.id);
              }}
              className="rounded-full px-3 py-1 text-sm font-medium text-white underline-offset-2 hover:bg-white/15"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            className={cn('grid size-7 place-items-center rounded-full text-slate-300 hover:bg-white/15 hover:text-white')}
          >
            <XIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
