import { useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { COMPANY } from '@/data/seed/staff.js';
import { billIssues, billTotals, dueDate, orderTitle } from '@/data/purchaseRules.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { money } from '@/lib/format.js';
import {
  cancelPurchaseOrder, closeOrderShort, decideOrderApproval, markBillPaid, receiveGoods, recordBill, sendPurchaseOrder,
  submitOrderForApproval, updateExpectedDate,
} from '@/store/purchaseActions.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Field, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { Modal } from '@/ui/Overlay.jsx';

// ---- ask for approval ------------------------------------------------------------------------------
export function RequestApprovalDialog({ po, needs, onClose }) {
  const form = useForm({ comment: '' });
  const send = form.submit((v) => {
    submitOrderForApproval(po.id, v.comment.trim());
    toast(`Sent to the ${needs.roleLabel} for approval`);
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Send for approval to the ${needs.roleLabel}?`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={send}>Send for approval</Button></>}
    >
      <ul className="mt-1 list-disc space-y-1 pl-5">{needs.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      <form onSubmit={send} className="mt-4">
        <Field label="A word for the approver" hint="Optional. Why we need it and why now.">
          <TextArea {...form.bind('comment')} rows={3} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- approve or refuse ----------------------------------------------------------------------------------
export function DecisionDialog({ po, approve, onClose }) {
  const form = useForm({ note: '' }, (v) => (approve || v.note.trim() ? {} : { note: 'Say why, so the buyer can fix it.' }));
  const go = form.submit((v) => {
    decideOrderApproval(po.id, { approve, note: v.note.trim() });
    toast(approve ? 'Approved: the order can be sent' : 'Refused: the order is back in draft');
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={approve ? `Approve ${po.number}?` : `Refuse ${po.number}?`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={approve ? 'primary' : 'danger'} onClick={go}>{approve ? 'Approve' : 'Refuse'}</Button></>}
    >
      <form onSubmit={go} className="mt-3">
        <Field label={approve ? 'Note (optional)' : 'Reason'} required={!approve} error={form.error('note')}>
          <TextArea {...form.bind('note')} rows={3} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- send to the supplier -------------------------------------------------------------------------------------
export function SendDialog({ v, onClose }) {
  const { user } = useSession();
  const { po, supplier } = v;
  const first = supplier.contactName.split(' ')[0];
  const form = useForm(
    {
      to: supplier.email,
      expectedOn: po.expectedOn,
      message: `Dear ${first},\n\nPlease supply the items of purchase order ${po.number} (${orderTitle(po)}). Please confirm the price and the delivery day.\n\nKind regards,\n${user.name}\n${COMPANY.name}`,
    },
    (val) => ({ ...(/.+@.+/.test(val.to) ? {} : { to: 'Write the e-mail address of the supplier.' }) }),
  );
  const send = form.submit((val) => {
    sendPurchaseOrder(po.id, { to: val.to.trim(), message: val.message.trim(), expectedOn: val.expectedOn });
    toast('Order sent (simulated: nothing leaves this prototype)');
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Send ${po.number} to the supplier`}
      width="max-w-lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={send}>Send order</Button></>}
    >
      <form onSubmit={send} className="mt-3 grid gap-4">
        <Field label="To" required error={form.error('to')}><TextInput {...form.bind('to')} autoComplete="off" /></Field>
        <Field label="Delivery promised for" hint="If the supplier gave a day, write it. After that day the order shows as late."><TextInput type="date" {...form.bind('expectedOn')} /></Field>
        <Field label="Message"><TextArea {...form.bind('message')} rows={7} /></Field>
        <p className="text-xs text-slate-500">The order is attached as a PDF (simulated). Nothing is really sent from the prototype.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- receive goods ------------------------------------------------------------------------------------------------
export function ReceiveDialog({ v, onClose }) {
  const s = useStore();
  const { po, progress } = v;
  const rows = progress.rows.filter((r) => r.outstanding > 0);
  const [qty, setQty] = useState(() => Object.fromEntries(rows.map((r) => [r.line.id, String(r.outstanding)])));
  const none = rows.every((r) => !(Number(qty[r.line.id]) > 0));
  const form = useForm(
    { on: todayISO(), deliveryNote: '', note: '' },
    (val) => ({ ...(val.on ? {} : { on: 'Say the day the goods came.' }), ...(none ? { lines: 'Write the quantity that arrived for at least one item.' } : {}) }),
  );
  const where =
    po.deliverTo === 'site'
      ? 'Delivered straight to the site: no stock balance changes, the cost is already charged to the order.'
      : po.purpose === 'stock'
        ? `The balance of ${s.locations[po.deliverTo]?.name ?? 'the store'} grows by what arrives, at the cost of this order.`
        : 'Held in the store for the project or the job: no stock balance changes.';
  const go = form.submit((val) => {
    const { number } = receiveGoods(po.id, { on: val.on, deliveryNote: val.deliveryNote.trim(), note: val.note.trim(), lines: rows.map((r) => ({ lineId: r.line.id, qty: Number(qty[r.line.id]) || 0 })) });
    toast(`Goods received: ${number}`);
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Receive goods for ${po.number}`}
      width="max-w-2xl"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Receive goods</Button></>}
    >
      <form onSubmit={go} className="mt-3 grid gap-4">
        <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-700">{where}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Day received" required error={form.error('on')}><TextInput type="date" {...form.bind('on')} max={todayISO()} /></Field>
          <Field label="Delivery note number" hint="From the supplier's paper."><TextInput {...form.bind('deliveryNote')} autoComplete="off" /></Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 flex w-full items-center justify-between text-xs font-medium text-slate-700">
            <span>What arrived</span>
            <button type="button" className="font-medium text-slate-700 hover:underline" onClick={() => setQty(Object.fromEntries(rows.map((r) => [r.line.id, String(r.outstanding)])))}>Everything outstanding</button>
          </legend>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {rows.map((r) => {
              const n = Number(qty[r.line.id]) || 0;
              return (
                <li key={r.line.id} className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-900">{r.line.description}</p>
                    <p className="text-xs tabular-nums text-slate-500">Ordered {r.ordered} · here {r.received} · outstanding {r.outstanding} {r.line.unit}</p>
                    {n > r.outstanding && <p className="text-xs text-orange-700">More than was ordered: accept it only if you agree with the supplier.</p>}
                  </div>
                  <TextInput aria-label={`Quantity received of ${r.line.description}`} inputMode="decimal" value={qty[r.line.id]} onChange={(val) => setQty((q) => ({ ...q, [r.line.id]: val }))} className="!h-10 text-right" />
                </li>
              );
            })}
          </ul>
          {form.error('lines') && <p role="alert" className="mt-1 text-xs text-red-700">{form.error('lines')}</p>}
        </fieldset>
        <Field label="Note" hint="Damage, shortage, who counted it."><TextArea {...form.bind('note')} rows={2} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- record a supplier bill ----------------------------------------------------------------------------------------------
export function BillDialog({ v, onClose }) {
  const { po, progress, receipts, bills, supplier } = v;
  const rows = progress.rows.filter((r) => r.expected - r.billedQty > 0);
  const [lines, setLines] = useState(() => Object.fromEntries(rows.map((r) => [r.line.id, { qty: String(r.toBillQty), cost: String(r.line.cost) }])));
  const [dueOn, setDueOn] = useState('');
  const form = useForm(
    { ref: '', on: todayISO() },
    (val) => ({
      ...(val.ref.trim() ? {} : { ref: 'Write the number printed on the supplier\'s invoice.' }),
      ...(val.on ? {} : { on: 'Say the date of the bill.' }),
      ...(rows.every((r) => !(Number(lines[r.line.id]?.qty) > 0)) ? { lines: 'Write the quantity billed for at least one item.' } : {}),
    }),
  );
  const due = dueOn || dueDate(form.values.on || todayISO(), supplier.terms);
  const draft = rows.map((r) => ({ lineId: r.line.id, qty: Number(lines[r.line.id]?.qty) || 0, cost: Number(lines[r.line.id]?.cost) || 0 }));
  const issues = billIssues(po, receipts, bills, draft);
  const t = billTotals({ lines: draft }, po);
  const set = (id, patch) => setLines((l) => ({ ...l, [id]: { ...l[id], ...patch } }));
  const go = form.submit((val) => {
    recordBill(po.id, { supplierRef: val.ref.trim(), on: val.on, dueOn: due, lines: draft });
    toast(`Bill recorded: due ${fmtDate(due)}`);
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Record the bill of ${supplier.name}`}
      width="max-w-2xl"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Record bill</Button></>}
    >
      <form onSubmit={go} className="mt-3 grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Supplier's invoice number" required error={form.error('ref')}><TextInput {...form.bind('ref')} autoComplete="off" /></Field>
          <Field label="Bill date" required error={form.error('on')}><TextInput type="date" {...form.bind('on')} max={todayISO()} /></Field>
          <Field label="Due on" hint={`${Number(supplier.terms) === 0 ? 'Cash on delivery' : `Net ${supplier.terms} days`}, as agreed.`}><TextInput type="date" value={due} onChange={setDueOn} /></Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-slate-700">What is billed (before VAT)</legend>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {rows.map((r) => (
              <li key={r.line.id} className="grid grid-cols-[minmax(0,1fr)_80px_100px] items-center gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-900">{r.line.description}</p>
                  <p className="text-xs tabular-nums text-slate-500">Ordered {r.ordered} · received {r.received} · billed {r.billedQty} {r.line.unit}</p>
                </div>
                <TextInput aria-label={`Quantity billed of ${r.line.description}`} inputMode="decimal" value={lines[r.line.id].qty} onChange={(val) => set(r.line.id, { qty: val })} className="!h-10 text-right" />
                <TextInput aria-label={`Cost each of ${r.line.description}`} inputMode="decimal" value={lines[r.line.id].cost} onChange={(val) => set(r.line.id, { cost: val })} className="!h-10 text-right" />
              </li>
            ))}
          </ul>
          {form.error('lines') && <p role="alert" className="mt-1 text-xs text-red-700">{form.error('lines')}</p>}
        </fieldset>
        {issues.length > 0 && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
            <p className="flex items-center gap-2 font-semibold"><TriangleAlertIcon className="size-4" aria-hidden="true" />The bill does not match the order and the delivery</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {issues.map((i, k) => <li key={k}>{rows.find((r) => r.line.id === i.lineId)?.line.description}: {i.text}</li>)}
            </ul>
            <p className="mt-1.5 text-xs">You may still record it. Ask the supplier before paying.</p>
          </div>
        )}
        <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate-600">Net</dt><dd className="tabular-nums">{money(t.net)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-600">VAT {po.vatRate}%</dt><dd className="tabular-nums">{money(t.vat)}</dd></div>
          <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold"><dt>Total (AED)</dt><dd className="tabular-nums">{money(t.total)}</dd></div>
        </dl>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- mark a bill as paid -----------------------------------------------------------------------------------------------------
export function PaidDialog({ bill, po, onClose }) {
  const t = billTotals(bill, po);
  const form = useForm({ on: todayISO(), ref: '' }, (v) => (v.on ? {} : { on: 'Say the day it was paid.' }));
  const go = form.submit((v) => {
    markBillPaid(bill.id, { on: v.on, ref: v.ref.trim() });
    toast('Bill marked as paid');
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Mark bill ${bill.supplierRef} as paid`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Mark as paid</Button></>}
    >
      <p>Total <strong className="font-semibold tabular-nums text-slate-900">AED {money(t.total)}</strong>, due {fmtDate(bill.dueOn)}.</p>
      <form onSubmit={go} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Paid on" required error={form.error('on')}><TextInput type="date" {...form.bind('on')} max={todayISO()} /></Field>
        <Field label="Payment reference" hint="Transfer or cheque number."><TextInput {...form.bind('ref')} autoComplete="off" /></Field>
        <p className="text-xs text-slate-500 sm:col-span-2">The prototype only records that the bill is paid. The accounts and the bank are not part of it.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- cancel, close short, move the date ----------------------------------------------------------------------------------------
export function CancelDialog({ po, onClose }) {
  const form = useForm({ reason: '' }, (v) => (v.reason.trim().length >= 3 ? {} : { reason: 'Say why the order is cancelled.' }));
  const go = form.submit((v) => {
    cancelPurchaseOrder(po.id, v.reason.trim());
    toast('Order cancelled');
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Cancel ${po.number}?`}
      footer={<><Button onClick={onClose}>Keep the order</Button><Button variant="danger" onClick={go}>Cancel the order</Button></>}
    >
      {po.status === 'sent' && <p className="mb-3 rounded-xl bg-orange-50 px-3 py-2 text-orange-950">The supplier already has this order. Tell them too: the prototype does not.</p>}
      <form onSubmit={go}>
        <Field label="Reason" required error={form.error('reason')}><TextArea {...form.bind('reason')} rows={3} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export function CloseShortDialog({ po, onClose }) {
  const form = useForm({ note: '' }, (v) => (v.note.trim().length >= 3 ? {} : { note: 'Say what the supplier told you.' }));
  const go = form.submit((v) => {
    closeOrderShort(po.id, v.note.trim());
    toast('Order closed: it expects only what has come');
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Close ${po.number} short?`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Close the order</Button></>}
    >
      <p>The supplier will not send the rest. The order then expects only what has come, and stops showing as late.</p>
      <form onSubmit={go} className="mt-3">
        <Field label="Why" required error={form.error('note')}><TextArea {...form.bind('note')} rows={3} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export function DeliveryDateDialog({ po, onClose }) {
  const form = useForm({ on: po.expectedOn });
  const go = form.submit((v) => {
    updateExpectedDate(po.id, v.on);
    toast('Delivery day changed');
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Delivery day promised"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Save</Button></>}
    >
      <form onSubmit={go} className="mt-2">
        <Field label="Expected on" hint="Leave empty if the supplier gave no day."><TextInput type="date" {...form.bind('on')} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

