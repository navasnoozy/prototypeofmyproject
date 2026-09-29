import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckIcon, ChevronDownIcon, EyeIcon } from 'lucide-react';
import { ROLES } from '@/data/roles.js';
import { cn } from '@/lib/cn.js';
import { useSession } from '@/store/session.js';
import { setSession, useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Avatar } from '@/ui/Badge.jsx';
import { IconButton } from '@/ui/Button.jsx';
import { Floating } from '@/ui/Floating.jsx';

// A control of the prototype (not of the product): look at the same data as
// another person of the company. The amber colour marks it as such.
export function ViewAs() {
  const state = useStore();
  const { user, role } = useSession();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const choose = (person) => {
    setSession(person.id);
    close();
    navigate('/');
    toast(`Now viewing as ${person.name}, ${ROLES[person.roleKey].label.toLowerCase()}`);
  };

  return (
    <>
      <span ref={ref} className="inline-flex">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="hidden h-9 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 pl-3 pr-2.5 text-sm text-amber-950 transition-colors duration-150 hover:bg-amber-100 md:inline-flex"
        >
          <EyeIcon className="size-4 text-amber-700" aria-hidden="true" />
          <span>
            View as <span className="font-semibold">{user.name.split(' ')[0]}</span>
            <span className="text-amber-800/80"> · {role.label}</span>
          </span>
          <ChevronDownIcon className="size-4 text-amber-700" aria-hidden="true" />
        </button>
        <IconButton
          icon={EyeIcon}
          label={`View as: ${user.name}`}
          onClick={() => setOpen((o) => !o)}
          className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 md:hidden"
        />
      </span>
      <Floating anchorRef={ref} open={open} onClose={close} align="end" className="w-[340px] max-w-[calc(100vw-16px)]">
        <div className="px-4 pb-2 pt-4">
          <h2 className="text-sm font-semibold text-slate-900">View the prototype as…</h2>
          <p className="mt-0.5 text-xs text-slate-500">Each person sees the areas their role allows.</p>
        </div>
        <ul role="menu" className="max-h-[min(60vh,420px)] overflow-y-auto px-1.5 pb-1.5">
          {Object.values(state.staff).map((p) => {
            const isCurrent = p.id === user.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  onClick={() => choose(p)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-100', isCurrent && 'bg-slate-50')}
                >
                  <Avatar name={p.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{p.name}</span>
                    <span className="block truncate text-xs text-slate-500">{p.title}</span>
                  </span>
                  {isCurrent && <CheckIcon className="size-4 shrink-0 text-slate-900" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="rounded-b-2xl border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          Which area belongs to which role is a proposal (record 39). Use this to test it.
        </p>
      </Floating>
    </>
  );
}
