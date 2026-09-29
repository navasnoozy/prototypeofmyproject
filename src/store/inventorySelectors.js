import { STORE_ID } from '@/data/purchaseKinds.js';
import { balancesOf, orderProgress, reorderQty, round3, stockState, vanShortfall } from '@/data/purchaseRules.js';
import { money, plural, round2 } from '@/lib/format.js';
import { billsOf, receiptsOf } from './purchaseSelectors.js';
import { list } from './selectors.js';

// Pure functions of the Inventory area. Nothing here changes anything.

// ---- balances ------------------------------------------------------------------------------------
const balanceCache = new WeakMap();
/** { itemId: { locationId: quantity } }, worked out once per version of the movements table. */
export function stockMap(s) {
  if (!balanceCache.has(s.movements)) balanceCache.set(s.movements, balancesOf(Object.values(s.movements)));
  return balanceCache.get(s.movements);
}
export const balanceOf = (s, itemId, locationId) => stockMap(s)[itemId]?.[locationId] ?? 0;
export const onHandOf = (s, itemId) => Object.values(stockMap(s)[itemId] ?? {}).reduce((n, q) => round3(n + q), 0);

/** The main store first, then the vans by name. */
export const locationList = (s) =>
  list(s.locations).toSorted((a, b) => (a.kind === 'store' ? -1 : 0) - (b.kind === 'store' ? -1 : 0) || a.name.localeCompare(b.name));
export const vanList = (s) => locationList(s).filter((l) => l.kind === 'van');

/** The van of a person, if the person has one. */
export const vanOfPerson = (s, staffId) => s.locations[`loc_${staffId}`] ?? null;

// ---- what is on order ------------------------------------------------------------------------------
/** Quantity still to come on orders for stock that have been sent: { itemId: qty }. */
export function onOrderMap(s) {
  const map = {};
  for (const po of list(s.purchaseOrders)) {
    if (po.purpose !== 'stock' || po.status !== 'sent') continue;
    for (const r of orderProgress(po, receiptsOf(s, po.id), billsOf(s, po.id)).rows) {
      if (r.line.itemId && r.outstanding > 0) map[r.line.itemId] = round3((map[r.line.itemId] ?? 0) + r.outstanding);
    }
  }
  return map;
}

/** Orders for stock that exist but are not sent yet (draft, waiting, approved): { itemId: [order] }. */
export function pendingOrderMap(s) {
  const map = {};
  for (const po of list(s.purchaseOrders)) {
    if (po.purpose !== 'stock' || !['draft', 'waiting_approval', 'approved'].includes(po.status)) continue;
    for (const l of po.lines) if (l.itemId) (map[l.itemId] ??= []).push(po);
  }
  return map;
}

// ---- the stock table --------------------------------------------------------------------------------------
export function stockRows(s) {
  const map = stockMap(s);
  const onOrder = onOrderMap(s);
  const pending = pendingOrderMap(s);
  const vans = vanList(s);
  return list(s.items)
    .filter((i) => i.stocked)
    .map((item) => {
      const row = map[item.id] ?? {};
      const store = row[STORE_ID] ?? 0;
      const inVans = vans.reduce((n, v) => round3(n + (row[v.id] ?? 0)), 0);
      const ordered = onOrder[item.id] ?? 0;
      return {
        item, row, store, inVans, total: round3(store + inVans), onOrder: ordered,
        state: stockState(item, store, ordered), reorder: reorderQty(item, store, ordered), pending: pending[item.id] ?? [],
        value: round2((store + inVans) * (item.avgCost ?? item.cost)),
      };
    })
    .toSorted((a, b) => a.item.code.localeCompare(b.item.code));
}

export const lowStockRows = (rows) => rows.filter((r) => ['low', 'out'].includes(r.state) && r.reorder > 0);

/** The reorder suggestions grouped by the supplier each item is usually bought from. */
export function reorderGroups(s, rows = stockRows(s)) {
  const groups = {};
  for (const r of lowStockRows(rows)) {
    const key = r.item.supplierId || '';
    (groups[key] ??= { supplierId: key, supplier: s.suppliers[key] ?? null, rows: [] }).rows.push(r);
  }
  return Object.values(groups).toSorted((a, b) => (a.supplier?.name ?? '~').localeCompare(b.supplier?.name ?? '~'));
}

/** What a van lacks against its par levels: [{ item, have, par, need, inStore }]. */
export function vanShortfalls(s, locationId) {
  const map = stockMap(s);
  return list(s.items)
    .filter((i) => i.stocked && i.vanPar > 0)
    .map((item) => {
      const have = map[item.id]?.[locationId] ?? 0;
      return { item, have, par: item.vanPar, need: vanShortfall(item, have), inStore: map[item.id]?.[STORE_ID] ?? 0 };
    })
    .filter((r) => r.need > 0)
    .toSorted((a, b) => a.item.code.localeCompare(b.item.code));
}

/** Balances below zero: someone used stock that was not recorded, so the place needs a count. */
export function negativeBalances(s) {
  const out = [];
  for (const [itemId, row] of Object.entries(stockMap(s))) {
    for (const [locationId, qty] of Object.entries(row)) if (qty < 0) out.push({ item: s.items[itemId], location: s.locations[locationId], qty });
  }
  return out;
}

export const stockValue = (rows) => round2(rows.reduce((n, r) => n + r.value, 0));

// ---- the ledger -----------------------------------------------------------------------------------------------------
export const movementRows = (s) => list(s.movements).toSorted((a, b) => b.on.localeCompare(a.on) || b.id.localeCompare(a.id, undefined, { numeric: true }));

const shortName = (l) => (l?.kind === 'store' ? 'Main store' : l?.name.split(' (')[0] ?? '?');

/** The document a movement belongs to: a label and, when there is one to open, where. */
export function movementRef(s, m) {
  const r = m.ref ?? {};
  if (r.kind === 'grn') return { label: r.number, to: `/purchases/${r.poId}` };
  if (r.kind === 'job') return { label: r.number, to: `/service/jobs/${r.id}` };
  if (r.kind === 'project') return { label: r.number, to: `/projects/${r.id}?tab=materials` };
  if (r.kind === 'transfer') return { label: `${shortName(s.locations[r.from])} to ${shortName(s.locations[r.to])}`, to: '' };
  return { label: '', to: '' };
}

// ---- attention ---------------------------------------------------------------------------------------------------------
export function inventoryAttention(s, today, viewerId) {
  const items = [];
  const rows = stockRows(s);
  const low = lowStockRows(rows);
  if (low.length > 0) {
    items.push({
      id: 'stock_low', area: 'inventory', action: 'stock_alerts', tone: 'orange',
      title: low.length === 1 ? `${low[0].item.name} is below its minimum` : `${plural(low.length, 'item')} below the minimum in the store`,
      text: low.slice(0, 3).map((r) => r.item.code).join(', ') + (low.length > 3 ? '…' : ''),
      to: '/inventory/stock',
    });
  }
  const negative = negativeBalances(s);
  if (negative.length > 0) {
    items.push({
      id: 'stock_negative', area: 'inventory', action: 'stock_control', tone: 'red',
      title: negative.length === 1 ? `${negative[0].location?.name} has a negative balance` : `${plural(negative.length, 'balance')} below zero`,
      text: 'Parts were used that were never recorded as stock. Count the place.',
      to: '/inventory/stock',
    });
  }
  const van = vanOfPerson(s, viewerId);
  if (van) {
    const short = vanShortfalls(s, van.id);
    if (short.length > 0) {
      items.push({
        id: 'van_low', area: 'inventory', action: 'use_van', tone: 'blue',
        title: `Your van is below its usual stock on ${plural(short.length, 'item')}`,
        text: 'Ask the store to top it up before the next job.',
        to: '/inventory/stock',
      });
    }
  }
  return items;
}

/** Items for the global search. */
export function itemSearchEntries(s) {
  return list(s.items).map((i) => ({
    type: 'Items', id: i.id, title: `${i.code} · ${i.name}`,
    sub: `${i.category} · AED ${money(i.price)} per ${i.unit}`, path: `/inventory?open=${i.id}`, keywords: '',
  }));
}
