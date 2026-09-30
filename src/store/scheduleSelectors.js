import { workingDates } from '@/data/projectRules.js';
import { addDays, todayISO } from '@/lib/dates.js';
import { jobStatus } from './serviceSelectors.js';
import { list } from './selectors.js';

// Pure functions of the Schedule area. The board owns no record of its own: it
// reads and changes the planned day, the time window and the people of jobs
// (Service) and of site work (Projects), and it knows the days people are not
// available.

export const WINDOWS_ORDER = ['morning', 'afternoon', 'night', 'all_day'];
export const FIELD_ROLES = ['technician', 'engineer'];

/** The people who go out: technicians first, then engineers. */
export const fieldStaff = (s) =>
  list(s.staff)
    .filter((p) => FIELD_ROLES.includes(p.roleKey))
    .toSorted((a, b) => FIELD_ROLES.indexOf(a.roleKey) - FIELD_ROLES.indexOf(b.roleKey) || a.name.localeCompare(b.name));

export const absenceOn = (s, staffId, date) => list(s.absences).find((a) => a.staffId === staffId && a.from <= date && date <= a.to);

// Where a job or a piece of site work sits on the board.
const jobItem = (s, j, staffId) => ({
  key: `job:${j.id}:${staffId}`, kind: 'job', id: j.id, staffId, date: j.plannedOn, window: j.window || 'morning',
  title: j.title, sub: s.sites[j.siteId]?.name ?? '', tag: j.kind === 'planned_visit' ? 'Visit' : j.kind === 'call_out' ? 'Call-out' : 'Repair',
  urgency: j.urgency, status: jobStatus(j), draggable: j.status === 'planned', path: `/service/jobs/${j.id}`, people: j.assigneeIds, first: true,
});
const taskItem = (s, p, t, staffId, date, index, dates) => ({
  key: `task:${t.id}:${staffId}:${date}`, kind: 'task', id: t.id, projectId: p.id, staffId, date, window: t.window || 'all_day',
  title: t.title, sub: `${p.number} · ${s.sites[p.siteId]?.name ?? ''}`, tag: dates.length > 1 ? `Day ${index + 1} of ${dates.length}` : 'Site work',
  urgency: 'normal', status: t.status, draggable: index === 0 && t.status === 'planned', path: `/projects/${p.id}?tab=plan`, sitePath: `/customers/sites/${p.siteId}`, people: t.assigneeIds, first: index === 0,
});

// A site survey planned in Sales takes the morning of its day. It is shown so that nobody is booked on top of it,
// but it is planned (and moved) in Sales, so the board does not drag it.
const surveyItem = (s, e) => ({
  key: `survey:${e.id}`, kind: 'survey', id: e.id, staffId: e.survey.assigneeId, date: e.survey.plannedOn, window: 'morning',
  title: `Site survey: ${s.customers[e.customerId]?.name ?? e.title}`, sub: s.sites[e.siteId]?.name ?? e.title, tag: 'Survey',
  urgency: 'normal', status: e.survey.doneOn ? 'done' : 'planned', draggable: false,
  path: `/sales/${e.id}`, sitePath: e.siteId ? `/customers/sites/${e.siteId}` : '', people: [e.survey.assigneeId], first: true,
});

/** Where a click on an item leads: jobs and (for people who may open Sales) surveys have their own page, the rest opens the site. */
export const itemPath = (item, mayOpenSales) => (item.kind === 'job' || (item.kind === 'survey' && mayOpenSales) ? item.path : item.sitePath);

/** Everything planned between two days, one item per person and day. */
export function boardItems(s, from, to) {
  const items = [];
  for (const j of list(s.jobs)) {
    if (!j.plannedOn || j.plannedOn < from || j.plannedOn > to) continue;
    if (['cancelled'].includes(j.status)) continue;
    for (const staffId of j.assigneeIds) items.push(jobItem(s, j, staffId));
  }
  for (const e of list(s.enquiries)) {
    const survey = e.survey;
    if (!survey?.needed || !survey.plannedOn || !survey.assigneeId || e.status === 'lost') continue;
    if (survey.plannedOn >= from && survey.plannedOn <= to) items.push(surveyItem(s, e));
  }
  for (const p of list(s.projects)) {
    if (p.phase === 'complete') continue;
    for (const t of p.tasks) {
      if (!t.plannedOn || t.status === 'todo') continue;
      const dates = workingDates(t.plannedOn, t.days);
      dates.forEach((date, i) => {
        if (date < from || date > to) return;
        for (const staffId of t.assigneeIds) items.push(taskItem(s, p, t, staffId, date, i, dates));
      });
    }
  }
  return items;
}

/** Work that has no day yet: jobs that need planning and site work that is not planned. */
export function queueItems(s, today = todayISO()) {
  const urgency = { emergency: 0, urgent: 1, normal: 2 };
  const jobs = list(s.jobs)
    .filter((j) => jobStatus(j, today) === 'unplanned')
    .map((j) => ({
      key: `job:${j.id}`, kind: 'job', id: j.id, title: j.title, sub: s.sites[j.siteId]?.name ?? '', tag: j.kind === 'planned_visit' ? 'Visit' : j.kind === 'call_out' ? 'Call-out' : 'Repair',
      urgency: j.urgency, due: j.dueOn, path: `/service/jobs/${j.id}`, window: j.window || 'morning',
    }))
    .toSorted((a, b) => urgency[a.urgency] - urgency[b.urgency] || (a.due ?? '').localeCompare(b.due ?? ''));
  const tasks = list(s.projects)
    .filter((p) => ['installation', 'testing', 'handover'].includes(p.phase))
    .flatMap((p) =>
      p.tasks.filter((t) => t.status === 'todo').map((t) => ({
        key: `task:${t.id}`, kind: 'task', id: t.id, projectId: p.id, title: t.title, sub: `${p.number} · ${s.sites[p.siteId]?.name ?? ''}`, tag: 'Site work', urgency: 'normal',
        due: '', path: `/projects/${p.id}?tab=plan`, window: t.window || 'all_day', days: t.days,
      })),
    );
  return { jobs, tasks };
}

/**
 * The problems of one person's day: two items in the same part of the day
 * (an all-day item takes the morning and the afternoon), or work on a day the
 * person is not available.
 */
export function dayProblems(s, staffId, date, items) {
  const mine = items.filter((i) => i.staffId === staffId && i.date === date && !['completed', 'report_sent', 'done'].includes(i.status));
  const problems = [];
  const seen = {};
  for (const item of mine) {
    const slots = item.window === 'all_day' ? ['morning', 'afternoon'] : [item.window];
    for (const slot of slots) {
      if (seen[slot]) problems.push(`Two items in the ${slot === 'night' ? 'night' : slot}`);
      seen[slot] = true;
    }
  }
  const absence = absenceOn(s, staffId, date);
  if (absence && mine.length > 0) problems.push(`Work planned on a day of ${absence.kind === 'leave' ? 'leave' : absence.kind === 'sick' ? 'sick leave' : absence.kind}`);
  return [...new Set(problems)];
}

/** For the bell: conflicts in the next days. */
export function scheduleAttention(s, today, viewerId) {
  const role = s.staff[viewerId]?.roleKey;
  if (!['owner', 'manager', 'coordinator', 'engineer'].includes(role)) return [];
  const items = boardItems(s, today, addDays(today, 7));
  const clashes = [];
  for (let i = 0; i <= 7; i += 1) {
    const date = addDays(today, i);
    for (const person of fieldStaff(s)) {
      const problems = dayProblems(s, person.id, date, items);
      if (problems.length > 0) clashes.push({ person, date, text: problems[0] });
    }
  }
  if (clashes.length === 0) return [];
  const first = clashes[0];
  const day = new Date(`${first.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return [{
    id: 'schedule_clashes', area: 'schedule', tone: 'orange',
    title: `${clashes.length} clash${clashes.length === 1 ? '' : 'es'} on the planning board in the next 7 days`,
    text: `${first.person.name}: ${first.text.toLowerCase()} on ${day}`, to: `/schedule?week=${first.date}`,
  }];
}
