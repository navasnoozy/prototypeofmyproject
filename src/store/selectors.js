import { addMonths, diffDays, todayISO } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { CONTACT_ROLES, SYSTEM_TYPES } from '@/data/catalog.js';

// Pure functions that read the state. Nothing here changes anything.

export const list = (table) => Object.values(table);

// A table is replaced (never edited) on every change, so a WeakMap keyed by
// the table gives a free cache that is dropped exactly when the data changes.
const cache = new WeakMap();
const memo = (table, build) => {
  if (!cache.has(table)) cache.set(table, build(table));
  return cache.get(table);
};
const groupBy = (table, key) =>
  memo(table, (rows) => {
    const groups = {};
    for (const row of Object.values(rows)) (groups[row[key]] ??= []).push(row);
    return groups;
  });

export const devicesBySite = (s) => groupBy(s.devices, 'siteId');
export const devicesBySystem = (s) => groupBy(s.devices, 'systemId');
export const systemsBySite = (s) => groupBy(s.systems, 'siteId');
export const sitesByCustomer = (s) => groupBy(s.sites, 'customerId');
export const contactsByCustomer = (s) => groupBy(s.contacts, 'customerId');

/** Sites of a customer, and sites it only pays for (bill-to). */
export const customerSites = (s, customerId) => sitesByCustomer(s)[customerId] ?? [];
export const paidSites = (s, customerId) =>
  list(s.sites).filter((x) => x.billToId === customerId && x.customerId !== customerId);
export const customerContacts = (s, customerId) => contactsByCustomer(s)[customerId] ?? [];
export const siteContacts = (s, site) =>
  customerContacts(s, site.customerId).filter(
    (c) => c.siteIds.length === 0 || c.siteIds.includes(site.id),
  );

/**
 * When a device is next due and how urgent that is.
 * status: out (out of service), overdue, soon (within 30 days), ok.
 */
export function dueOf(device, today = todayISO()) {
  const next = addMonths(device.lastServiced, device.intervalMonths);
  const days = diffDays(today, next);
  let status = 'ok';
  if (device.condition === 'out_of_service') status = 'out';
  else if (days < 0) status = 'overdue';
  else if (days <= 30) status = 'soon';
  return { next, days, status };
}

export const deviceTypeLabel = (systemType, deviceType) =>
  SYSTEM_TYPES[systemType]?.devices[deviceType]?.label ?? deviceType;

/** Counts for a set of devices: rows, items, overdue, due soon, next date. */
export function summariseDevices(devices, today = todayISO()) {
  const out = { rows: devices.length, items: 0, overdue: 0, soon: 0, out: 0, nextDue: null };
  for (const d of devices) {
    out.items += d.qty;
    const due = dueOf(d, today);
    if (due.status === 'overdue') out.overdue += 1;
    if (due.status === 'soon') out.soon += 1;
    if (due.status === 'out') out.out += 1;
    if (due.status !== 'out' && (out.nextDue === null || due.next < out.nextDue)) out.nextDue = due.next;
  }
  return out;
}

export function siteSummary(s, siteId, today = todayISO()) {
  const devices = devicesBySite(s)[siteId] ?? [];
  return {
    systems: (systemsBySite(s)[siteId] ?? []).length,
    ...summariseDevices(devices, today),
  };
}

/** "overdue", "soon", "ok" or "none" for a whole site (its worst device). */
export const siteHealth = (summary) =>
  summary.overdue > 0 ? 'overdue' : summary.soon > 0 ? 'soon' : summary.rows > 0 ? 'ok' : 'none';

export const contactRoleLabel = (role) => CONTACT_ROLES[role] ?? role;

/**
 * What needs a person's attention. Each item belongs to an area, so the
 * sidebar can show a small count and the bell can list it. Later steps add
 * more sources (approvals, renewals, critical deficiencies, overdue money).
 */
export function attentionItems(s, today = todayISO()) {
  const items = [];
  for (const c of list(s.customers)) {
    if (c.status === 'on_hold') {
      items.push({
        id: `hold_${c.id}`, area: 'customers', tone: 'red',
        title: `${c.name} is on hold`,
        text: 'New work needs the owner\'s approval.',
        to: `/customers/${c.id}`,
      });
    }
  }
  let overdueSites = 0;
  let overdueRows = 0;
  let soonSites = 0;
  for (const site of list(s.sites)) {
    const sum = siteSummary(s, site.id, today);
    if (sum.overdue > 0) {
      overdueSites += 1;
      overdueRows += sum.overdue;
    } else if (sum.soon > 0) soonSites += 1;
  }
  if (overdueSites > 0) {
    items.push({
      id: 'overdue_equipment', area: 'service', tone: 'orange',
      title: `Equipment is overdue for service at ${plural(overdueSites, 'site')}`,
      text: `${plural(overdueRows, 'device group')} past the due date.`,
      to: '/customers/sites?due=overdue',
    });
  }
  if (soonSites > 0) {
    items.push({
      id: 'soon_equipment', area: 'service', tone: 'blue',
      title: `Service due within 30 days at ${plural(soonSites, 'site')}`,
      text: 'Plan the visits so nothing goes overdue.',
      to: '/customers/sites?due=soon',
    });
  }
  return items;
}

/** Everything the global search can find, as flat entries. */
export function buildSearchIndex(s) {
  const entries = [];
  for (const c of list(s.customers)) {
    entries.push({
      type: 'Customers', id: c.id, title: c.name,
      sub: `${c.code} · ${c.segment} · ${c.area}`,
      path: `/customers/${c.id}`, keywords: `${c.code} ${c.group} ${c.trn} ${c.area}`,
    });
  }
  for (const x of list(s.sites)) {
    entries.push({
      type: 'Sites', id: x.id, title: x.name,
      sub: `${s.customers[x.customerId]?.name} · ${x.area}`,
      path: `/customers/sites/${x.id}`, keywords: `${x.address} ${x.type} ${x.civilDefence?.fileNo ?? ''}`,
    });
  }
  for (const p of list(s.contacts)) {
    entries.push({
      type: 'Contacts', id: p.id, title: p.name,
      sub: `${p.title} · ${s.customers[p.customerId]?.name}`,
      path: `/customers/contacts?open=${p.id}`, keywords: `${p.phone} ${p.email}`,
    });
  }
  for (const d of list(s.devices)) {
    const sys = s.systems[d.systemId];
    if (!sys) continue;
    entries.push({
      type: 'Equipment', id: d.id, title: `${d.tag} · ${deviceTypeLabel(sys.type, d.type)}`,
      sub: `${s.sites[d.siteId]?.name} · ${d.location}`,
      path: `/customers/sites/${d.siteId}?tab=equipment&open=${d.id}`, keywords: `${d.serial} ${d.make} ${d.model}`,
    });
  }
  return entries;
}
