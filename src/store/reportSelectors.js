import { INVOICE_SOURCE } from '@/data/billingKinds.js';
import { documentTotals } from '@/data/billingRules.js';
import { amountOf, claimedTotal, contractValue, forecast, paidTotal, percentComplete, retentionHeld } from '@/data/projectRules.js';
import { MOVEMENT_KINDS } from '@/data/purchaseKinds.js';
import { orderTotals } from '@/data/purchaseRules.js';
import { KINDS } from '@/data/quotationKinds.js';
import { chartMonths, groupRows, inRange, monthLabel, percent, periodRange, sumOf } from '@/data/reportRules.js';
import { JOB_KINDS, SEVERITY } from '@/data/serviceKinds.js';
import { diffDays } from '@/lib/dates.js';
import { round2 } from '@/lib/format.js';
import { invoiceViews, isOwed } from './billingSelectors.js';
import { lowStockRows, negativeBalances, stockRows, stockValue } from './inventorySelectors.js';
import { isActive, overBudget } from './projectSelectors.js';
import { billRows, orderViews, projectView } from './purchaseSelectors.js';
import { effectiveStatus, latestQuotations, quoteTotals } from './salesSelectors.js';
import { list, summariseDevices } from './selectors.js';
import { contractStatus, openDeficiencies } from './serviceSelectors.js';

// The figures of the five reports. Each function reads the tables and returns
// plain data: nothing is stored, so a report is always as new as the data.
// Money is AED before VAT unless a figure says otherwise.

const average = (numbers) => (numbers.length > 0 ? Math.round(numbers.reduce((n, x) => n + x, 0) / numbers.length) : null);

// ---- money -----------------------------------------------------------------------------------------------------
export function moneyReport(s, period, today) {
  const range = periodRange(period, today);
  const net = (inv) => documentTotals(inv).net;
  const issued = list(s.invoices).filter((i) => i.status === 'issued');
  const inPeriod = issued.filter((i) => inRange(i.issuedOn, range));
  const receipts = list(s.payments);
  const receivedIn = receipts.filter((p) => inRange(p.on, range));
  const views = invoiceViews(s, today);
  const owed = views.filter(isOwed);
  const overdue = owed.filter((v) => v.state === 'overdue');
  const bills = billRows(s, today).filter((r) => r.state !== 'paid');

  // Days from the invoice to its last receipt, for the invoices paid in full in this period.
  const lastPaid = {};
  for (const p of receipts) for (const a of p.allocations) if (!lastPaid[a.invoiceId] || p.on > lastPaid[a.invoiceId]) lastPaid[a.invoiceId] = p.on;
  const daysToPay = average(views.filter((v) => v.state === 'paid' && inRange(lastPaid[v.inv.id], range)).map((v) => diffDays(v.inv.issuedOn, lastPaid[v.inv.id])));

  const chart = chartMonths(today).map((m) => ({
    key: m, label: monthLabel(m),
    values: [sumOf(issued.filter((i) => i.issuedOn.startsWith(m)), net), sumOf(receipts.filter((p) => p.on.startsWith(m)), (p) => p.amount)],
  }));
  const bySource = Object.entries(groupRows(inPeriod, (i) => i.source.kind))
    .map(([kind, rows]) => ({ kind, label: INVOICE_SOURCE[kind] ?? kind, count: rows.length, net: sumOf(rows, net) }))
    .toSorted((a, b) => b.net - a.net);
  const invoicedTotal = sumOf(inPeriod, net);
  const byCustomer = Object.entries(groupRows(inPeriod, (i) => i.customerId))
    .map(([id, rows]) => ({ customer: s.customers[id], count: rows.length, net: sumOf(rows, net), owed: sumOf(owed.filter((v) => v.inv.customerId === id), (v) => v.balance) }))
    .toSorted((a, b) => b.net - a.net);

  return {
    range, chart, bySource, byCustomer, daysToPay,
    invoiced: invoicedTotal, invoiceCount: inPeriod.length,
    received: sumOf(receivedIn, (p) => p.amount), receiptCount: receivedIn.length,
    owed: sumOf(owed, (v) => v.balance), owedCount: owed.length,
    overdue: sumOf(overdue, (v) => v.balance), overdueCount: overdue.length,
    billsToPay: sumOf(bills, (r) => r.totals.total), billsCount: bills.length,
    billsOverdue: sumOf(bills.filter((r) => r.state === 'overdue'), (r) => r.totals.total),
    top: byCustomer.slice(0, 8).map((r) => ({ ...r, share: percent(r.net, invoicedTotal) })),
  };
}

// ---- sales -----------------------------------------------------------------------------------------------------
export function salesReport(s, period, today) {
  const range = periodRange(period, today);
  const qs = latestQuotations(s);
  const net = (q) => quoteTotals(q, s.settings.vatRate).net;
  const sentIn = qs.filter((q) => q.sent && inRange(q.sent.on, range));
  const wonIn = qs.filter((q) => q.status === 'accepted' && inRange(q.answer?.on, range));
  const lostIn = qs.filter((q) => q.status === 'rejected' && inRange(q.answer?.on, range));
  const waiting = qs.filter((q) => effectiveStatus(q, today) === 'sent');
  const enquiries = list(s.enquiries);
  const open = enquiries.filter((e) => !['won', 'lost'].includes(e.status));
  const toQuote = open.filter((e) => ['new', 'survey', 'estimating'].includes(e.status));

  const chart = chartMonths(today).map((m) => ({
    key: m, label: monthLabel(m),
    values: [
      sumOf(qs.filter((q) => q.sent?.on.startsWith(m)), net),
      sumOf(qs.filter((q) => q.status === 'accepted' && q.answer?.on.startsWith(m)), net),
    ],
  }));

  const figures = (keyOf, labelOf, keys) =>
    keys.map((key) => {
      const sent = sentIn.filter((q) => keyOf(q) === key);
      const won = wonIn.filter((q) => keyOf(q) === key);
      const lost = lostIn.filter((q) => keyOf(q) === key);
      return {
        key, label: labelOf(key), sent: sent.length, sentValue: sumOf(sent, net), won: won.length, wonValue: sumOf(won, net), lost: lost.length,
        winRate: percent(won.length, won.length + lost.length),
      };
    });

  // Why work is lost: one line for each quotation the customer rejected in the period, and for each enquiry closed as lost
  // in the period whose loss no rejected quotation already explains, grouped by the reason that was recorded.
  const counted = new Set(lostIn.map((q) => q.enquiryId).filter(Boolean));
  const losses = [
    ...lostIn.map((q) => ({ reason: q.answer.reason || 'No reason given', value: net(q) })),
    ...enquiries
      .filter((e) => e.status === 'lost' && !counted.has(e.id) && inRange(e.closedOn || e.receivedOn, range))
      .map((e) => {
        const quoted = qs.find((q) => q.enquiryId === e.id);
        return { reason: e.lostReason || 'No reason given', value: quoted ? net(quoted) : e.estValue };
      }),
  ];
  const lostValue = sumOf(losses, (x) => x.value);
  const byReason = Object.entries(groupRows(losses, (x) => x.reason))
    .map(([reason, rows]) => ({ reason, count: rows.length, value: sumOf(rows, (x) => x.value), share: percent(sumOf(rows, (x) => x.value), lostValue) }))
    .toSorted((a, b) => b.value - a.value);

  return {
    range, chart, byReason,
    sent: sentIn.length, sentValue: sumOf(sentIn, net),
    won: wonIn.length, wonValue: sumOf(wonIn, net),
    lost: lostIn.length,
    winRate: percent(wonIn.length, wonIn.length + lostIn.length),
    waiting: waiting.length, waitingValue: sumOf(waiting, net),
    openEnquiries: open.length, lateEnquiries: toQuote.filter((e) => e.dueOn && e.dueOn < today).length,
    byKind: figures((q) => q.kind, (k) => KINDS[k].label, Object.keys(KINDS)),
    byPerson: figures((q) => q.preparedBy, (id) => s.staff[id]?.name ?? id, [...new Set(qs.map((q) => q.preparedBy))]).filter((r) => r.sent + r.won + r.lost > 0),
  };
}

// ---- service -----------------------------------------------------------------------------------------------------
export function serviceReport(s, period, today) {
  const range = periodRange(period, today);
  const contracts = list(s.contracts);
  const live = contracts.filter((c) => ['active', 'expiring'].includes(contractStatus(c, today)));
  const jobs = list(s.jobs);
  const finished = jobs.filter((j) => ['completed', 'report_sent'].includes(j.status));
  const doneIn = finished.filter((j) => inRange(j.completedOn, range));
  const visitsDue = jobs.filter((j) => j.kind === 'planned_visit' && inRange(j.dueOn, range) && j.status !== 'cancelled');
  const visitsDone = visitsDue.filter((j) => finished.includes(j));
  const callOuts = jobs.filter((j) => j.kind === 'call_out' && inRange(j.requestedOn, range));
  const deficiencies = openDeficiencies(s).filter((d) => d.status !== 'declined');
  const devices = summariseDevices(list(s.devices), today);

  const kinds = Object.keys(JOB_KINDS);
  const chart = chartMonths(today).map((m) => ({
    key: m, label: monthLabel(m),
    values: kinds.map((k) => finished.filter((j) => j.kind === k && j.completedOn?.startsWith(m)).length),
  }));

  const ending = live
    .filter((c) => diffDays(today, c.endOn) <= 90)
    .toSorted((a, b) => a.endOn.localeCompare(b.endOn))
    .map((c) => ({ contract: c, customer: s.customers[c.customerId], site: s.sites[c.siteId], daysLeft: diffDays(today, c.endOn), renewal: s.quotations[c.renewalQuotationId] ?? null }));

  const hours = {};
  for (const j of doneIn) for (const l of j.labour) (hours[l.staffId] ??= { jobs: new Set(), hours: 0 }).hours += l.hours;
  for (const j of doneIn) for (const l of j.labour) hours[l.staffId].jobs.add(j.id);
  const people = Object.entries(hours)
    .map(([id, x]) => ({ person: s.staff[id], jobs: x.jobs.size, hours: round2(x.hours) }))
    .toSorted((a, b) => b.hours - a.hours);

  return {
    range, chart, kinds, ending, people,
    activeContracts: live.length, annualValue: sumOf(live, (c) => c.annualFee),
    jobsDone: doneIn.length, callOuts: callOuts.length, emergencies: callOuts.filter((j) => j.urgency === 'emergency').length,
    visitsDue: visitsDue.length, visitsDone: visitsDone.length, visitsOnTime: percent(visitsDone.filter((j) => j.completedOn <= j.dueOn).length, visitsDone.length),
    deficiencies: deficiencies.length,
    bySeverity: Object.keys(SEVERITY).map((k) => ({ key: k, label: SEVERITY[k].label, tone: SEVERITY[k].tone, count: deficiencies.filter((d) => d.severity === k).length })),
    oldestDeficiency: deficiencies.reduce((m, d) => Math.max(m, diffDays(d.foundOn, today)), 0),
    devices,
  };
}

// ---- projects ------------------------------------------------------------------------------------------------------
/** Projects as they stand today (a project has no period): money, cost against budget, claims and retention. */
export function projectsReport(s) {
  const rows = list(s.projects)
    .map((p) => {
      const pv = projectView(s, p);
      const f = forecast(pv);
      return {
        project: p, customer: s.customers[p.customerId], active: isActive(p),
        value: f.value, budget: f.budget, cost: f.exposure, margin: f.margin, marginPct: f.marginPct,
        percent: percentComplete(p), claimed: claimedTotal(p), paid: paidTotal(p), retention: retentionHeld(p),
        over: overBudget(pv).length,
        certified: round2(p.claims.filter((c) => ['certified', 'invoiced', 'paid'].includes(c.status)).reduce((n, c) => n + amountOf(c), 0)),
      };
    })
    .toSorted((a, b) => Number(b.active) - Number(a.active) || b.value - a.value);
  return {
    rows, active: rows.filter((r) => r.active).length,
    value: sumOf(rows, (r) => r.value), budget: sumOf(rows, (r) => r.budget), cost: sumOf(rows, (r) => r.cost),
    claimed: sumOf(rows, (r) => r.claimed), certified: sumOf(rows, (r) => r.certified), paid: sumOf(rows, (r) => r.paid), retention: sumOf(rows, (r) => r.retention),
    overPackages: rows.reduce((n, r) => n + r.over, 0), overProjects: rows.filter((r) => r.over > 0).length,
    contractValue: sumOf(list(s.projects), contractValue),
  };
}

// ---- stock -------------------------------------------------------------------------------------------------------------
export function stockReport(s, period, today) {
  const range = periodRange(period, today);
  const rows = stockRows(s);
  const cost = (r) => r.item.avgCost ?? r.item.cost;
  const low = lowStockRows(rows);
  const moves = list(s.movements).filter((m) => inRange(m.on, range) && m.kind !== 'opening');
  const openStockOrders = orderViews(s, today).filter((v) => v.po.purpose === 'stock' && ['approved', 'sent', 'partly_received'].includes(v.status));

  const byKind = Object.entries(groupRows(moves, (m) => m.kind))
    .map(([kind, group]) => ({ kind, label: MOVEMENT_KINDS[kind] ?? kind, count: group.length }))
    .toSorted((a, b) => b.count - a.count);
  const byCategory = Object.entries(groupRows(rows, (r) => r.item.category))
    .map(([category, group]) => ({ category, items: group.length, value: sumOf(group, (r) => Math.max(0, r.value)) }))
    .toSorted((a, b) => b.value - a.value);

  const lastMove = {};
  for (const m of list(s.movements)) if (m.kind !== 'opening' && (!lastMove[m.itemId] || m.on > lastMove[m.itemId])) lastMove[m.itemId] = m.on;

  return {
    range, byKind, byCategory,
    value: stockValue(rows), storeValue: sumOf(rows, (r) => r.store * cost(r)), vanValue: sumOf(rows, (r) => r.inVans * cost(r)),
    itemCount: rows.length, movements: moves.length,
    lowCount: low.length, negative: negativeBalances(s).length,
    onOrderValue: sumOf(openStockOrders, (v) => orderTotals(v.po).net), onOrderCount: openStockOrders.length,
    low: low.map((r) => ({ ...r, supplier: s.suppliers[r.item.supplierId] ?? null })),
    top: rows.toSorted((a, b) => b.value - a.value).slice(0, 8),
    idle: rows
      .filter((r) => r.total > 0 && diffDays(lastMove[r.item.id] ?? '2000-01-01', today) > 90)
      .map((r) => ({ ...r, last: lastMove[r.item.id] ?? '', days: lastMove[r.item.id] ? diffDays(lastMove[r.item.id], today) : null }))
      .toSorted((a, b) => b.value - a.value),
  };
}
