import { emptyCreditApproval, termsDays } from '@/data/billingKinds.js';
import {
  balanceOf, claimInvoiceLines, claimTitle, contractInvoiceLines, documentTotals, dueFor, jobInvoiceLines, quotationInvoiceLines, settlements, unappliedOf,
} from '@/data/billingRules.js';
import { STORE_ID } from '@/data/purchaseKinds.js';
import { netOf, progressClaims } from '@/data/projectRules.js';
import { todayISO } from '@/lib/dates.js';
import { money, round2 } from '@/lib/format.js';
import { creditApprovalNeeds, payerOf } from './billingSelectors.js';
import { applyClaimPayment } from './projectActions.js';
import { balanceIn, postMovement } from './stockCore.js';
import { transact } from './store.js';

// Every change to invoices, receipts and credit notes. Each one is one
// transaction; the ones that touch the record an invoice came from (a billing
// plan, a claim, a job, a quotation, the stock) do it in the same transaction,
// so the two sides never disagree.

const who = (tx) => tx.state().session.userId;
const EPS = 0.004;

// ---- where an invoice comes from ---------------------------------------------------------------------

/** The draft that a source already has, if it has one. */
function existingDraft(tx, source) {
  let id = '';
  if (source.kind === 'contract') id = tx.get('contracts', source.contractId).billingPlan.find((r) => r.id === source.rowId)?.invoiceId;
  else if (source.kind === 'claim') id = tx.get('projects', source.projectId).claims.find((c) => c.id === source.claimId)?.invoiceId;
  else if (source.kind === 'job') id = tx.get('jobs', source.jobId).invoiceId;
  else if (source.kind === 'supply') id = tx.all('invoices').find((i) => i.source.kind === 'supply' && i.source.quotationId === source.quotationId && i.status === 'draft')?.id;
  return id && tx.get('invoices', id)?.status === 'draft' ? id : '';
}

/**
 * A draft invoice from a record of another area: the lines, the payer and the
 * amounts come from it. A source that already has a draft opens that draft.
 */
export function createInvoiceFromSource(source) {
  return transact((tx) => {
    const s = tx.state();
    const found = existingDraft(tx, source);
    if (found) return found;
    let base;
    if (source.kind === 'contract') {
      const c = tx.get('contracts', source.contractId);
      const row = c.billingPlan.find((r) => r.id === source.rowId);
      base = {
        customerId: payerOf(s, c.siteId), siteId: c.siteId, supplyOn: row.dueOn, title: `Maintenance contract ${c.number}, instalment ${row.n} of ${c.billingPlan.length}`,
        lines: contractInvoiceLines(c, row, tx.id), locked: true, reference: '', discountPct: 0,
      };
    } else if (source.kind === 'claim') {
      const p = tx.get('projects', source.projectId);
      const c = p.claims.find((x) => x.id === source.claimId);
      const previous = progressClaims(p).filter((x) => x.status !== 'draft' && x.n < c.n).at(-1);
      base = {
        customerId: p.customerId, siteId: p.siteId, supplyOn: c.periodEnd || c.certifiedOn, title: claimTitle(p, c), reference: p.lpo,
        lines: claimInvoiceLines(p, c, previous ? netOf(previous) : 0, tx.id), locked: true, discountPct: 0,
      };
    } else if (source.kind === 'job') {
      const j = tx.get('jobs', source.jobId);
      const q = j.kind === 'repair' ? s.quotations[j.quotationId] : null;
      const byCode = Object.fromEntries(Object.values(s.items).map((i) => [i.code, i]));
      base = {
        customerId: payerOf(s, j.siteId), siteId: j.siteId, supplyOn: j.completedOn || todayISO(), title: `${j.number}: ${j.title}`,
        reference: q?.answer?.reference ?? '', lines: q ? quotationInvoiceLines(q, tx.id) : jobInvoiceLines(j, byCode, tx.id, s.items), locked: false, discountPct: q?.discountPct || 0,
      };
    } else if (source.kind === 'supply') {
      const q = tx.get('quotations', source.quotationId);
      base = {
        customerId: payerOf(s, q.siteId) || q.customerId, siteId: q.siteId, supplyOn: todayISO(), title: `${q.number}: ${q.title}`,
        reference: q.answer?.reference ?? '', lines: quotationInvoiceLines(q, tx.id), locked: false, discountPct: q.discountPct || 0,
      };
    } else {
      throw new Error(`Unknown source ${source.kind}`);
    }
    const id = tx.id('inv');
    const customer = tx.get('customers', base.customerId);
    tx.put('invoices', {
      id, number: '', status: 'draft', contactId: '', source, issuedOn: '', dueOn: '', terms: customer.terms, vatRate: s.settings.vatRate, notes: '',
      createdBy: who(tx), createdOn: todayISO(), sent: null, reminders: [], ...base,
    });
    // The source remembers its invoice, so it is not invoiced twice.
    if (source.kind === 'contract') {
      const c = tx.get('contracts', source.contractId);
      tx.patch('contracts', c.id, { billingPlan: c.billingPlan.map((r) => (r.id === source.rowId ? { ...r, invoiceId: id } : r)) });
    } else if (source.kind === 'claim') {
      const p = tx.get('projects', source.projectId);
      tx.patch('projects', p.id, { claims: p.claims.map((x) => (x.id === source.claimId ? { ...x, invoiceId: id } : x)) });
    } else if (source.kind === 'job') {
      tx.patch('jobs', source.jobId, { invoiceId: id });
    }
    tx.log('invoice', id, `Draft made ${{ contract: 'from the contract', claim: 'from the project claim', job: 'from the job', supply: 'from the accepted quotation' }[source.kind]}`);
    return id;
  });
}

/** A new draft that has no source (a manual invoice), or changes to a draft. A locked invoice keeps its lines. */
export function saveInvoice(data) {
  return transact((tx) => {
    const s = tx.state();
    const old = data.id ? tx.get('invoices', data.id) : null;
    const customer = tx.get('customers', data.customerId);
    const id = data.id ?? tx.id('inv');
    const lines = (old?.locked ? old.lines : data.lines).map((l) => ({ id: l.id ?? tx.id('il'), itemId: l.itemId ?? '', description: l.description, qty: Number(l.qty), unit: l.unit, price: Number(l.price) }));
    tx.put('invoices', {
      number: '', status: 'draft', source: { kind: 'manual' }, issuedOn: '', dueOn: '', vatRate: s.settings.vatRate, createdBy: who(tx), createdOn: todayISO(), sent: null, reminders: [], locked: false,
      ...old,
      id, customerId: data.customerId, siteId: data.siteId ?? '', contactId: data.contactId ?? '', terms: customer.terms, reference: data.reference ?? '', supplyOn: data.supplyOn || todayISO(),
      title: data.title, notes: data.notes ?? '', lines, discountPct: old?.locked ? old.discountPct : Number(data.discountPct || 0),
    });
    tx.log('invoice', id, old ? 'Draft changed' : 'Draft made');
    return id;
  });
}

/** Only a draft can be deleted; the source is free to be invoiced again. */
export function deleteInvoiceDraft(id) {
  return transact((tx) => {
    const inv = tx.get('invoices', id);
    if (inv.status !== 'draft') return false;
    const src = inv.source;
    if (src.kind === 'contract') {
      const c = tx.get('contracts', src.contractId);
      tx.patch('contracts', c.id, { billingPlan: c.billingPlan.map((r) => (r.id === src.rowId ? { ...r, invoiceId: '' } : r)) });
    } else if (src.kind === 'claim') {
      const p = tx.get('projects', src.projectId);
      tx.patch('projects', p.id, { claims: p.claims.map((x) => (x.id === src.claimId ? { ...x, invoiceId: '' } : x)) });
    } else if (src.kind === 'job') {
      tx.patch('jobs', src.jobId, { invoiceId: '' });
    }
    tx.remove('invoices', id);
    return true;
  });
}

// ---- issuing and sending ----------------------------------------------------------------------------------
/**
 * Issuing gives the invoice its number, its date and its due day, and it can no longer
 * be changed (a mistake is corrected by a credit note). The record it came from learns
 * the number; a claim becomes "invoiced"; the stock items of a supply leave the store.
 */
export function issueInvoice(id) {
  return transact((tx) => {
    const inv = tx.get('invoices', id);
    const today = todayISO();
    const number = tx.number('invoice');
    tx.patch('invoices', id, { number, status: 'issued', issuedOn: today, dueOn: dueFor(today, termsDays(inv.terms)) });
    const src = inv.source;
    const short = [];
    if (src.kind === 'contract') {
      const c = tx.get('contracts', src.contractId);
      tx.patch('contracts', c.id, { billingPlan: c.billingPlan.map((r) => (r.id === src.rowId ? { ...r, invoiceRef: number, invoiceId: id } : r)) });
      tx.log('contract', c.id, `Invoice ${number} issued for instalment ${c.billingPlan.find((r) => r.id === src.rowId)?.n}`);
    } else if (src.kind === 'claim') {
      const p = tx.get('projects', src.projectId);
      tx.patch('projects', p.id, { claims: p.claims.map((x) => (x.id === src.claimId ? { ...x, status: 'invoiced', invoiceRef: number, invoiceId: id } : x)) });
      tx.log('project', p.id, `Claim invoiced: ${number}`);
    } else if (src.kind === 'job') {
      tx.log('job', src.jobId, `Invoiced: ${number}`);
    } else if (src.kind === 'supply') {
      tx.patch('quotations', src.quotationId, { followUp: { type: 'invoice', id, number } });
      tx.log('quotation', src.quotationId, `Delivered and invoiced: ${number}`);
      for (const l of inv.lines) {
        const item = l.itemId ? tx.get('items', l.itemId) : null;
        if (!item?.stocked) continue;
        postMovement(tx, { kind: 'issue_sale', itemId: item.id, locationId: STORE_ID, qty: -l.qty, ref: { kind: 'invoice', id, number } });
        if (balanceIn(tx, item.id, STORE_ID) < 0) short.push(item.name);
      }
    }
    const total = documentTotals(inv).total;
    tx.log('invoice', id, `Issued: ${number}, AED ${money(total)}, due in ${termsDays(inv.terms)} days`);
    tx.log('customer', inv.customerId, `Invoice ${number} issued: AED ${money(total)}`);
    return { number, short };
  });
}

/** `to` is a list of contact ids; `attached` names the documents that go with it (the service report). */
export function sendInvoice(id, { to, message, attached = [] }) {
  transact((tx) => {
    const inv = tx.get('invoices', id);
    tx.patch('invoices', id, { sent: { on: todayISO(), to, message, attached } });
    const names = to.map((cid) => tx.get('contacts', cid)?.name).filter(Boolean).join(', ');
    tx.log('invoice', id, `Sent to the customer${names ? `: ${names}` : ''}${attached.length ? ` with ${attached.join(', ')}` : ''}`);
    tx.log('customer', inv.customerId, `Invoice ${inv.number} sent`);
  });
}

export function sendReminder(id, { to, message }) {
  transact((tx) => {
    const inv = tx.get('invoices', id);
    const level = inv.reminders.length + 1;
    tx.patch('invoices', id, { reminders: [...inv.reminders, { on: todayISO(), level, to, message }] });
    tx.log('invoice', id, `Reminder ${level} sent`);
  });
}

/** A statement of account goes to the customer; only the history remembers it. `to` is a list of contact ids. */
export function sendStatement(customerId, { to, from, until }) {
  transact((tx) => {
    const names = to.map((cid) => tx.get('contacts', cid)?.name).filter(Boolean).join(', ');
    tx.log('customer', customerId, `Statement of account sent (${from} to ${until})${names ? `: ${names}` : ''}`);
  });
}

// ---- money received ------------------------------------------------------------------------------------------
/** After money or credit reaches invoices: an invoice paid in full is logged, and a paid claim moves its project on. */
function afterSettling(tx, invoiceIds, on, byPayment) {
  const settled = settlements(tx.all('payments'), tx.all('creditNotes'));
  for (const iid of new Set(invoiceIds)) {
    const inv = tx.get('invoices', iid);
    if (balanceOf(inv, settled[iid]) > EPS) continue;
    tx.log('invoice', iid, byPayment ? 'Paid in full' : 'Settled by a credit note');
    if (byPayment && inv.source.kind === 'claim') applyClaimPayment(tx, inv.source.projectId, inv.source.claimId, on);
  }
}

/**
 * Money from a customer: `allocations` are [{ invoiceId, amount }]. What no invoice takes stays
 * on the receipt as money on account, to be allocated later.
 */
export function recordPayment({ customerId, amount, on, method, reference, note, allocations }) {
  return transact((tx) => {
    const id = tx.id('pay');
    const number = tx.number('receipt');
    const rows = allocations.filter((a) => a.amount > EPS).map((a) => ({ invoiceId: a.invoiceId, amount: round2(a.amount) }));
    tx.put('payments', { id, number, customerId, on, amount: round2(amount), method, reference: reference ?? '', byId: who(tx), note: note ?? '', allocations: rows });
    tx.log('payment', id, `Payment received: AED ${money(amount)}`);
    for (const a of rows) tx.log('invoice', a.invoiceId, `Payment received: ${number}, AED ${money(a.amount)}`);
    tx.log('customer', customerId, `Payment received: AED ${money(amount)} (${number})`);
    afterSettling(tx, rows.map((a) => a.invoiceId), on, true);
    return { id, number };
  });
}

/** Money that was on account goes to invoices. */
export function allocatePayment(paymentId, allocations) {
  transact((tx) => {
    const p = tx.get('payments', paymentId);
    const rows = allocations.filter((a) => a.amount > EPS).map((a) => ({ invoiceId: a.invoiceId, amount: round2(a.amount) }));
    tx.patch('payments', paymentId, { allocations: [...p.allocations, ...rows] });
    for (const a of rows) tx.log('invoice', a.invoiceId, `Payment ${p.number} allocated: AED ${money(a.amount)}`);
    afterSettling(tx, rows.map((a) => a.invoiceId), p.on, true);
  });
}

// ---- credit notes -----------------------------------------------------------------------------------------------
/** A draft credit note against an invoice: `lines` carry the quantities to credit. */
export function createCreditNote({ invoiceId, reason, note, lines }) {
  return transact((tx) => {
    const inv = tx.get('invoices', invoiceId);
    const id = tx.id('cn');
    tx.put('creditNotes', {
      id, number: '', invoiceId, customerId: inv.customerId, siteId: inv.siteId, status: 'draft', reason, note: note ?? '',
      lines: lines.filter((l) => Number(l.qty) > 0).map((l) => ({ id: tx.id('il'), itemId: l.itemId ?? '', description: l.description, qty: Number(l.qty), unit: l.unit, price: Number(l.price) })),
      discountPct: inv.discountPct || 0, vatRate: inv.vatRate, createdBy: who(tx), createdOn: todayISO(), issuedOn: '', approval: emptyCreditApproval(), applied: [],
    });
    tx.log('creditNote', id, 'Credit note made');
    tx.log('invoice', invoiceId, `Credit note made against this invoice`);
    return id;
  });
}

export function deleteCreditNoteDraft(id) {
  transact((tx) => {
    if (tx.get('creditNotes', id).status === 'draft') tx.remove('creditNotes', id);
  });
}

/** The credit note gets its number and its day, and the credit goes to its invoice as far as the invoice still owes. */
function issueCredit(tx, id, decidedBy) {
  const cn = tx.get('creditNotes', id);
  const inv = tx.get('invoices', cn.invoiceId);
  const number = tx.number('creditNote');
  const today = todayISO();
  const total = documentTotals(cn).total;
  const settled = settlements(tx.all('payments'), tx.all('creditNotes'));
  const owed = Math.max(0, balanceOf(inv, settled[inv.id]));
  const take = round2(Math.min(total, owed));
  tx.patch('creditNotes', id, { number, status: 'issued', issuedOn: today, applied: take > EPS ? [{ invoiceId: inv.id, amount: take, on: today }] : [] });
  tx.log('creditNote', id, decidedBy ? 'Approved and issued' : 'Issued');
  tx.log('invoice', inv.id, `Credit note ${number} issued: AED ${money(total)}${take > EPS ? `, AED ${money(take)} taken off this invoice` : ' (the invoice was paid: the credit is on account)'}`);
  tx.log('customer', cn.customerId, `Credit note ${number} issued: AED ${money(total)}`);
  afterSettling(tx, [inv.id], today, false);
  return number;
}

export function issueCreditNote(id) {
  return transact((tx) => issueCredit(tx, id, false));
}

export function submitCreditForApproval(id, comment = '') {
  return transact((tx) => {
    const cn = tx.get('creditNotes', id);
    const needs = creditApprovalNeeds(cn, tx.state());
    if (!needs.needed) return false;
    tx.patch('creditNotes', id, {
      status: 'waiting_approval',
      approval: { ...emptyCreditApproval(), required: needs.role, reasons: needs.reasons, requestedBy: who(tx), requestedOn: todayISO(), comment },
    });
    tx.log('creditNote', id, `Sent for approval to the ${needs.roleLabel}`);
    return true;
  });
}

/** The person who asked withdraws the request; the credit note is a draft again. */
export function returnCreditToDraft(id) {
  transact((tx) => {
    tx.patch('creditNotes', id, { status: 'draft', approval: emptyCreditApproval() });
    tx.log('creditNote', id, 'Approval request withdrawn');
  });
}

export function decideCreditApproval(id, { approve, note }) {
  return transact((tx) => {
    const cn = tx.get('creditNotes', id);
    const approval = { ...cn.approval, decision: approve ? 'approved' : 'rejected', decidedBy: who(tx), decidedOn: todayISO(), decisionNote: note };
    tx.patch('creditNotes', id, { approval, status: approve ? cn.status : 'draft' });
    if (!approve) {
      tx.log('creditNote', id, `Approval refused: ${note}`);
      return '';
    }
    return issueCredit(tx, id, true);
  });
}

/** The credit of an issued credit note that no invoice has taken goes to invoices. */
export function applyCreditNote(id, allocations) {
  transact((tx) => {
    const cn = tx.get('creditNotes', id);
    const free = unappliedOf(cn, documentTotals(cn).total);
    let left = free;
    const rows = [];
    for (const a of allocations) {
      const take = round2(Math.min(left, a.amount));
      if (take > EPS) {
        rows.push({ invoiceId: a.invoiceId, amount: take, on: todayISO() });
        left = round2(left - take);
      }
    }
    tx.patch('creditNotes', id, { applied: [...(cn.applied ?? []), ...rows] });
    for (const r of rows) tx.log('invoice', r.invoiceId, `Credit of ${cn.number} taken off this invoice: AED ${money(r.amount)}`);
    afterSettling(tx, rows.map((r) => r.invoiceId), todayISO(), false);
  });
}

