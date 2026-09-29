import { SYSTEM_TYPES } from '@/data/catalog.js';
import { diffDays, fmtDate, todayISO } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { ROLES } from '@/data/roles.js';
import { list } from './selectors.js';

// Pure functions of the Service area.

// ---- effective statuses ---------------------------------------------------------------
/** A visit released in advance needs planning 30 days before its date. */
export const jobStatus = (j, today = todayISO()) =>
  j.status === 'upcoming' ? (diffDays(today, j.dueOn) <= 30 ? 'unplanned' : 'upcoming') : j.status;

/** An active contract is "ending soon" 60 days before its last day, and ended after it. */
export function contractStatus(c, today = todayISO()) {
  if (c.status !== 'active') return c.status;
  if (c.endOn < today) return 'ended';
  return diffDays(today, c.endOn) <= 60 ? 'expiring' : 'active';
}

/** Where one visit of a visit plan stands. */
export function visitState(row, job, today = todayISO()) {
  if (job) {
    const st = jobStatus(job, today);
    if (['completed', 'report_sent'].includes(st)) return 'done';
    if (st === 'cancelled') return 'cancelled';
    return st; // upcoming, unplanned, planned, in_progress
  }
  if (row.state) return row.state;
  return row.dueOn < today ? 'missed' : 'upcoming';
}

// ---- lookups -------------------------------------------------------------------------------
export const contractsOfSite = (s, siteId) => list(s.contracts).filter((c) => c.siteId === siteId);
export const currentContract = (s, siteId, today = todayISO()) =>
  contractsOfSite(s, siteId).find((c) => ['active', 'awaiting_approval', 'draft'].includes(c.status) && c.endOn >= today && c.status !== 'draft') ??
  contractsOfSite(s, siteId).find((c) => c.status === 'active' && c.endOn >= today);
export const jobsOfSite = (s, siteId) => list(s.jobs).filter((j) => j.siteId === siteId);
export const openDeficiencies = (s) => list(s.deficiencies).filter((d) => d.status !== 'verified');
export const deficienciesOfSite = (s, siteId) => list(s.deficiencies).filter((d) => d.siteId === siteId);

/** Open deficiencies by device, to flag a device in the register. */
export function openDeficienciesByDevice(s) {
  const map = {};
  for (const d of openDeficiencies(s)) if (d.deviceId) (map[d.deviceId] ??= []).push(d);
  return map;
}

/** "Smoke detector x 260 (SD-001 to SD-260)" */
export const deviceLabel = (s, device) => {
  const sys = s.systems[device.systemId];
  const name = SYSTEM_TYPES[sys?.type]?.devices[device.type]?.label ?? device.type;
  return `${name}${device.qty > 1 ? ` x ${device.qty}` : ''} (${device.tag})`;
};

export const checklistProgress = (j) => {
  const total = j.checklist.length;
  const done = j.checklist.filter((r) => r.result).length;
  return { total, done, failed: j.checklist.filter((r) => r.result === 'fail').length };
};

/** The deficiency recorded for a failed check of a job, if there is one. */
export const deficiencyOfCheck = (s, job, row) =>
  list(s.deficiencies).find((d) => d.jobId === job.id && d.deviceId === row.deviceId);

/** Failed checks that no one has recorded as a deficiency yet. */
export const unrecordedFails = (s, job) =>
  job.checklist.filter((r) => r.result === 'fail' && !deficiencyOfCheck(s, job, r));

// ---- life-cycle strips ------------------------------------------------------------------------
export function jobSteps(j, today = todayISO()) {
  const st = jobStatus(j, today);
  const order = ['unplanned', 'planned', 'in_progress', 'completed', 'report_sent'];
  const label = { unplanned: st === 'upcoming' ? 'Upcoming' : 'Needs planning', planned: 'Planned', in_progress: 'In progress', completed: 'Completed', report_sent: 'Report sent' };
  const at = order.indexOf(st === 'upcoming' ? 'unplanned' : st === 'cancelled' ? 'unplanned' : st);
  return order.map((key, i) => ({ key, label: label[key], state: i < at ? 'done' : i === at ? (key === 'report_sent' ? 'done' : 'current') : 'todo' }));
}

export function contractSteps(c, today = todayISO()) {
  const status = contractStatus(c, today);
  const order = ['draft', 'approval', 'active', 'ended'];
  const at = { draft: 0, awaiting_approval: 1, active: 2, expiring: 2, ended: 3 }[status];
  const label = { draft: 'Draft', approval: status === 'awaiting_approval' ? 'Waiting for the authority' : 'Authority approval', active: status === 'expiring' ? 'Active, ends soon' : 'Active', ended: c.renewedToId ? 'Renewed' : 'Ended' };
  return order.map((key, i) => ({ key, label: label[key], state: i < at ? 'done' : i === at ? (key === 'ended' ? (c.renewedToId ? 'done' : 'bad') : 'current') : 'todo' }));
}

export function deficiencySteps(d) {
  const order = ['found', 'reported', 'quoted', 'approved', 'repaired', 'verified'];
  const label = { found: 'Found', reported: 'Reported', quoted: 'Quoted', approved: 'Approved', repaired: 'Repaired', verified: 'Verified' };
  if (d.status === 'declined') {
    return order.slice(0, 4).map((key, i) => ({ key, label: key === 'approved' ? 'Declined' : label[key], state: i < 3 ? 'done' : 'bad' }));
  }
  const at = order.indexOf(d.status);
  return order.map((key, i) => ({ key, label: label[key], state: i < at ? 'done' : i === at ? (key === 'verified' ? 'done' : 'current') : 'todo' }));
}

// ---- attention ---------------------------------------------------------------------------------
export function serviceAttention(s, today, viewerId) {
  const items = [];
  const role = s.staff[viewerId]?.roleKey;
  const planner = ['owner', 'manager', 'coordinator'].includes(role);
  const site = (id) => s.sites[id]?.name ?? '';

  // What the technician has to do today.
  const mine = list(s.jobs).filter((j) => j.assigneeIds.includes(viewerId) && ['planned', 'in_progress'].includes(j.status) && j.plannedOn && j.plannedOn <= today);
  if (mine.length > 0 && role === 'technician') {
    items.push({
      id: 'my_jobs', area: 'service', tone: 'blue',
      title: `You have ${plural(mine.length, 'job')} for today`,
      text: mine.map((j) => `${j.number} at ${site(j.siteId)}`).slice(0, 2).join(' · '),
      to: '/',
    });
  }
  for (const j of list(s.jobs)) {
    if (role === 'technician' && j.assigneeIds.includes(viewerId) && j.urgency === 'emergency' && ['planned', 'in_progress'].includes(j.status)) {
      items.push({
        id: `emergency_${j.id}`, area: 'service', tone: 'red',
        title: `Emergency: ${j.title}`, text: `${j.number} at ${site(j.siteId)}`, to: `/service/jobs/${j.id}`,
      });
    }
  }
  if (role === 'technician') return items;

  for (const d of openDeficiencies(s)) {
    if (d.severity === 'impairment' && d.status === 'found') {
      items.push({
        id: `imp_${d.id}`, area: 'service', tone: 'red',
        title: `Impairment at ${site(d.siteId)}: tell the customer`,
        text: `${d.number} · ${d.title}`, to: `/service/deficiencies/${d.id}`,
      });
    }
  }
  const unreported = openDeficiencies(s).filter((d) => d.status === 'found' && d.severity !== 'impairment');
  if (unreported.length > 0) {
    items.push({
      id: 'def_unreported', area: 'service', tone: 'orange',
      title: unreported.length === 1 ? `${unreported[0].number} is not reported to the customer yet` : `${unreported.length} deficiencies are not reported to the customer yet`,
      text: 'The customer decides on the repair, so tell them in writing.',
      to: unreported.length === 1 ? `/service/deficiencies/${unreported[0].id}` : '/service/deficiencies?status=found',
    });
  }
  const approved = openDeficiencies(s).filter((d) => d.status === 'approved' && !d.repairJobId);
  if (approved.length > 0) {
    items.push({
      id: 'def_approved', area: 'service', tone: 'orange',
      title: approved.length === 1 ? `${approved[0].number}: the customer approved the repair` : `${approved.length} approved repairs need a job`,
      text: 'Create the repair job so it can be planned.',
      to: approved.length === 1 ? `/service/deficiencies/${approved[0].id}` : '/service/deficiencies?status=approved',
    });
  }
  for (const c of list(s.contracts)) {
    const st = contractStatus(c, today);
    if (st === 'expiring' && !c.renewedToId && !c.renewalQuotationId) {
      items.push({
        id: `renew_${c.id}`, area: 'service', tone: 'orange',
        title: `${c.number} ends in ${diffDays(today, c.endOn)} days`,
        text: `${site(c.siteId)}: make the renewal quotation.`, to: `/service/${c.id}`,
      });
    }
    if (c.status === 'awaiting_approval' && c.cdApproval.submittedOn && diffDays(c.cdApproval.submittedOn, today) >= 14) {
      items.push({
        id: `cd_${c.id}`, area: 'service', tone: 'blue',
        title: `${c.number} has waited ${diffDays(c.cdApproval.submittedOn, today)} days for the authority`,
        text: `${site(c.siteId)} · ${c.cdApproval.reference}`, to: `/service/${c.id}`,
      });
    }
  }
  if (planner) {
    const needs = list(s.jobs).filter((j) => jobStatus(j, today) === 'unplanned');
    if (needs.length > 0) {
      items.push({
        id: 'jobs_need_planning', area: 'service', tone: 'blue',
        title: `${plural(needs.length, 'job')} need${needs.length === 1 ? 's' : ''} planning`,
        text: 'Give each a day and the people who go, on the planning board.', to: '/schedule',
      });
    }
    const late = list(s.jobs).filter((j) => j.status === 'planned' && j.plannedOn && j.plannedOn < today);
    if (late.length > 0) {
      items.push({
        id: 'jobs_late', area: 'service', tone: 'red',
        title: late.length === 1 ? `${late[0].number} was planned for ${fmtDate(late[0].plannedOn)} and is not done` : `${late.length} planned jobs are past their day`,
        text: 'Move them or find out what happened.', to: late.length === 1 ? `/service/jobs/${late[0].id}` : '/service/jobs?status=planned',
      });
    }
  }
  return items;
}

/** Contracts, jobs and deficiencies for the global search. */
export function serviceSearchEntries(s) {
  const entries = [];
  for (const c of list(s.contracts)) {
    entries.push({ type: 'Contracts', id: c.id, title: `${c.number} · ${c.title}`, sub: s.customers[c.customerId]?.name ?? '', path: `/service/${c.id}`, keywords: '' });
  }
  for (const j of list(s.jobs)) {
    entries.push({ type: 'Jobs', id: j.id, title: `${j.number} · ${j.title}`, sub: `${s.sites[j.siteId]?.name ?? ''}`, path: `/service/jobs/${j.id}`, keywords: j.description });
  }
  for (const d of list(s.deficiencies)) {
    entries.push({ type: 'Deficiencies', id: d.id, title: `${d.number} · ${d.title}`, sub: s.sites[d.siteId]?.name ?? '', path: `/service/deficiencies/${d.id}`, keywords: d.description });
  }
  return entries;
}

export const canPlanJobs = (roleKey) => ['owner', 'manager', 'coordinator'].includes(roleKey);
export const staffOfRoles = (s, roleKeys) => list(s.staff).filter((p) => roleKeys.includes(p.roleKey));
export const roleLabel = (roleKey) => ROLES[roleKey]?.label ?? roleKey;
