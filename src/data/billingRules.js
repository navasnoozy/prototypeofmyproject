import { addDays, diffDays, fmtDate } from '../lib/dates.js';
import { round2 } from '../lib/format.js';
import { progressClaims } from './projectRules.js';

// Pure rules of Billing. They use only relative imports, so the seed and the
// screens share the very same functions and the money can be checked without the
// application.

const sum = (rows, fn) => rows.reduce((n, x) => n + fn(x), 0);
const EPS = 0.004;

// ---- totals -------------------------------------------------------------------------------------
// An invoice and a credit note have lines { id, itemId, description, qty, unit, price }
// (a price may be negative: a deduction), a discount in percent and the VAT rate
// they were made with. Totals are never stored.
export const lineAmount = (l) => round2(l.qty * l.price);

export function documentTotals(doc) {
  const subtotal = round2(sum(doc.lines, lineAmount));
  const discount = round2((subtotal * (doc.discountPct || 0)) / 100);
  const net = round2(subtotal - discount);
  const vat = round2((net * (doc.vatRate ?? 0)) / 100);
  return { subtotal, discount, net, vat, total: round2(net + vat) };
}

// ---- what has been received and credited ---------------------------------------------------------------
/**
 * { invoiceId: { paid, credited } } from the allocations of the receipts and the
 * applications of the issued credit notes.
 */
export function settlements(receipts, creditNotes) {
  const map = {};
  const row = (id) => (map[id] ??= { paid: 0, credited: 0 });
  for (const r of receipts) for (const a of r.allocations) row(a.invoiceId).paid = round2(row(a.invoiceId).paid + a.amount);
  for (const c of creditNotes) {
    if (c.status !== 'issued') continue;
    for (const a of c.applied ?? []) row(a.invoiceId).credited = round2(row(a.invoiceId).credited + a.amount);
  }
  return map;
}

export const balanceOf = (inv, settled) => round2(documentTotals(inv).total - (settled?.paid ?? 0) - (settled?.credited ?? 0));

/**
 * draft, paid, credited (nothing was paid, all was credited), overdue (something is
 * owed and the due day has passed), partly_paid, or due (nothing paid, not yet due).
 */
export function invoiceState(inv, settled, today) {
  if (inv.status === 'draft') return 'draft';
  const balance = balanceOf(inv, settled);
  if (balance <= EPS) return (settled?.paid ?? 0) > 0 ? 'paid' : 'credited';
  if (inv.dueOn < today) return 'overdue';
  return (settled?.paid ?? 0) + (settled?.credited ?? 0) > 0 ? 'partly_paid' : 'due';
}

// ---- ageing ----------------------------------------------------------------------------------------------------
/** The day an invoice is due: the day it is issued plus the days of the payment terms. */
export const dueFor = (issuedOn, days) => addDays(issuedOn, days);

export const daysOverdue = (inv, today) => Math.max(0, diffDays(inv.dueOn, today));

/** current (not overdue), d30, d60, d90 or d90p, counted in days past the due day. */
export function ageBucket(inv, today) {
  const d = diffDays(inv.dueOn, today);
  if (d <= 0) return 'current';
  if (d <= 30) return 'd30';
  if (d <= 60) return 'd60';
  if (d <= 90) return 'd90';
  return 'd90p';
}

// ---- the lines that each source gives an invoice --------------------------------------------------------------
const line = (newId, o) => ({ id: newId('il'), itemId: '', unit: 'lot', qty: 1, ...o });

/** The project counts only its progress claims ("Progress claim 2"), so an invoice uses the same number. */
export const progressNo = (p, c) => progressClaims(p).findIndex((x) => x.id === c.id) + 1;
/** "PRJ-2026-003: progress claim 2", "...: advance payment", "...: retention release". */
export const claimTitle = (p, c) =>
  `${p.number}: ${c.kind === 'advance' ? 'advance payment' : c.kind === 'retention' ? 'retention release' : `progress claim ${progressNo(p, c)}`}`;

/** One instalment of a maintenance contract: the fee of one billing period, billed in advance. */
export function contractInvoiceLines(contract, row, newId) {
  const next = contract.billingPlan[row.n]?.dueOn;
  const to = next ? addDays(next, -1) : contract.endOn;
  return [line(newId, {
    description: `Maintenance contract ${contract.number}: instalment ${row.n} of ${contract.billingPlan.length}, ${fmtDate(row.dueOn)} to ${fmtDate(to)}`,
    price: row.amount,
  })];
}

/**
 * A claim of a project. An advance and a retention release are one line. A progress
 * claim is cumulative, so its invoice shows the working: the work done to date,
 * less the retention, less the advance paid back, less what the earlier claims
 * already invoiced. The figures are the certified ones once the customer's engineer
 * has certified.
 */
export function claimInvoiceLines(p, c, previousNet, newId) {
  if (c.kind === 'advance') {
    return [line(newId, { description: `Advance payment, ${p.advancePct}% of the contract value: ${p.number}, ${p.title}`, price: c.certAmount ?? c.amount })];
  }
  if (c.kind === 'retention') {
    return [line(newId, { description: `Release of the retention held: ${p.number}, ${p.title}`, price: c.certAmount ?? c.amount })];
  }
  const gross = c.certifiedGross ?? c.gross;
  const retention = c.certRetention ?? c.retention;
  const net = c.certNet ?? c.net;
  const advance = round2(gross - retention - net);
  const rows = [
    line(newId, { description: `Work done to date${c.certifiedGross ? ' (as certified)' : ''}: progress claim ${progressNo(p, c)}, ${p.number}, ${p.title}`, price: gross }),
    line(newId, { description: `Less retention held (${p.retentionPct}%)`, price: -retention }),
  ];
  if (advance > 0) rows.push(line(newId, { description: 'Less advance payment paid back with the work', price: -advance }));
  if (previousNet > 0) rows.push(line(newId, { description: 'Less earlier progress claims invoiced', price: -previousNet }));
  return rows;
}

/**
 * A call-out is charged with the call-out charge (day, or night and holidays),
 * which takes the first hour on site, then the technician's time beyond it, then
 * the parts at their selling price. `byCode` is the catalogue keyed by code.
 */
export function jobInvoiceLines(job, byCode, newId, itemsById) {
  const call = byCode[job.window === 'night' ? 'LB-CALLN' : 'LB-CALL'];
  const rows = [];
  if (call) rows.push(line(newId, { itemId: call.id, description: `${call.name}: ${job.title}`, unit: call.unit, price: call.price }));
  const hours = sum(job.labour, (r) => r.hours);
  const extra = Math.max(0, hours - 1);
  const tech = byCode['LB-TECH'];
  if (tech && extra > 0) rows.push(line(newId, { itemId: tech.id, description: `Technician time on site beyond the first hour (${hours} h in all)`, qty: extra, unit: tech.unit, price: tech.price }));
  for (const part of job.parts) {
    const it = itemsById[part.itemId];
    rows.push(line(newId, { itemId: part.itemId, description: part.description, qty: part.qty, unit: part.unit, price: it?.price ?? 0 }));
  }
  return rows;
}

/** A supply or a repair invoiced as it was quoted. */
export const quotationInvoiceLines = (q, newId) =>
  q.lines.map((l) => line(newId, { itemId: l.itemId, description: l.description, qty: l.qty, unit: l.unit, price: l.price }));

// ---- receipts ---------------------------------------------------------------------------------------------------
/** The money of a receipt that no invoice has taken yet. */
export const unallocatedOf = (receipt) => round2(receipt.amount - sum(receipt.allocations, (a) => a.amount));
/** The credit of a credit note that no invoice has taken yet. */
export const unappliedOf = (cn, total) => round2(total - sum(cn.applied ?? [], (a) => a.amount));

/**
 * Spreads an amount over open invoices, the oldest due first: `open` is
 * [{ invoiceId, balance, dueOn }]. Returns [{ invoiceId, amount }].
 */
export function allocateOldestFirst(open, amount) {
  let left = round2(amount);
  const out = [];
  for (const o of open.toSorted((a, b) => a.dueOn.localeCompare(b.dueOn))) {
    if (left <= EPS) break;
    const take = round2(Math.min(left, o.balance));
    if (take > EPS) out.push({ invoiceId: o.invoiceId, amount: take });
    left = round2(left - take);
  }
  return out;
}

// ---- statements -------------------------------------------------------------------------------------------------------
/**
 * The account of one customer between two days: what was owed before, every
 * invoice (debit), receipt and credit note (credit) with the running balance,
 * and what is owed at the end. A receipt counts in full on the day it came, so
 * a payment on account is already taken off.
 */
export function statementOf({ customerId, invoices, receipts, creditNotes, totalOf, from, to }) {
  const all = [];
  for (const inv of invoices) {
    if (inv.status !== 'issued' || inv.customerId !== customerId) continue;
    all.push({ date: inv.issuedOn, kind: 'invoice', order: 0, id: inv.id, number: inv.number, siteId: inv.siteId, debit: totalOf(inv), credit: 0, dueOn: inv.dueOn, text: inv.title });
  }
  for (const c of creditNotes) {
    if (c.status !== 'issued' || c.customerId !== customerId) continue;
    all.push({ date: c.issuedOn, kind: 'credit', order: 1, id: c.id, number: c.number, siteId: c.siteId, debit: 0, credit: totalOf(c), text: c.reason });
  }
  for (const r of receipts) {
    if (r.customerId !== customerId) continue;
    all.push({ date: r.on, kind: 'receipt', order: 2, id: r.id, number: r.number, siteId: '', debit: 0, credit: r.amount, text: `${r.reference || 'Payment'}` });
  }
  all.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.number.localeCompare(b.number));
  const opening = round2(sum(all.filter((r) => r.date < from), (r) => r.debit - r.credit));
  let running = opening;
  const rows = all
    .filter((r) => r.date >= from && r.date <= to)
    .map((r) => {
      running = round2(running + r.debit - r.credit);
      return { ...r, running };
    });
  return { opening, rows, closing: running };
}

// ---- credit notes ----------------------------------------------------------------------------------------------------
/** Level 0 nobody, 1 operations manager, 2 owner, from the value of a credit note. */
export function creditLevel(total, limits) {
  if (total > limits.cnManagerLimit) return 2;
  if (total > limits.cnLimit) return 1;
  return 0;
}
