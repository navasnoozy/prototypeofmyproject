import { HANDOVER_DOCS, PHASE_ORDER, PHASES } from '@/data/projectKinds.js';
import { claimFigures, contractValue, costTotals, currentProgress, lastNet, percentComplete, progressClaims, retentionHeld, workDone } from '@/data/projectRules.js';
import { diffDays, fmtDate, todayISO } from '@/lib/dates.js';
import { aed, plural } from '@/lib/format.js';
import { projectView } from './purchaseSelectors.js';
import { list } from './selectors.js';

// Pure functions of the Projects area.

export const projectStatus = (p) => (p.onHold ? 'on_hold' : p.phase);
export const isActive = (p) => !['retention', 'complete'].includes(p.phase);
export const projectsOfSite = (s, siteId) => list(s.projects).filter((p) => p.siteId === siteId);

export function phaseSteps(p) {
  const at = PHASE_ORDER.indexOf(p.phase);
  return PHASE_ORDER.map((key, i) => ({
    key,
    label: PHASES[key].label,
    state: i < at || p.phase === 'complete' ? 'done' : i === at ? 'current' : 'todo',
  }));
}

// ---- claims ------------------------------------------------------------------------------------
export const draftClaim = (p) => p.claims.find((c) => c.kind === 'progress' && c.status === 'draft');
/** The figures of a claim; a draft progress claim follows the progress of the packages as they are now. */
export const claimView = (p, c) =>
  c.kind === 'progress' && c.status === 'draft'
    ? { ...c, ...claimFigures(p, currentProgress(p), lastNet(p)), live: true }
    : c;
export const progressIndex = (p, c) => progressClaims(p).findIndex((x) => x.id === c.id) + 1;
export const claimLabel = (p, c) => (c.kind === 'advance' ? 'Advance' : c.kind === 'retention' ? 'Retention release' : `Progress claim ${progressIndex(p, c)}`);

const lastSubmitted = (p) => progressClaims(p).filter((c) => c.status !== 'draft').at(-1);

/** Work done that no claim has covered yet, in money (what the next claim would add). */
export const sinceLastClaim = (p) => {
  const last = lastSubmitted(p);
  return Math.max(0, workDone(p) - (last ? (last.certifiedGross ?? last.gross ?? 0) : 0));
};

// ---- lists inside a project -----------------------------------------------------------------------------
export const openVariations = (p) => p.variations.filter((v) => ['draft', 'submitted'].includes(v.status));
export const pendingDocuments = (p) => p.documents.filter((d) => ['submitted', 'rejected'].includes(d.status));
export const openSnags = (p) => p.snags.filter((x) => x.status === 'open');
export const unscheduledTasks = (p) => p.tasks.filter((t) => t.status === 'todo');
export const overBudget = (p) => p.packages.filter((x) => costTotals(p, x.id).exposure > x.cost);
export const testsPending = (p) => p.tests.filter((t) => t.result !== 'pass');

/**
 * What must be true before the customer can take over. `label` is the condition and `detail` where it stands (the
 * checklist shows both); `todo` says what to do about it (the list of what needs attention shows that).
 */
export function handoverChecks(p) {
  const docs = HANDOVER_DOCS.map((kind) => p.documents.filter((d) => d.kind === kind));
  const docsOk = docs.every((rows) => rows.length > 0 && rows.every((d) => d.status === 'issued'));
  const passed = p.tests.length - testsPending(p).length;
  return [
    {
      key: 'tests', label: 'Every acceptance test has passed', ok: p.tests.length > 0 && testsPending(p).length === 0, detail: `${passed} of ${p.tests.length} passed`,
      todo: p.tests.length === 0 ? 'Add the acceptance tests' : `Pass the acceptance tests (${passed} of ${p.tests.length} passed)`,
    },
    { key: 'snags', label: 'No snag is open', ok: openSnags(p).length === 0, detail: plural(openSnags(p).length, 'snag') + ' open', todo: `Close ${plural(openSnags(p).length, 'open snag')}` },
    {
      key: 'cd', label: p.cdApproval === 'contractor' ? 'Civil Defence completion certificate is recorded' : 'The customer handles the Civil Defence completion',
      ok: p.cdApproval !== 'contractor' || Boolean(p.handover.cdCertificate),
      detail: p.handover.cdCertificate ? p.handover.cdCertificate.ref : p.handover.cdRequestedOn ? `Inspection requested ${fmtDate(p.handover.cdRequestedOn)}` : 'Not requested yet',
      todo: p.handover.cdRequestedOn ? `Record the Civil Defence completion certificate (inspection requested ${fmtDate(p.handover.cdRequestedOn)})` : 'Request the Civil Defence inspection and record its certificate',
    },
    { key: 'docs', label: 'As-builts, manuals, warranties and test reports are issued', ok: docsOk, detail: docsOk ? 'All issued' : 'Some are not issued', todo: 'Issue the as-builts, manuals, warranties and test reports' },
  ];
}
export const readyToHandOver = (p) => handoverChecks(p).every((c) => c.ok);

// ---- what to do next -----------------------------------------------------------------------------------------
/** A short list of the next things this project needs, most urgent first. Each item leads to a tab. */
export function nextSteps(p, today = todayISO()) {
  const steps = [];
  const add = (tone, text, tab) => steps.push({ tone, text, tab });
  const draft = draftClaim(p);
  const since = sinceLastClaim(p);
  const lastClaim = lastSubmitted(p);
  if (p.onHold) add('red', `On hold: ${p.holdReason}`, 'overview');
  for (const pkg of overBudget(p)) {
    add('orange', `${pkg.title} is over its budget by ${aed(costTotals(p, pkg.id).exposure - pkg.cost)}`, 'costs');
  }
  for (const c of p.claims.filter((x) => x.status === 'submitted')) {
    const waited = diffDays(c.submittedOn, today);
    if (waited >= 14) add('orange', `${claimLabel(p, c)} has waited ${waited} days for the certificate`, 'claims');
  }
  for (const c of p.claims.filter((x) => x.status === 'certified')) add('blue', `${claimLabel(p, c)} is certified: ready to invoice in Billing`, 'claims');
  if (draft && since > 0) add('blue', `${claimLabel(p, draft)} is a draft: ${aed(since)} of work since the last claim`, 'claims');
  else if (!draft && p.phase === 'installation' && since > 0 && (!lastClaim || diffDays(lastClaim.submittedOn || lastClaim.periodEnd, today) >= 25)) add('blue', `Time for a progress claim: ${aed(since)} of work is not claimed yet`, 'claims');
  for (const v of p.variations.filter((x) => x.status === 'submitted')) {
    const waited = diffDays(v.submittedOn, today);
    if (waited >= 5) add('orange', `${v.number} has waited ${waited} days for the customer`, 'variations');
  }
  const rejected = p.documents.filter((d) => d.status === 'rejected');
  if (rejected.length > 0) add('orange', `${plural(rejected.length, 'document')} rejected: resubmit`, 'documents');
  const waitingDocs = p.documents.filter((d) => d.status === 'submitted');
  if (waitingDocs.length > 0) add('blue', `${plural(waitingDocs.length, 'document')} waiting for the consultant`, 'documents');
  if (p.phase === 'installation' && unscheduledTasks(p).length > 0) add('blue', `${plural(unscheduledTasks(p).length, 'site work item')} not planned yet`, 'plan');
  if (p.phase === 'approvals' && p.cdApproval === 'contractor' && !p.documents.some((d) => d.kind === 'cd_drawings' && d.status === 'approved')) add('orange', 'The Civil Defence approval of the drawings is not recorded yet', 'documents');
  if (p.phase === 'testing' && testsPending(p).length > 0) add('orange', `${plural(testsPending(p).length, 'test')} not passed yet`, 'handover');
  if (p.phase === 'handover') {
    if (readyToHandOver(p)) add('blue', 'Everything is in place: hand over to the customer', 'handover');
    else for (const c of handoverChecks(p).filter((x) => !x.ok)) add('orange', c.todo, 'handover');
  }
  if (p.phase === 'retention') {
    const release = p.claims.find((c) => c.kind === 'retention');
    const left = diffDays(today, p.handover.dlpEnd);
    if (release) {
      // Once submitted, the lines about claims above say what is next; a draft still has to be submitted.
      if (release.status === 'draft') add('blue', 'The retention release is a draft: submit it to the customer', 'claims');
    } else if (left <= 0) add('blue', `The defects liability period is over: release the retention (${aed(retentionHeld(p))})`, 'claims');
    else add('blue', `The defects liability period ends ${fmtDate(p.handover.dlpEnd)}; ${aed(retentionHeld(p))} is held until then`, 'claims');
  }
  return steps;
}

// ---- for the bell, the search and the sidebar popup ------------------------------------------------------------------------
export function projectAttention(s, today, viewerId) {
  const role = s.staff[viewerId]?.roleKey;
  if (!['owner', 'manager', 'engineer'].includes(role)) return [];
  // One line for each project: its most urgent step, and how many more there are.
  const items = [];
  for (const raw of list(s.projects)) {
    if (raw.phase === 'complete') continue;
    const p = projectView(s, raw); // with the materials, so an overrun of an order shows
    const steps = nextSteps(p, today).filter((st) => st.tone !== 'blue' || /hand over|release the retention|Time for a progress claim/.test(st.text));
    if (steps.length === 0) continue;
    const [first, ...more] = steps;
    items.push({
      id: `prj_${p.id}`, area: 'projects', tone: first.tone,
      title: `${p.number}: ${first.text}`,
      text: more.length > 0 ? `${more.length} more to look at · ${s.sites[p.siteId]?.name ?? ''}` : s.sites[p.siteId]?.name ?? '',
      to: `/projects/${p.id}?tab=${first.tab}`,
    });
  }
  return items;
}

export function projectSearchEntries(s) {
  return list(s.projects).map((p) => ({
    type: 'Projects', id: p.id, title: `${p.number} · ${p.title}`, sub: s.customers[p.customerId]?.name ?? '', path: `/projects/${p.id}`, keywords: `${s.sites[p.siteId]?.name ?? ''} ${p.lpo}`,
  }));
}

/** The facts that the list shows for a project. */
export function projectFacts(p) {
  const value = contractValue(p);
  return { value, done: percentComplete(p), retention: retentionHeld(p), cost: costTotals(p) };
}
