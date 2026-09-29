import { balancesOf, round3, weightedAverage } from '@/data/purchaseRules.js';
import { STORE_ID } from '@/data/purchaseKinds.js';
import { todayISO } from '@/lib/dates.js';

// The one way a stock balance changes: a row in the movements table. Inside a
// transaction the balances are worked out from the rows as they stand, so two
// changes in one transaction see each other.

/** The quantity of an item in one place. */
export const balanceIn = (tx, itemId, locationId) =>
  balancesOf(tx.all('movements').filter((m) => m.itemId === itemId))[itemId]?.[locationId] ?? 0;

/** The quantity of an item in all places together. */
export const totalOnHand = (tx, itemId) =>
  Object.values(balancesOf(tx.all('movements').filter((m) => m.itemId === itemId))[itemId] ?? {}).reduce((n, q) => round3(n + q), 0);

/**
 * One movement. `qty` has a sign. The cost is the item's average cost unless
 * the caller gives one (a delivery brings its own cost).
 */
export function postMovement(tx, m) {
  const item = tx.get('items', m.itemId);
  const n = tx.next('movement');
  return tx.put('movements', {
    id: `mv_${n}`, on: todayISO(), byId: tx.state().session.userId, note: '', ref: {},
    unitCost: item?.avgCost ?? item?.cost ?? 0, ...m,
  });
}

/** Goods arrive: the average cost moves towards the cost of the delivery, then the balance grows. */
export function postReceipt(tx, { itemId, locationId, qty, unitCost, on, ref }) {
  const item = tx.get('items', itemId);
  const avg = weightedAverage(totalOnHand(tx, itemId), item.avgCost ?? item.cost, qty, unitCost);
  tx.patch('items', itemId, { avgCost: avg });
  return postMovement(tx, { kind: 'receipt', itemId, locationId, qty, unitCost, on, ref });
}

/**
 * One item moves from one place to another: two rows that share the transfer's
 * id. A transfer of several items gives every call the same `transferId`
 * (`tx.next('transfer')` once).
 */
export function postTransfer(tx, { transferId, itemId, qty, from, to, on = todayISO(), note = '' }) {
  const ref = { kind: 'transfer', id: `tr_${transferId}`, from, to };
  postMovement(tx, { kind: 'transfer_out', itemId, locationId: from, qty: -qty, on, note, ref });
  postMovement(tx, { kind: 'transfer_in', itemId, locationId: to, qty, on, note, ref });
}

/** The place a job takes its parts from: the van of the first person on it who has one, else the store. */
export function issueLocationOf(state, job) {
  for (const id of job.assigneeIds) {
    const person = state.staff[id];
    if (person?.van && state.locations[`loc_${id}`]) return `loc_${id}`;
  }
  return STORE_ID;
}
