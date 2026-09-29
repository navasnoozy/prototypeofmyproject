import { APPROVER_LABEL, ROLES } from '@/data/roles.js';
import { diffDays, todayISO } from '@/lib/dates.js';
import { money, num, round2 } from '@/lib/format.js';
import { list } from './selectors.js';

// Pure functions of the selling side. Totals are never stored: they are worked
// out from the lines each time, so an edited price can never leave an old
// total behind.

/** Subtotal, discount, VAT, total, and (for those who may see it) cost and margin. */
export function quoteTotals(q, vatRate = 5) {
  let subtotal = 0;
  let cost = 0;
  for (const line of q.lines) {
    subtotal += line.qty * line.price;
    cost += line.qty * (line.cost ?? 0);
  }
  subtotal = round2(subtotal);
  const discount = round2((subtotal * (q.discountPct || 0)) / 100);
  const net = round2(subtotal - discount);
  const vat = round2((net * vatRate) / 100);
  cost = round2(cost);
  return {
    subtotal, discount, net, vat, total: round2(net + vat), cost,
    profit: round2(net - cost),
    margin: net > 0 ? round2(((net - cost) / net) * 100) : 0,
  };
}

export const lineAmount = (line) => round2(line.qty * line.price);

/** A sent quotation whose validity has passed is shown as expired. */
export const effectiveStatus = (q, today = todayISO()) =>
  q.status === 'sent' && q.validUntil < today ? 'expired' : q.status;

export const quotationLabel = (q) => `${q.number}${q.rev > 0 ? ` Rev ${q.rev}` : ''}`;

export const latestQuotations = (s) => list(s.quotations).filter((q) => q.status !== 'superseded');
export const revisionsOf = (s, q) =>
  list(s.quotations).filter((x) => x.number === q.number).toSorted((a, b) => a.rev - b.rev);
export const enquiryQuotations = (s, enquiryId) => latestQuotations(s).filter((q) => q.enquiryId === enquiryId);
export const customerQuotations = (s, customerId) => latestQuotations(s).filter((q) => q.customerId === customerId);
export const customerEnquiries = (s, customerId) => list(s.enquiries).filter((e) => e.customerId === customerId);

export const authorityOf = (s, staffId) => ROLES[s.staff[staffId]?.roleKey]?.authority ?? 0;
const LEVEL = { manager: 1, owner: 2 };

/**
 * Who must approve a quotation. Every rule gives a level (1 operations
 * manager, 2 owner); the highest wins. If the person who prepared it already
 * has that authority, nobody else has to approve.
 */
export function approvalNeeds(q, s) {
  const a = s.settings.approvals;
  const t = quoteTotals(q, s.settings.vatRate);
  let level = 0;
  const reasons = [];
  const bump = (l, text) => {
    level = Math.max(level, l);
    reasons.push(text);
  };
  if (t.net > a.managerLimit) bump(2, `Net value is above AED ${num(a.managerLimit)}`);
  else if (t.net > a.salesLimit) bump(1, `Net value is above AED ${num(a.salesLimit)}`);
  if (q.discountPct > a.managerDiscount) bump(2, `Discount is above ${a.managerDiscount}%`);
  else if (q.discountPct > a.salesDiscount) bump(1, `Discount is above ${a.salesDiscount}%`);
  if (t.net > 0 && q.lines.some((l) => l.cost > 0) && t.margin < a.marginFloor) bump(1, `Margin is below ${a.marginFloor}%`);
  if (s.customers[q.customerId]?.status === 'on_hold') bump(2, 'The customer is on hold');
  const needed = level > authorityOf(s, q.preparedBy);
  return {
    level,
    needed,
    role: needed ? (level === 2 ? 'owner' : 'manager') : null,
    roleLabel: needed ? APPROVER_LABEL[level] : null,
    reasons,
  };
}

/** May this person decide the pending approval? Not the one who prepared it, unless the owner. */
export function canApprove(q, s, viewerId) {
  if (q.status !== 'waiting_approval' || !q.approval.required) return false;
  const authority = authorityOf(s, viewerId);
  return authority >= LEVEL[q.approval.required] && (viewerId !== q.preparedBy || authority === 2);
}

/** What the life-cycle strip of a quotation shows. */
export function quotationSteps(q, s, today = todayISO()) {
  const status = effectiveStatus(q, today);
  const usesApproval = q.approval.required || ['waiting_approval', 'approved'].includes(status) || q.approval.decision;
  const order = ['draft', ...(usesApproval ? ['approval'] : []), 'sent', 'answer'];
  const at = {
    draft: 'draft', waiting_approval: 'approval', approved: 'approval', sent: 'sent',
    accepted: 'answer', rejected: 'answer', expired: 'answer', superseded: 'answer',
  }[status];
  const label = {
    draft: 'Draft',
    approval: status === 'waiting_approval' ? 'Waiting approval' : 'Approved',
    sent: 'Sent',
    answer: { accepted: 'Accepted', rejected: 'Rejected', expired: 'Expired', superseded: 'Replaced' }[status] ?? 'Answer',
  };
  const here = order.indexOf(at);
  return order.map((key, i) => ({
    key,
    label: label[key],
    state:
      i < here ? 'done'
      : i === here
        ? (status === 'rejected' || status === 'expired' ? 'bad' : status === 'accepted' || status === 'approved' ? 'done' : 'current')
        : 'todo',
  }));
}

/** What the life-cycle strip of an enquiry shows. */
export function enquirySteps(e) {
  const order = ['new', ...(e.survey.needed ? ['survey'] : []), 'estimating', 'quoted', 'closed'];
  const at = { new: 'new', survey: 'survey', estimating: 'estimating', quoted: 'quoted', won: 'closed', lost: 'closed' }[e.status];
  const label = { new: 'New', survey: 'Site survey', estimating: 'Estimating', quoted: 'Quoted', closed: e.status === 'lost' ? 'Lost' : 'Won' };
  const here = order.indexOf(at);
  return order.map((key, i) => ({
    key,
    label: label[key],
    state: i < here ? 'done' : i === here ? (e.status === 'lost' ? 'bad' : e.status === 'won' ? 'done' : 'current') : 'todo',
  }));
}

/** Sales items for the bell, the home page and the sidebar counts. */
export function salesAttention(s, today, viewerId) {
  const items = [];
  const customer = (id) => s.customers[id]?.name ?? '';
  for (const q of list(s.quotations)) {
    if (canApprove(q, s, viewerId)) {
      const t = quoteTotals(q, s.settings.vatRate);
      items.push({
        id: `approve_${q.id}`, area: 'sales', tone: 'orange',
        title: `${quotationLabel(q)} waits for your approval`,
        text: `${customer(q.customerId)} · AED ${money(t.total)} · ${q.approval.reasons[0] ?? 'Needs approval'}`,
        to: `/sales/quotations/${q.id}`,
      });
    }
  }
  const sent = latestQuotations(s).filter((q) => q.status === 'sent');
  const expired = sent.filter((q) => q.validUntil < today);
  const ending = sent.filter((q) => q.validUntil >= today && diffDays(today, q.validUntil) <= 7);
  if (expired.length > 0) {
    items.push({
      id: 'quotes_expired', area: 'sales', tone: 'orange',
      title: expired.length === 1 ? `${quotationLabel(expired[0])} has expired` : `${expired.length} quotations have expired`,
      text: 'Revise, extend or record the answer.',
      to: expired.length === 1 ? `/sales/quotations/${expired[0].id}` : '/sales/quotations?status=sent',
    });
  }
  if (ending.length > 0) {
    items.push({
      id: 'quotes_ending', area: 'sales', tone: 'blue',
      title: ending.length === 1 ? `${quotationLabel(ending[0])} ends in ${diffDays(today, ending[0].validUntil)} days` : `${ending.length} quotations end within 7 days`,
      text: 'Follow up with the customer.',
      to: ending.length === 1 ? `/sales/quotations/${ending[0].id}` : '/sales/quotations?status=sent',
    });
  }
  const late = list(s.enquiries).filter((e) => ['new', 'survey', 'estimating'].includes(e.status) && e.dueOn && e.dueOn < today);
  if (late.length > 0) {
    items.push({
      id: 'enquiries_late', area: 'sales', tone: 'red',
      title: late.length === 1 ? `${late[0].number} is past its date for a quotation` : `${late.length} enquiries are past their date for a quotation`,
      text: 'The customer is waiting.',
      to: late.length === 1 ? `/sales/${late[0].id}` : '/sales?status=open',
    });
  }
  return items;
}

/** Enquiries, quotations and catalogue items for the global search. */
export function salesSearchEntries(s) {
  const entries = [];
  for (const e of list(s.enquiries)) {
    entries.push({
      type: 'Enquiries', id: e.id, title: `${e.number} · ${e.title}`,
      sub: s.customers[e.customerId]?.name ?? '', path: `/sales/${e.id}`, keywords: e.description,
    });
  }
  for (const q of latestQuotations(s)) {
    entries.push({
      type: 'Quotations', id: q.id, title: `${quotationLabel(q)} · ${q.title}`,
      sub: s.customers[q.customerId]?.name ?? '', path: `/sales/quotations/${q.id}`, keywords: q.kind,
    });
  }
  for (const i of list(s.items)) {
    entries.push({
      type: 'Catalogue', id: i.id, title: `${i.code} · ${i.name}`,
      sub: `${i.category} · AED ${money(i.price)} per ${i.unit}`, path: `/sales/catalogue?open=${i.id}`, keywords: '',
    });
  }
  return entries;
}
