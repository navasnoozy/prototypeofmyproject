import { SYSTEM_TYPES } from '@/data/catalog.js';
import {
  advanceTotal, certifiedFigures, claimFigures, currentProgress, defaultDocuments, dlpEnd, emptyHandover, equipmentFromQuotation, lastNet, originalValue,
  packagesFromQuotation, retentionHeld, tagRange, testsFromPackages,
} from '@/data/projectRules.js';
import { addDays, todayISO } from '@/lib/dates.js';
import { createQuotation, importCoverage } from './salesActions.js';
import { getState, transact } from './store.js';

// Every change to projects. Each one is one transaction; the ones that touch
// other areas (a quotation, the equipment register) do it in the same
// transaction, so nothing is left half done.

const who = (tx) => tx.state().session.userId;
const project = (tx, id) => tx.get('projects', id);
const patch = (tx, id, changes) => tx.patch('projects', id, changes);
const replaceIn = (rows, id, changes) => rows.map((r) => (r.id === id ? { ...r, ...changes } : r));

// ---- starting -------------------------------------------------------------------------------------------
/** An accepted project quotation starts a project (in "design and approvals"). */
export function startProjectFromQuotation(quotationId) {
  return transact((tx) => {
    const s = tx.state();
    const q = tx.get('quotations', quotationId);
    const k = q.kindData;
    const today = todayISO();
    const packages = packagesFromQuotation(q, s.items, tx.id);
    const engineer = Object.values(s.staff).find((x) => x.roleKey === 'engineer')?.id ?? s.session.userId;
    const id = tx.id('prj');
    const p = {
      id, number: tx.number('project'), title: q.title, customerId: q.customerId, siteId: q.siteId, contactId: q.contactId, quotationId: q.id,
      engineerId: engineer, supervisorId: '', lpo: q.answer?.reference ?? '', awardedOn: q.answer?.on ?? today,
      startOn: addDays(today, 7), endOn: addDays(today, 7 + k.durationWeeks * 7), durationWeeks: k.durationWeeks,
      advancePct: k.advancePct, retentionPct: k.retentionPct, dlpMonths: 12, cdApproval: k.cdApproval,
      phase: 'approvals', onHold: false, holdReason: '', packages, variations: [], claims: [], costs: [], tasks: [],
      documents: defaultDocuments(tx.id, k.cdApproval === 'contractor'), tests: testsFromPackages(packages, tx.id), snags: [],
      handover: emptyHandover(), createdOn: today, notes: '',
    };
    p.claims = [{
      id: tx.id('clm'), n: 1, kind: 'advance', status: 'draft', periodEnd: '', progress: {}, gross: 0, retention: 0, advance: 0, net: 0,
      amount: advanceTotal(p), value: originalValue(p), submittedOn: '', certifiedOn: '', invoiceRef: '', paidOn: '', note: '',
    }];
    tx.put('projects', p);
    tx.patch('quotations', quotationId, { followUp: { type: 'project', id, number: p.number } });
    tx.log('project', id, `Project created from the accepted quotation ${q.number}`);
    tx.log('quotation', quotationId, `Project ${p.number} started`);
    tx.log('customer', q.customerId, `Project ${p.number} started`);
    if (q.siteId) tx.log('site', q.siteId, `Project ${p.number} started`);
    return id;
  });
}

export function updateProject(id, changes, note = 'Details updated') {
  transact((tx) => {
    patch(tx, id, changes);
    tx.log('project', id, note);
  });
}

export const holdProject = (id, reason) => updateProject(id, { onHold: true, holdReason: reason }, `Put on hold: ${reason}`);
export const resumeProject = (id) => updateProject(id, { onHold: false, holdReason: '' }, 'Work resumed');

// ---- phases ----------------------------------------------------------------------------------------------
function phase(id, next, note) {
  transact((tx) => {
    patch(tx, id, { phase: next });
    tx.log('project', id, note);
  });
}
export const startInstallation = (id) => phase(id, 'installation', 'Installation started');
export const startTesting = (id) => phase(id, 'testing', 'Testing and commissioning started');
export const moveToHandover = (id) => phase(id, 'handover', 'Handover phase started: snags, documents and the authority\'s inspection');

// ---- the work: packages and site work ---------------------------------------------------------------------------------
/** The percent complete of a package; no line in the activity list while the engineer keeps it up to date. */
export function setPackageProgress(id, packageId, pct) {
  transact((tx) => {
    const p = project(tx, id);
    patch(tx, id, { packages: replaceIn(p.packages, packageId, { progress: Math.max(0, Math.min(100, Math.round(Number(pct) || 0))) }) });
  });
}

export function addTask(id, packageId, title) {
  transact((tx) => {
    const p = project(tx, id);
    patch(tx, id, { tasks: [...p.tasks, { id: tx.id('tsk'), packageId, title, status: 'todo', plannedOn: '', days: 1, window: 'all_day', assigneeIds: [] }] });
    tx.log('project', id, `Site work added: ${title}`);
  });
}
export function updateTask(id, taskId, changes) {
  transact((tx) => {
    patch(tx, id, { tasks: replaceIn(project(tx, id).tasks, taskId, changes) });
  });
}
export function removeTask(id, taskId) {
  transact((tx) => {
    const p = project(tx, id);
    patch(tx, id, { tasks: p.tasks.filter((t) => t.id !== taskId) });
  });
}
/** Gives a piece of site work a day, a number of working days, a time window and people. */
export function scheduleTask(id, taskId, { plannedOn, days, window, assigneeIds }) {
  transact((tx) => {
    const p = project(tx, id);
    const t = p.tasks.find((x) => x.id === taskId);
    patch(tx, id, { tasks: replaceIn(p.tasks, taskId, { plannedOn, days, window, assigneeIds, status: t.status === 'todo' ? 'planned' : t.status }) });
    const names = assigneeIds.map((sid) => tx.get('staff', sid)?.name).filter(Boolean).join(', ');
    tx.log('project', id, `Planned: ${t.title}, from ${plannedOn}${names ? ` (${names})` : ''}`);
  });
}
export function unscheduleTask(id, taskId) {
  transact((tx) => {
    const p = project(tx, id);
    patch(tx, id, { tasks: replaceIn(p.tasks, taskId, { status: 'todo', plannedOn: '', assigneeIds: [] }) });
  });
}
export function setTaskStatus(id, taskId, status) {
  transact((tx) => {
    const p = project(tx, id);
    const t = p.tasks.find((x) => x.id === taskId);
    patch(tx, id, { tasks: replaceIn(p.tasks, taskId, { status, plannedOn: t.plannedOn || (status === 'todo' ? '' : todayISO()) }) });
    if (status === 'done') tx.log('project', id, `Site work done: ${t.title}`);
  });
}

// ---- costs ------------------------------------------------------------------------------------------------------------
export function addCost(id, data) {
  transact((tx) => {
    const p = project(tx, id);
    patch(tx, id, { costs: [...p.costs, { id: tx.id('cst'), packageId: data.packageId, kind: data.kind, description: data.description, ref: data.ref ?? '', amount: data.amount, state: data.state, on: todayISO() }] });
    tx.log('project', id, `Cost recorded: ${data.description}`);
  });
}
export function removeCost(id, costId) {
  transact((tx) => {
    patch(tx, id, { costs: project(tx, id).costs.filter((c) => c.id !== costId) });
  });
}
export function markCostBilled(id, costId) {
  transact((tx) => {
    patch(tx, id, { costs: replaceIn(project(tx, id).costs, costId, { state: 'incurred', on: todayISO() }) });
  });
}

// ---- variations ----------------------------------------------------------------------------------------------------------
export function createVariation(id, data) {
  return transact((tx) => {
    const p = project(tx, id);
    const number = `VO-${String(p.variations.length + 1).padStart(3, '0')}`;
    const vid = tx.id('var');
    patch(tx, id, { variations: [...p.variations, { id: vid, number, title: data.title, reason: data.reason, value: data.value, cost: data.cost, days: data.days, status: 'draft', raisedOn: todayISO(), submittedOn: '', decidedOn: '', ref: '' }] });
    tx.log('project', id, `${number} drafted: ${data.title}`);
    return vid;
  });
}
export function updateVariation(id, varId, changes) {
  transact((tx) => {
    patch(tx, id, { variations: replaceIn(project(tx, id).variations, varId, changes) });
  });
}
export function deleteVariation(id, varId) {
  transact((tx) => {
    patch(tx, id, { variations: project(tx, id).variations.filter((v) => v.id !== varId) });
  });
}
export function submitVariation(id, varId) {
  transact((tx) => {
    const v = project(tx, id).variations.find((x) => x.id === varId);
    patch(tx, id, { variations: replaceIn(project(tx, id).variations, varId, { status: 'submitted', submittedOn: todayISO() }) });
    tx.log('project', id, `${v.number} submitted to the customer`);
  });
}
/** The customer's answer. An approved variation becomes a package of the project (with its own price, budget and progress) and may extend the end date. */
export function decideVariation(id, varId, { approved, ref, note }) {
  transact((tx) => {
    const p = project(tx, id);
    const v = p.variations.find((x) => x.id === varId);
    const changes = { variations: replaceIn(p.variations, varId, { status: approved ? 'approved' : 'rejected', decidedOn: todayISO(), ref, note }) };
    if (approved) {
      changes.packages = [...p.packages, { id: tx.id('pkg'), kind: 'variation', variationId: varId, title: `${v.number}: ${v.title}`, docs: false, value: v.value, cost: v.cost, progress: 0, types: [] }];
      if (v.days > 0) changes.endOn = addDays(p.endOn, v.days);
    }
    patch(tx, id, changes);
    tx.log('project', id, approved ? `${v.number} approved by the customer: ${v.value >= 0 ? '+' : '-'}AED ${Math.abs(v.value).toLocaleString('en-US')}` : `${v.number} rejected by the customer${note ? `: ${note}` : ''}`);
  });
}

// ---- claims ----------------------------------------------------------------------------------------------------------------
/** A new progress claim starts as a draft that follows the progress of the packages. */
export function createProgressClaim(id, periodEnd) {
  transact((tx) => {
    const p = project(tx, id);
    patch(tx, id, { claims: [...p.claims, { id: tx.id('clm'), n: p.claims.length + 1, kind: 'progress', status: 'draft', periodEnd, progress: {}, submittedOn: '', certifiedOn: '', invoiceRef: '', paidOn: '', note: '' }] });
    tx.log('project', id, 'Progress claim started');
  });
}
export function deleteClaim(id, claimId) {
  transact((tx) => {
    patch(tx, id, { claims: project(tx, id).claims.filter((c) => c.id !== claimId) });
  });
}
/** Submitting freezes the claim: its figures and the progress they came from no longer change. */
export function submitClaim(id, claimId) {
  transact((tx) => {
    const p = project(tx, id);
    const c = p.claims.find((x) => x.id === claimId);
    const frozen = c.kind === 'progress'
      ? { progress: currentProgress(p), ...claimFigures(p, currentProgress(p), lastNet(p)) }
      : {};
    patch(tx, id, { claims: replaceIn(p.claims, claimId, { ...frozen, status: 'submitted', submittedOn: todayISO() }) });
    tx.log('project', id, `${c.kind === 'advance' ? 'Advance claim' : c.kind === 'retention' ? 'Retention release claim' : 'Progress claim'} submitted to the customer`);
  });
}
/** The customer's engineer certifies a value; it may be less than what was claimed. */
export function certifyClaim(id, claimId, { certifiedGross, note }) {
  transact((tx) => {
    const p = project(tx, id);
    const c = p.claims.find((x) => x.id === claimId);
    let certified = { status: 'certified', certifiedOn: todayISO(), note: note ?? '' };
    if (c.kind === 'progress') {
      const previous = p.claims.filter((x) => x.kind === 'progress' && x.status !== 'draft' && x.n < c.n).at(-1);
      const cf = certifiedFigures(p, { ...c, certifiedGross }, previous ? (previous.certNet ?? previous.net) : 0);
      certified = { ...certified, certifiedGross, certRetention: cf.retention, certNet: cf.net, certAmount: cf.amount };
    } else {
      certified = { ...certified, certAmount: c.amount };
    }
    patch(tx, id, { claims: replaceIn(p.claims, claimId, certified) });
    tx.log('project', id, `Claim certified: AED ${certified.certAmount.toLocaleString('en-US')}`);
  });
}
/** Stands for the invoice and the receipt, which Billing makes properly in step 7. */
export function markClaimPaid(id, claimId) {
  transact((tx) => {
    const p = project(tx, id);
    const c = p.claims.find((x) => x.id === claimId);
    patch(tx, id, {
      claims: replaceIn(p.claims, claimId, { status: 'paid', paidOn: todayISO(), invoiceRef: c.invoiceRef || 'Made in Billing (step 7)' }),
      // The retention is released: the project is complete.
      ...(c.kind === 'retention' ? { phase: 'complete', handover: { ...p.handover, retentionReleasedOn: todayISO() } } : {}),
    });
    tx.log('project', id, 'Payment recorded for a claim');
    if (c.kind === 'retention') tx.log('project', id, 'Retention released: the project is complete');
  });
}
/** After the defects liability period (or earlier, by agreement), the retention is claimed. */
export function releaseRetention(id, early = false) {
  transact((tx) => {
    const p = project(tx, id);
    const amount = retentionHeld(p);
    patch(tx, id, {
      claims: [...p.claims, {
        id: tx.id('clm'), n: p.claims.length + 1, kind: 'retention', status: 'draft', periodEnd: '', progress: {}, gross: 0, retention: 0, advance: 0, net: 0,
        amount, value: 0, submittedOn: '', certifiedOn: '', invoiceRef: '', paidOn: '', note: early ? 'Released before the end of the period, by agreement with the customer.' : '',
      }],
    });
    tx.log('project', id, `Retention release claim made: AED ${amount.toLocaleString('en-US')}${early ? ' (early, by agreement)' : ''}`);
  });
}

// ---- documents ------------------------------------------------------------------------------------------------------------------
export function addDocument(id, data) {
  transact((tx) => {
    const p = project(tx, id);
    patch(tx, id, { documents: [...p.documents, { id: tx.id('doc'), kind: data.kind, title: data.title, ref: data.ref ?? '', rev: data.rev ?? '', status: 'planned', on: '' }] });
    tx.log('project', id, `Document added: ${data.title}`);
  });
}
export function setDocumentStatus(id, docId, status, extra = {}) {
  transact((tx) => {
    const p = project(tx, id);
    const d = p.documents.find((x) => x.id === docId);
    patch(tx, id, { documents: replaceIn(p.documents, docId, { ...extra, status, on: todayISO() }) });
    tx.log('project', id, `${d.title}: ${{ submitted: 'submitted', approved: 'approved', rejected: 'rejected', issued: 'issued', draft: 'in preparation' }[status] ?? status}`);
  });
}
export function removeDocument(id, docId) {
  transact((tx) => {
    patch(tx, id, { documents: project(tx, id).documents.filter((d) => d.id !== docId) });
  });
}

// ---- tests, snags, the authority ----------------------------------------------------------------------------------------------------
export function recordTest(id, testId, { result, note }) {
  transact((tx) => {
    const p = project(tx, id);
    const t = p.tests.find((x) => x.id === testId);
    patch(tx, id, { tests: replaceIn(p.tests, testId, { result, note: note ?? t.note, on: result ? todayISO() : '', by: result ? who(tx) : '' }) });
    if (result) tx.log('project', id, `Test ${result === 'pass' ? 'passed' : 'failed'}: ${t.title}`);
  });
}
export function addSnag(id, { title, location }) {
  transact((tx) => {
    const p = project(tx, id);
    patch(tx, id, { snags: [...p.snags, { id: tx.id('snag'), title, location, status: 'open', raisedOn: todayISO(), closedOn: '' }] });
    tx.log('project', id, `Snag raised: ${title}`);
  });
}
export function setSnagStatus(id, snagId, status) {
  transact((tx) => {
    const p = project(tx, id);
    const x = p.snags.find((n) => n.id === snagId);
    patch(tx, id, { snags: replaceIn(p.snags, snagId, { status, closedOn: status === 'closed' ? todayISO() : '' }) });
    if (status === 'closed') tx.log('project', id, `Snag closed: ${x.title}`);
  });
}
export function requestCivilDefence(id) {
  transact((tx) => {
    const p = project(tx, id);
    patch(tx, id, { handover: { ...p.handover, cdRequestedOn: todayISO() } });
    tx.log('project', id, 'Civil Defence inspection requested');
  });
}
export function recordCdCertificate(id, { ref, on }) {
  transact((tx) => {
    const p = project(tx, id);
    patch(tx, id, { handover: { ...p.handover, cdCertificate: { ref, on } } });
    tx.log('project', id, `Civil Defence completion certificate recorded (${ref})`);
  });
}

// ---- the handover ---------------------------------------------------------------------------------------------------------------------------
const nextNumber = (devices, siteId, prefix) => {
  let max = 0;
  for (const d of devices) {
    if (d.siteId !== siteId) continue;
    for (const m of d.tag.matchAll(new RegExp(`${prefix}-(\\d+)`, 'g'))) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
};

/**
 * The customer takes over. The systems that the project installed are written
 * into the equipment register of the site (Service), the defects liability
 * period starts, and a maintenance contract is offered as a draft quotation.
 */
export function handOver(id, { receivedBy, receivedRole }) {
  const created = transact((tx) => {
    const s = tx.state();
    const p = project(tx, id);
    const q = tx.get('quotations', p.quotationId);
    const today = todayISO();
    const existing = tx.all('devices');
    const systemIds = [];
    const added = [];
    for (const { type, devices } of equipmentFromQuotation(q, s.items)) {
      const clash = tx.all('systems').some((x) => x.siteId === p.siteId && x.type === type);
      const sid = tx.id('sys');
      tx.put('systems', {
        id: sid, siteId: p.siteId, type, name: clash ? `${SYSTEM_TYPES[type].label}, ${p.number}` : SYSTEM_TYPES[type].label,
        location: 'See the as-built drawings', installedOn: today, status: 'in_service', notes: `Installed by ${p.number}`,
      });
      systemIds.push(sid);
      for (const { deviceType, qty } of devices) {
        const def = SYSTEM_TYPES[type].devices[deviceType];
        const first = nextNumber([...existing, ...added], p.siteId, def.prefix);
        const dev = {
          id: tx.id('dev'), systemId: sid, siteId: p.siteId, type: deviceType, qty, tag: tagRange(def.prefix, first, qty), location: 'As installed',
          make: '', model: '', serial: '', installedOn: today, lastServiced: today, intervalMonths: def.months, condition: 'ok',
        };
        tx.put('devices', dev);
        added.push(dev);
      }
    }
    const site = tx.get('sites', p.siteId);
    if (site.stage === 'construction') tx.patch('sites', p.siteId, { stage: 'operating' });
    patch(tx, id, {
      phase: 'retention',
      handover: { ...p.handover, handedOverOn: today, receivedBy, receivedRole, systemIds, dlpEnd: dlpEnd(today, p.dlpMonths) },
    });
    tx.log('project', id, `Handed over to the customer (${receivedBy}): ${systemIds.length} system${systemIds.length === 1 ? '' : 's'} added to the register`);
    tx.log('site', p.siteId, `Handover of ${p.number}: ${systemIds.length} system${systemIds.length === 1 ? '' : 's'} added to the register`);
    tx.log('customer', p.customerId, `Project ${p.number} handed over`);
    return { systemIds };
  });

  // The maintenance contract is offered as a draft quotation for the new systems.
  const p = getState().projects[id];
  const qid = createQuotation({
    kind: 'contract', customerId: p.customerId, siteId: p.siteId, contactId: p.contactId,
    title: `Maintenance contract, ${getState().sites[p.siteId].name}`,
  });
  importCoverage(qid, created.systemIds);
  transact((tx) => {
    patch(tx, id, { handover: { ...project(tx, id).handover, contractQuotationId: qid } });
    tx.log('project', id, 'Maintenance contract offered: a draft quotation was made');
  });
  return { ...created, quotationId: qid };
}
