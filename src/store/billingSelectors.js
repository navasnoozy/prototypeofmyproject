import { APPROVER_LABEL } from '@/data/roles.js';
import { INVOICE_SOURCE, PAYMENT_METHODS } from '@/data/billingKinds.js';
import {
  ageBucket, balanceOf, claimTitle, creditLevel, daysOverdue, documentTotals, invoiceState, jobInvoiceLines, settlements, unallocatedOf, unappliedOf,
} from '@/data/billingRules.js';
import { addDays, diffDays, fmtDate, todayISO } from '@/lib/dates.js';
import { money, num, plural, round2 } from '@/lib/format.js';
import { authorityOf } from './salesSelectors.js';
import { customerContacts, list } from './selectors.js';

// Pure functions of the Billing area. Nothing here changes anything.

export const payerOf = (s, siteId) => s.sites[siteId]?.billToId || s.sites[siteId]?.customerId || '';

/** The people of a customer who can be written to, the accounts person first, then the main contact. */
export const recipientsOf = (s, customerId) =>
  customerContacts(s, customerId)
    .filter((p) => p.email)
    .toSorted((a, b) => Number(b.role === 'accounts') - Number(a.role === 'accounts') || Number(b.primary) - Number(a.primary));

// ---- what has been settled (cached per version of the two tables) ---------------------------------------
const settledCache = new WeakMap();
/** { invoiceId: { paid, credited } }. */
export function settledMap(s) {
  let inner = settledCache.get(s.payments);
  if (!inner) settledCache.set(s.payments, (inner = new WeakMap()));
  if (!inner.has(s.creditNotes)) inner.set(s.creditNotes, settlements(list(s.payments), list(s.creditNotes)));
  return inner.get(s.creditNotes);
}

export const invoiceLabel = (inv) => inv.number || 'Draft invoice';
export const creditLabel = (cn) => cn.number || 'Draft credit note';

// ---- one invoice as the screens see it ----------------------------------------------------------------------
export function invoiceView(s, inv, today = todayISO()) {
  const settled = settledMap(s)[inv.id] ?? { paid: 0, credited: 0 };
  return {
    inv, totals: documentTotals(inv), settled, balance: balanceOf(inv, settled), state: invoiceState(inv, settled, today),
    overdueDays: inv.status === 'issued' ? daysOverdue(inv, today) : 0, customer: s.customers[inv.customerId], site: s.sites[inv.siteId],
  };
}
export const invoiceViews = (s, today = todayISO()) => list(s.invoices).map((inv) => invoiceView(s, inv, today));

/** An invoice that still has something to pay. */
export const isOwed = (v) => v.inv.status === 'issued' && v.balance > 0.004;

/** The receipts and the credit notes that settled an invoice, newest first. */
export function settlementsOf(s, invoiceId) {
  const payments = list(s.payments)
    .flatMap((p) => p.allocations.filter((a) => a.invoiceId === invoiceId).map((a) => ({ kind: 'payment', doc: p, amount: a.amount, on: p.on })));
  const credits = list(s.creditNotes)
    .filter((c) => c.status === 'issued')
    .flatMap((c) => (c.applied ?? []).filter((a) => a.invoiceId === invoiceId).map((a) => ({ kind: 'credit', doc: c, amount: a.amount, on: a.on ?? c.issuedOn })));
  return [...payments, ...credits].toSorted((a, b) => b.on.localeCompare(a.on));
}

export const creditNotesOf = (s, invoiceId) => list(s.creditNotes).filter((c) => c.invoiceId === invoiceId);

/** Where an invoice comes from, as a sentence and a link (the link only for those who may open that area). */
export function sourceOf(s, inv) {
  const src = inv.source;
  if (src.kind === 'contract') {
    const c = s.contracts[src.contractId];
    return { label: c ? `Contract ${c.number}` : 'Maintenance contract', to: c ? `/service/${c.id}?tab=billing` : '', area: 'service' };
  }
  if (src.kind === 'claim') {
    const p = s.projects[src.projectId];
    return { label: p ? `Project ${p.number}` : 'Project claim', to: p ? `/projects/${p.id}?tab=claims` : '', area: 'projects' };
  }
  if (src.kind === 'job') {
    const j = s.jobs[src.jobId];
    return { label: j ? `Job ${j.number}` : 'Job', to: j ? `/service/jobs/${j.id}` : '', area: 'service' };
  }
  if (src.kind === 'supply') {
    const q = s.quotations[src.quotationId];
    return { label: q ? `Quotation ${q.number}` : 'Supply of goods', to: q ? `/sales/quotations/${q.id}` : '', area: 'sales' };
  }
  return { label: INVOICE_SOURCE.manual, to: '', area: '' };
}

// ---- a customer's account ------------------------------------------------------------------------------------------
/** Receipts with money that no invoice has taken yet, and credit notes with credit that no invoice has taken. */
export function onAccountOf(s, customerId) {
  const receipts = list(s.payments).filter((p) => p.customerId === customerId).map((p) => ({ kind: 'payment', doc: p, amount: unallocatedOf(p) })).filter((x) => x.amount > 0.004);
  const credits = list(s.creditNotes)
    .filter((c) => c.customerId === customerId && c.status === 'issued')
    .map((c) => ({ kind: 'credit', doc: c, amount: unappliedOf(c, documentTotals(c).total) }))
    .filter((x) => x.amount > 0.004);
  return { items: [...receipts, ...credits], total: round2([...receipts, ...credits].reduce((n, x) => n + x.amount, 0)) };
}

/** What one customer owes, how old it is, and how it stands against the credit limit. */
export function accountOf(s, customerId, today = todayISO()) {
  const customer = s.customers[customerId];
  const open = invoiceViews(s, today).filter((v) => v.inv.customerId === customerId && isOwed(v));
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };
  for (const v of open) buckets[ageBucket(v.inv, today)] = round2(buckets[ageBucket(v.inv, today)] + v.balance);
  const balance = round2(open.reduce((n, v) => n + v.balance, 0));
  const overdue = round2(balance - buckets.current);
  const oldest = open.reduce((m, v) => Math.max(m, v.overdueDays), 0);
  const lastPayment = list(s.payments).filter((p) => p.customerId === customerId).toSorted((a, b) => b.on.localeCompare(a.on))[0] ?? null;
  const limit = customer?.creditLimit ?? 0;
  return {
    customer, open, buckets, balance, overdue, oldest, lastPayment, limit, onAccount: onAccountOf(s, customerId).total,
    over: limit > 0 && balance > limit, used: limit > 0 ? (balance / limit) * 100 : 0,
  };
}

/** The customers that owe something or have credit on account, for the ageing list. */
export function receivables(s, today = todayISO()) {
  const ids = new Set();
  for (const v of invoiceViews(s, today)) if (isOwed(v)) ids.add(v.inv.customerId);
  for (const p of list(s.payments)) if (unallocatedOf(p) > 0.004) ids.add(p.customerId);
  return [...ids].map((id) => accountOf(s, id, today)).filter((a) => a.customer);
}

// ---- what is ready to be invoiced ---------------------------------------------------------------------------------
/**
 * The work that has been done and not invoiced yet, from the four sources: a
 * contract instalment that is due (or nearly), a certified project claim, a
 * chargeable job whose report has gone, and an accepted supply. A source that
 * already has a draft shows the draft.
 */
export function toInvoice(s, today = todayISO()) {
  const items = [];
  const draftOf = (id) => (id && s.invoices[id]?.status === 'draft' ? id : '');
  const doneOf = (id) => Boolean(id && s.invoices[id]?.status === 'issued');
  for (const c of list(s.contracts)) {
    if (c.status !== 'active') continue;
    for (const row of c.billingPlan) {
      if (doneOf(row.invoiceId) || row.dueOn > addDays(today, 14)) continue;
      items.push({
        key: `contract:${c.id}:${row.id}`, kind: 'contract', source: { kind: 'contract', contractId: c.id, rowId: row.id }, title: `${c.number}: instalment ${row.n} of ${c.billingPlan.length}`,
        sub: `${s.sites[c.siteId]?.name ?? ''} · billed in advance`, customerId: payerOf(s, c.siteId), siteId: c.siteId, amount: row.amount,
        late: diffDays(row.dueOn, today), dueOn: row.dueOn, draftId: draftOf(row.invoiceId),
      });
    }
  }
  for (const p of list(s.projects)) {
    for (const c of p.claims) {
      if (c.status !== 'certified' || doneOf(c.invoiceId)) continue;
      items.push({
        key: `claim:${p.id}:${c.id}`, kind: 'claim', source: { kind: 'claim', projectId: p.id, claimId: c.id },
        title: claimTitle(p, c),
        sub: `Certified ${fmtDate(c.certifiedOn)} · ${s.sites[p.siteId]?.name ?? ''}`, customerId: p.customerId, siteId: p.siteId, amount: c.certAmount ?? c.amount,
        late: diffDays(c.certifiedOn, today), dueOn: c.certifiedOn, draftId: draftOf(c.invoiceId),
      });
    }
  }
  const byCode = Object.fromEntries(list(s.items).map((i) => [i.code, i]));
  for (const j of list(s.jobs)) {
    const chargeable = j.kind === 'repair' || (j.kind === 'call_out' && !j.contractId);
    if (!chargeable || !['completed', 'report_sent'].includes(j.status) || !j.report || doneOf(j.invoiceId)) continue;
    const quoted = j.kind === 'repair' && s.quotations[j.quotationId];
    const net = quoted
      ? documentTotals({ lines: quoted.lines, discountPct: quoted.discountPct || 0, vatRate: 0 }).net
      : documentTotals({ lines: jobInvoiceLines(j, byCode, () => 'x', s.items), discountPct: 0, vatRate: 0 }).net;
    items.push({
      key: `job:${j.id}`, kind: 'job', source: { kind: 'job', jobId: j.id }, title: `${j.number}: ${j.title}`,
      sub: `${j.kind === 'repair' ? 'Repair, as quoted' : 'Call-out, not under a contract'} · report ${j.report.number}`, customerId: payerOf(s, j.siteId), siteId: j.siteId,
      amount: net, late: diffDays(j.completedOn, today), dueOn: j.completedOn, draftId: draftOf(j.invoiceId),
    });
  }
  for (const q of list(s.quotations)) {
    if (q.kind !== 'supply' || q.status !== 'accepted' || q.followUp?.type === 'invoice') continue;
    items.push({
      key: `supply:${q.id}`, kind: 'supply', source: { kind: 'supply', quotationId: q.id }, title: `${q.number}: ${q.title}`,
      sub: `Accepted ${fmtDate(q.answer?.on)} · delivered and invoiced together`, customerId: payerOf(s, q.siteId) || q.customerId, siteId: q.siteId,
      amount: documentTotals({ lines: q.lines, discountPct: q.discountPct || 0, vatRate: 0 }).net, late: diffDays(q.answer?.on ?? today, today), dueOn: q.answer?.on ?? today, draftId: '',
    });
  }
  return items.toSorted((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? ''));
}

// ---- life-cycle strips ------------------------------------------------------------------------------------------------
export function invoiceSteps(v) {
  const { inv, state } = v;
  const keys = ['draft', 'issued', 'sent', 'paid'];
  const openStep = inv.status === 'draft' ? 0 : ['paid', 'credited'].includes(state) ? 4 : !inv.sent ? 2 : 3;
  const label = {
    draft: 'Draft',
    issued: 'Issued',
    sent: 'Sent',
    paid: state === 'paid' ? 'Paid' : state === 'credited' ? 'Credited' : state === 'overdue' ? 'Overdue' : state === 'partly_paid' ? 'Partly paid' : 'Payment',
  };
  return keys.map((key, i) => ({
    key, label: label[key],
    state: i < openStep ? 'done' : i === openStep ? (key === 'paid' && state === 'overdue' ? 'bad' : 'current') : 'todo',
  }));
}

export function creditSteps(cn) {
  const usesApproval = Boolean(cn.approval.required);
  const keys = ['draft', ...(usesApproval ? ['approval'] : []), 'issued'];
  const openStep = cn.status === 'issued' ? keys.length : cn.status === 'waiting_approval' ? keys.indexOf('approval') : 0;
  const label = { draft: 'Draft', approval: cn.status === 'waiting_approval' ? 'Waiting approval' : 'Approval', issued: 'Issued' };
  return keys.map((key, i) => ({ key, label: label[key], state: i < openStep ? 'done' : i === openStep ? 'current' : 'todo' }));
}

// ---- approval of a credit note --------------------------------------------------------------------------------------------
const LEVEL = { manager: 1, owner: 2 };

/** Who must approve a credit note: by its net value; nobody above the maker's own authority. */
export function creditApprovalNeeds(cn, s) {
  const limits = s.settings.approvals;
  const net = documentTotals(cn).net;
  const level = creditLevel(net, limits);
  const needed = level > authorityOf(s, cn.createdBy);
  return {
    level, needed,
    role: needed ? (level === 2 ? 'owner' : 'manager') : null,
    roleLabel: needed ? APPROVER_LABEL[level] : null,
    reasons: level === 0 ? [] : [`Value is above AED ${num(level === 2 ? limits.cnManagerLimit : limits.cnLimit)}`],
  };
}

/** May this person decide the pending approval? Not the one who asked, unless the owner. */
export function canApproveCredit(cn, s, viewerId) {
  if (cn.status !== 'waiting_approval' || !cn.approval.required) return false;
  const authority = authorityOf(s, viewerId);
  return authority >= LEVEL[cn.approval.required] && (viewerId !== cn.approval.requestedBy || authority === 2);
}

// ---- attention ----------------------------------------------------------------------------------------------------------------
export function billingAttention(s, today, viewerId) {
  const items = [];
  const views = invoiceViews(s, today);
  const owed = views.filter(isOwed);

  for (const cn of list(s.creditNotes)) {
    if (canApproveCredit(cn, s, viewerId)) {
      const t = documentTotals(cn);
      items.push({
        id: `cnapprove_${cn.id}`, area: 'billing', action: 'approve_credit_notes', tone: 'orange',
        title: `A credit note waits for your approval`,
        text: `${s.customers[cn.customerId]?.name ?? ''} · AED ${money(t.total)} · ${cn.reason}`, to: `/billing/credit-notes/${cn.id}`,
      });
    }
  }
  const overdue = owed.filter((v) => v.state === 'overdue');
  if (overdue.length > 0) {
    items.push({
      id: 'invoices_overdue', area: 'billing', action: 'receive_payments', tone: 'red',
      title: `${plural(overdue.length, 'invoice')} overdue`,
      text: `AED ${money(overdue.reduce((n, v) => n + v.balance, 0))} to collect, the oldest by ${overdue.reduce((m, v) => Math.max(m, v.overdueDays), 0)} days.`,
      to: '/billing?seg=overdue',
    });
  }
  // A customer 60 days late is a candidate for a hold.
  for (const a of receivables(s, today)) {
    if (a.customer.status === 'active' && a.oldest > 60) {
      items.push({
        id: `hold_${a.customer.id}`, area: 'billing', action: 'receive_payments', tone: 'orange',
        title: `${a.customer.name} is ${a.oldest} days late with an invoice`,
        text: 'Call the finance manager before more work is sold, or put the customer on hold.', to: `/billing/statements/${a.customer.id}`,
      });
    }
    if (a.over) {
      items.push({
        id: `limit_${a.customer.id}`, area: 'billing', action: 'receive_payments', tone: 'orange',
        title: `${a.customer.name} is over its credit limit`, text: `Owes AED ${money(a.balance)} of AED ${money(a.limit)}.`, to: `/billing/statements/${a.customer.id}`,
      });
    }
  }
  const ready = toInvoice(s, today).filter((x) => !x.draftId);
  if (ready.length > 0) {
    const late = ready.filter((x) => x.kind === 'contract' && x.late > 0);
    items.push({
      id: 'to_invoice', area: 'billing', action: 'issue_invoices', tone: late.length > 0 ? 'orange' : 'blue',
      title: `${plural(ready.length, 'thing')} ready to invoice`,
      text: late.length > 0 ? `${late[0].title} was due ${plural(late[0].late, 'day')} ago and is not invoiced.` : `AED ${money(ready.reduce((n, x) => n + x.amount, 0))} before VAT.`,
      to: '/billing',
    });
  }
  const unsent = views.filter((v) => v.inv.status === 'issued' && !v.inv.sent && diffDays(v.inv.issuedOn, today) >= 2);
  if (unsent.length > 0) {
    items.push({
      id: 'invoices_unsent', area: 'billing', action: 'issue_invoices', tone: 'blue',
      title: unsent.length === 1 ? `${unsent[0].inv.number} was issued and not sent` : `${unsent.length} invoices were issued and not sent`,
      text: 'The customer cannot pay what it has not received.', to: '/billing?seg=unsent',
    });
  }
  return items;
}

/** Invoices, receipts and credit notes for the global search. */
export function billingSearchEntries(s) {
  const entries = [];
  for (const inv of list(s.invoices)) {
    entries.push({
      type: 'Invoices', id: inv.id, title: `${invoiceLabel(inv)} · ${inv.title}`, sub: `${s.customers[inv.customerId]?.name ?? ''} · AED ${money(documentTotals(inv).total)}`,
      path: `/billing/${inv.id}`, keywords: `${inv.reference} ${s.sites[inv.siteId]?.name ?? ''}`,
    });
  }
  for (const p of list(s.payments)) {
    entries.push({
      type: 'Receipts', id: p.id, title: `${p.number} · ${s.customers[p.customerId]?.name ?? ''}`, sub: `AED ${money(p.amount)} · ${p.reference || PAYMENT_METHODS[p.method]}`,
      path: `/billing/receipts?open=${p.id}`, keywords: p.reference,
    });
  }
  for (const c of list(s.creditNotes)) {
    entries.push({
      type: 'Credit notes', id: c.id, title: `${creditLabel(c)} · ${c.reason}`, sub: `${s.customers[c.customerId]?.name ?? ''} · AED ${money(documentTotals(c).total)}`,
      path: `/billing/credit-notes/${c.id}`, keywords: '',
    });
  }
  return entries;
}
