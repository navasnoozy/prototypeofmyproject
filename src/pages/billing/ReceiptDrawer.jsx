import { useMemo } from 'react';
import { Link } from 'react-router';
import { PAYMENT_METHODS } from '@/data/billingKinds.js';
import { unallocatedOf } from '@/data/billingRules.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { money } from '@/lib/format.js';
import { allocatePayment, recordPayment } from '@/store/billingActions.js';
import { receivables } from '@/store/billingSelectors.js';
import { activityFor } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { ActivityList } from '@/ui/Activity.jsx';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer } from '@/ui/Overlay.jsx';
import { Card, DefinitionList } from '@/ui/Page.jsx';
import { customerOptions, staffName } from '@/pages/sales/parts.jsx';
import { AllocationEditor, openInvoicesOf, useAllocation } from './Allocation.jsx';

// ---- a new receipt ---------------------------------------------------------------------------------------
// The customer, the amount, and which invoices it pays. The invoices are filled
// oldest first; the person can change any row; what no invoice takes stays on the
// receipt as money on account.
export function NewReceiptDrawer({ presetCustomer = '', onClose, onSaved }) {
  const s = useStore();
  const form = useForm(
    { customerId: s.customers[presetCustomer] ? presetCustomer : '', amount: '', on: todayISO(), method: 'bank_transfer', reference: '', note: '' },
    (v) => ({
      ...(v.customerId ? {} : { customerId: 'Choose the customer that paid.' }),
      ...(Number(v.amount) > 0 ? {} : { amount: 'Write the amount that was received.' }),
      ...(v.on ? {} : { on: 'Say the day the money came.' }),
    }),
  );
  const { values } = form;
  const amount = Number(values.amount) > 0 ? Number(values.amount) : 0;
  const open = useMemo(() => (values.customerId ? openInvoicesOf(s, values.customerId) : []), [s, values.customerId]);
  const alloc = useAllocation(open, amount);

  const customers = useMemo(() => {
    const owing = Object.fromEntries(receivables(s).map((a) => [a.customer.id, a.balance]));
    return customerOptions(s)
      .map((o) => ({ ...o, sub: owing[o.value] > 0 ? `owes AED ${money(owing[o.value])}` : o.sub, owes: owing[o.value] ?? 0 }))
      .toSorted((a, b) => b.owes - a.owes || a.label.localeCompare(b.label));
  }, [s]);

  const save = form.submit((v) => {
    if (alloc.left < -0.004) return;
    const { id, number } = recordPayment({
      customerId: v.customerId, amount: Number(v.amount), on: v.on, method: v.method, reference: v.reference.trim(), note: v.note.trim(), allocations: alloc.rows,
    });
    toast(`Receipt ${number} made`);
    onSaved(id);
  });

  return (
    <Drawer
      open
      onClose={onClose}
      title="New receipt"
      subtitle="Money that a customer paid"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={alloc.left < -0.004}>Record receipt</Button></>}
    >
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Customer" required error={form.error('customerId')} hint="Customers that owe money are at the top.">
          <Combobox
            options={customers}
            noun="customers"
            placeholder="Choose the customer"
            searchPlaceholder="Search customers"
            {...form.bind('customerId')}
            onChange={(id) => { form.set('customerId', id); alloc.reset(); }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount received" required error={form.error('amount')}><TextInput {...form.bind('amount')} prefix="AED" inputMode="decimal" /></Field>
          <Field label="Day received" required error={form.error('on')}><TextInput type="date" {...form.bind('on')} max={todayISO()} /></Field>
          <Field label="How it was paid"><Select {...form.bind('method')} options={Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="Reference" hint="Transfer, cheque or card number."><TextInput {...form.bind('reference')} autoComplete="off" /></Field>
        </div>
        {values.customerId && <AllocationEditor open={open} amount={amount} alloc={alloc} />}
        <Field label="Note"><TextInput {...form.bind('note')} autoComplete="off" placeholder="For example one transfer for two buildings" /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

// ---- one receipt --------------------------------------------------------------------------------------------
export function ReceiptViewDrawer({ payment, onClose, onAllocate }) {
  const s = useStore();
  const { may, access } = useSession();
  const customer = s.customers[payment.customerId];
  const free = unallocatedOf(payment);
  const canAllocate = may('receive_payments') && free > 0.004 && openInvoicesOf(s, payment.customerId).length > 0;
  return (
    <Drawer
      open
      onClose={onClose}
      title={payment.number}
      subtitle={`AED ${money(payment.amount)} from ${customer?.name ?? ''}`}
      footer={<><Button onClick={onClose}>Close</Button>{canAllocate && <Button variant="primary" onClick={onAllocate}>Allocate the money on account</Button>}</>}
    >
      <div className="space-y-5">
        <DefinitionList
          cols={1}
          items={[
            { label: 'Customer', value: customer && (access('customers') ? <Link to={`/customers/${customer.id}`} className="font-medium underline-offset-2 hover:underline">{customer.name}</Link> : customer.name) },
            { label: 'Received', value: fmtDate(payment.on) },
            { label: 'How', value: PAYMENT_METHODS[payment.method] },
            { label: 'Reference', value: payment.reference },
            { label: 'Recorded by', value: staffName(s, payment.byId) },
            payment.note && { label: 'Note', value: payment.note },
          ]}
        />
        <Card title="What it paid" className="!rounded-xl" bodyClassName="!px-4">
          <ul className="-my-2 divide-y divide-slate-100">
            {payment.allocations.map((a) => {
              const inv = s.invoices[a.invoiceId];
              return (
                <li key={a.invoiceId} className="flex flex-wrap items-center justify-between gap-x-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <Link to={`/billing/${a.invoiceId}`} className="font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline">{inv?.number}</Link>
                    <span className="block truncate text-xs text-slate-500">{inv?.title}</span>
                  </span>
                  <span className="tabular-nums text-slate-900">{money(a.amount)}</span>
                </li>
              );
            })}
            {free > 0.004 && (
              <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-orange-800">Money on account (no invoice yet)</span>
                <span className="font-medium tabular-nums text-orange-800">{money(free)}</span>
              </li>
            )}
            {payment.allocations.length === 0 && free <= 0.004 && <li className="py-2.5 text-sm text-slate-500">Nothing.</li>}
          </ul>
        </Card>
        <Card title="What happened" className="!rounded-xl"><ActivityList entries={activityFor(s, 'payment', payment.id)} limit={8} /></Card>
      </div>
    </Drawer>
  );
}

// ---- give the money on account to invoices ----------------------------------------------------------------------
export function AllocateDrawer({ payment, onClose }) {
  const s = useStore();
  const free = unallocatedOf(payment);
  const open = useMemo(() => openInvoicesOf(s, payment.customerId), [s, payment.customerId]);
  const alloc = useAllocation(open, free);
  const go = () => {
    if (alloc.rows.length === 0 || alloc.left < -0.004) return;
    allocatePayment(payment.id, alloc.rows);
    toast(`AED ${money(alloc.allocated)} allocated to ${alloc.rows.length === 1 ? 'one invoice' : `${alloc.rows.length} invoices`}`);
    onClose();
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title={`Allocate ${payment.number}`}
      subtitle={`AED ${money(free)} of AED ${money(payment.amount)} is on account`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go} disabled={alloc.rows.length === 0 || alloc.left < -0.004}>Allocate</Button></>}
    >
      <AllocationEditor open={open} amount={free} alloc={alloc} />
    </Drawer>
  );
}
