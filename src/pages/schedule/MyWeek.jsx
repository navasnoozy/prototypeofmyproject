import { Link } from 'react-router';
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { ABSENCE_KINDS } from '@/data/projectKinds.js';
import { WINDOWS } from '@/data/serviceKinds.js';
import { weekStart } from '@/data/projectRules.js';
import { cn } from '@/lib/cn.js';
import { addDays, fmtDay, todayISO } from '@/lib/dates.js';
import { useParam } from '@/lib/useParam.js';
import { absenceOn, boardItems } from '@/store/scheduleSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Badge } from '@/ui/Badge.jsx';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Page } from '@/ui/Page.jsx';

const ABOUT = {
  purpose: 'A technician sees their own days: what is planned, when, and where. The coordinator plans it on the Planning board; this page only shows it.',
  why: [
    'A technician needs their own days, not the whole company\'s board (study, K.6: "technicians see their own days").',
    'Each item leads to its job or its site work. A day of leave or training shows in place of work.',
  ],
  assumed: ['The team board is offered read-only, so a technician can see who is on the same site; whether that is wanted is open.'],
};

const ORDER = { morning: 0, afternoon: 1, all_day: 2, night: 3 };
const fullDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

// The days of one person for a week, as a list: made for a phone.
export function MyWeek() {
  const s = useStore();
  const { user } = useSession();
  const today = todayISO();
  const [weekParam, setWeek] = useParam('week', today);
  const start = weekStart(weekParam);
  const items = boardItems(s, start, addDays(start, 6)).filter((i) => i.staffId === user.id);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <Page
      title="My week"
      facts={`${fmtDay(start)} to ${fmtDay(addDays(start, 6))}`}
      about={ABOUT}
      actions={<Button to="/schedule?view=team">Team board</Button>}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeftIcon} label="Previous week" variant="secondary" onClick={() => setWeek(addDays(start, -7))} />
          <Button size="sm" onClick={() => setWeek(today)}>This week</Button>
          <IconButton icon={ChevronRightIcon} label="Next week" variant="secondary" onClick={() => setWeek(addDays(start, 7))} />
        </div>
        {days.map((date) => {
          const mine = items.filter((i) => i.date === date).toSorted((a, b) => ORDER[a.window] - ORDER[b.window]);
          const absent = absenceOn(s, user.id, date);
          const weekend = [0, 6].includes(new Date(`${date}T00:00:00`).getDay());
          return (
            <section key={date} className={cn('rounded-2xl border p-4', date === today ? 'border-slate-900' : 'border-slate-200', weekend && !mine.length && 'bg-slate-50')}>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                {fullDay(date)}
                {date === today && <Badge tone="dark">Today</Badge>}
              </h2>
              {absent && <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{ABSENCE_KINDS[absent.kind]}{absent.note ? `: ${absent.note}` : ''}</p>}
              {mine.length === 0 && !absent && <p className="mt-1 text-sm text-slate-500">{weekend ? 'Weekend.' : 'Nothing planned.'}</p>}
              <ul className="mt-2 space-y-2">
                {mine.map((it) => (
                  <li key={it.key}>
                    <Link to={it.kind === 'task' ? it.sitePath : it.path} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                      <span className="w-20 shrink-0 text-xs font-medium text-slate-500">{WINDOWS[it.window].split(' (')[0]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{it.title}</span>
                        <span className="block truncate text-xs text-slate-500">{it.sub} · {it.tag}</span>
                      </span>
                      <ArrowRightIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Page>
  );
}
