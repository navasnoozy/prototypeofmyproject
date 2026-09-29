import { relTime } from '@/lib/dates.js';
import { useStore } from '@/store/store.js';

// "What happened" for one record: the line, who did it, and how long ago.
export function ActivityList({ entries, limit = 6 }) {
  const s = useStore();
  if (entries.length === 0) return <p className="text-sm text-slate-500">Nothing yet.</p>;
  return (
    <ol className="space-y-3">
      {entries.slice(0, limit).map((a) => (
        <li key={a.id} className="flex gap-3">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm text-slate-800">{a.text}</p>
            <p className="text-xs text-slate-500">{s.staff[a.by]?.name ?? '—'} · {relTime(a.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
