import { APPROVER_LABEL } from '@/data/roles.js';
import { costTotals } from '@/data/projectRules.js';
import {
  billState, billTotals, costRowsOfIssues, costRowsOfOrder, isOpenOrder, lineNet, orderLate, orderNet, orderProgress,
  orderStatus, orderTitle, orderTotals, valueLevel,
} from '@/data/purchaseRules.js';
import { diffDays, fmtDate, todayISO } from '@/lib/dates.js';
import { money, num, plural, round2 } from '@/lib/format.js';
import { authorityOf } from './salesSelectors.js';
import { list } from './selectors.js';

// Pure functions of the Purchases area. Nothing here changes anything.

// ---- grouping (a table is replaced on every change, so a WeakMap is a free cache) ---------
const caches = {};
function groupedBy(table, key) {
  const cache = (caches[key] ??= new WeakMap());
  if (!cache.has(table)) {
    const groups = {};
    for (const row of Object.values(table)) (groups[row[key]] ??= []).push(row);
    cache.set(table, groups);
  }
  return cache.get(table);
}
export const receiptsOf = (s, poId) => groupedBy(s.receipts, 'poId')[poId] ?? [];
export const billsOf = (s, poId) => groupedBy(s.bills, 'poId')[poId] ?? [];
export const ordersOfProject = (s, projectId) => groupedBy(s.purchaseOrders, 'projectId')[projectId] ?? [];
export const ordersOfJob = (s, jobId) => groupedBy(s.purchaseOrders, 'jobId')[jobId] ?? [];
export const ordersOfSupplier = (s, supplierId) => groupedBy(s.purchaseOrders, 'supplierId')[supplierId] ?? [];

const issueCache = new WeakMap();
/** Stock issued to (and returned from) each project: { projectId: [movement] }. */
function issuesByProject(movements) {
  if (!issueCache.has(movements)) {
    const map = {};
    for (const m of Object.values(movements)) {
      if (['issue_project', 'return_project'].includes(m.kind) && m.ref?.id) (map[m.ref.id] ??= []).push(m);
    }
    issueCache.set(movements, map);
  }
  return issueCache.get(movements);
}
export const issuesOfProject = (s, projectId) => issuesByProject(s.movements)[projectId] ?? [];

// ---- one order as the screens see it ------------------------------------------------------------
export function orderView(s, po, today = todayISO()) {
  const receipts = receiptsOf(s, po.id);
  const bills = billsOf(s, po.id);
  const progress = orderProgress(po, receipts, bills);
  return {
    po, receipts, bills, progress, supplier: s.suppliers[po.supplierId],
    status: orderStatus(po, receipts, bills), late: orderLate(po, progress, today), totals: orderTotals(po),
  };
}
export const orderViews = (s, today = todayISO()) => list(s.purchaseOrders).map((po) => orderView(s, po, today));

/** What an order is for, in a word or a number: "Stock", "PRJ-2026-002", "JOB-2026-0570". */
export function forWhat(s, po) {
  if (po.purpose === 'project') return s.projects[po.projectId]?.number ?? 'Project';
  if (po.purpose === 'job') return s.jobs[po.jobId]?.number ?? 'Job';
  return 'Stock';
}

/** Where the goods go. */
export function deliverLabel(s, po) {
  if (po.deliverTo === 'site') {
    const site = po.purpose === 'project' ? s.sites[s.projects[po.projectId]?.siteId]?.name : po.purpose === 'job' ? s.sites[s.jobs[po.jobId]?.siteId]?.name : '';
    return site ? `To site: ${site}` : 'To site';
  }
  return s.locations[po.deliverTo]?.name ?? 'Main store';
}

// The segments of the order list.
export const SEGMENTS = [
  { value: 'open', label: 'Open' },
  { value: 'waiting', label: 'Waiting approval' },
  { value: 'receive', label: 'To receive' },
  { value: 'bill', label: 'To bill' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];
export function inSegment(v, segment) {
  switch (segment) {
    case 'open': return isOpenOrder(v.status) && !(v.status === 'received' && v.progress.allBilled);
    case 'waiting': return v.status === 'waiting_approval';
    case 'receive': return ['sent', 'partly_received'].includes(v.status);
    case 'bill': return v.po.status === 'sent' && v.progress.toBillNet > 0;
    case 'closed': return ['closed', 'cancelled'].includes(v.status) || (v.status === 'received' && v.progress.allBilled);
    default: return true;
  }
}

// ---- approval of an order -----------------------------------------------------------------------------
const LEVEL = { manager: 1, owner: 2 };

/**
 * Who must approve an order. The value decides; an order for a project that
 * would take a package over its budget needs the manager as well. If the person
 * who made it already has that authority, nobody else has to approve.
 */
export function poApprovalNeeds(po, s) {
  const limits = s.settings.approvals;
  let level = 0;
  const reasons = [];
  const bump = (l, text) => {
    level = Math.max(level, l);
    reasons.push(text);
  };
  const byValue = valueLevel(orderNet(po), limits);
  if (byValue === 2) bump(2, `Value is above AED ${num(limits.poManagerLimit)}`);
  else if (byValue === 1) bump(1, `Value is above AED ${num(limits.poLimit)}`);
  const project = po.purpose === 'project' ? s.projects[po.projectId] : null;
  if (project && ['draft', 'waiting_approval'].includes(po.status)) {
    const view = projectView(s, project);
    const added = {};
    for (const l of po.lines) added[l.packageId] = round2((added[l.packageId] ?? 0) + lineNet(l));
    for (const [packageId, amount] of Object.entries(added)) {
      const pkg = view.packages.find((x) => x.id === packageId);
      if (!pkg) continue;
      const exposure = costTotals(view, packageId).exposure;
      if (exposure > pkg.cost) bump(1, `Adds to “${pkg.title}”, which is already AED ${money(exposure - pkg.cost)} over its budget`);
      else if (exposure + amount > pkg.cost) bump(1, `Takes “${pkg.title}” AED ${money(exposure + amount - pkg.cost)} over its budget`);
    }
  }
  const needed = level > authorityOf(s, po.createdBy);
  return {
    level, needed, reasons,
    role: needed ? (level === 2 ? 'owner' : 'manager') : null,
    roleLabel: needed ? APPROVER_LABEL[level] : null,
  };
}

/** May this person decide the pending approval? Not the one who asked, unless the owner. */
export function canApprovePO(po, s, viewerId) {
  if (po.status !== 'waiting_approval' || !po.approval.required) return false;
  const authority = authorityOf(s, viewerId);
  return authority >= LEVEL[po.approval.required] && (viewerId !== po.approval.requestedBy || authority === 2);
}

/** What the life-cycle strip of an order shows. */
export function orderSteps(v) {
  const { po, status, progress } = v;
  const usesApproval = Boolean(po.approval.required) || ['waiting_approval', 'approved'].includes(status);
  const keys = ['draft', ...(usesApproval ? ['approval'] : []), 'sent', 'delivered', 'billed'];
  const at = (key) => keys.indexOf(key);
  // The first step that is not done yet.
  const openStep = {
    draft: at('draft'),
    waiting_approval: at('approval'),
    approved: at('sent'),
    sent: at('delivered'),
    partly_received: at('delivered'),
    received: at('billed'),
    closed: keys.length,
    cancelled: po.sent ? at('delivered') : po.approval.decision === 'approved' ? at('sent') : po.approval.required && po.approval.requestedOn ? at('approval') : at('draft'),
  }[status];
  const billedNow = keys[openStep] === 'billed';
  const label = {
    draft: 'Draft',
    approval: status === 'waiting_approval' ? 'Waiting approval' : ['approved', 'sent', 'partly_received', 'received', 'closed'].includes(status) ? 'Approved' : 'Approval',
    sent: 'Sent',
    delivered: status === 'partly_received' ? 'Partly delivered' : ['received', 'closed'].includes(status) ? 'Delivered' : 'Delivery',
    billed: status === 'closed' ? 'Billed and paid' : billedNow ? (progress.allBilled ? 'Billed, to pay' : 'To bill') : 'Billed',
  };
  const steps = keys.map((key, i) => ({ key, label: label[key], state: i < openStep ? 'done' : i === openStep ? 'current' : 'todo' }));
  if (status === 'cancelled') return [...steps.slice(0, openStep).map((x) => ({ ...x, state: 'done' })), { key: 'cancelled', label: 'Cancelled', state: 'bad' }];
  return steps;
}

// ---- projects: costs from orders and from stock -----------------------------------------------------------------
/**
 * The project with its materials added to the costs it keeps by hand: every
 * approved or sent order for it, and every item issued to it from stock. The
 * rows carry `derived: true`; they are removed by cancelling the order or
 * returning the stock, never here.
 */
export function projectView(s, p) {
  const orders = ordersOfProject(s, p.id);
  const issues = issuesOfProject(s, p.id);
  if (orders.length === 0 && issues.length === 0) return p;
  const rows = orders.flatMap((po) => costRowsOfOrder(po, receiptsOf(s, po.id), billsOf(s, po.id), orderTitle(po)));
  rows.push(...costRowsOfIssues(issues, p.id, (id) => s.items[id]?.name ?? 'Item'));
  return { ...p, costs: [...p.costs, ...rows] };
}

// ---- suppliers ----------------------------------------------------------------------------------------------------------
export function supplierStats(s, supplierId, today = todayISO()) {
  const views = ordersOfSupplier(s, supplierId).map((po) => orderView(s, po, today));
  let unpaid = 0;
  let overdue = 0;
  for (const b of list(s.bills)) {
    if (b.supplierId !== supplierId || b.paidOn) continue;
    const total = billTotals(b, s.purchaseOrders[b.poId]).total;
    unpaid = round2(unpaid + total);
    if (billState(b, today) === 'overdue') overdue = round2(overdue + total);
  }
  const placed = views.filter((v) => !['draft', 'waiting_approval', 'cancelled'].includes(v.status));
  return {
    orders: views.length,
    open: views.filter((v) => ['approved', 'sent', 'partly_received'].includes(v.status)).length,
    spent: round2(placed.reduce((n, v) => n + v.totals.net, 0)),
    unpaid, overdue,
  };
}

/** Bills for the bills page, each with its order and its state. */
export function billRows(s, today = todayISO()) {
  return list(s.bills).map((b) => {
    const po = s.purchaseOrders[b.poId];
    return { bill: b, po, supplier: s.suppliers[b.supplierId], totals: billTotals(b, po), state: billState(b, today) };
  });
}

/** Goods received and not billed yet: one row per order. */
export function toBillRows(s, today = todayISO()) {
  return orderViews(s, today).filter((v) => v.po.status === 'sent' && v.progress.toBillNet > 0);
}

// ---- attention ---------------------------------------------------------------------------------------------------------------
export function purchaseAttention(s, today, viewerId) {
  const items = [];
  const views = orderViews(s, today);
  const role = s.staff[viewerId]?.roleKey;
  const label = (v) => `${v.po.number} · ${v.supplier?.name ?? ''}`;

  for (const v of views) {
    if (canApprovePO(v.po, s, viewerId)) {
      items.push({
        id: `poapprove_${v.po.id}`, area: 'purchases', action: 'approve_orders', tone: 'orange',
        title: `${v.po.number} waits for your approval`,
        text: `${v.supplier?.name ?? ''} · AED ${money(v.totals.total)} · ${v.po.approval.reasons[0] ?? 'Needs approval'}`,
        to: `/purchases/${v.po.id}`,
      });
    }
  }
  // Late orders: to the people who chase suppliers, and to the engineer of the project.
  const late = views.filter((v) => v.late && (role === 'engineer' ? s.projects[v.po.projectId]?.engineerId === viewerId : true));
  for (const v of late) {
    const days = diffDays(v.po.expectedOn, today);
    items.push({
      id: `polate_${v.po.id}`, area: 'purchases', action: 'request_purchase', tone: 'red',
      title: `${v.po.number} is ${plural(days, 'day')} late`,
      text: `${v.supplier?.name ?? ''} promised ${fmtDate(v.po.expectedOn)}${v.status === 'partly_received' ? '; part of it has come' : ''}.`,
      to: `/purchases/${v.po.id}`,
    });
  }
  // Deliveries the store expects today or tomorrow.
  const due = views.filter((v) => ['sent', 'partly_received'].includes(v.status) && v.po.deliverTo !== 'site' && v.po.expectedOn && v.po.expectedOn >= today && diffDays(today, v.po.expectedOn) <= 1);
  if (due.length > 0) {
    items.push({
      id: 'deliveries_due', area: 'inventory', action: 'receive_goods', tone: 'blue',
      title: due.length === 1 ? `${due[0].po.number} is due ${diffDays(today, due[0].po.expectedOn) === 0 ? 'today' : 'tomorrow'}` : `${due.length} deliveries are due today or tomorrow`,
      text: due.map((v) => v.supplier?.name).filter(Boolean).slice(0, 2).join(' · '),
      to: '/inventory/stock',
    });
  }
  // Supplier bills.
  const bills = billRows(s, today).filter((r) => r.state !== 'paid');
  const overdue = bills.filter((r) => r.state === 'overdue');
  if (overdue.length > 0) {
    items.push({
      id: 'bills_overdue', area: 'purchases', action: 'pay_bills', tone: 'red',
      title: overdue.length === 1 ? `A supplier bill is overdue: ${overdue[0].supplier?.name}` : `${overdue.length} supplier bills are overdue`,
      text: `AED ${money(overdue.reduce((n, r) => n + r.totals.total, 0))} to pay.`,
      to: '/purchases/bills?seg=overdue',
    });
  }
  const soon = bills.filter((r) => r.state === 'due' && diffDays(today, r.bill.dueOn) <= 7);
  if (soon.length > 0) {
    items.push({
      id: 'bills_soon', area: 'purchases', action: 'pay_bills', tone: 'blue',
      title: soon.length === 1 ? `A supplier bill is due in ${plural(diffDays(today, soon[0].bill.dueOn), 'day')}` : `${soon.length} supplier bills are due within a week`,
      text: `AED ${money(soon.reduce((n, r) => n + r.totals.total, 0))}.`,
      to: '/purchases/bills',
    });
  }
  return items;
}

/** Orders and suppliers for the global search. */
export function purchaseSearchEntries(s) {
  const entries = [];
  for (const po of list(s.purchaseOrders)) {
    entries.push({
      type: 'Purchase orders', id: po.id, title: `${po.number} · ${orderTitle(po)}`,
      sub: `${s.suppliers[po.supplierId]?.name ?? ''} · ${forWhat(s, po)}`, path: `/purchases/${po.id}`, keywords: po.notes,
    });
  }
  for (const sup of list(s.suppliers)) {
    entries.push({
      type: 'Suppliers', id: sup.id, title: sup.name, sub: `${sup.kind} · ${sup.area}`, path: `/purchases/suppliers/${sup.id}`,
      keywords: `${sup.contactName} ${sup.categories.join(' ')}`,
    });
  }
  return entries;
}
