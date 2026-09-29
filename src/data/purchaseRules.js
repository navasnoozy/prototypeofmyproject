import { addDays } from '../lib/dates.js';
import { round2 } from '../lib/format.js';

// Pure rules of Purchases and Inventory. They use only relative imports, so the
// seed and the screens share the very same functions and the money and the
// stock can be checked without the application.

const sum = (rows, fn) => rows.reduce((n, x) => n + fn(x), 0);

/** Quantities such as metres have decimals; three places keep the sums exact. */
export const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

// ---- an order and its lines -------------------------------------------------------------------
// A line: { id, itemId ('' for a line typed by hand), description, unit, qty, cost, packageId }.
// Money is AED before VAT; the order keeps the VAT rate it was made with.
export const lineNet = (l) => round2(l.qty * l.cost);
export const orderNet = (po) => round2(sum(po.lines, lineNet));

export function orderTotals(po) {
  const net = orderNet(po);
  const vat = round2((net * (po.vatRate ?? 0)) / 100);
  return { net, vat, total: round2(net + vat) };
}

/** What the order is called in lists: its own title, or its first line. */
export function orderTitle(po) {
  if (po.title) return po.title;
  const first = po.lines[0]?.description ?? 'Purchase order';
  return po.lines.length > 1 ? `${first} and ${po.lines.length - 1} more` : first;
}

// ---- deliveries and bills ------------------------------------------------------------------------
/** The quantity received for each line: { lineId: qty }, from the receipts of one order. */
export function receivedByLine(receipts) {
  const out = {};
  for (const r of receipts) for (const l of r.lines) out[l.lineId] = round3((out[l.lineId] ?? 0) + l.qty);
  return out;
}

/** The quantity and the value billed for each line: { lineId: { qty, net } }, from the bills of one order. */
export function billedByLine(bills) {
  const out = {};
  for (const b of bills) {
    for (const l of b.lines) {
      const row = (out[l.lineId] ??= { qty: 0, net: 0 });
      row.qty = round3(row.qty + l.qty);
      row.net = round2(row.net + l.qty * l.cost);
    }
  }
  return out;
}

/**
 * Where an order stands, line by line and as a whole. An order that was closed
 * short expects only what has come. The three-way check of the study is here:
 * ordered against received against billed.
 */
export function orderProgress(po, receipts, bills) {
  const got = receivedByLine(receipts);
  const billed = billedByLine(bills);
  const rows = po.lines.map((line) => {
    const received = got[line.id] ?? 0;
    const b = billed[line.id] ?? { qty: 0, net: 0 };
    const expected = po.closedShort ? Math.min(line.qty, received) : line.qty;
    return {
      line,
      ordered: line.qty,
      expected,
      received,
      outstanding: Math.max(0, round3(expected - received)),
      billedQty: b.qty,
      billedNet: b.net,
      toBillQty: Math.max(0, round3(received - b.qty)),
    };
  });
  return {
    rows,
    someReceived: rows.some((r) => r.received > 0),
    allReceived: rows.every((r) => r.outstanding === 0),
    allBilled: rows.every((r) => round3(r.expected - r.billedQty) <= 0),
    receivedNet: round2(sum(rows, (r) => r.received * r.line.cost)),
    billedNet: round2(sum(rows, (r) => r.billedNet)),
    toBillNet: round2(sum(rows, (r) => r.toBillQty * r.line.cost)),
    outstandingNet: round2(sum(rows, (r) => r.outstanding * r.line.cost)),
  };
}

/** The state shown to people: the stored state until the order is sent, then what the deliveries and bills say. */
export function orderStatus(po, receipts, bills) {
  if (po.status !== 'sent') return po.status;
  const p = orderProgress(po, receipts, bills);
  if (!p.someReceived) return 'sent';
  if (!p.allReceived) return 'partly_received';
  return p.allBilled && bills.every((b) => b.paidOn) ? 'closed' : 'received';
}

/** Sent, not all here, and the day promised is past. */
export const orderLate = (po, progress, today) =>
  po.status === 'sent' && !progress.allReceived && Boolean(po.expectedOn) && po.expectedOn < today;

export const isOpenOrder = (status) => ['draft', 'waiting_approval', 'approved', 'sent', 'partly_received', 'received'].includes(status);

// ---- supplier bills ---------------------------------------------------------------------------------
export const billNet = (b) => round2(sum(b.lines, (l) => l.qty * l.cost));

export function billTotals(b, po) {
  const net = billNet(b);
  const vat = round2((net * (po.vatRate ?? 0)) / 100);
  return { net, vat, total: round2(net + vat) };
}

export const billState = (b, today) => (b.paidOn ? 'paid' : b.dueOn < today ? 'overdue' : 'due');

/**
 * The problems of a bill that is being entered, against what the order says
 * and what has been received. `draft` is [{ lineId, qty, cost }].
 */
export function billIssues(po, receipts, bills, draft) {
  const progress = orderProgress(po, receipts, bills);
  const issues = [];
  for (const d of draft) {
    if (!(d.qty > 0)) continue;
    const row = progress.rows.find((r) => r.line.id === d.lineId);
    if (!row) continue;
    if (round3(row.billedQty + d.qty) > row.received) {
      issues.push({ lineId: d.lineId, kind: 'qty', text: `${round3(row.billedQty + d.qty)} billed but only ${row.received} received` });
    }
    const diff = round2((d.cost - row.line.cost) * d.qty);
    if (Math.abs(d.cost - row.line.cost) > 0.004) {
      issues.push({ lineId: d.lineId, kind: 'price', diff, text: `Price differs from the order (${diff > 0 ? '+' : '−'}AED ${Math.abs(diff).toFixed(2)})` });
    }
  }
  return issues;
}

// ---- what an order costs a project ---------------------------------------------------------------------
// An approved or sent order for a project is money the project has to pay: the
// part that a supplier bill covers is "incurred", the rest is "committed".
// Goods received without a bill are still committed.
export function costRowsOfOrder(po, receipts, bills, label) {
  if (po.purpose !== 'project' || !['approved', 'sent'].includes(po.status)) return [];
  const progress = orderProgress(po, receipts, bills);
  const byPackage = {};
  for (const r of progress.rows) {
    const row = (byPackage[r.line.packageId] ??= { incurred: 0, committed: 0 });
    row.incurred = round2(row.incurred + r.billedNet);
    row.committed = round2(row.committed + Math.max(0, round3(r.expected - r.billedQty)) * r.line.cost);
  }
  const billedOn = bills.map((b) => b.on).sort().at(-1) ?? po.createdOn;
  const orderedOn = po.sent?.on ?? po.createdOn;
  const rows = [];
  for (const [packageId, v] of Object.entries(byPackage)) {
    if (v.incurred > 0) rows.push({ id: `${po.id}:${packageId}:incurred`, packageId, kind: 'material', description: label, ref: po.number, amount: v.incurred, state: 'incurred', on: billedOn, derived: true, poId: po.id });
    if (v.committed > 0) rows.push({ id: `${po.id}:${packageId}:committed`, packageId, kind: 'material', description: label, ref: po.number, amount: v.committed, state: 'committed', on: orderedOn, derived: true, poId: po.id });
  }
  return rows;
}

/** Stock issued to a project is a cost at the cost of the item on the day. */
export function costRowsOfIssues(movements, projectId, nameOf) {
  return movements
    .filter((m) => ['issue_project', 'return_project'].includes(m.kind) && m.ref?.id === projectId)
    .map((m) => ({
      id: `${m.id}:stock`, packageId: m.ref.packageId ?? '', kind: 'material',
      description: `${nameOf(m.itemId)}: ${Math.abs(m.qty)} from stock${m.qty > 0 ? ' (returned)' : ''}`,
      ref: '', amount: round2(-m.qty * m.unitCost), state: 'incurred', on: m.on, derived: true, movementId: m.id,
    }));
}

// ---- stock ------------------------------------------------------------------------------------------------------
/** { itemId: { locationId: quantity } } from the movements. */
export function balancesOf(movements) {
  const map = {};
  for (const m of movements) {
    const row = (map[m.itemId] ??= {});
    row[m.locationId] = round3((row[m.locationId] ?? 0) + m.qty);
  }
  return map;
}

/** The cost of an item after goods arrive: the old stock and the new goods, at their own costs. */
export function weightedAverage(oldQty, oldCost, addQty, addCost) {
  const keep = Math.max(oldQty, 0);
  const total = keep + addQty;
  return total > 0 ? round2((keep * oldCost + addQty * addCost) / total) : addCost;
}

/** ok, ordered (an order will bring it above the minimum), low, or out. */
export function stockState(item, inStore, onOrder) {
  if (!item.stocked || !(item.minStore > 0) || inStore >= item.minStore) return 'ok';
  if (inStore + onOrder >= item.minStore) return 'ordered';
  return inStore <= 0 ? 'out' : 'low';
}

/** How many to order: enough to reach the minimum, in steps of the usual order quantity. */
export function reorderQty(item, inStore, onOrder) {
  const short = item.minStore - inStore - onOrder;
  if (short <= 0) return 0;
  const step = item.reorderQty > 0 ? item.reorderQty : short;
  return Math.ceil(short / step) * step;
}

/** How many a van needs to be back at its par level. */
export const vanShortfall = (item, inVan) => Math.max(0, round3((item.vanPar ?? 0) - Math.max(0, inVan)));

/** The stock lines of a delivery: only orders for stock, only items that are kept in stock. */
export function stockLinesOfReceipt(po, receipt, items) {
  if (po.purpose !== 'stock') return [];
  const out = [];
  for (const rl of receipt.lines) {
    const line = po.lines.find((l) => l.id === rl.lineId);
    if (line?.itemId && items[line.itemId]?.stocked && rl.qty > 0) out.push({ itemId: line.itemId, qty: rl.qty, unitCost: line.cost });
  }
  return out;
}

// ---- approval of an order --------------------------------------------------------------------------------------
/** Level 0 nobody, 1 operations manager, 2 owner, from the value of the order alone. */
export function valueLevel(net, limits) {
  if (net > limits.poManagerLimit) return 2;
  if (net > limits.poLimit) return 1;
  return 0;
}

// ---- suppliers ----------------------------------------------------------------------------------------------------
/** The day a bill is due: the bill date plus the payment terms of the supplier, in days. */
export const dueDate = (billOn, terms) => addDays(billOn, Number(terms) || 0);
