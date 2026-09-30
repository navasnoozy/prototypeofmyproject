import { useMemo } from 'react';
import { InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { PAYMENT_METHODS, termsDays } from '@/data/billingKinds.js';
import { dueFor } from '@/data/billingRules.js';
import { COMPANY } from '@/data/seed/staff.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { money, round2 } from '@/lib/format.js';
import { issueInvoice, recordPayment, sendInvoice, sendReminder } from '@/store/billingActions.js';
import { accountOf, recipientsOf } from '@/store/billingSelectors.js';
import { balanceOf as stockBalance } from '@/store/inventorySelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Checkbox, Field, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { Modal } from '@/ui/Overlay.jsx';

const Note = ({ tone = 'orange', icon: Icon = TriangleAlertIcon, children }) => (
  <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${tone === 'orange' ? 'bg-orange-50 text-orange-950' : tone === 'red' ? 'bg-red-50 text-red-900' : 'bg-slate-50 text-slate-700'}`}>
    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

// ---- issue ---------------------------------------------------------------------------------------------------
export function IssueDialog({ v, onClose }) {
  const s = useStore();
  const { inv, totals, customer } = v;
  const account = accountOf(s, inv.customerId);
  const after = round2(account.balance + totals.total);
  const days = termsDays(inv.terms);
  const stockLines = inv.source.kind === 'supply' ? inv.lines.filter((l) => s.items[l.itemId]?.stocked) : [];
  const short = stockLines.filter((l) => stockBalance(s, l.itemId, 'loc_store') < l.qty);
  const go = () => {
    const { number, short: missing } = issueInvoice(inv.id);
    toast(`${number} issued`);
    if (missing.length > 0) toast(`The store did not have enough ${missing.join(', ')}: the balance is below zero and needs a count`, { tone: 'error' });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Issue this invoice?"
      width="max-w-lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Issue invoice</Button></>}
    >
      <div className="mt-1 space-y-3">
        <p>
          <strong className="font-semibold text-slate-900">AED {money(totals.total)}</strong> to {customer?.name}. The invoice gets its number and today's date, it is due on{' '}
          <strong className="font-semibold text-slate-900">{fmtDate(dueFor(todayISO(), days))}</strong> ({days === 0 ? 'cash' : `net ${days} days`}), and it can no longer be changed. A mistake is corrected with a credit note.
        </p>
        {account.limit > 0 && after > account.limit && (
          <Note>This takes {customer?.name} above its credit limit: it owes AED {money(account.balance)} now, AED {money(after)} with this invoice, and the limit is AED {money(account.limit)}.</Note>
        )}
        {customer?.status === 'on_hold' && <Note tone="red">{customer.name} is on hold. The invoice for work that is done is still issued; new work needs the owner.</Note>}
        {customer?.type === 'company' && !customer.trn && <Note tone="slate" icon={InfoIcon}>The customer has no TRN on record. A tax invoice to a VAT-registered company must carry it: add it to the customer first if it has one.</Note>}
        {stockLines.length > 0 && (
          <Note tone={short.length > 0 ? 'orange' : 'slate'} icon={short.length > 0 ? TriangleAlertIcon : InfoIcon}>
            The goods leave the main store now: {stockLines.map((l) => `${l.qty} ${s.items[l.itemId].code}`).join(', ')}.
            {short.length > 0 && ` The store has fewer than that of ${short.map((l) => s.items[l.itemId].code).join(', ')}: the balance will go below zero.`}
          </Note>
        )}
      </div>
    </Modal>
  );
}

// ---- send ----------------------------------------------------------------------------------------------------------
export function SendDialog({ v, onClose }) {
  const s = useStore();
  const { user } = useSession();
  const { inv, totals } = v;
  const contacts = useMemo(() => recipientsOf(s, inv.customerId), [s, inv.customerId]);
  const job = inv.source.kind === 'job' ? s.jobs[inv.source.jobId] : null;
  // The person the invoice is addressed to; if none, the accounts person of the customer.
  const first = (contacts.find((p) => p.id === inv.contactId) ?? contacts[0])?.name.split(' ')[0];
  const form = useForm(
    {
      to: contacts.some((p) => p.id === inv.contactId) ? [inv.contactId] : contacts.slice(0, 1).map((p) => p.id),
      report: Boolean(job?.report),
      message: `Dear ${first ?? 'Sir or Madam'},\n\nPlease find our tax invoice ${inv.number} for AED ${money(totals.total)}, ${inv.title}. It is due on ${fmtDate(inv.dueOn)}.\n\nPlease call me if you have any question.\n\nKind regards,\n${user.name}\n${COMPANY.name}`,
    },
    (val) => (val.to.length > 0 ? {} : { to: 'Choose who receives it.' }),
  );
  const send = form.submit((val) => {
    sendInvoice(inv.id, { to: val.to, message: val.message.trim(), attached: val.report && job?.report ? [job.report.number] : [] });
    toast('Invoice sent (simulated: nothing leaves this prototype)');
    onClose();
  });
  const toggle = (id) => form.set('to', form.values.to.includes(id) ? form.values.to.filter((x) => x !== id) : [...form.values.to, id]);
  return (
    <Modal open onClose={onClose} title={`Send ${inv.number} to the customer`} width="max-w-lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={send}>Send invoice</Button></>}>
      <form onSubmit={send} className="mt-3 grid gap-4">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-slate-700">To</legend>
          <div className="grid grid-cols-1 gap-2">
            {contacts.map((p) => (
              <Checkbox key={p.id} checked={form.values.to.includes(p.id)} onChange={() => toggle(p.id)} label={`${p.name} · ${p.email}`} hint={p.role === 'accounts' ? 'Accounts' : undefined} />
            ))}
            {contacts.length === 0 && <p className="text-sm text-slate-500">This customer has no contact with an e-mail address. Add one first.</p>}
          </div>
          {form.error('to') && <p role="alert" className="mt-1 text-xs text-red-700">{form.error('to')}</p>}
        </fieldset>
        {job?.report && <Checkbox checked={form.values.report} onChange={(val) => form.set('report', val)} label={`Attach the service report ${job.report.number}`} hint="The report proves the work; sending both together saves a question." />}
        <Field label="Message"><TextArea {...form.bind('message')} rows={7} /></Field>
        <p className="text-xs text-slate-500">The invoice is attached as a PDF (simulated). Nothing is really sent from the prototype.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- record a payment ---------------------------------------------------------------------------------------------------
export function PaymentDialog({ v, onClose }) {
  const { inv, balance } = v;
  const form = useForm(
    { amount: String(balance), on: todayISO(), method: 'bank_transfer', reference: '', note: '' },
    (val) => ({
      ...(Number(val.amount) > 0 ? {} : { amount: 'Write the amount that was paid.' }),
      ...(val.on ? {} : { on: 'Say the day the money came.' }),
      ...(val.on && val.on < inv.issuedOn ? { on: 'The money cannot come before the invoice.' } : {}),
    }),
  );
  const paying = Number(form.values.amount) || 0;
  const extra = round2(paying - balance);
  const go = form.submit((val) => {
    const { number } = recordPayment({
      customerId: inv.customerId, amount: Number(val.amount), on: val.on, method: val.method, reference: val.reference.trim(), note: val.note.trim(),
      allocations: [{ invoiceId: inv.id, amount: Math.min(Number(val.amount), balance) }],
    });
    toast(`Receipt ${number} made`);
    onClose();
  });
  return (
    <Modal open onClose={onClose} title={`Record a payment for ${inv.number}`} width="max-w-lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Record payment</Button></>}>
      <form onSubmit={go} className="mt-3 grid gap-4">
        <p className="text-sm text-slate-600">The invoice still owes <strong className="font-semibold tabular-nums text-slate-900">AED {money(balance)}</strong>. A receipt is made for the money.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Amount received" required error={form.error('amount')}><TextInput {...form.bind('amount')} prefix="AED" inputMode="decimal" /></Field>
          <Field label="Day received" required error={form.error('on')}><TextInput type="date" {...form.bind('on')} max={todayISO()} /></Field>
          <Field label="How it was paid"><Select {...form.bind('method')} options={Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="Reference" hint="Transfer, cheque or card number."><TextInput {...form.bind('reference')} autoComplete="off" /></Field>
        </div>
        {paying > 0 && paying < balance && <Note tone="slate" icon={InfoIcon}>A part payment: AED {money(round2(balance - paying))} stays owed and the invoice shows as part paid.</Note>}
        {extra > 0.004 && <Note tone="slate" icon={InfoIcon}>AED {money(extra)} is more than this invoice owes. It stays on the receipt as money on account; you can allocate it to another invoice later.</Note>}
        <Field label="Note"><TextInput {...form.bind('note')} autoComplete="off" /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- remind --------------------------------------------------------------------------------------------------------------------
export function ReminderDialog({ v, onClose }) {
  const s = useStore();
  const { user } = useSession();
  const { inv, balance, overdueDays } = v;
  const level = inv.reminders.length + 1;
  const contacts = useMemo(() => recipientsOf(s, inv.customerId), [s, inv.customerId]);
  const account = contacts[0];
  const form = useForm(
    {
      to: account ? [account.id] : [],
      message: `Dear ${account?.name.split(' ')[0] ?? 'Sir or Madam'},\n\nOur tax invoice ${inv.number} of AED ${money(balance)} was due on ${fmtDate(inv.dueOn)}${overdueDays > 0 ? ` and is ${overdueDays} days overdue` : ''}. ${level > 1 ? 'This is a further reminder. ' : ''}Please let us know when we may expect the payment, or if something is not clear.\n\nKind regards,\n${user.name}\n${COMPANY.name}`,
    },
    (val) => (val.to.length > 0 ? {} : { to: 'Choose who receives it.' }),
  );
  const send = form.submit((val) => {
    sendReminder(inv.id, { to: val.to, message: val.message.trim() });
    toast(`Reminder ${level} sent (simulated)`);
    onClose();
  });
  const toggle = (id) => form.set('to', form.values.to.includes(id) ? form.values.to.filter((x) => x !== id) : [...form.values.to, id]);
  return (
    <Modal open onClose={onClose} title={`Send reminder ${level} for ${inv.number}`} width="max-w-lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={send}>Send reminder</Button></>}>
      <form onSubmit={send} className="mt-3 grid gap-4">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-slate-700">To</legend>
          <div className="grid grid-cols-1 gap-2">
            {contacts.map((p) => <Checkbox key={p.id} checked={form.values.to.includes(p.id)} onChange={() => toggle(p.id)} label={`${p.name} · ${p.email}`} hint={p.role === 'accounts' ? 'Accounts' : undefined} />)}
          </div>
          {form.error('to') && <p role="alert" className="mt-1 text-xs text-red-700">{form.error('to')}</p>}
        </fieldset>
        <Field label="Message"><TextArea {...form.bind('message')} rows={7} /></Field>
        <p className="text-xs text-slate-500">Nothing is really sent from the prototype. The reminder is written into the history of the invoice.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

