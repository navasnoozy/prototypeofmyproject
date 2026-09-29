import { planJob } from './serviceActions.js';
import { scheduleTask, unscheduleTask } from './projectActions.js';
import { transact } from './store.js';

// What dropping something on the planning board does. The board keeps no data of
// its own: it plans jobs (Service) and site work (Projects).

/** Where one person's place in a list of people changes: the person moved from is replaced by the person moved to. */
export const withPerson = (people, from, to) => {
  const next = from ? people.map((x) => (x === from ? to : x)) : [...people, to];
  return [...new Set(next)];
};

/**
 * Drop an item on a cell of the board.
 *   item   { kind: 'job' | 'task', id, projectId }
 *   cell   { staffId, date, window }
 *   from   the person whose place the item was dragged from (a card that was already on the board)
 */
export function dropOnBoard(state, item, cell, from = '') {
  if (item.kind === 'job') {
    const job = state.jobs[item.id];
    const assigneeIds = job.status === 'planned' ? withPerson(job.assigneeIds, from, cell.staffId) : [cell.staffId];
    planJob(item.id, { plannedOn: cell.date, window: cell.window || job.window || 'morning', assigneeIds });
    return;
  }
  const task = state.projects[item.projectId].tasks.find((t) => t.id === item.id);
  const assigneeIds = task.status === 'planned' ? withPerson(task.assigneeIds, from, cell.staffId) : [cell.staffId];
  scheduleTask(item.projectId, item.id, { plannedOn: cell.date, days: task.days, window: cell.window || task.window || 'all_day', assigneeIds });
}

/** A job or site work that is not started goes back to the list of work that needs planning. */
export function unplan(item) {
  if (item.kind === 'task') {
    unscheduleTask(item.projectId, item.id);
    return;
  }
  transact((tx) => {
    tx.patch('jobs', item.id, { status: 'unplanned', plannedOn: '', window: '', assigneeIds: [] });
    tx.log('job', item.id, 'Taken off the planning board: it needs planning again');
  });
}

export function addAbsence({ staffId, from, to, kind, note }) {
  transact((tx) => {
    const id = tx.id('abs');
    tx.put('absences', { id, staffId, from, to: to || from, kind, note: note ?? '' });
    tx.log('staff', staffId, `Not available from ${from}${to && to !== from ? ` to ${to}` : ''}`);
  });
}

export function removeAbsence(id) {
  transact((tx) => {
    tx.remove('absences', id);
  });
}

