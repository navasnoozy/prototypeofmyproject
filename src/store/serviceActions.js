import { billingDates, contractEnd, dueGroups, visitDates } from '@/data/serviceRules.js';
import { addDays, addMonths, todayISO } from '@/lib/dates.js';
import { createQuotation, importCoverage, updateQuotation } from './salesActions.js';
import { quoteTotals } from './salesSelectors.js';
import { deficiencyByNumber } from './links.js';
import { deviceLabel } from './serviceSelectors.js';
import { getState, transact } from './store.js';

// Every change to contracts, jobs, deficiencies and certificates. Each one is
// one transaction; the ones that touch other areas (a quotation, the equipment
// register) do it in the same transaction, so nothing is left half done.

const site = (tx, id) => tx.get('sites', id);
const staffOf = (tx) => tx.state().session.userId;

// ---- contracts -------------------------------------------------------------------------
const visitRows = (tx, startOn, term, visits) =>
  visitDates(startOn, term, visits).map((dueOn, i) => ({ id: tx.id('vis'), n: i + 1, dueOn, jobId: '', state: '' }));
const billingRows = (tx, startOn, term, frequency, fee) =>
  billingDates(startOn, term, frequency, fee).map((b, i) => ({ id: tx.id('bil'), n: i + 1, dueOn: b.dueOn, amount: b.amount, invoiceRef: '' }));

/** An accepted contract quotation starts a contract (as a draft). */
export function startContractFromQuotation(quotationId) {
  return transact((tx) => {
    const q = tx.get('quotations', quotationId);
    const k = q.kindData;
    const today = todayISO();
    const id = tx.id('con');
    const number = tx.number('contract');
    const fee = quoteTotals(q, tx.state().settings.vatRate).net;
    const prev = k.renewalOf ? tx.get('contracts', k.renewalOf) : null;
    tx.put('contracts', {
      id, number, customerId: q.customerId, siteId: q.siteId, contactId: q.contactId, quotationId: q.id,
      title: `Maintenance contract, ${site(tx, q.siteId)?.name ?? q.title}`, status: 'draft',
      startOn: k.startOn, termMonths: k.termMonths, endOn: contractEnd(k.startOn, k.termMonths),
      visitsPerYear: k.visitsPerYear, responseHours: k.responseHours,
      systemIds: q.sections.map((sec) => sec.systemId).filter(Boolean), annualFee: fee, billing: k.billing,
      visitPlan: visitRows(tx, k.startOn, k.termMonths, k.visitsPerYear),
      billingPlan: billingRows(tx, k.startOn, k.termMonths, k.billing, fee),
      cdApproval: { required: true, status: 'to_submit', reference: '', submittedOn: '', decidedOn: '', note: '' },
      renewedFromId: prev?.id ?? '', renewedToId: '', renewalQuotationId: '', createdOn: today, notes: '',
    });
    tx.patch('quotations', quotationId, { followUp: { type: 'contract', id, number } });
    if (prev) tx.patch('contracts', prev.id, { renewedToId: id });
    tx.log('contract', id, `Contract created from the accepted quotation ${q.number}`);
    tx.log('quotation', quotationId, `Contract ${number} started`);
    tx.log('customer', q.customerId, `Contract ${number} created`);
    return id;
  });
}

export function updateContract(id, changes, note = 'Terms updated') {
  transact((tx) => {
    const c = tx.get('contracts', id);
    const next = { ...c, ...changes };
    // While it is a draft the plans follow the terms.
    if (c.status === 'draft') {
      next.endOn = contractEnd(next.startOn, next.termMonths);
      next.visitPlan = visitRows(tx, next.startOn, next.termMonths, next.visitsPerYear);
      next.billingPlan = billingRows(tx, next.startOn, next.termMonths, next.billing, next.annualFee);
    }
    tx.put('contracts', next);
    tx.log('contract', id, note);
  });
}

export function submitContractToAuthority(id, { reference, submittedOn }) {
  transact((tx) => {
    const c = tx.get('contracts', id);
    tx.patch('contracts', id, { status: 'awaiting_approval', cdApproval: { ...c.cdApproval, status: 'submitted', reference, submittedOn, decidedOn: '' } });
    tx.log('contract', id, `Submitted to the authority for approval (${reference})`);
  });
}

// Creates the visits of the plan as jobs that are "upcoming" until 30 days before their date.
function releaseVisits(tx, contractId) {
  const c = tx.get('contracts', contractId);
  const today = todayISO();
  let made = 0;
  const visitPlan = c.visitPlan.map((row) => {
    if (row.jobId || row.dueOn < today) return row;
    const jid = tx.id('job');
    tx.put('jobs', {
      id: jid, number: tx.number('job'), kind: 'planned_visit', customerId: c.customerId, siteId: c.siteId, contractId: c.id,
      quotationId: '', deficiencyIds: [], visitId: row.id, title: `Planned visit ${row.n} of ${c.visitPlan.length}`, description: '',
      urgency: 'normal', requestedOn: today, dueOn: row.dueOn, status: 'upcoming', plannedOn: '', window: '', assigneeIds: [],
      startedOn: '', completedOn: '', systemIds: [], checklist: [], findings: '', parts: [], labour: [], signature: null, report: null, callInfo: null, photos: [], startedAt: '', completedAt: '',
    });
    made += 1;
    return { ...row, jobId: jid };
  });
  tx.patch('contracts', contractId, { visitPlan });
  return made;
}

export function releaseContractVisits(id) {
  return transact((tx) => {
    const made = releaseVisits(tx, id);
    tx.log('contract', id, `${made} visit${made === 1 ? '' : 's'} released as jobs`);
    return made;
  });
}

export function recordContractApproval(id, { approved, reference, note }) {
  transact((tx) => {
    const c = tx.get('contracts', id);
    const today = todayISO();
    tx.patch('contracts', id, {
      status: approved ? 'active' : 'draft',
      cdApproval: { ...c.cdApproval, status: approved ? 'approved' : 'rejected', reference: reference || c.cdApproval.reference, decidedOn: today, note },
    });
    if (approved) {
      const made = releaseVisits(tx, id);
      tx.log('contract', id, `Approved by the authority: contract active, ${made} visits released`);
      tx.log('customer', c.customerId, `Contract ${c.number} is active`);
    } else {
      tx.log('contract', id, `Refused by the authority: ${note}`);
    }
  });
}

/** For a contract that needs no approval (sample: some emirates). */
export function activateContract(id) {
  transact((tx) => {
    const c = tx.get('contracts', id);
    tx.patch('contracts', id, { status: 'active', cdApproval: { ...c.cdApproval, status: 'not_needed', note: 'No approval was needed' } });
    const made = releaseVisits(tx, id);
    tx.log('contract', id, `Contract activated without the authority's approval, ${made} visits released`);
    tx.log('customer', c.customerId, `Contract ${c.number} is active`);
  });
}

export function endContract(id, reason) {
  transact((tx) => {
    const c = tx.get('contracts', id);
    tx.patch('contracts', id, { status: 'ended', notes: reason });
    for (const j of tx.all('jobs')) {
      if (j.contractId === id && j.status === 'upcoming') tx.patch('jobs', j.id, { status: 'cancelled' });
    }
    tx.log('contract', id, `Contract ended: ${reason}`);
    tx.log('customer', c.customerId, `Contract ${c.number} ended`);
  });
}

/** The renewal quotation of a contract: same customer, site and systems, the next period. */
export function createRenewalQuotation(contractId) {
  const contract = getState().contracts[contractId];
  const qid = createQuotation({
    kind: 'contract', customerId: contract.customerId, siteId: contract.siteId, contactId: contract.contactId,
    title: `Maintenance contract renewal, ${contract.title.replace('Maintenance contract, ', '')}`,
  });
  importCoverage(qid, contract.systemIds);
  updateQuotation(qid, {
    kindData: {
      termMonths: 12, startOn: addDays(contract.endOn, 1), visitsPerYear: contract.visitsPerYear,
      billing: contract.billing, responseHours: contract.responseHours, renewalOf: contractId,
    },
  });
  transact((tx) => {
    tx.patch('contracts', contractId, { renewalQuotationId: qid });
    tx.log('contract', contractId, 'Renewal quotation made');
  });
  return qid;
}

// ---- jobs -------------------------------------------------------------------------------
const activeContractAt = (tx, siteId) => {
  const today = todayISO();
  return tx.all('contracts').find((c) => c.siteId === siteId && c.status === 'active' && c.endOn >= today);
};

/** A call-out (a customer reports a fault) or a repair job. */
export function createJob(data) {
  return transact((tx) => {
    const today = todayISO();
    const id = tx.id('job');
    const number = tx.number('job');
    tx.put('jobs', {
      id, number, kind: data.kind, customerId: data.customerId, siteId: data.siteId,
      contractId: activeContractAt(tx, data.siteId)?.id ?? '', quotationId: data.quotationId ?? '',
      deficiencyIds: data.deficiencyIds ?? [], visitId: '', title: data.title, description: data.description ?? '',
      urgency: data.urgency ?? 'normal', requestedOn: today, dueOn: data.dueOn ?? today, status: 'unplanned',
      plannedOn: '', window: '', assigneeIds: [], startedOn: '', completedOn: '',
      systemIds: data.systemIds ?? [], checklist: [], findings: '', parts: [], labour: [], signature: null, report: null,
      callInfo: data.kind === 'call_out' ? { reportedBy: data.reportedBy ?? '', via: data.via ?? 'phone', fault: data.fault ?? '' } : null,
      photos: [], startedAt: '', completedAt: '',
    });
    tx.log('job', id, data.kind === 'call_out' ? 'Call-out registered' : 'Repair job created');
    tx.log('site', data.siteId, `${number}: ${data.title}`);
    return id;
  });
}

export function planJob(id, { plannedOn, window, assigneeIds }) {
  transact((tx) => {
    tx.patch('jobs', id, { plannedOn, window, assigneeIds, status: 'planned' });
    const names = assigneeIds.map((sid) => tx.get('staff', sid)?.name).filter(Boolean).join(', ');
    tx.log('job', id, `Planned for ${plannedOn}${names ? `: ${names}` : ''}`);
  });
}

/** Starting a planned visit makes its checklist from the devices that are due. */
export function startJob(id) {
  transact((tx) => {
    const s = tx.state();
    const j = tx.get('jobs', id);
    const today = todayISO();
    let { checklist, systemIds } = j;
    if (j.kind === 'planned_visit') {
      const contract = j.contractId ? tx.get('contracts', j.contractId) : null;
      const covered = contract ? contract.systemIds : tx.all('systems').filter((x) => x.siteId === j.siteId).map((x) => x.id);
      const atSite = tx.all('devices').filter((d) => d.siteId === j.siteId);
      let rows = dueGroups(atSite, covered, today);
      // Nothing due: a full check of the covered systems.
      if (rows.length === 0) rows = atSite.filter((d) => covered.includes(d.systemId));
      checklist = rows.map((d) => ({ id: tx.id('chk'), deviceId: d.id, systemId: d.systemId, label: deviceLabel(s, d), result: '', note: '' }));
      systemIds = [...new Set(rows.map((d) => d.systemId))];
    }
    tx.patch('jobs', id, { status: 'in_progress', startedOn: today, startedAt: new Date().toISOString(), checklist, systemIds });
    tx.log('job', id, j.kind === 'planned_visit' ? `Visit started: ${checklist.length} device groups to check` : 'Job started');
  });
}

export function setCheckResult(id, rowId, changes) {
  transact((tx) => {
    const j = tx.get('jobs', id);
    tx.patch('jobs', id, { checklist: j.checklist.map((r) => (r.id === rowId ? { ...r, ...changes } : r)) });
  });
}

/** "Mark the rest as pass": every item that has no result yet. One change, so one save. */
export function passRemaining(id) {
  transact((tx) => {
    const j = tx.get('jobs', id);
    tx.patch('jobs', id, { checklist: j.checklist.map((r) => (r.result ? r : { ...r, result: 'pass' })) });
  });
}

/** Findings, parts and time while the work goes on: no line in the activity list. */
export function updateJob(id, changes) {
  transact((tx) => {
    tx.patch('jobs', id, changes);
  });
}

/** Completing a visit moves the register: every device group that was tested is serviced today. */
export function completeJob(id, { autoHours = 0 } = {}) {
  transact((tx) => {
    const j = tx.get('jobs', id);
    const today = todayISO();
    for (const row of j.checklist) {
      if (row.result === 'pass' || row.result === 'fail') tx.patch('devices', row.deviceId, { lastServiced: today });
    }
    if (j.kind === 'repair') {
      for (const did of j.deficiencyIds) {
        const d = tx.get('deficiencies', did);
        if (d && d.status !== 'verified') {
          tx.patch('deficiencies', did, { status: 'repaired', repairedOn: today });
          tx.log('deficiency', did, `Repaired in ${j.number}`);
        }
      }
    }
    // The time on site, from the moment the job was started, goes to each person who went.
    const labour = autoHours > 0 && j.labour.length === 0 ? j.assigneeIds.map((staffId) => ({ staffId, hours: autoHours })) : j.labour;
    tx.patch('jobs', id, { status: 'completed', completedOn: today, completedAt: new Date().toISOString(), labour });
    const failed = j.checklist.filter((r) => r.result === 'fail').length;
    tx.log('job', id, j.kind === 'planned_visit' ? `Visit completed${failed ? `: ${failed} failed item${failed === 1 ? '' : 's'}` : ''}` : 'Job completed');
    if (j.kind === 'planned_visit') tx.log('site', j.siteId, `Planned visit completed (${j.number})`);
  });
}

export function signJob(id, { name, role, path = '' }) {
  transact((tx) => {
    tx.patch('jobs', id, { signature: { name, role, on: todayISO(), path } });
    tx.log('job', id, `Signed by ${name} for the customer`);
  });
}

/** The service report gets its number; a maintenance certificate can be issued with it. */
export function issueReport(id, { certificate }) {
  transact((tx) => {
    const j = tx.get('jobs', id);
    const today = todayISO();
    const number = tx.number('report');
    let certificateId = '';
    if (certificate) {
      const contract = j.contractId ? tx.get('contracts', j.contractId) : null;
      const nextRow = contract?.visitPlan.find((r) => r.dueOn > today);
      const certNumber = tx.number('certificate');
      certificateId = tx.id('cert');
      tx.put('certificates', {
        id: certificateId, number: certNumber, kind: 'maintenance', siteId: j.siteId, jobId: id, systemIds: j.systemIds,
        issuedOn: today, nextDue: nextRow?.dueOn ?? addMonths(today, 6),
      });
      tx.log('site', j.siteId, `Maintenance certificate ${certNumber} issued`);
    }
    tx.patch('jobs', id, { report: { number, issuedOn: today, sentOn: '', sentTo: [], certificateId } });
    tx.log('job', id, `Service report ${number} issued`);
  });
}

export function sendReport(id, { to }) {
  transact((tx) => {
    const j = tx.get('jobs', id);
    const names = to.map((cid) => tx.get('contacts', cid)?.name).filter(Boolean).join(', ');
    tx.patch('jobs', id, { status: 'report_sent', report: { ...j.report, sentOn: todayISO(), sentTo: to } });
    tx.log('job', id, `Service report ${j.report.number} sent${names ? `: ${names}` : ''}`);
    tx.log('customer', j.customerId, `Service report ${j.report.number} sent for ${j.number}`);
  });
}

export function cancelJob(id, reason) {
  transact((tx) => {
    tx.patch('jobs', id, { status: 'cancelled' });
    tx.log('job', id, `Cancelled: ${reason}`);
  });
}

// ---- deficiencies --------------------------------------------------------------------------
// An impairment takes the system (or the device) out of service.
function impair(tx, systemId, deviceId) {
  if (deviceId) tx.patch('devices', deviceId, { condition: 'out_of_service' });
  else tx.patch('systems', systemId, { status: 'impaired' });
}

export function createDeficiency(data) {
  return transact((tx) => {
    const id = tx.id('def');
    const number = tx.number('deficiency');
    const sys = tx.get('systems', data.systemId);
    tx.put('deficiencies', {
      id, number, siteId: sys.siteId, systemId: data.systemId, deviceId: data.deviceId || '', jobId: data.jobId || '',
      severity: data.severity, title: data.title, description: data.description || '', requirement: data.requirement || '',
      foundOn: data.foundOn || todayISO(), foundBy: staffOf(tx), status: 'found', reportedOn: '', reportedTo: '',
      quotationId: '', repairJobId: '', repairedOn: '', verifiedOn: '', verifiedBy: '', note: '', photos: data.photos ?? [],
    });
    if (data.severity === 'impairment') impair(tx, data.systemId, data.deviceId);
    tx.log('deficiency', id, 'Found');
    tx.log('site', sys.siteId, `Deficiency ${number}: ${data.title}`);
    if (data.severity === 'impairment') tx.log('customer', tx.get('sites', sys.siteId).customerId, `Impairment found: ${data.title}`);
    return id;
  });
}

export function updateDeficiency(id, changes) {
  transact((tx) => {
    tx.patch('deficiencies', id, changes);
    tx.log('deficiency', id, 'Details updated');
  });
}

/** Photos added to a deficiency while it is open: no line in the activity list. */
export function setDeficiencyPhotos(id, photos) {
  transact((tx) => {
    tx.patch('deficiencies', id, { photos });
  });
}

export function reportDeficiency(id, { contactId, note }) {
  transact((tx) => {
    const contact = tx.get('contacts', contactId);
    tx.patch('deficiencies', id, { status: 'reported', reportedOn: todayISO(), reportedTo: contactId, note });
    tx.log('deficiency', id, `Reported to the customer in writing${contact ? `: ${contact.name}` : ''}`);
  });
}

export function declineDeficiency(id, note) {
  transact((tx) => {
    tx.patch('deficiencies', id, { status: 'declined', note });
    tx.log('deficiency', id, `Declined by the customer${note ? `: ${note}` : ''}`);
  });
}

export function verifyDeficiency(id, { note }) {
  transact((tx) => {
    const d = tx.get('deficiencies', id);
    const today = todayISO();
    tx.patch('deficiencies', id, { status: 'verified', verifiedOn: today, verifiedBy: staffOf(tx), note: note || d.note, repairedOn: d.repairedOn || today });
    if (d.severity === 'impairment') {
      if (d.deviceId) tx.patch('devices', d.deviceId, { condition: 'ok' });
      const others = tx.all('deficiencies').filter((x) => x.id !== id && x.systemId === d.systemId && x.severity === 'impairment' && x.status !== 'verified');
      if (others.length === 0) tx.patch('systems', d.systemId, { status: 'in_service' });
    }
    tx.log('deficiency', id, 'Verified: the repair was checked');
  });
}

/** A repair job for a deficiency: from an accepted quotation, or a repair under the contract. */
export function startRepairJob({ quotationId, deficiencyId }) {
  return transact((tx) => {
    const s = tx.state();
    const q = quotationId ? tx.get('quotations', quotationId) : null;
    const d = deficiencyId ? tx.get('deficiencies', deficiencyId) : q?.kindData?.deficiencyRef ? deficiencyByNumber(s, q.kindData.deficiencyRef) : null;
    const siteId = q?.siteId || d.siteId;
    const st = tx.get('sites', siteId);
    const urgency = q?.kindData?.urgency ?? (d?.severity === 'impairment' ? 'emergency' : d?.severity === 'critical' ? 'urgent' : 'normal');
    const id = tx.id('job');
    const number = tx.number('job');
    const today = todayISO();
    tx.put('jobs', {
      id, number, kind: 'repair', customerId: q?.customerId ?? st.customerId, siteId,
      contractId: activeContractAt(tx, siteId)?.id ?? '', quotationId: q?.id ?? '', deficiencyIds: d ? [d.id] : [], visitId: '',
      title: q?.title ?? d.title, description: q ? `From the accepted quotation ${q.number}.` : `Repair under the contract for ${d.number}.`,
      urgency, requestedOn: today, dueOn: addDays(today, urgency === 'emergency' ? 1 : urgency === 'urgent' ? 3 : 10), status: 'unplanned',
      plannedOn: '', window: '', assigneeIds: [], startedOn: '', completedOn: '', systemIds: d ? [d.systemId] : [],
      checklist: [], findings: '', parts: [], labour: [], signature: null, report: null, callInfo: null, photos: [], startedAt: '', completedAt: '',
    });
    if (d) {
      tx.patch('deficiencies', d.id, { repairJobId: id });
      tx.log('deficiency', d.id, `Repair job ${number} created`);
    }
    if (q) {
      tx.patch('quotations', q.id, { followUp: { type: 'job', id, number } });
      tx.log('quotation', q.id, `Repair job ${number} created`);
    }
    tx.log('job', id, q ? `Created from the accepted quotation ${q.number}` : 'Repair job created');
    return id;
  });
}

// ---- the equipment register's impairment ---------------------------------------------------------
/** Marking a system out of service records an impairment. */
export function impairSystem(systemId) {
  return transact((tx) => {
    const sys = tx.get('systems', systemId);
    tx.patch('systems', systemId, { status: 'impaired' });
    const open = tx.all('deficiencies').find((d) => d.systemId === systemId && d.severity === 'impairment' && d.status !== 'verified');
    tx.log('site', sys.siteId, `${sys.name} marked out of service (impaired)`);
    if (open) return open.id;
    const id = tx.id('def');
    const number = tx.number('deficiency');
    tx.put('deficiencies', {
      id, number, siteId: sys.siteId, systemId, deviceId: '', jobId: '', severity: 'impairment',
      title: `${sys.name} is out of service`, description: 'Marked out of service in the equipment register. The owner must be told.',
      requirement: '', foundOn: todayISO(), foundBy: staffOf(tx), status: 'found', reportedOn: '', reportedTo: '',
      quotationId: '', repairJobId: '', repairedOn: '', verifiedOn: '', verifiedBy: '', note: '', photos: [],
    });
    tx.log('deficiency', id, 'Found: the system was marked out of service');
    return id;
  });
}

/** Putting a system back in service closes its open impairments. */
export function restoreSystem(systemId) {
  transact((tx) => {
    const sys = tx.get('systems', systemId);
    tx.patch('systems', systemId, { status: 'in_service' });
    for (const d of tx.all('deficiencies')) {
      if (d.systemId === systemId && d.severity === 'impairment' && d.status !== 'verified') {
        tx.patch('deficiencies', d.id, { status: 'verified', verifiedOn: todayISO(), verifiedBy: staffOf(tx), repairedOn: todayISO() });
        tx.log('deficiency', d.id, 'Verified: the system is back in service');
      }
    }
    tx.log('site', sys.siteId, `${sys.name} back in service`);
  });
}

// ---- certificates and the monthly return ---------------------------------------------------------------
export function submitReturn(month, reference) {
  transact((tx) => {
    tx.put('returns', { id: month, month, status: 'submitted', on: todayISO(), reference });
    tx.log('site', tx.all('sites')[0].id, `Monthly return for ${month} submitted`);
  });
}
