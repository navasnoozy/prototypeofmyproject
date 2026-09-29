import { emptyPOApproval, STORE_ID } from '@/data/purchaseKinds.js';
import { dueDate, round3, stockLinesOfReceipt } from '@/data/purchaseRules.js';
import { todayISO } from '@/lib/dates.js';
import { money } from '@/lib/format.js';
import { poApprovalNeeds } from './purchaseSelectors.js';
import { postReceipt } from './stockCore.js';
import { transact } from './store.js';

// Every change to suppliers, purchase orders, deliveries and supplier bills.
// Each one is one transaction and writes its line into the activity lists.

const roleWord = (role) => (role === 'owner' ? 'owner' : 'operations manager');

// ---- suppliers -----------------------------------------------------------------------------------
export function saveSupplier(data) {
  return transact((tx) => {
    const id = data.id ?? tx.id('sup');
    tx.put('suppliers', { active: true, notes: '', ...data, id });
    return id;
  });
}

// ---- writing an order -------------------------------------------------------------------------------
/**
 * Creates a draft, or saves changes to a draft. `lines` come from the form:
 * { id?, itemId, description, unit, qty, cost, packageId }. The VAT rate follows
 * the supplier: an imported supply has none on the invoice.
 */
export function savePurchaseOrder(data) {
  return transact((tx) => {
    const s = tx.state();
    const supplier = tx.get('suppliers', data.supplierId);
    const id = data.id ?? tx.id('po');
    const old = data.id ? tx.get('purchaseOrders', id) : null;
    const lines = data.lines.map((l) => ({
      id: l.id ?? tx.id('pl'), itemId: l.itemId ?? '', description: l.description, unit: l.unit, qty: Number(l.qty), cost: Number(l.cost),
      packageId: data.purpose === 'project' ? l.packageId ?? '' : '',
    }));
    const po = {
      status: 'draft', createdOn: todayISO(), createdBy: s.session.userId, supplierRef: '', sent: null, cancelled: null, closedShort: null,
      approval: emptyPOApproval(),
      ...old,
      id, number: old?.number ?? tx.number('po'), supplierId: data.supplierId, purpose: data.purpose,
      projectId: data.purpose === 'project' ? data.projectId : '', jobId: data.purpose === 'job' ? data.jobId : '',
      deliverTo: data.deliverTo, title: data.title ?? '', expectedOn: data.expectedOn ?? '', notes: data.notes ?? '', supplierRef: data.supplierRef ?? '',
      vatRate: supplier.taxable ? s.settings.vatRate : 0, lines,
    };
    tx.put('purchaseOrders', po);
    tx.log('po', id, old ? 'Order details saved' : 'Purchase order created');
    return id;
  });
}

/** A copy as a new draft with its own number: a repeat order. */
export function duplicatePurchaseOrder(id) {
  return transact((tx) => {
    const old = tx.get('purchaseOrders', id);
    const nid = tx.id('po');
    tx.put('purchaseOrders', {
      ...old, id: nid, number: tx.number('po'), status: 'draft', createdOn: todayISO(), createdBy: tx.state().session.userId,
      expectedOn: '', supplierRef: '', sent: null, cancelled: null, closedShort: null, approval: emptyPOApproval(),
      lines: old.lines.map((l) => ({ ...l, id: tx.id('pl') })),
    });
    tx.log('po', nid, `Copied from ${old.number}`);
    return nid;
  });
}

/** Only a draft that nothing else refers to can be deleted. */
export function deletePurchaseOrder(id) {
  return transact((tx) => {
    const po = tx.get('purchaseOrders', id);
    if (po.status !== 'draft') return false;
    tx.remove('purchaseOrders', id);
    return true;
  });
}

// ---- approval and sending -----------------------------------------------------------------------------
export function submitOrderForApproval(id, comment = '') {
  return transact((tx) => {
    const s = tx.state();
    const po = tx.get('purchaseOrders', id);
    const needs = poApprovalNeeds(po, s);
    if (!needs.needed) return false;
    tx.patch('purchaseOrders', id, {
      status: 'waiting_approval',
      approval: { ...emptyPOApproval(), required: needs.role, reasons: needs.reasons, requestedBy: s.session.userId, requestedOn: todayISO(), comment },
    });
    tx.log('po', id, `Sent for approval to the ${roleWord(needs.role)}`);
    return true;
  });
}

export function decideOrderApproval(id, { approve, note }) {
  transact((tx) => {
    const s = tx.state();
    const po = tx.get('purchaseOrders', id);
    tx.patch('purchaseOrders', id, {
      status: approve ? 'approved' : 'draft',
      approval: { ...po.approval, decision: approve ? 'approved' : 'rejected', decidedBy: s.session.userId, decidedOn: todayISO(), decisionNote: note },
    });
    tx.log('po', id, approve ? `Approved${note ? `: ${note}` : ''}` : `Approval refused: ${note}`);
  });
}

/** Back to draft to change it; a new approval is needed afterwards. */
export function returnOrderToDraft(id, note = 'Returned to draft') {
  transact((tx) => {
    tx.patch('purchaseOrders', id, { status: 'draft', approval: emptyPOApproval() });
    tx.log('po', id, note);
  });
}

export function sendPurchaseOrder(id, { to, message, expectedOn }) {
  transact((tx) => {
    const po = tx.get('purchaseOrders', id);
    const supplier = tx.get('suppliers', po.supplierId);
    tx.patch('purchaseOrders', id, { status: 'sent', sent: { on: todayISO(), to, message }, expectedOn: expectedOn || po.expectedOn });
    tx.log('po', id, `Sent to ${supplier.name}`);
  });
}

export function updateExpectedDate(id, expectedOn) {
  transact((tx) => {
    tx.patch('purchaseOrders', id, { expectedOn });
    tx.log('po', id, expectedOn ? `New delivery date promised: ${expectedOn}` : 'Delivery date removed');
  });
}

export function cancelPurchaseOrder(id, reason) {
  transact((tx) => {
    tx.patch('purchaseOrders', id, { status: 'cancelled', cancelled: { on: todayISO(), reason } });
    tx.log('po', id, `Cancelled: ${reason}`);
  });
}

/** The supplier will not send the rest: the order expects only what has come. */
export function closeOrderShort(id, note) {
  transact((tx) => {
    tx.patch('purchaseOrders', id, { closedShort: { on: todayISO(), note } });
    tx.log('po', id, `Closed short: ${note}`);
  });
}

// ---- deliveries ---------------------------------------------------------------------------------------------
/**
 * Goods arrive against an order. Lines with a quantity of zero are left out.
 * An order for stock adds the goods to the balance of the place it is
 * delivered to, at the cost of the order; an order for a project, a job, or a
 * delivery straight to a site changes no balance, the cost is the order's.
 */
export function receiveGoods(poId, { on, deliveryNote, note, lines }) {
  return transact((tx) => {
    const s = tx.state();
    const po = tx.get('purchaseOrders', poId);
    const id = tx.id('rc');
    const receipt = {
      id, number: tx.number('grn'), poId, on, byId: s.session.userId, deliveryNote: deliveryNote ?? '', note: note ?? '', to: po.deliverTo,
      lines: lines.filter((l) => l.qty > 0).map((l) => ({ lineId: l.lineId, qty: round3(Number(l.qty)) })),
    };
    tx.put('receipts', receipt);
    for (const l of stockLinesOfReceipt(po, receipt, tx.state().items)) {
      postReceipt(tx, {
        itemId: l.itemId, locationId: receipt.to, qty: l.qty, unitCost: l.unitCost, on,
        ref: { kind: 'grn', id, number: receipt.number, poId, poNumber: po.number },
      });
    }
    tx.log('po', poId, `Goods received: ${receipt.number} (${receipt.lines.length} of ${po.lines.length} lines)`);
    return { id, number: receipt.number };
  });
}

// ---- supplier bills -------------------------------------------------------------------------------------------
/** A supplier bill against an order. `lines` are [{ lineId, qty, cost }]; the due date follows the supplier's terms unless given. */
export function recordBill(poId, { supplierRef, on, dueOn, lines }) {
  return transact((tx) => {
    const po = tx.get('purchaseOrders', poId);
    const supplier = tx.get('suppliers', po.supplierId);
    const id = tx.id('bl');
    const rows = lines.filter((l) => l.qty > 0).map((l) => ({ lineId: l.lineId, qty: round3(Number(l.qty)), cost: Number(l.cost) }));
    const net = rows.reduce((n, l) => n + l.qty * l.cost, 0);
    tx.put('bills', {
      id, number: tx.number('bill'), poId, supplierId: po.supplierId, supplierRef, on, dueOn: dueOn || dueDate(on, supplier.terms),
      paidOn: '', paidRef: '', recordedBy: tx.state().session.userId, lines: rows,
    });
    tx.log('po', poId, `Supplier bill ${supplierRef} recorded: AED ${money(net + (net * po.vatRate) / 100)}`);
    return { id };
  });
}

export function markBillPaid(billId, { on, ref }) {
  transact((tx) => {
    const b = tx.get('bills', billId);
    tx.patch('bills', billId, { paidOn: on, paidRef: ref ?? '' });
    tx.log('po', b.poId, `Bill ${b.supplierRef} paid`);
  });
}

// ---- from the reorder panel ---------------------------------------------------------------------------------------
/**
 * One draft order for stock for each supplier group: [{ supplierId, rows: [{ item, qty }] }].
 * Items without a preferred supplier are left for a person to place.
 */
export function createDraftOrders(groups) {
  return transact((tx) => {
    const ids = [];
    for (const g of groups) {
      if (!g.supplierId) continue;
      const supplier = tx.get('suppliers', g.supplierId);
      const s = tx.state();
      const id = tx.id('po');
      tx.put('purchaseOrders', {
        id, number: tx.number('po'), supplierId: g.supplierId, status: 'draft', purpose: 'stock', projectId: '', jobId: '', deliverTo: STORE_ID,
        title: '', createdOn: todayISO(), createdBy: s.session.userId, expectedOn: '', supplierRef: '', notes: 'Made from the reorder suggestions.',
        vatRate: supplier.taxable ? s.settings.vatRate : 0,
        lines: g.rows.map((r) => ({ id: tx.id('pl'), itemId: r.item.id, description: r.item.name, unit: r.item.unit, qty: r.qty, cost: r.item.avgCost ?? r.item.cost, packageId: '' })),
        approval: emptyPOApproval(), sent: null, cancelled: null, closedShort: null,
      });
      tx.log('po', id, 'Draft made from the reorder suggestions');
      ids.push(id);
    }
    return ids;
  });
}

