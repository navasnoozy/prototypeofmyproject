import { CloudCheckIcon, CloudOffIcon, LoaderCircleIcon } from 'lucide-react';
import { useSession } from '@/store/session.js';
import { goOnline, useSync } from '@/store/sync.js';

// The state of the signal, for people who work on a phone: everything is saved,
// or there is no signal and some changes wait to be sent (the account menu
// simulates this, because the prototype has no server).
export function SyncChip() {
  const { online, pending, syncing } = useSync();
  const { role } = useSession();
  if (syncing) {
    return (
      <span role="status" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-700">
        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
        <span className="max-md:sr-only">Sending {pending}</span>
      </span>
    );
  }
  if (!online) {
    return (
      <button
        type="button"
        onClick={goOnline}
        title="No signal (simulation). Press to go back online."
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 text-xs font-medium text-amber-950 hover:bg-amber-200"
      >
        <CloudOffIcon className="size-4" aria-hidden="true" />
        <span className="max-md:sr-only">No signal</span>
        {pending > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-amber-950 px-1 text-[11px] leading-5 tabular-nums text-white" aria-label={`${pending} changes waiting`}>{pending}</span>}
      </button>
    );
  }
  if (!role.phoneFirst) return null;
  return (
    <span title="All changes are saved" className="grid size-9 place-items-center text-slate-500">
      <CloudCheckIcon className="size-[18px]" aria-hidden="true" />
      <span className="sr-only">All changes are saved</span>
    </span>
  );
}
