import { documentTotals } from '@/data/billingRules.js';
import { percentComplete } from '@/data/projectRules.js';
import { orderTitle, orderTotals } from '@/data/purchaseRules.js';
import { sumOf } from '@/data/reportRules.js';
import { WINDOWS } from '@/data/serviceKinds.js';
import { addDays, diffDays, fmtDay } from '@/lib/dates.js';
import { money, plural } from '@/lib/format.js';
import { canApproveCredit, creditLabel, invoiceViews, isOwed, receivables, toInvoice } from './billingSelectors.js';
import { lowStockRows, negativeBalances, stockRows, vanList, vanShortfalls } from './inventorySelectors.js';
import { isActive, overBudget } from './projectSelectors.js';
import { billRows, canApprovePO, inSegment, orderViews, projectView, toBillRows } from './purchaseSelectors.js';
import { canApprove, effectiveStatus, latestQuotations, quotationLabel, quoteTotals } from './salesSelectors.js';
import { WINDOWS_ORDER, boardItems, queueItems } from './scheduleSelectors.js';
import { list } from './selectors.js';
import { openDeficiencies } from './serviceSelectors.js';

// What each role sees on its Home: four figures and a few short lists, all
// read from the tables of the other areas (nothing is stored). The page draws
// them the same way for every role.
//   tile: { key, label, value | amount, sub, tone, to }
//   list: { key, title, side, action: { label, to }, empty, rows: [{ key, to, title, sub, right, tone, progress }] }

const aed = (n) => `AED ${money(n)}`;
const windowWord = (w) => (WINDOWS[w] ?? '').split(' (')[0];
const dueWords = (date, today) => {
  const d = diffDays(today, date);
  return d < 0 ? `${plural(-d, 'day')} late` : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
};
const names = (s, ids) => ids.map((id) => s.staff[id]?.name.split(' ')[0]).filter(Boolean).join(', ');

// ---- shared lists -------------------------------------------------------------------------------------------
/** Quotations, purchase orders and credit notes that this person must decide. */
function approvalRows(s, viewerId) {
  const rows = [];
  for (const q of latestQuotations(s)) {
    if (q.status === 'waiting_approval' && canApprove(q, s, viewerId)) {
      rows.push({ key: q.id, to: `/sales/quotations/${q.id}`, title: `${quotationLabel(q)} · ${q.title}`, sub: `${s.customers[q.customerId]?.name ?? ''} · quotation`, right: aed(quoteTotals(q, s.settings.vatRate).net) });
    }
  }
  for (const po of list(s.purchaseOrders)) {
    if (canApprovePO(po, s, viewerId)) {
      rows.push({ key: po.id, to: `/purchases/${po.id}`, title: `${po.number} · ${orderTitle(po)}`, sub: `${s.suppliers[po.supplierId]?.name ?? ''} · purchase order`, right: aed(orderTotals(po).net) });
    }
  }
  for (const cn of list(s.creditNotes)) {
    if (canApproveCredit(cn, s, viewerId)) {
      rows.push({ key: cn.id, to: `/billing/credit-notes/${cn.id}`, title: `${creditLabel(cn)} · ${cn.reason}`, sub: `${s.customers[cn.customerId]?.name ?? ''} · credit note`, right: aed(documentTotals(cn).net) });
    }
  }
  return rows;
}

/** Customers that are on hold, over their credit limit, or more than 60 days late with an invoice. */
function watchRows(s, today) {
  const rows = new Map();
  const add = (customer, reason, owes = 0) => {
    const row = rows.get(customer.id) ?? { key: customer.id, to: `/billing/statements/${customer.id}`, title: customer.name, reasons: [], right: '' };
    row.reasons.push(reason);
    if (owes > 0) row.right = aed(owes);
    rows.set(customer.id, row);
  };
  for (const a of receivables(s, today)) {
    if (a.oldest > 60) add(a.customer, `${a.oldest} days late`, a.balance);
    if (a.over) add(a.customer, 'over its credit limit', a.balance);
  }
  for (const c of list(s.customers)) if (c.status === 'on_hold') add(c, 'on hold');
  return [...rows.values()].map((r) => ({ key: r.key, to: r.to, title: r.title, sub: r.reasons.join(' · '), right: r.right, tone: 'text-red-700' }));
}

function projectRows(s, projects) {
  return projects.map((p) => {
    const over = overBudget(projectView(s, p)).length;
    return {
      key: p.id, to: `/projects/${p.id}`, title: `${p.number} · ${p.title}`, sub: `${s.customers[p.customerId]?.name ?? ''}${over > 0 ? ` · ${plural(over, 'package')} over budget` : ''}`,
      progress: percentComplete(p), tone: over > 0 ? 'text-orange-700' : undefined,
    };
  });
}

const planningRows = (s, today, limit = 5) =>
  queueItems(s, today).jobs.slice(0, limit).map((j) => ({
    key: j.key, to: j.path, title: j.title, sub: `${j.sub} · ${j.tag}`, right: j.urgency === 'normal' ? '' : j.urgency === 'emergency' ? 'Emergency' : 'Urgent', tone: j.urgency === 'emergency' ? 'text-red-700' : 'text-orange-700',
  }));

const deliveryRows = (s, today, filter = () => true) =>
  orderViews(s, today)
    .filter((v) => ['sent', 'partly_received'].includes(v.status) && filter(v) && (v.late || (v.po.expectedOn && v.po.expectedOn <= addDays(today, 7))))
    .toSorted((a, b) => (a.po.expectedOn ?? '').localeCompare(b.po.expectedOn ?? ''))
    .slice(0, 6)
    .map((v) => ({
      key: v.po.id, to: `/purchases/${v.po.id}`, title: `${v.po.number} · ${v.supplier?.name ?? ''}`, sub: orderTitle(v.po),
      right: v.late ? `${plural(diffDays(v.po.expectedOn, today), 'day')} late` : `expected ${dueWords(v.po.expectedOn, today)}`, tone: v.late ? 'text-red-700' : undefined,
    }));

// ---- one builder per role ----------------------------------------------------------------------------------------
function owner(s, user, today) {
  const views = invoiceViews(s, today);
  const owed = views.filter(isOwed);
  const overdue = owed.filter((v) => v.state === 'overdue');
  const month = today.slice(0, 7);
  const invoicedMonth = sumOf(list(s.invoices).filter((i) => i.status === 'issued' && i.issuedOn.startsWith(month)), (i) => documentTotals(i).net);
  const waiting = latestQuotations(s).filter((q) => effectiveStatus(q, today) === 'sent');
  const active = list(s.projects).filter(isActive);
  const overPackages = active.reduce((n, p) => n + overBudget(projectView(s, p)).length, 0);
  const soon = addDays(today, 30);
  const bills = billRows(s, today).filter((r) => r.state !== 'paid');
  return {
    tiles: [
      { key: 'owed', label: 'Owed to us', amount: sumOf(owed, (v) => v.balance), sub: overdue.length > 0 ? `${aed(sumOf(overdue, (v) => v.balance))} overdue` : 'nothing overdue', tone: overdue.length > 0 ? 'text-red-700' : undefined, to: '/billing/statements' },
      { key: 'invoiced', label: 'Invoiced this month', amount: invoicedMonth, sub: 'before VAT', to: '/reports' },
      { key: 'quotes', label: 'Quotations waiting', amount: sumOf(waiting, (q) => quoteTotals(q, s.settings.vatRate).net), sub: `${plural(waiting.length, 'quotation')} with customers`, to: '/sales/quotations?status=sent' },
      { key: 'projects', label: 'Projects under way', value: active.length, sub: overPackages > 0 ? `${plural(overPackages, 'package')} over budget` : 'all inside their budgets', tone: overPackages > 0 ? 'text-orange-700' : undefined, to: '/reports/projects' },
    ],
    lists: [
      { key: 'decide', title: 'Waiting for your decision', empty: 'Nothing waits for your decision.', rows: approvalRows(s, user.id) },
      { key: 'watch', title: 'Customers to watch', empty: 'No customer needs watching.', rows: watchRows(s, today), action: { label: 'All statements', to: '/billing/statements' } },
      {
        key: 'money', title: 'Money in the next 30 days', side: true,
        rows: [
          { key: 'in', to: '/billing?seg=unpaid', title: 'To come in', sub: 'invoices that fall due', right: aed(sumOf(owed.filter((v) => v.state !== 'overdue' && v.inv.dueOn <= soon), (v) => v.balance)) },
          { key: 'late', to: '/billing?seg=overdue', title: 'Late from customers', sub: plural(overdue.length, 'invoice'), right: aed(sumOf(overdue, (v) => v.balance)), tone: overdue.length > 0 ? 'text-red-700' : undefined },
          { key: 'out', to: '/purchases/bills', title: 'To pay suppliers', sub: 'bills that fall due', right: aed(sumOf(bills.filter((r) => r.state === 'due' && r.bill.dueOn <= soon), (r) => r.totals.total)) },
          { key: 'outlate', to: '/purchases/bills', title: 'Late to suppliers', sub: plural(bills.filter((r) => r.state === 'overdue').length, 'bill'), right: aed(sumOf(bills.filter((r) => r.state === 'overdue'), (r) => r.totals.total)), tone: bills.some((r) => r.state === 'overdue') ? 'text-orange-700' : undefined },
        ],
      },
    ],
  };
}

function manager(s, user, today) {
  const approvals = approvalRows(s, user.id);
  const queue = queueItems(s, today);
  const active = list(s.projects).filter(isActive);
  const overProjects = active.filter((p) => overBudget(projectView(s, p)).length > 0);
  const late = orderViews(s, today).filter((v) => v.late);
  return {
    tiles: [
      { key: 'approve', label: 'Waiting for your approval', value: approvals.length, sub: approvals.length > 0 ? 'quotations, orders and credit notes' : 'nothing waits', tone: approvals.length > 0 ? 'text-orange-700' : undefined },
      { key: 'plan', label: 'Need planning', value: queue.jobs.length + queue.tasks.length, sub: `${plural(queue.jobs.length, 'job')}, ${plural(queue.tasks.length, 'site work item')}`, to: '/schedule' },
      { key: 'over', label: 'Projects over budget', value: overProjects.length, sub: `of ${plural(active.length, 'project')} under way`, tone: overProjects.length > 0 ? 'text-orange-700' : undefined, to: '/reports/projects' },
      { key: 'late', label: 'Late purchase orders', value: late.length, sub: late.length > 0 ? `the oldest ${plural(Math.max(...late.map((v) => diffDays(v.po.expectedOn, today))), 'day')} late` : 'all on time', tone: late.length > 0 ? 'text-red-700' : undefined, to: '/purchases' },
    ],
    lists: [
      { key: 'approve', title: 'Waiting for your approval', empty: 'Nothing waits for your approval.', rows: approvals },
      { key: 'plan', title: 'Needs planning', empty: 'Everything is planned.', rows: planningRows(s, today), action: { label: 'Open the board', to: '/schedule' } },
      { key: 'projects', title: 'Projects under way', side: true, rows: projectRows(s, active), action: { label: 'All projects', to: '/projects' } },
    ],
  };
}

function sales(s, user, today) {
  const mine = (q) => q.preparedBy === user.id;
  const qs = latestQuotations(s).filter(mine);
  const year = today.slice(0, 4);
  const waiting = qs.filter((q) => effectiveStatus(q, today) === 'sent').toSorted((a, b) => a.sent.on.localeCompare(b.sent.on));
  const won = qs.filter((q) => q.status === 'accepted' && q.answer?.on.startsWith(year));
  const lost = qs.filter((q) => q.status === 'rejected' && q.answer?.on.startsWith(year));
  // Enquiries still to be quoted: a quoted one is waiting for the customer and shows in the first list.
  const enquiries = list(s.enquiries).filter((e) => e.ownerId === user.id && ['new', 'survey', 'estimating'].includes(e.status)).toSorted((a, b) => (a.dueOn ?? '9').localeCompare(b.dueOn ?? '9'));
  const drafts = qs.filter((q) => ['draft', 'approved'].includes(q.status));
  const STATE = { new: 'New', survey: 'Site survey', estimating: 'Estimating', quoted: 'Quoted' };
  return {
    tiles: [
      { key: 'enq', label: 'Enquiries to quote', value: enquiries.length, sub: enquiries.some((e) => e.dueOn && e.dueOn < today) ? `${enquiries.filter((e) => e.dueOn && e.dueOn < today).length} late` : 'none late', tone: enquiries.some((e) => e.dueOn && e.dueOn < today) ? 'text-orange-700' : undefined, to: `/sales?owner=${user.id}` },
      { key: 'out', label: 'Quotations with customers', amount: sumOf(waiting, (q) => quoteTotals(q, s.settings.vatRate).net), sub: plural(waiting.length, 'quotation'), to: '/sales/quotations?status=sent' },
      { key: 'won', label: 'Won this year', amount: sumOf(won, (q) => quoteTotals(q, s.settings.vatRate).net), sub: plural(won.length, 'quotation'), to: '/reports/sales' },
      { key: 'rate', label: 'Win rate this year', value: won.length + lost.length > 0 ? `${Math.round((won.length / (won.length + lost.length)) * 100)}%` : '—', sub: `${won.length} won, ${lost.length} lost` },
    ],
    lists: [
      {
        key: 'waiting', title: 'Waiting for the customer', empty: 'No quotation is waiting for an answer.', action: { label: 'All quotations', to: '/sales/quotations' },
        rows: waiting.slice(0, 6).map((q) => {
          const days = diffDays(q.sent.on, today);
          return { key: q.id, to: `/sales/quotations/${q.id}`, title: `${quotationLabel(q)} · ${s.customers[q.customerId]?.name ?? ''}`, sub: q.title, right: `sent ${plural(days, 'day')} ago`, tone: days >= 14 ? 'text-orange-700' : undefined };
        }),
      },
      {
        key: 'enquiries', title: 'Enquiries to work on', empty: 'Every enquiry is quoted.', action: { label: 'All enquiries', to: '/sales' },
        rows: enquiries.slice(0, 6).map((e) => ({
          key: e.id, to: `/sales/${e.id}`, title: `${e.number} · ${e.title}`, sub: `${s.customers[e.customerId]?.name ?? ''} · ${STATE[e.status]}`,
          right: e.dueOn ? `due ${dueWords(e.dueOn, today)}` : '', tone: e.dueOn && e.dueOn < today ? 'text-red-700' : undefined,
        })),
      },
      {
        key: 'drafts', title: 'Quotations to finish', side: true, empty: 'No draft quotation.',
        rows: drafts.map((q) => ({ key: q.id, to: `/sales/quotations/${q.id}`, title: `${quotationLabel(q)} · ${s.customers[q.customerId]?.name ?? ''}`, sub: q.status === 'approved' ? 'approved: send it' : 'draft', right: aed(quoteTotals(q, s.settings.vatRate).net) })),
      },
    ],
  };
}

function coordinator(s, user, today) {
  const tomorrow = addDays(today, 1);
  const jobs = list(s.jobs);
  const dayJobs = jobs
    .filter((j) => [today, tomorrow].includes(j.plannedOn) && ['planned', 'in_progress', 'completed'].includes(j.status))
    .toSorted((a, b) => a.plannedOn.localeCompare(b.plannedOn) || WINDOWS_ORDER.indexOf(a.window || 'morning') - WINDOWS_ORDER.indexOf(b.window || 'morning'));
  const queue = queueItems(s, today);
  const impairments = openDeficiencies(s).filter((d) => d.severity === 'impairment' && d.status !== 'declined');
  const untold = openDeficiencies(s).filter((d) => d.status === 'found');
  const visits = jobs.filter((j) => j.kind === 'planned_visit' && ['upcoming', 'unplanned'].includes(j.status) && j.dueOn <= addDays(today, 30));
  return {
    tiles: [
      { key: 'today', label: 'Jobs today', value: dayJobs.filter((j) => j.plannedOn === today).length, sub: `${dayJobs.filter((j) => j.plannedOn === today && j.status === 'in_progress').length} under way now`, to: '/service/jobs' },
      { key: 'plan', label: 'Need planning', value: queue.jobs.length, sub: queue.jobs.some((j) => j.urgency !== 'normal') ? 'some are urgent' : 'none urgent', tone: queue.jobs.some((j) => j.urgency !== 'normal') ? 'text-orange-700' : undefined, to: '/schedule' },
      { key: 'imp', label: 'Impairments open', value: impairments.length, sub: impairments.length > 0 ? 'a system is out of order' : 'no system out of order', tone: impairments.length > 0 ? 'text-red-700' : undefined, to: '/service/deficiencies?severity=impairment' },
      { key: 'visits', label: 'Visits due in 30 days', value: visits.length, sub: 'from the visit plans', to: '/service/jobs?status=unplanned' },
    ],
    lists: [
      {
        key: 'days', title: 'Today and tomorrow', empty: 'No job is planned for today or tomorrow.', action: { label: 'Open the board', to: '/schedule' },
        rows: dayJobs.map((j) => ({
          key: j.id, to: `/service/jobs/${j.id}`, title: j.title, sub: `${s.sites[j.siteId]?.name ?? ''} · ${names(s, j.assigneeIds)}`,
          right: `${j.plannedOn === today ? 'Today' : 'Tomorrow'}, ${windowWord(j.window || 'morning').toLowerCase()}`, tone: j.status === 'in_progress' ? 'text-blue-700' : undefined,
        })),
      },
      { key: 'plan', title: 'Needs planning', empty: 'Everything is planned.', rows: planningRows(s, today), action: { label: 'Open the board', to: '/schedule' } },
      {
        key: 'tell', title: 'Tell the customer', side: true, empty: 'Every finding was reported.', action: { label: 'All deficiencies', to: '/service/deficiencies' },
        rows: untold.slice(0, 5).map((d) => ({ key: d.id, to: `/service/deficiencies/${d.id}`, title: `${d.number} · ${d.title}`, sub: s.sites[d.siteId]?.name ?? '', right: d.severity === 'impairment' ? 'Impairment' : d.severity === 'critical' ? 'Critical' : '', tone: d.severity === 'impairment' ? 'text-red-700' : 'text-orange-700' })),
      },
    ],
  };
}

function engineer(s, user, today) {
  const mineAll = list(s.projects).filter((p) => isActive(p) && p.engineerId === user.id);
  const mine = mineAll.length > 0 ? mineAll : list(s.projects).filter(isActive);
  const over = mine.reduce((n, p) => n + overBudget(projectView(s, p)).length, 0);
  const waitingClaims = mine.flatMap((p) => p.claims.filter((c) => c.status === 'submitted').map((c) => ({ p, c })));
  const waitingVariations = mine.flatMap((p) => p.variations.filter((v) => v.status === 'submitted'));
  // Site work of the projects she looks after in the next 7 days, whoever does it (one row for a day of a task).
  const mineIds = new Set(mine.map((p) => p.id));
  const seen = new Set();
  const week = boardItems(s, today, addDays(today, 7))
    .filter((i) => i.kind === 'task' && mineIds.has(i.projectId) && !seen.has(`${i.id}:${i.date}`) && seen.add(`${i.id}:${i.date}`))
    .toSorted((a, b) => a.date.localeCompare(b.date));
  return {
    tiles: [
      { key: 'mine', label: 'Projects under way', value: mine.length, sub: 'that you look after', to: '/projects' },
      { key: 'over', label: 'Packages over budget', value: over, sub: over > 0 ? 'look at the costs' : 'all inside their budgets', tone: over > 0 ? 'text-orange-700' : undefined, to: '/projects' },
      { key: 'wait', label: 'Waiting for the customer', value: waitingClaims.length + waitingVariations.length, sub: `${plural(waitingClaims.length, 'claim')}, ${plural(waitingVariations.length, 'variation')}` },
      { key: 'week', label: 'On site this week', value: week.length, sub: 'days of site work in the next 7 days', to: '/schedule' },
    ],
    lists: [
      { key: 'projects', title: 'Your projects', empty: 'No project under way.', rows: projectRows(s, mine), action: { label: 'All projects', to: '/projects' } },
      {
        key: 'week', title: 'On site this week', empty: 'No site work is planned on your projects in the next 7 days.', action: { label: 'Open the board', to: '/schedule' },
        rows: week.map((i) => ({ key: i.key, to: i.path, title: i.title, sub: `${i.sub} · ${names(s, i.people)}`, right: `${i.date === today ? 'Today' : fmtDay(i.date)}, ${windowWord(i.window).toLowerCase()}` })),
      },
      {
        key: 'chase', title: 'Chase the customer', side: true, empty: 'Nothing waits for the customer.',
        rows: [
          ...waitingClaims.map(({ p, c }) => ({ key: c.id, to: `/projects/${p.id}?tab=claims`, title: `${p.number}: claim waiting for the certificate`, sub: `submitted ${plural(diffDays(c.submittedOn, today), 'day')} ago`, tone: diffDays(c.submittedOn, today) >= 14 ? 'text-orange-700' : undefined })),
          ...mine.flatMap((p) => p.variations.filter((v) => v.status === 'submitted').map((v) => ({ key: v.id, to: `/projects/${p.id}?tab=variations`, title: `${p.number}: ${v.number} waiting for the customer`, sub: `submitted ${plural(diffDays(v.submittedOn, today), 'day')} ago` }))),
        ],
      },
    ],
  };
}

function purchasing(s, user, today) {
  const views = orderViews(s, today);
  const low = lowStockRows(stockRows(s));
  const toBill = toBillRows(s, today);
  return {
    tiles: [
      { key: 'open', label: 'Open orders', value: views.filter((v) => inSegment(v, 'open')).length, sub: 'not closed yet', to: '/purchases' },
      { key: 'late', label: 'Late orders', value: views.filter((v) => v.late).length, sub: 'past the promised day', tone: views.some((v) => v.late) ? 'text-red-700' : undefined, to: '/purchases?seg=receive' },
      { key: 'wait', label: 'Waiting for approval', value: views.filter((v) => v.status === 'waiting_approval').length, sub: 'with the manager or the owner', to: '/purchases?seg=waiting' },
      { key: 'low', label: 'Items below the minimum', value: low.length, sub: 'to reorder', tone: low.length > 0 ? 'text-orange-700' : undefined, to: '/inventory/stock' },
    ],
    lists: [
      { key: 'chase', title: 'Deliveries to chase', empty: 'No delivery is late or due this week.', rows: deliveryRows(s, today), action: { label: 'All orders', to: '/purchases' } },
      {
        key: 'reorder', title: 'To reorder', empty: 'Nothing is below its minimum.', action: { label: 'Open the stock', to: '/inventory/stock' },
        rows: low.slice(0, 6).map((r) => ({ key: r.item.id, to: '/inventory/stock', title: r.item.name, sub: `${r.store} in the store, minimum ${r.item.minStore}${r.onOrder > 0 ? `, ${r.onOrder} on order` : ''}`, right: `order ${r.reorder}` })),
      },
      {
        key: 'bill', title: 'Arrived, not billed yet', side: true, empty: 'Every delivery has its bill.', action: { label: 'Supplier bills', to: '/purchases/bills' },
        rows: toBill.slice(0, 5).map((v) => ({ key: v.po.id, to: `/purchases/${v.po.id}`, title: `${v.po.number} · ${v.supplier?.name ?? ''}`, sub: orderTitle(v.po), right: aed(v.progress.toBillNet) })),
      },
    ],
  };
}

function storekeeper(s, user, today) {
  const low = lowStockRows(stockRows(s));
  const vans = vanList(s).map((v) => ({ van: v, short: vanShortfalls(s, v.id) })).filter((x) => x.short.length > 0);
  const toStore = (v) => v.po.deliverTo !== 'site';
  const deliveries = deliveryRows(s, today, toStore);
  const expected = orderViews(s, today).filter((v) => ['sent', 'partly_received'].includes(v.status) && toStore(v) && (v.late || (v.po.expectedOn && v.po.expectedOn <= addDays(today, 7))));
  const counts = negativeBalances(s);
  return {
    tiles: [
      { key: 'receive', label: 'Deliveries to receive', value: expected.length, sub: expected.some((v) => v.late) ? 'some are late' : 'this week', tone: expected.some((v) => v.late) ? 'text-orange-700' : undefined, to: '/purchases?seg=receive' },
      { key: 'low', label: 'Items below the minimum', value: low.length, sub: 'in the store', tone: low.length > 0 ? 'text-orange-700' : undefined, to: '/inventory/stock' },
      { key: 'vans', label: 'Vans to top up', value: vans.length, sub: `of ${plural(vanList(s).length, 'van')}`, to: '/inventory/stock' },
      { key: 'count', label: 'Places to count', value: counts.length, sub: counts.length > 0 ? 'a balance is below zero' : 'all balances are right', tone: counts.length > 0 ? 'text-red-700' : undefined, to: '/inventory/stock' },
    ],
    lists: [
      { key: 'deliveries', title: 'Deliveries to receive', empty: 'No delivery is expected this week.', rows: deliveries, action: { label: 'All orders', to: '/purchases?seg=receive' } },
      {
        key: 'low', title: 'Below the minimum', empty: 'Nothing is below its minimum.', action: { label: 'Open the stock', to: '/inventory/stock' },
        rows: low.slice(0, 6).map((r) => ({ key: r.item.id, to: '/inventory/stock', title: r.item.name, sub: `${r.store} in the store, minimum ${r.item.minStore}`, right: r.onOrder > 0 ? `${r.onOrder} on order` : 'not ordered', tone: r.onOrder > 0 ? undefined : 'text-orange-700' })),
      },
      {
        key: 'vans', title: 'Vans', side: true, empty: 'Every van has its usual stock.', action: { label: 'Open the stock', to: '/inventory/stock' },
        rows: vans.map((x) => ({ key: x.van.id, to: '/inventory/stock', title: x.van.name, sub: x.short.slice(0, 3).map((r) => `${r.need} ${r.item.code}`).join(', '), right: `${x.short.length} to top up` })),
      },
    ],
  };
}

function accountant(s, user, today) {
  const views = invoiceViews(s, today);
  const owed = views.filter(isOwed);
  const overdue = owed.filter((v) => v.state === 'overdue').toSorted((a, b) => b.overdueDays - a.overdueDays);
  const queue = toInvoice(s, today);
  const thirty = addDays(today, -30);
  const received = list(s.payments).filter((p) => p.on >= thirty);
  const week = addDays(today, 7);
  const bills = billRows(s, today).filter((r) => r.state !== 'paid' && r.bill.dueOn <= week);
  return {
    tiles: [
      { key: 'ready', label: 'Ready to invoice', amount: sumOf(queue, (x) => x.amount), sub: plural(queue.length, 'thing'), tone: queue.some((x) => x.kind === 'contract' && x.late > 0) ? 'text-orange-700' : undefined, to: '/billing' },
      { key: 'overdue', label: 'Overdue', amount: sumOf(overdue, (v) => v.balance), sub: plural(overdue.length, 'invoice'), tone: overdue.length > 0 ? 'text-red-700' : undefined, to: '/billing?seg=overdue' },
      { key: 'received', label: 'Received, last 30 days', amount: sumOf(received, (p) => p.amount), sub: plural(received.length, 'receipt'), to: '/billing/receipts' },
      { key: 'bills', label: 'Bills to pay this week', amount: sumOf(bills, (r) => r.totals.total), sub: plural(bills.length, 'bill'), tone: bills.some((r) => r.state === 'overdue') ? 'text-orange-700' : undefined, to: '/purchases/bills' },
    ],
    lists: [
      {
        key: 'collect', title: 'Collect first', empty: 'Nothing is overdue.', action: { label: 'All statements', to: '/billing/statements' },
        rows: overdue.slice(0, 6).map((v) => ({ key: v.inv.id, to: `/billing/${v.inv.id}`, title: `${v.inv.number} · ${v.customer?.name ?? ''}`, sub: v.inv.title, right: `${aed(v.balance)}, ${plural(v.overdueDays, 'day')} late`, tone: v.overdueDays > 60 ? 'text-red-700' : 'text-orange-700' })),
      },
      {
        key: 'ready', title: 'Ready to invoice', empty: 'Nothing waits to be invoiced.', action: { label: 'Open Billing', to: '/billing' },
        rows: queue.slice(0, 5).map((x) => ({ key: x.key, to: '/billing', title: x.title, sub: `${s.customers[x.customerId]?.name ?? ''} · ${x.sub}`, right: aed(x.amount), tone: x.kind === 'contract' && x.late > 0 ? 'text-orange-700' : undefined })),
      },
      { key: 'watch', title: 'Customers to watch', side: true, empty: 'No customer needs watching.', rows: watchRows(s, today).slice(0, 5) },
    ],
  };
}

const BUILDERS = { owner, manager, sales, coordinator, engineer, purchasing, storekeeper, accountant };

/** The figures and lists of a person's Home. A role without a builder gets the owner's. */
export const roleHome = (s, user, today) => (BUILDERS[user.roleKey] ?? owner)(s, user, today);
