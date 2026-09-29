import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import { BellIcon, CircleCheckIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { IconButton } from '@/ui/Button.jsx';
import { Floating } from '@/ui/Floating.jsx';
import { useAttention } from './attention.js';

const dot = { red: 'bg-red-500', orange: 'bg-orange-500', blue: 'bg-blue-500', green: 'bg-green-500' };

// The bell lists what needs the person: approvals, renewals, critical
// deficiencies, overdue money (steps to come), and today what the customer
// and equipment data already say.
export function Bell() {
  const { items, total } = useAttention();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <span ref={ref} className="inline-flex">
        <IconButton
          icon={BellIcon}
          label={total > 0 ? `Notifications: ${total} need attention` : 'Notifications'}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          badge={total > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-white" aria-hidden="true" />}
        />
      </span>
      <Floating anchorRef={ref} open={open} onClose={close} align="end" className="w-[380px] max-w-[calc(100vw-16px)]" role="dialog">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
          {total > 0 && <span className="text-xs text-slate-500">{total} open</span>}
        </div>
        {items.length === 0 ? (
          <div className="grid place-items-center gap-2 px-6 py-10 text-center text-sm text-slate-500">
            <CircleCheckIcon className="size-8 text-green-600" aria-hidden="true" />
            You are all caught up.
          </div>
        ) : (
          <ul className="max-h-[min(60vh,420px)] overflow-y-auto px-1.5 pb-1.5">
            {items.map((i) => (
              <li key={i.id}>
                <Link to={i.to} onClick={close} className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-100">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', dot[i.tone])} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{i.title}</span>
                    <span className="block text-xs text-slate-500">{i.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="rounded-b-2xl border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          Only what needs you is listed. Nothing else.
        </p>
      </Floating>
    </>
  );
}
