import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeftIcon, ChevronRightIcon, GripVerticalIcon, HardHatIcon, TriangleAlertIcon, UserRoundXIcon, XIcon } from 'lucide-react';
import { ABSENCE_KINDS } from '@/data/projectKinds.js';
import { WINDOWS } from '@/data/serviceKinds.js';
import { weekStart } from '@/data/projectRules.js';
import { cn } from '@/lib/cn.js';
import { addDays, fmtDay, todayISO } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { dropOnBoard, removeAbsence, unplan } from '@/store/scheduleActions.js';
import { absenceOn, boardItems, dayProblems, fieldStaff, queueItems } from '@/store/scheduleSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { getState, useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Avatar } from '@/ui/Badge.jsx';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { Page } from '@/ui/Page.jsx';
import { PlanDrawer } from '@/pages/service/JobDialogs.jsx';
import { TaskDrawer } from '@/pages/projects/ProjectPlan.jsx';
import { AbsenceDrawer } from './ScheduleDialogs.jsx';

const ABOUT = {
  purpose: 'Who goes where and when, for all field work: the planned visits, call-outs and repairs of Service and the site work of Projects. Drag work from the list on the left onto a person and a day. Drag a card to move it, or back to the list to take it off the board.',
  why: [
    'One board for both areas, because the same few people do both, and a coordinator planning the week must see a call-out and a day of site work in the same place (study, K.6).',
    'The board owns no record of its own. Dropping a card only sets the planned day, the time and the people of the job or the site work; the content stays in Service or Projects.',
    'Problems show where they happen: two items in the same part of the day, or work planned on a day the person is not available. Nothing is refused (a coordinator may have a good reason) but nothing is hidden.',
    'To place a call-out in a running day, use the Day view: it shows the morning, afternoon and night of one day, person by person.',
  ],
  assumed: [
    'Saturdays and Sundays are shaded, and site work skips them; a job can still be planned on a weekend. The real working week is a setting of the company.',
    'A day has three parts (morning, afternoon, night) and "all day", which takes the morning and the afternoon. The real slots are a setting.',
    'The board knows only "not available"; leave and working hours belong to HR, much later.',
  ],
};

const SLOTS = [
  { window: 'morning', label: 'Morning', sub: '08:00 to 12:00' },
  { window: 'afternoon', label: 'Afternoon', sub: '13:00 to 17:00' },
  { window: 'night', label: 'Night', sub: '23:00 to 05:00' },
  { window: 'all_day', label: 'All day', sub: '' },
];
const ORDER = { morning: 0, afternoon: 1, all_day: 2, night: 3 };
const dayName = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' });
const fullDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

// One card on the board or in the list of work to plan.
function Card({ item, drag, onDragStart, onDragEnd, onOpen, compact = false }) {
  const done = ['completed', 'report_sent', 'done'].includes(item.status);
  const canDrag = onDragStart && item.draggable !== false;
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={Boolean(canDrag)}
      onDragStart={canDrag ? (e) => { e.dataTransfer?.setData('text/plain', item.title); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; onDragStart(item); } : undefined}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
      data-item={item.key}
      className={cn(
        'group relative cursor-pointer rounded-xl border bg-white px-2.5 py-2 text-left shadow-[0_1px_1px_rgb(15_23_42/6%)] transition-shadow duration-150 hover:shadow-float',
        item.kind === 'task' ? 'border-l-[3px] border-slate-200 border-l-violet-500' : 'border-l-[3px] border-slate-200 border-l-blue-500',
        item.status === 'in_progress' && 'ring-1 ring-violet-300',
        done && 'opacity-60',
        drag?.key === item.key && 'opacity-40',
        canDrag && 'active:cursor-grabbing',
      )}
    >
      <div className="flex items-start gap-1">
        {canDrag && <GripVerticalIcon className="-ml-1.5 mt-0.5 size-3.5 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className={cn('text-[13px] font-medium leading-4 text-slate-900', compact ? 'line-clamp-2' : 'line-clamp-2', done && 'line-through')}>{item.title}</p>
          <p className="mt-0.5 truncate text-[11px] leading-4 text-slate-500">{item.sub}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="rounded-sm bg-slate-100 px-1.5 text-[10px] font-medium leading-4 text-slate-600">{item.tag}</span>
            {item.urgency && item.urgency !== 'normal' && <span className={cn('rounded-sm px-1.5 text-[10px] font-medium leading-4', item.urgency === 'emergency' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800')}>{item.urgency === 'emergency' ? 'Emergency' : 'Urgent'}</span>}
            {item.window && item.date && <span className="text-[10px] leading-4 text-slate-500">{WINDOWS[item.window].split(' (')[0]}</span>}
            {item.due && <span className="text-[10px] leading-4 text-slate-500">due {fmtDay(item.due)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Board({ readOnly = false }) {
  const s = useStore();
  const navigate = useNavigate();
  const { canEdit } = useSession();
  const today = todayISO();
  const planner = canEdit('schedule') && !readOnly;
  const [weekParam, setWeek] = useParam('week', today);
  const [mode, setMode] = useParam('mode', 'week');
  const [dayParam, setDay] = useParam('day', today);
  const [kind, setKind] = useParam('kind', 'all');
  const [showLater, setShowLater] = useState(false);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState('');
  const [drawer, setDrawer] = useState(null); // { job } | { task, project } | { absence: { staffId, date } }

  const start = weekStart(weekParam);
  const day = dayParam;
  const columns = useMemo(
    () => (mode === 'day'
      ? SLOTS.map((slot) => ({ key: slot.window, label: slot.label, sub: slot.sub, date: day, window: slot.window }))
      : Array.from({ length: 7 }, (_, i) => { const date = addDays(start, i); return { key: date, label: dayName(date), sub: fmtDay(date), date, window: '' }; })),
    [mode, day, start],
  );
  const from = mode === 'day' ? day : start;
  const to = mode === 'day' ? day : addDays(start, 6);
  const people = fieldStaff(s);
  const all = useMemo(() => boardItems(s, from, to), [s, from, to]);
  const items = all.filter((i) => kind === 'all' || (kind === 'service' ? i.kind === 'job' : i.kind === 'task'));
  const queue = useMemo(() => queueItems(s, today), [s, today]);
  const later = list(s.jobs).filter((j) => j.status === 'upcoming' && jobLater(j, today)).map((j) => ({
    key: `job:${j.id}`, kind: 'job', id: j.id, title: j.title, sub: s.sites[j.siteId]?.name ?? '', tag: 'Visit', urgency: 'normal', due: j.dueOn, path: `/service/jobs/${j.id}`, window: j.window || 'morning',
  }));
  const queueJobs = kind === 'projects' ? [] : [...queue.jobs, ...(showLater ? later : [])];
  const queueTasks = kind === 'service' ? [] : queue.tasks;

  const step = mode === 'day' ? 1 : 7;
  const move = (n) => (mode === 'day' ? setDay(addDays(day, n * step)) : setWeek(addDays(start, n * step)));
  const label = mode === 'day' ? fullDay(day) : `${fmtDay(start)} to ${fmtDay(addDays(start, 6))} ${addDays(start, 6).slice(0, 4)}`;

  const open = (item) => {
    if (item.kind === 'job') setDrawer({ job: s.jobs[item.id] });
    else setDrawer({ task: s.projects[item.projectId].tasks.find((t) => t.id === item.id), project: s.projects[item.projectId] });
  };

  const drop = (person, column) => {
    setOver('');
    const item = drag;
    setDrag(null);
    if (!item || !planner) return;
    const absent = absenceOn(s, person.id, column.date);
    if (absent) {
      toast(`${person.name} is not available on ${fullDay(column.date)} (${ABSENCE_KINDS[absent.kind].toLowerCase()})`, { tone: 'error' });
      return;
    }
    dropOnBoard(getState(), { kind: item.kind, id: item.id, projectId: item.projectId }, { staffId: person.id, date: column.date, window: column.window }, item.staffId ?? '');
    const now = getState();
    const problems = dayProblems(now, person.id, column.date, boardItems(now, column.date, column.date));
    toast(problems.length > 0 ? `Planned for ${person.name.split(' ')[0]}, but: ${problems[0].toLowerCase()}` : `Planned for ${person.name.split(' ')[0]} on ${fmtDay(column.date)}`, { tone: problems.length > 0 ? 'error' : 'default' });
  };
  const dropOnQueue = () => {
    setOver('');
    const item = drag;
    setDrag(null);
    if (!item || !planner || !item.staffId) return;
    unplan({ kind: item.kind, id: item.id, projectId: item.projectId });
    toast('Taken off the board: it needs planning again');
  };
  const dragProps = planner ? { drag, onDragStart: setDrag, onDragEnd: () => { setDrag(null); setOver(''); } } : {};

  const queueCount = queueJobs.length + queueTasks.length;
  const minColumn = mode === 'day' ? 150 : 106;
  const grid = { gridTemplateColumns: `minmax(148px, 164px) repeat(${columns.length}, minmax(${minColumn}px, 1fr))`, minWidth: 148 + columns.length * minColumn };

  return (
    <Page
      title="Planning board"
      facts={`${plural(queue.jobs.length, 'job')} and ${plural(queue.tasks.length, 'piece of site work', 'pieces of site work')} to plan`}
      about={ABOUT}
      actions={
        planner ? <Button icon={UserRoundXIcon} onClick={() => setDrawer({ absence: { staffId: '', date: mode === 'day' ? day : today } })}>Not available</Button>
          : readOnly ? <Button to="/schedule?view=mine">My week</Button> : undefined
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeftIcon} label={mode === 'day' ? 'Previous day' : 'Previous week'} onClick={() => move(-1)} variant="secondary" />
          <Button size="sm" onClick={() => (mode === 'day' ? setDay(today) : setWeek(today))}>Today</Button>
          <IconButton icon={ChevronRightIcon} label={mode === 'day' ? 'Next day' : 'Next week'} onClick={() => move(1)} variant="secondary" />
        </div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented size="sm" label="View" value={mode} onChange={setMode} options={[{ value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }]} />
          <Segmented size="sm" label="Show" value={kind} onChange={setKind} options={[{ value: 'all', label: 'Everything' }, { value: 'service', label: 'Service' }, { value: 'projects', label: 'Projects' }]} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[264px_minmax(0,1fr)]">
        <aside
          aria-label="Work to plan"
          onDragOver={planner && drag?.staffId ? (e) => { e.preventDefault(); setOver('queue'); } : undefined}
          onDragLeave={() => over === 'queue' && setOver('')}
          onDrop={planner ? (e) => { e.preventDefault(); dropOnQueue(); } : undefined}
          className={cn('h-fit rounded-2xl border p-3 transition-colors duration-150 xl:sticky xl:top-0', over === 'queue' ? 'border-slate-900 bg-slate-50' : 'border-slate-200')}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-900">Needs planning</h2>
            <span className="rounded-full bg-slate-100 px-1.5 text-xs font-medium tabular-nums text-slate-600">{queueCount}</span>
          </div>
          {queueCount === 0 && <p className="px-1 py-3 text-sm text-slate-500">Everything is planned.</p>}
          {queueJobs.length > 0 && (
            <section className="mb-3">
              <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Service</h3>
              <div className="space-y-1.5">{queueJobs.map((it) => <Card key={it.key} item={it} compact onOpen={() => navigate(it.path)} {...dragProps} />)}</div>
            </section>
          )}
          {queueTasks.length > 0 && (
            <section className="mb-3">
              <h3 className="mb-1.5 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><HardHatIcon className="size-3" aria-hidden="true" />Site work</h3>
              <div className="space-y-1.5">{queueTasks.map((it) => <Card key={it.key} item={it} compact onOpen={() => navigate(it.path)} {...dragProps} />)}</div>
            </section>
          )}
          {kind !== 'projects' && (
            <label className="mt-1 flex items-center gap-2 px-1 text-xs text-slate-600">
              <input type="checkbox" checked={showLater} onChange={(e) => setShowLater(e.target.checked)} className="size-3.5 accent-slate-900" />
              Also visits due later
            </label>
          )}
          {planner && <p className="mt-3 px-1 text-[11px] leading-4 text-slate-500">Drag a card onto a person and a time. Drag a planned card back here to take it off the board.</p>}
        </aside>

        <div className="min-w-0 overflow-x-auto rounded-2xl border border-slate-200">
          <div className="grid" style={grid} role="grid" aria-label="Planning board">
            <div className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">Person</div>
            {columns.map((col) => {
              const isToday = col.date === today && mode === 'week';
              const weekend = mode === 'week' && [0, 6].includes(new Date(`${col.date}T00:00:00`).getDay());
              return (
                <div key={col.key} className={cn('border-b border-slate-200 px-3 py-2', isToday ? 'bg-slate-900 text-white' : weekend ? 'bg-slate-100' : 'bg-slate-50')}>
                  <p className={cn('text-xs font-semibold', isToday ? 'text-white' : 'text-slate-900')}>{col.label}</p>
                  <p className={cn('text-[11px]', isToday ? 'text-slate-300' : 'text-slate-500')}>{col.sub}</p>
                </div>
              );
            })}
            {people.map((person) => {
              const mine = items.filter((i) => i.staffId === person.id);
              return (
                <Row key={person.id}>
                  <div className="sticky left-0 z-10 flex items-start gap-2 border-b border-r border-slate-200 bg-white px-3 py-3">
                    <Avatar name={person.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{person.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{person.title}</p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">{plural(mine.length, 'item')}</p>
                    </div>
                  </div>
                  {columns.map((col) => {
                    const cellKey = `${person.id}:${col.key}`;
                    const absent = absenceOn(s, person.id, col.date);
                    const here = mine.filter((i) => i.date === col.date && (mode === 'week' || i.window === col.window)).toSorted((a, b) => ORDER[a.window] - ORDER[b.window]);
                    const problems = mode === 'week' || col.window === 'morning' ? dayProblems(s, person.id, col.date, all) : [];
                    const weekend = mode === 'week' && [0, 6].includes(new Date(`${col.date}T00:00:00`).getDay());
                    const hot = over === cellKey;
                    return (
                      <div
                        key={col.key}
                        role="gridcell"
                        data-cell={cellKey}
                        onDragOver={planner && drag ? (e) => { e.preventDefault(); setOver(cellKey); } : undefined}
                        onDragLeave={() => hot && setOver('')}
                        onDrop={planner ? (e) => { e.preventDefault(); drop(person, col); } : undefined}
                        className={cn(
                          'relative min-h-[92px] space-y-1.5 border-b border-slate-100 p-1.5 transition-colors duration-100',
                          weekend && 'bg-slate-50/70',
                          absent && 'bg-[repeating-linear-gradient(135deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_7px)]',
                          hot && (absent ? 'outline outline-2 -outline-offset-2 outline-red-400' : 'bg-blue-50 outline outline-2 -outline-offset-2 outline-blue-400'),
                        )}
                      >
                        {absent && (
                          <div className="flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-600">
                            <span className="min-w-0 flex-1 truncate">{ABSENCE_KINDS[absent.kind]}{absent.note ? `: ${absent.note}` : ''}</span>
                            {planner && <button type="button" aria-label="Remove this absence" onClick={() => removeAbsence(absent.id)} className="rounded-full p-0.5 hover:bg-slate-200"><XIcon className="size-3" aria-hidden="true" /></button>}
                          </div>
                        )}
                        {here.map((it) => <Card key={it.key} item={it} onOpen={() => open(it)} {...dragProps} />)}
                        {problems.length > 0 && (
                          <p className="flex items-center gap-1 text-[10px] font-medium leading-3 text-orange-700" title={problems.join('. ')}>
                            <TriangleAlertIcon className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{problems[0]}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </Row>
              );
            })}
          </div>
        </div>
      </div>

      {drawer?.job && <PlanDrawer j={drawer.job} onClose={() => setDrawer(null)} />}
      {drawer?.task && <TaskDrawer p={drawer.project} task={drawer.task} onClose={() => setDrawer(null)} />}
      {drawer?.absence && <AbsenceDrawer staffId={drawer.absence.staffId} date={drawer.absence.date} onClose={() => setDrawer(null)} />}
    </Page>
  );
}

// A row of the grid: its cells are direct children of the grid, so a row is only a fragment.
const Row = ({ children }) => <>{children}</>;

// A visit released from a contract that is due more than 30 days away.
const jobLater = (j, today) => j.dueOn && j.dueOn > today;
