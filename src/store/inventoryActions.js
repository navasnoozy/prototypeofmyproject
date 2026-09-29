import { STORE_ID } from '@/data/purchaseKinds.js';
import { round3 } from '@/data/purchaseRules.js';
import { balanceIn, issueLocationOf, postMovement, postTransfer } from './stockCore.js';
import { transact } from './store.js';

// Every change to the items and to the stock: transfers, counts, what is issued
// to projects, and the parts used on jobs. Each one is one transaction; the
// balances are never written, only the rows of the ledger.

// ---- the item master -------------------------------------------------------------------------------
export function saveItem(item) {
  return transact((tx) => {
    const id = item.id ?? tx.id('item');
    const old = item.id ? tx.get('items', id) : null;
    tx.put('items', {
      active: true, kind: 'material', stocked: false, minStore: 0, reorderQty: 0, vanPar: 0, supplierId: '', avgCost: item.cost ?? 0,
      ...old, ...item, id,
    });
    return id;
  });
}

// ---- moving and counting -----------------------------------------------------------------------------
/** [{ itemId, qty }] from one place to another. Returns the number of items moved. */
export function transferStock({ from, to, lines, note = '' }) {
  return transact((tx) => {
    const rows = lines.filter((l) => Number(l.qty) > 0);
    if (rows.length === 0 || from === to) return 0;
    const transferId = tx.next('transfer');
    for (const l of rows) postTransfer(tx, { transferId, itemId: l.itemId, qty: round3(Number(l.qty)), from, to, note });
    return rows.length;
  });
}

/**
 * A count of one place: [{ itemId, counted }]. The difference from the books
 * becomes a movement of the kind "count" with the reason as its note.
 */
export function countStock({ locationId, counts, reason }) {
  return transact((tx) => {
    let changed = 0;
    for (const c of counts) {
      const delta = round3(Number(c.counted) - balanceIn(tx, c.itemId, locationId));
      if (delta === 0) continue;
      postMovement(tx, { kind: 'count', itemId: c.itemId, locationId, qty: delta, note: reason, ref: { kind: 'count' } });
      changed += 1;
    }
    return changed;
  });
}

// ---- stock issued to a project -----------------------------------------------------------------------------
export function issueToProject(projectId, { packageId, itemId, qty, note = '' }) {
  return transact((tx) => {
    const project = tx.get('projects', projectId);
    const item = tx.get('items', itemId);
    const m = postMovement(tx, {
      kind: 'issue_project', itemId, locationId: STORE_ID, qty: -round3(Number(qty)), note,
      ref: { kind: 'project', id: projectId, number: project.number, packageId },
    });
    tx.log('project', projectId, `Issued from stock: ${qty} ${item.unit} ${item.name}`);
    return { short: balanceIn(tx, itemId, STORE_ID) < 0, id: m.id };
  });
}

/** What was issued comes back to the store; the cost of the project goes down by the same amount. */
export function returnToStock(movementId) {
  transact((tx) => {
    const m = tx.get('movements', movementId);
    if (!m || m.returned || m.kind !== 'issue_project') return;
    postMovement(tx, {
      kind: 'return_project', itemId: m.itemId, locationId: m.locationId, qty: Math.abs(m.qty), unitCost: m.unitCost, ref: m.ref, note: 'Returned to stock',
    });
    tx.patch('movements', movementId, { returned: true });
    tx.log('project', m.ref.id, `Returned to stock: ${Math.abs(m.qty)} ${tx.get('items', m.itemId).name}`);
  });
}

// ---- parts used on a job -----------------------------------------------------------------------------------------
/**
 * A part is used on a job. If the item is kept in stock it is taken from the
 * van of the first person on the job (or the store). A balance may go below
 * zero: the work was done, and the count that follows fixes the books.
 */
export function addJobPart(jobId, { itemId, qty }) {
  return transact((tx) => {
    const s = tx.state();
    const job = tx.get('jobs', jobId);
    const item = tx.get('items', itemId);
    const partId = tx.id('prt');
    const amount = round3(Number(qty));
    let fromId = '';
    let movementId = '';
    if (item.stocked) {
      fromId = issueLocationOf(s, job);
      movementId = postMovement(tx, {
        kind: 'issue_job', itemId, locationId: fromId, qty: -amount, ref: { kind: 'job', id: jobId, number: job.number, partId },
      }).id;
    }
    tx.patch('jobs', jobId, { parts: [...job.parts, { id: partId, itemId, description: item.name, unit: item.unit, qty: amount, fromId, movementId }] });
    return { fromId, short: item.stocked && balanceIn(tx, itemId, fromId) < 0, name: s.locations[fromId]?.name ?? '' };
  });
}

export function removeJobPart(jobId, partId) {
  transact((tx) => {
    const job = tx.get('jobs', jobId);
    const part = job.parts.find((p) => p.id === partId);
    if (!part) return;
    const original = part.movementId ? tx.get('movements', part.movementId) : null;
    if (original) {
      postMovement(tx, {
        kind: 'return_job', itemId: part.itemId, locationId: part.fromId, qty: part.qty, unitCost: original.unitCost, ref: original.ref, note: 'Taken off the job',
      });
    }
    tx.patch('jobs', jobId, { parts: job.parts.filter((p) => p.id !== partId) });
  });
}
