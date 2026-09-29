import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDownIcon, RotateCcwIcon, SettingsIcon } from 'lucide-react';
import { COMPANY } from '@/data/seed/staff.js';
import { useSession } from '@/store/session.js';
import { resetDemo } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Avatar } from '@/ui/Badge.jsx';
import { Floating } from '@/ui/Floating.jsx';
import { ConfirmDialog } from '@/ui/Overlay.jsx';

// The account chip at the right of the top bar: who is "signed in", the demo
// company, and the reset of the demo data.
export function AccountMenu() {
  const { user, role } = useSession();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <span ref={ref} className="inline-flex">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 items-center gap-2 rounded-full pl-1 pr-1 transition-colors duration-150 hover:bg-slate-100 md:pr-3"
        >
          <Avatar name={user.name} size="md" className="!size-8 !text-xs" />
          <span className="hidden text-left md:block">
            <span className="block text-sm font-medium leading-4 text-slate-900">{user.name}</span>
            <span className="block text-xs leading-4 text-slate-500">{role.label}</span>
          </span>
          <ChevronDownIcon className="hidden size-4 text-slate-500 md:block" aria-hidden="true" />
        </button>
      </span>
      <Floating anchorRef={ref} open={open} onClose={close} align="end" className="w-72" role="menu">
        <div className="flex items-center gap-3 border-b border-slate-200 p-4">
          <Avatar name={user.name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.title}</p>
            <p className="truncate text-xs text-slate-500">{COMPANY.name}</p>
          </div>
        </div>
        <div className="p-1.5">
          <Link
            to="/settings"
            onClick={close}
            role="menuitem"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-800 hover:bg-slate-100 md:hidden"
          >
            <SettingsIcon className="size-4 text-slate-500" aria-hidden="true" /> Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              setConfirm(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
          >
            <RotateCcwIcon className="size-4 text-slate-500" aria-hidden="true" /> Reset demo data
          </button>
        </div>
        <p className="rounded-b-2xl bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          Demo company. All names, numbers and amounts are samples.
        </p>
      </Floating>
      <ConfirmDialog
        open={confirm}
        title="Reset demo data?"
        confirmLabel="Reset"
        tone="danger"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          resetDemo();
          toast('Demo data restored to the first sample');
        }}
      >
        This puts back the first sample data and removes every change you made in this browser. It cannot be undone.
      </ConfirmDialog>
    </>
  );
}
