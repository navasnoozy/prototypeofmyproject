import { useState } from 'react';
import { CalendarPlusIcon, CheckIcon, EllipsisIcon, PlayIcon, PlusIcon, Trash2Icon, Undo2Icon } from 'lucide-react';
import { WINDOWS } from '@/data/serviceKinds.js';
import { workingDates } from '@/data/projectRules.js';
import { cn } from '@/lib/cn.js';
import { fmtDay, todayISO } from '@/lib/dates.js';
import { aed, plural } from '@/lib/format.js';
import { addTask, removeTask, scheduleTask, setPackageProgress, setTaskStatus, unscheduleTask, updateTask } from '@/store/projectActions.js';
import { absenceOn, boardItems, dayProblems, fieldStaff } from '@/store/scheduleSelectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Badge, Status } from '@/ui/Badge.jsx';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Checkbox, Field, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Menu } from '@/ui/Floating.jsx';
import { Drawer } from '@/ui/Overlay.jsx';
import { Card } from '@/ui/Page.jsx';
import { ProgressBar } from './parts.jsx';

const shortWindow = (w) => WINDOWS[w].split(' (')[0];

// Gives a piece of site work a day, some working days, a time and the people.
export function TaskDrawer({ p, task, onClose }) {
  const s = useStore();
  const today = todayISO();
  const people = fieldStaff(s);
  const form = useForm(
    { title: task.title, plannedOn: task.plannedOn || today, days: String(task.days || 1), window: task.window || 'all_day', assigneeIds: task.assigneeIds },
    (v) => ({
      ...(v.title.trim() ? {} : { title: 'Give the work a title.' }),
      ...(v.plannedOn ? {} : { plannedOn: 'Choose the first day.' }),
      ...(Number(v.days) >= 1 ? {} : { days: 'At least one working day.' }),
      ...(v.assigneeIds.length > 0 ? {} : { assigneeIds: 'Choose who goes.' }),
    }),
  );
  const { values } = form;
  // What the chosen people already have on the days of this work.
  const dates = workingDates(values.plannedOn || today, Math.max(1, Number(values.days) || 1));
  const items = boardItems(s, dates[0], dates.at(-1)).filter((i) => !(i.kind === 'task' && i.id === task.id));
  const busy = (id) => dates.filter((d) => absenceOn(s, id, d) || dayProblems(s, id, d, [...items, ...dates.map((date) => ({ staffId: id, date, window: values.window, status: 'planned' }))]).length > 0).length;
  const toggle = (id, on) => form.set('assigneeIds', on ? [...values.assigneeIds, id] : values.assigneeIds.filter((x) => x !== id));
  const save = form.submit((v) => {
    if (v.title.trim() !== task.title) updateTask(p.id, task.id, { title: v.title.trim() });
    scheduleTask(p.id, task.id, { plannedOn: v.plannedOn, days: Number(v.days), window: v.window, assigneeIds: v.assigneeIds });
    toast('Site work planned');
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Plan the site work" subtitle={`${p.number} · ${p.title}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Plan it</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Work" required error={form.error('title')}><TextInput {...form.bind('title')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First day" required error={form.error('plannedOn')}><TextInput type="date" {...form.bind('plannedOn')} /></Field>
          <Field label="Working days" required error={form.error('days')} hint="Saturdays and Sundays are skipped."><TextInput {...form.bind('days')} inputMode="numeric" /></Field>
        </div>
        <Field label="Time"><Select {...form.bind('window')} options={Object.entries(WINDOWS).map(([value, label]) => ({ value, label }))} /></Field>
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-xs font-medium text-slate-700">Who goes <span className="text-slate-400" aria-hidden="true">*</span></legend>
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            {people.map((person) => {
              const clashes = busy(person.id);
              return (
                <Checkbox
                  key={person.id}
                  label={person.name}
                  hint={`${person.title} · ${clashes === 0 ? 'free on these days' : `busy or away on ${plural(clashes, 'of these days', 'of these days')}`}`}
                  checked={values.assigneeIds.includes(person.id)}
                  onChange={(on) => toggle(person.id, on)}
                />
              );
            })}
          </div>
          {form.error('assigneeIds') && <p role="alert" className="mt-1.5 text-xs text-red-700">{form.error('assigneeIds')}</p>}
        </fieldset>
        <p className="text-xs text-slate-500">
          {dates.length} working day{dates.length === 1 ? '' : 's'}: {fmtDay(dates[0])}{dates.length > 1 ? ` to ${fmtDay(dates.at(-1))}` : ''}. The Planning board in Schedule shows the work on those days.
        </p>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

function TaskRow({ p, task, manage, onPlan }) {
  const s = useStore();
  const who = task.assigneeIds.map((id) => s.staff[id]?.name.split(' ')[0]).filter(Boolean).join(', ');
  const dates = task.plannedOn ? workingDates(task.plannedOn, task.days) : [];
  const menu = [
    task.status === 'planned' && { label: 'Started', icon: PlayIcon, onClick: () => setTaskStatus(p.id, task.id, 'in_progress') },
    task.status !== 'done' && { label: 'Mark as done', icon: CheckIcon, onClick: () => setTaskStatus(p.id, task.id, 'done') },
    task.status === 'done' && { label: 'Reopen', icon: Undo2Icon, onClick: () => setTaskStatus(p.id, task.id, task.plannedOn ? 'planned' : 'todo') },
    ['planned', 'in_progress'].includes(task.status) && { label: 'Take off the board', icon: Undo2Icon, onClick: () => unscheduleTask(p.id, task.id) },
    { separator: true },
    { label: 'Remove', icon: Trash2Icon, tone: 'danger', onClick: () => removeTask(p.id, task.id) },
  ].filter(Boolean);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <Status kind="task" value={task.status} dot={false} />
      <span className="min-w-0 flex-1 basis-56">
        <span className={cn('block text-sm text-slate-900', task.status === 'done' && 'text-slate-500')}>{task.title}</span>
        <span className="block text-xs text-slate-500">
          {task.plannedOn ? `${fmtDay(dates[0])}${dates.length > 1 ? ` to ${fmtDay(dates.at(-1))}` : ''} · ${plural(task.days, 'working day')} · ${shortWindow(task.window)}${who ? ` · ${who}` : ''}` : 'No day yet'}
        </span>
      </span>
      {manage && task.status !== 'done' && (
        <Button size="xs" icon={CalendarPlusIcon} onClick={onPlan}>{task.plannedOn ? 'Change' : 'Plan'}</Button>
      )}
      {manage && <Menu button={(props) => <IconButton icon={EllipsisIcon} label={`Actions for ${task.title}`} size="xs" {...props} />} items={menu} />}
    </li>
  );
}

function AddTask({ p, packageId }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const add = () => {
    if (title.trim().length < 3) return;
    addTask(p.id, packageId, title.trim());
    setTitle('');
    setOpen(false);
  };
  if (!open) return <Button size="xs" icon={PlusIcon} onClick={() => setOpen(true)}>Add site work</Button>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1 basis-64">
        <TextInput aria-label="New site work" value={title} onChange={setTitle} placeholder="For example Cable pulling, levels 23 to 44" className="!h-10" autoFocus />
      </div>
      <Button variant="primary" size="sm" onClick={add}>Add</Button>
      <Button size="sm" onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  );
}

export function ProjectPlan({ p, manage }) {
  const [planning, setPlanning] = useState(null);
  const editable = manage && !['complete'].includes(p.phase);
  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-slate-600">
        The work in packages. The engineer keeps each package's percent complete up to date (the progress claim follows it) and gives the site work its days: the work then appears on the Planning board.
      </p>
      {p.packages.map((pkg) => (
        <Card
          key={pkg.id}
          title={<span className="flex flex-wrap items-center gap-2">{pkg.title}{pkg.kind === 'variation' && <Badge tone="violet">Variation</Badge>}</span>}
          action={<span className="text-xs tabular-nums text-slate-500">{aed(pkg.value)}</span>}
        >
          <div className="grid grid-cols-1 items-center gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-700">Work done</p>
              <ProgressBar value={pkg.progress} />
            </div>
            {editable && (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={pkg.progress}
                  onChange={(e) => setPackageProgress(p.id, pkg.id, e.target.value)}
                  aria-label={`Percent complete of ${pkg.title}`}
                  className="h-2 w-40 accent-slate-900"
                />
                <TextInput aria-label={`Percent complete of ${pkg.title}, number`} value={String(pkg.progress)} onChange={(v) => setPackageProgress(p.id, pkg.id, v)} suffix="%" inputMode="numeric" className="!h-9 !w-20" />
              </div>
            )}
          </div>
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {p.tasks.filter((t) => t.packageId === pkg.id).map((t) => (
              <TaskRow key={t.id} p={p} task={t} manage={editable} onPlan={() => setPlanning(t)} />
            ))}
            {p.tasks.filter((t) => t.packageId === pkg.id).length === 0 && <li className="py-3 text-sm text-slate-500">No site work yet.</li>}
          </ul>
          {editable && <div className="mt-3"><AddTask p={p} packageId={pkg.id} /></div>}
        </Card>
      ))}
      {planning && <TaskDrawer p={p} task={p.tasks.find((t) => t.id === planning.id) ?? planning} onClose={() => setPlanning(null)} />}
    </div>
  );
}
