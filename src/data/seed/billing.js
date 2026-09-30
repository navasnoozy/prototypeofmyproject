import { addDays } from '../../lib/dates.js';
import { round2 } from '../../lib/format.js';
import { emptyCreditApproval, termsDays } from '../billingKinds.js';
import {
  claimInvoiceLines, claimTitle, contractInvoiceLines, creditLevel, documentTotals, dueFor, jobInvoiceLines, quotationInvoiceLines,
} from '../billingRules.js';
import { netOf, progressClaims } from '../projectRules.js';
import { DEFAULT_SETTINGS } from './sales.js';

// The money documents of the sample company: an invoice for every billing period
// of a contract, every claim of a project, and a few jobs and supplies that were
// invoiced, with the receipts, credit notes and the reminders that followed. Nothing
// here is invented apart from the way customers pay: every invoice comes from a
// record that the earlier areas already hold (the billing plans, the claims, the
// jobs and the quotations), and the link is written back into that record, so the
// two sides never disagree. Numbers follow the dates, year by year.

// How many days after the invoice each customer usually pays (a sample habit).
const HABIT = {
  cus_alnoor: 52, cus_meridian: 40, cus_palm: 26, cus_sahara: 55, cus_falcon: 44, cus_zenith: 13, cus_mall: 50, cus_oasis: 28,
  cus_bright: 62, cus_mussafah: 58, cus_rose: 78, cus_sharjah: 12, cus_nexus: 30, cus_green: 28, cus_harbour: 52, cus_marina: 52,
  cus_wasl: 0, cus_khalid: 0,
};
const METHOD = { cus_bright: 'cheque', cus_mall: 'cheque', cus_oasis: 'cheque', cus_wasl: 'cash', cus_khalid: 'card', cus_rose: 'cheque' };

// The invoices that stay unpaid on purpose, so that every part of the ageing has a story.
const UNPAID = new Set([
  'contract:con_2:4', // Harbour View: the contract ended without renewal and the payer disputes the last period
  'contract:con_11:2', // the school pays slowly in the holidays
  'contract:con_7:1', 'contract:con_13:2',
  'contract:con_14:2', 'contract:con_14:3', 'contract:con_14:4', // the restaurant group is on hold for these
  'job:jb_22',
]);
// The mall paid a part of one invoice.
const PARTIAL = { 'contract:con_9:4': { daysAgo: 14, amount: 10000 } };
// One transfer of the facilities manager pays two invoices of two buildings.
const GROUP = { 'contract:con_1:1': 'an1', 'contract:con_2:3': 'an1' };
const GROUP_DAYS_AGO = { an1: 162 };
// An instalment of a contract that nobody invoiced (the queue shows it in red).
const SKIP = new Set(['contract:con_3:3']);
// Reminders sent, in days after the due day.
const REMINDERS = {
  'contract:con_14:2': [14, 46], 'contract:con_14:3': [14], 'contract:con_2:4': [16], 'contract:con_11:2': [19],
};

const pad = (n) => String(n).padStart(4, '0');

export function buildBilling(T, { customers, sites, contacts, contracts, projects, jobs, quotations, items }) {
  const D = (n) => addDays(T, n);
  let seq = 0;
  const nid = (p) => `${p}_b${++seq}`;
  const byCode = Object.fromEntries(Object.values(items).map((i) => [i.code, i]));
  const payerOf = (siteId) => sites[siteId].billToId || sites[siteId].customerId;
  const contactsOf = (cid) => Object.values(contacts).filter((c) => c.customerId === cid);
  const accountsContact = (cid) => (contactsOf(cid).find((c) => c.role === 'accounts') ?? contactsOf(cid).find((c) => c.primary) ?? contactsOf(cid)[0])?.id ?? '';
  const vatRate = DEFAULT_SETTINGS.vatRate;

  // -- what is invoiced ----------------------------------------------------------------------------------
  const specs = [];
  const add = (o) => specs.push({ discountPct: 0, reference: '', notes: '', sendAfter: 1, attached: [], link: () => {}, ...o });

  for (const c of Object.values(contracts)) {
    if (['draft', 'awaiting_approval'].includes(c.status)) continue;
    for (const row of c.billingPlan) {
      const key = `contract:${c.id}:${row.n}`;
      if (row.dueOn > T || SKIP.has(key)) {
        row.invoiceId = '';
        row.invoiceRef = '';
        continue;
      }
      add({
        key, source: { kind: 'contract', contractId: c.id, rowId: row.id }, customerId: payerOf(c.siteId), siteId: c.siteId,
        issuedOn: row.dueOn, supplyOn: row.dueOn, title: `Maintenance contract ${c.number}, instalment ${row.n} of ${c.billingPlan.length}`,
        lines: contractInvoiceLines(c, row, nid), locked: true,
        sendAfter: key === 'contract:con_5:3' ? null : 1, // Palm Grove's newest invoice was not sent yet
        link: (id, number) => { row.invoiceId = id; row.invoiceRef = number; },
      });
    }
    for (const row of c.billingPlan) if (row.invoiceId === undefined) row.invoiceId = '';
  }

  for (const p of Object.values(projects)) {
    for (const c of p.claims) {
      if (!['invoiced', 'paid'].includes(c.status)) {
        c.invoiceId = '';
        continue;
      }
      const previous = progressClaims(p).filter((x) => x.status !== 'draft' && x.n < c.n).at(-1);
      add({
        key: `claim:${p.id}:${c.n}`, source: { kind: 'claim', projectId: p.id, claimId: c.id }, customerId: p.customerId, siteId: p.siteId,
        issuedOn: c.certifiedOn, supplyOn: c.periodEnd || c.certifiedOn,
        title: claimTitle(p, c),
        reference: p.lpo, lines: claimInvoiceLines(p, c, previous ? netOf(previous) : 0, nid), locked: true, paidOn: c.paidOn || '',
        link: (id, number) => { c.invoiceId = id; c.invoiceRef = number; },
      });
    }
    for (const c of p.claims) if (c.invoiceId === undefined) c.invoiceId = '';
  }

  for (const id of ['jb_22', 'jb_21']) {
    const j = jobs[id];
    add({
      key: `job:${id}`, source: { kind: 'job', jobId: id }, customerId: payerOf(j.siteId), siteId: j.siteId,
      issuedOn: j.report.sentOn, supplyOn: j.completedOn, title: `${j.number}: ${j.title}`, lines: jobInvoiceLines(j, byCode, nid, items),
      attached: [j.report.number], link: (invId) => { j.invoiceId = invId; },
    });
  }
  for (const j of Object.values(jobs)) if (j.invoiceId === undefined) j.invoiceId = '';

  const followUps = {};
  const quote = quotations.qt_125;
  add({
    key: 'supply:qt_125', source: { kind: 'supply', quotationId: quote.id }, customerId: quote.customerId, siteId: quote.siteId,
    issuedOn: addDays(quote.answer.on, 3), supplyOn: addDays(quote.answer.on, 3), title: `${quote.number}: ${quote.title}`,
    discountPct: quote.discountPct || 0, lines: quotationInvoiceLines(quote, nid),
    link: (id, number) => { followUps[quote.id] = { type: 'invoice', id, number }; },
  });

  // -- numbers by date, year by year -------------------------------------------------------------------------
  const ordered = specs.map((sp, i) => ({ sp, i })).toSorted((a, b) => a.sp.issuedOn.localeCompare(b.sp.issuedOn) || a.i - b.i).map((x) => x.sp);
  const perYear = {};
  const invoices = {};
  const events = [];
  const ev = (entity, id, by, date, text) => events.push({ entity, entityId: id, by, daysAgo: Math.round((new Date(T) - new Date(date)) / 86_400_000), text });
  ordered.forEach((sp, index) => {
    const year = sp.issuedOn.slice(0, 4);
    perYear[year] = (perYear[year] ?? 0) + 1;
    const id = `inv_${index + 1}`;
    const number = `INV-${year}-${pad(perYear[year])}`;
    const customer = customers[sp.customerId];
    const contactId = accountsContact(sp.customerId);
    const inv = {
      id, number, status: 'issued', customerId: sp.customerId, siteId: sp.siteId, contactId, source: sp.source, issuedOn: sp.issuedOn,
      supplyOn: sp.supplyOn, terms: customer.terms, dueOn: dueFor(sp.issuedOn, termsDays(customer.terms)), reference: sp.reference,
      title: sp.title, lines: sp.lines, discountPct: sp.discountPct, vatRate, notes: sp.notes, locked: Boolean(sp.locked),
      createdBy: 'staff_priya', createdOn: sp.issuedOn,
      sent: sp.sendAfter === null ? null : { on: addDays(sp.issuedOn, sp.sendAfter), to: contactId ? [contactId] : [], message: '', attached: sp.attached },
      reminders: (REMINDERS[sp.key] ?? []).map((days, k) => ({ on: addDays(dueFor(sp.issuedOn, termsDays(customer.terms)), days), level: k + 1, to: contactId ? [contactId] : [] })),
    };
    invoices[id] = inv;
    sp.invoice = inv;
    sp.link(id, number);
    ev('invoice', id, 'staff_priya', sp.issuedOn, `Invoice issued (${{ contract: 'from the contract', claim: 'from the project claim', job: 'from the job', supply: 'from the delivery' }[sp.source.kind]})`);
    if (inv.sent) ev('invoice', id, 'staff_priya', inv.sent.on, 'Sent to the customer');
    for (const r of inv.reminders) ev('invoice', id, 'staff_priya', r.on, `Reminder ${r.level} sent`);
  });

  // -- receipts: the money that came, by the habit of each customer ---------------------------------------------
  const receiptsByKey = new Map();
  for (const sp of ordered) {
    const inv = sp.invoice;
    const total = documentTotals(inv).total;
    let plan = null;
    if (sp.paidOn !== undefined) plan = sp.paidOn ? { on: sp.paidOn, amount: total } : null;
    else if (UNPAID.has(sp.key)) plan = null;
    else if (PARTIAL[sp.key]) plan = { on: D(-PARTIAL[sp.key].daysAgo), amount: PARTIAL[sp.key].amount };
    else {
      const on = GROUP[sp.key] ? D(-GROUP_DAYS_AGO[GROUP[sp.key]]) : addDays(inv.issuedOn, HABIT[inv.customerId] ?? 30);
      plan = on < T ? { on, amount: total } : null;
    }
    if (!plan) continue;
    const gkey = `${inv.customerId}|${plan.on}|${GROUP[sp.key] ?? sp.key}`;
    if (!receiptsByKey.has(gkey)) {
      receiptsByKey.set(gkey, { customerId: inv.customerId, on: plan.on, amount: 0, allocations: [], method: METHOD[inv.customerId] ?? 'bank_transfer', first: inv });
    }
    const r = receiptsByKey.get(gkey);
    r.amount = round2(r.amount + plan.amount);
    r.allocations.push({ invoiceId: inv.id, amount: plan.amount });
  }
  const receipts = {};
  const receiptYear = {};
  [...receiptsByKey.values()]
    .toSorted((a, b) => a.on.localeCompare(b.on) || a.first.number.localeCompare(b.first.number))
    .forEach((r, index) => {
      const year = r.on.slice(0, 4);
      receiptYear[year] = (receiptYear[year] ?? 0) + 1;
      const id = `rc_${index + 1}`;
      const stamp = r.on.replaceAll('-', '');
      receipts[id] = {
        id, number: `RCT-${year}-${pad(receiptYear[year])}`, customerId: r.customerId, on: r.on, amount: r.amount, method: r.method,
        reference: r.method === 'cash' ? '' : r.method === 'cheque' ? `CHQ ${100000 + index * 37}` : r.method === 'card' ? `POS ${stamp.slice(2)}${index + 11}` : `TRF${stamp}${index + 11}`,
        byId: 'staff_priya', note: '', allocations: r.allocations,
      };
      ev('payment', id, 'staff_priya', r.on, `Payment received: AED ${r.amount.toLocaleString('en-US')}`);
      for (const a of r.allocations) ev('invoice', a.invoiceId, 'staff_priya', r.on, `Payment received: ${receipts[id].number}, AED ${a.amount.toLocaleString('en-US')}`);
    });

  // -- credit notes ------------------------------------------------------------------------------------------------
  const limits = DEFAULT_SETTINGS.approvals;
  const creditNotes = {};
  const byKey = Object.fromEntries(ordered.map((sp) => [sp.key, sp.invoice]));
  const cn = (o) => {
    const inv = byKey[o.invoiceKey];
    const cnObj = {
      id: o.id, number: o.number, invoiceId: inv.id, customerId: inv.customerId, siteId: inv.siteId, status: o.status, reason: o.reason, note: o.note,
      lines: o.lines.map((l) => ({ id: nid('il'), itemId: '', unit: 'lot', ...l })), discountPct: 0, vatRate, createdBy: 'staff_priya', createdOn: o.createdOn,
      issuedOn: o.issuedOn ?? '', approval: emptyCreditApproval(), applied: o.applied ?? [],
    };
    const total = documentTotals(cnObj).total;
    const level = creditLevel(documentTotals(cnObj).net, limits);
    if (level > 0) {
      const role = level === 2 ? 'owner' : 'manager';
      cnObj.approval = { ...emptyCreditApproval(), required: role, reasons: [`Value is above AED ${(level === 2 ? limits.cnManagerLimit : limits.cnLimit).toLocaleString('en-US')}`], requestedBy: 'staff_priya', requestedOn: o.createdOn };
      if (o.status === 'issued') cnObj.approval = { ...cnObj.approval, decision: 'approved', decidedBy: level === 2 ? 'staff_layla' : 'staff_omar', decidedOn: o.issuedOn };
    }
    creditNotes[o.id] = cnObj;
    ev('creditNote', o.id, 'staff_priya', o.createdOn, 'Credit note made');
    if (o.status === 'waiting_approval') ev('creditNote', o.id, 'staff_priya', o.createdOn, 'Sent for approval to the operations manager');
    if (o.status === 'issued') ev('creditNote', o.id, cnObj.approval.decidedBy || 'staff_priya', o.issuedOn, cnObj.approval.decision ? 'Approved and issued' : 'Issued');
    ev('invoice', inv.id, 'staff_priya', o.createdOn, `Credit note made: AED ${total.toLocaleString('en-US')}`);
    return cnObj;
  };
  // The pump service was taken out of Marina Crest's contract after the invoice was paid: the credit is on account and is taken off the next invoice.
  const marinaNext = byKey['contract:con_1:3'];
  cn({
    id: 'cn_1', number: 'CN-2026-0001', invoiceKey: 'contract:con_1:2', status: 'issued', reason: 'Scope of the contract changed',
    note: 'The building took the pump room over from July: the yearly pump service was removed from the contract.',
    lines: [{ description: 'Fire pump service and run tests, removed from the contract from July', qty: 1, price: 1200 }],
    createdOn: D(-56), issuedOn: D(-55), applied: [{ invoiceId: marinaNext.id, amount: 1260, on: D(-22) }],
  });
  ev('invoice', marinaNext.id, 'staff_priya', D(-22), 'Credit of CN-2026-0001 taken off this invoice: AED 1,260');
  // A credit for two devices that were never installed waits for the manager.
  cn({
    id: 'cn_2', number: '', invoiceKey: 'contract:con_8:4', status: 'waiting_approval', reason: 'Wrong quantity or price',
    note: 'Two heat detectors of the schedule are not installed at the site: their yearly test was billed by mistake.',
    lines: [{ description: 'Yearly test of two heat detectors that are not installed', qty: 2, unit: 'nos', price: 1200 }],
    createdOn: D(-1),
  });

  // -- the sale of stock items leaves the store on the day of the invoice -----------------------------------------
  const saleIssues = ordered
    .filter((sp) => sp.source.kind === 'supply')
    .map((sp) => ({
      on: sp.invoice.issuedOn, invoiceId: sp.invoice.id, number: sp.invoice.number,
      lines: sp.invoice.lines.filter((l) => items[l.itemId]?.stocked).map((l) => ({ itemId: l.itemId, qty: l.qty })),
    }))
    .filter((x) => x.lines.length > 0);

  return {
    invoices, payments: receipts, creditNotes, events, followUps, saleIssues,
    counters: {
      invoice: perYear[T.slice(0, 4)] ?? 0,
      receipt: receiptYear[T.slice(0, 4)] ?? 0,
      creditNote: Object.values(creditNotes).filter((c) => c.number.startsWith(`CN-${T.slice(0, 4)}`)).length,
    },
  };
}
