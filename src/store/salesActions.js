import { amcSections } from '@/data/amc.js';
import { ANSWER_VIA, ENQUIRY_SOURCES, defaultKindData, defaultTerms, emptyApproval } from '@/data/quotationKinds.js';
import { addDays, todayISO } from '@/lib/dates.js';
import { answerDeficiencyQuotation, linkQuotationToDeficiency } from './links.js';
import { transact } from './store.js';
import { approvalNeeds, quotationLabel } from './salesSelectors.js';

// Every change to enquiries, quotations, the catalogue and the approval limits.
// Each one is one transaction and writes its line into the activity lists.

const emptySurvey = { needed: false, plannedOn: '', assigneeId: '', doneOn: '', notes: '' };

// ---- enquiries ------------------------------------------------------------------
export function createEnquiry(data) {
  return transact((tx) => {
    const id = tx.id('enq');
    const { surveyNeeded, surveyOn, surveyBy, ...rest } = data;
    const survey = surveyNeeded
      ? { needed: true, plannedOn: surveyOn || '', assigneeId: surveyBy || '', doneOn: '', notes: '' }
      : { ...emptySurvey };
    tx.put('enquiries', {
      description: '', contactId: '', siteId: '', dueOn: '', estValue: 0, lostReason: '', lostNote: '',
      ...rest, id, number: tx.number('enquiry'), status: surveyNeeded && surveyOn ? 'survey' : 'new', survey,
    });
    tx.log('enquiry', id, `Enquiry registered (${(ENQUIRY_SOURCES[data.source] ?? data.source).toLowerCase()})`);
    tx.log('customer', data.customerId, `Enquiry registered: ${data.title}`);
    return id;
  });
}

export function updateEnquiry(id, data) {
  transact((tx) => {
    const old = tx.get('enquiries', id);
    const { surveyNeeded, surveyOn, surveyBy, ...rest } = data;
    const survey = surveyNeeded
      ? { ...old.survey, needed: true, plannedOn: surveyOn ?? old.survey.plannedOn, assigneeId: surveyBy ?? old.survey.assigneeId }
      : { ...emptySurvey };
    let status = old.status;
    if (status === 'survey' && !survey.needed) status = 'new';
    if (status === 'new' && survey.needed && survey.plannedOn) status = 'survey';
    tx.patch('enquiries', id, { ...rest, survey, status });
    tx.log('enquiry', id, 'Enquiry details updated');
  });
}

export function planSurvey(id, { plannedOn, assigneeId }) {
  transact((tx) => {
    const e = tx.get('enquiries', id);
    tx.patch('enquiries', id, {
      survey: { ...e.survey, needed: true, plannedOn, assigneeId },
      status: ['new', 'survey'].includes(e.status) ? 'survey' : e.status,
    });
    tx.log('enquiry', id, `Site survey planned for ${plannedOn}`);
  });
}

export function recordSurvey(id, { doneOn, notes }) {
  transact((tx) => {
    const e = tx.get('enquiries', id);
    tx.patch('enquiries', id, {
      survey: { ...e.survey, doneOn, notes },
      status: ['new', 'survey'].includes(e.status) ? 'estimating' : e.status,
    });
    tx.log('enquiry', id, 'Site survey done');
  });
}

export function markEnquiryLost(id, { reason, note }) {
  transact((tx) => {
    const e = tx.patch('enquiries', id, { status: 'lost', lostReason: reason, lostNote: note, closedOn: todayISO() });
    tx.log('enquiry', id, `Lost: ${reason.toLowerCase()}`);
    tx.log('customer', e.customerId, `Enquiry ${e.number} lost: ${reason.toLowerCase()}`);
  });
}

export function reopenEnquiry(id) {
  transact((tx) => {
    const e = tx.get('enquiries', id);
    const hasQuote = tx.all('quotations').some((q) => q.enquiryId === id && q.status !== 'superseded');
    tx.patch('enquiries', id, { status: hasQuote ? 'quoted' : e.survey.doneOn ? 'estimating' : 'new', lostReason: '', lostNote: '', closedOn: '' });
    tx.log('enquiry', id, 'Enquiry reopened');
  });
}

/** Only an enquiry that is new and has no quotation can be deleted. */
export function deleteEnquiry(id) {
  return transact((tx) => {
    const e = tx.get('enquiries', id);
    if (e.status !== 'new' || tx.all('quotations').some((q) => q.enquiryId === id)) return false;
    tx.remove('enquiries', id);
    return true;
  });
}

// ---- quotations -----------------------------------------------------------------
export function createQuotation(data) {
  return transact((tx) => {
    const s = tx.state();
    const today = todayISO();
    const id = tx.id('qt');
    const { kind } = data;
    tx.put('quotations', {
      id, number: tx.number('quotation'), rev: 0, enquiryId: data.enquiryId || '', customerId: data.customerId,
      siteId: data.siteId || '', contactId: data.contactId || '', kind, title: data.title, status: 'draft',
      createdOn: today, validUntil: addDays(today, s.settings.validityDays), preparedBy: s.session.userId, discountPct: 0,
      sections: kind === 'contract' ? [] : [{ id: tx.id('sec'), title: kind === 'project' ? 'Works' : 'Items' }],
      lines: [], terms: defaultTerms(kind),
      kindData: { ...defaultKindData(kind, today), ...(data.deficiencyRef ? { deficiencyRef: data.deficiencyRef } : {}) },
      approval: emptyApproval(), sent: null, answer: null, supersededBy: '', followUp: null,
    });
    if (data.deficiencyRef) linkQuotationToDeficiency(tx, tx.get('quotations', id));
    const enquiry = data.enquiryId ? tx.get('enquiries', data.enquiryId) : null;
    if (enquiry && ['new', 'survey'].includes(enquiry.status)) tx.patch('enquiries', enquiry.id, { status: 'estimating' });
    tx.log('quotation', id, `Quotation created (${kind})`);
    return id;
  });
}

/** Edits while writing (lines, sections, discount): no line in the activity list. */
export function updateQuotation(id, changes) {
  transact((tx) => {
    tx.patch('quotations', id, changes);
  });
}

export function saveQuotationDetails(id, changes, note = 'Details updated') {
  transact((tx) => {
    const before = tx.get('quotations', id);
    const q = tx.patch('quotations', id, changes);
    // A deficiency number written in the terms links the repair to it.
    if (q.kind === 'repair' && q.kindData.deficiencyRef && q.kindData.deficiencyRef !== before.kindData.deficiencyRef) linkQuotationToDeficiency(tx, q);
    tx.log('quotation', id, note);
  });
}

export function submitForApproval(id, comment = '') {
  return transact((tx) => {
    const s = tx.state();
    const needs = approvalNeeds(tx.get('quotations', id), s);
    if (!needs.needed) return false;
    tx.patch('quotations', id, {
      status: 'waiting_approval',
      approval: { ...emptyApproval(), required: needs.role, reasons: needs.reasons, requestedBy: s.session.userId, requestedOn: todayISO(), comment },
    });
    tx.log('quotation', id, `Sent for approval to the ${needs.roleLabel}`);
    return true;
  });
}

export function decideApproval(id, { approve, note }) {
  transact((tx) => {
    const s = tx.state();
    const q = tx.get('quotations', id);
    tx.patch('quotations', id, {
      status: approve ? 'approved' : 'draft',
      approval: { ...q.approval, decision: approve ? 'approved' : 'rejected', decidedBy: s.session.userId, decidedOn: todayISO(), decisionNote: note },
    });
    tx.log('quotation', id, approve ? `Approved${note ? `: ${note}` : ''}` : `Approval refused: ${note}`);
  });
}

/** Back to draft (to edit again); a new approval is needed afterwards. */
export function returnToDraft(id, note = 'Returned to draft') {
  transact((tx) => {
    tx.patch('quotations', id, { status: 'draft', approval: emptyApproval() });
    tx.log('quotation', id, note);
  });
}

export function sendQuotation(id, { to, message }) {
  transact((tx) => {
    const s = tx.state();
    const q = tx.get('quotations', id);
    const today = todayISO();
    tx.patch('quotations', id, {
      status: 'sent',
      sent: { on: today, to, message },
      validUntil: q.validUntil < today ? addDays(today, s.settings.validityDays) : q.validUntil,
    });
    const enquiry = q.enquiryId ? tx.get('enquiries', q.enquiryId) : null;
    if (enquiry && ['new', 'survey', 'estimating'].includes(enquiry.status)) tx.patch('enquiries', enquiry.id, { status: 'quoted' });
    const names = to.map((cid) => tx.get('contacts', cid)?.name).filter(Boolean).join(', ');
    tx.log('quotation', id, `Sent to the customer${names ? `: ${names}` : ''}`);
    tx.log('customer', q.customerId, `Quotation ${quotationLabel(q)} sent`);
  });
}

export function recordAnswer(id, answer) {
  transact((tx) => {
    const q = tx.get('quotations', id);
    const accepted = answer.result === 'accepted';
    tx.patch('quotations', id, { status: accepted ? 'accepted' : 'rejected', answer });
    if (q.enquiryId && accepted) tx.patch('enquiries', q.enquiryId, { status: 'won', closedOn: answer.on });
    if (q.kind === 'repair') answerDeficiencyQuotation(tx, q, accepted);
    const via = ANSWER_VIA[answer.via]?.toLowerCase() ?? answer.via;
    tx.log('quotation', id, accepted ? `Accepted by the customer (${via}${answer.reference ? `, ${answer.reference}` : ''})` : `Rejected by the customer: ${answer.reason.toLowerCase()}`);
    tx.log('customer', q.customerId, `Quotation ${quotationLabel(q)} ${accepted ? 'accepted' : 'rejected'}`);
  });
}

export function extendValidity(id, days) {
  transact((tx) => {
    const q = tx.get('quotations', id);
    const from = q.validUntil > todayISO() ? q.validUntil : todayISO();
    tx.patch('quotations', id, { validUntil: addDays(from, days) });
    tx.log('quotation', id, `Validity extended by ${days} days`);
  });
}

// A copy with new ids for its sections and lines.
function copyBody(tx, q) {
  const sectionIds = new Map();
  const sections = q.sections.map((sec) => {
    const nid = tx.id('sec');
    sectionIds.set(sec.id, nid);
    return { ...sec, id: nid };
  });
  const lines = q.lines.map((l) => ({ ...l, id: tx.id('ln'), sectionId: sectionIds.get(l.sectionId) }));
  return { sections, lines, terms: { ...q.terms }, kindData: { ...q.kindData } };
}

/** A new revision of the same quotation: the old one is marked as replaced. */
export function reviseQuotation(id) {
  return transact((tx) => {
    const s = tx.state();
    const old = tx.get('quotations', id);
    const today = todayISO();
    const nid = tx.id('qt');
    tx.put('quotations', {
      ...old, ...copyBody(tx, old), id: nid, rev: old.rev + 1, status: 'draft', createdOn: today,
      validUntil: addDays(today, s.settings.validityDays), preparedBy: s.session.userId,
      approval: emptyApproval(), sent: null, answer: null, supersededBy: '', followUp: null,
    });
    tx.patch('quotations', id, { status: 'superseded', supersededBy: nid });
    const enquiry = old.enquiryId ? tx.get('enquiries', old.enquiryId) : null;
    if (enquiry && enquiry.status === 'quoted') tx.patch('enquiries', enquiry.id, { status: 'estimating' });
    if (old.kind === 'repair') linkQuotationToDeficiency(tx, tx.get('quotations', nid));
    tx.log('quotation', nid, `Revision ${old.rev + 1} created from revision ${old.rev}`);
    tx.log('quotation', id, `Replaced by revision ${old.rev + 1}`);
    return nid;
  });
}

/** A copy as a new quotation with its own number. */
export function duplicateQuotation(id) {
  return transact((tx) => {
    const s = tx.state();
    const old = tx.get('quotations', id);
    const today = todayISO();
    const nid = tx.id('qt');
    tx.put('quotations', {
      ...old, ...copyBody(tx, old), id: nid, number: tx.number('quotation'), rev: 0, enquiryId: '',
      title: `${old.title} (copy)`, status: 'draft', createdOn: today,
      validUntil: addDays(today, s.settings.validityDays), preparedBy: s.session.userId,
      approval: emptyApproval(), sent: null, answer: null, supersededBy: '',
    });
    tx.log('quotation', nid, `Copied from ${quotationLabel(old)}`);
    return nid;
  });
}

/** Only a draft that is not a revision can be deleted. */
export function deleteQuotation(id) {
  return transact((tx) => {
    const q = tx.get('quotations', id);
    if (q.status !== 'draft' || q.rev > 0) return false;
    tx.remove('quotations', id);
    return true;
  });
}

/** Adds the covered systems of a contract quotation, priced from the equipment register. */
export function importCoverage(id, systemIds) {
  return transact((tx) => {
    const s = tx.state();
    const q = tx.get('quotations', id);
    const covered = new Set(q.sections.map((sec) => sec.systemId).filter(Boolean));
    const systems = systemIds.filter((sid) => !covered.has(sid)).map((sid) => s.systems[sid]);
    const byCode = Object.fromEntries(Object.values(s.items).map((i) => [i.code, i]));
    const { sections, lines } = amcSections(systems, Object.values(s.devices), byCode, tx.id);
    tx.patch('quotations', id, { sections: [...q.sections, ...sections], lines: [...q.lines, ...lines] });
    tx.log('quotation', id, `Coverage added: ${systems.map((x) => x.name).join(', ')}`);
    return { systems: sections.length, lines: lines.length };
  });
}

// ---- catalogue and approval limits -----------------------------------------------------
export function saveItem(item) {
  return transact((tx) => {
    const id = item.id ?? tx.id('item');
    tx.put('items', { active: true, kind: 'material', ...item, id });
    return id;
  });
}

export function saveApprovalLimits(approvals) {
  transact((tx) => {
    tx.set('settings', { ...tx.state().settings, approvals });
  });
}
