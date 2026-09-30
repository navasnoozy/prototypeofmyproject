import { useMemo } from 'react';
import { COMPANY } from '@/data/seed/staff.js';
import { fmtDate } from '@/lib/dates.js';
import { money, plural } from '@/lib/format.js';
import { sendReminder, sendStatement } from '@/store/billingActions.js';
import { recipientsOf } from '@/store/billingSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Checkbox, Field, TextArea, useForm } from '@/ui/Form.jsx';
import { Modal } from '@/ui/Overlay.jsx';

function useRecipients(customerId) {
  const s = useStore();
  return useMemo(() => recipientsOf(s, customerId), [s, customerId]);
}

function Recipients({ contacts, form }) {
  const toggle = (id) => form.set('to', form.values.to.includes(id) ? form.values.to.filter((x) => x !== id) : [...form.values.to, id]);
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium text-slate-700">To</legend>
      <div className="grid grid-cols-1 gap-2">
        {contacts.map((p) => <Checkbox key={p.id} checked={form.values.to.includes(p.id)} onChange={() => toggle(p.id)} label={`${p.name} · ${p.email}`} hint={p.role === 'accounts' ? 'Accounts' : undefined} />)}
        {contacts.length === 0 && <p className="text-sm text-slate-500">This customer has no contact with an e-mail address. Add one first.</p>}
      </div>
      {form.error('to') && <p role="alert" className="mt-1 text-xs text-red-700">{form.error('to')}</p>}
    </fieldset>
  );
}

// ---- send the statement ---------------------------------------------------------------------------------------------------
export function SendStatementDialog({ customer, owed, from, until, onClose }) {
  const { user } = useSession();
  const contacts = useRecipients(customer.id);
  const first = contacts[0]?.name.split(' ')[0];
  const form = useForm(
    {
      to: contacts.slice(0, 1).map((p) => p.id),
      message: `Dear ${first ?? 'Sir or Madam'},\n\nPlease find the statement of your account with us from ${fmtDate(from)} to ${fmtDate(until)}. ${owed > 0 ? `It shows AED ${money(owed)} owed on our invoices.` : 'Nothing is owed on our invoices.'}\n\nPlease tell us if anything does not agree with your records.\n\nKind regards,\n${user.name}\n${COMPANY.name}`,
    },
    (v) => (v.to.length > 0 ? {} : { to: 'Choose who receives it.' }),
  );
  const send = form.submit((v) => {
    sendStatement(customer.id, { to: v.to, from: fmtDate(from), until: fmtDate(until) });
    toast('Statement sent (simulated: nothing leaves this prototype)');
    onClose();
  });
  return (
    <Modal open onClose={onClose} title={`Send the statement to ${customer.name}`} width="max-w-lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={send}>Send statement</Button></>}>
      <form onSubmit={send} className="mt-3 grid gap-4">
        <Recipients contacts={contacts} form={form} />
        <Field label="Message"><TextArea {...form.bind('message')} rows={7} /></Field>
        <p className="text-xs text-slate-500">The statement is attached as a PDF (simulated). Nothing is really sent from the prototype.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- remind about all the overdue invoices ------------------------------------------------------------------------------------
export function RemindAllDialog({ customer, overdue, onClose }) {
  const { user } = useSession();
  const contacts = useRecipients(customer.id);
  const first = contacts[0]?.name.split(' ')[0];
  const list = overdue.map((v) => `${v.inv.number}, AED ${money(v.balance)}, ${plural(v.overdueDays, 'day')} overdue`).join('\n');
  const form = useForm(
    {
      to: contacts.slice(0, 1).map((p) => p.id),
      message: `Dear ${first ?? 'Sir or Madam'},\n\nOur records show that these tax invoices are overdue:\n\n${list}\n\nPlease let us know when we may expect the payment, or if something is not clear.\n\nKind regards,\n${user.name}\n${COMPANY.name}`,
    },
    (v) => (v.to.length > 0 ? {} : { to: 'Choose who receives it.' }),
  );
  const send = form.submit((v) => {
    for (const x of overdue) sendReminder(x.inv.id, { to: v.to, message: v.message.trim() });
    toast(`${plural(overdue.length, 'reminder')} sent (simulated)`);
    onClose();
  });
  return (
    <Modal open onClose={onClose} title={`Remind ${customer.name} about ${plural(overdue.length, 'overdue invoice')}`} width="max-w-lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={send}>Send reminder</Button></>}>
      <form onSubmit={send} className="mt-3 grid gap-4">
        <Recipients contacts={contacts} form={form} />
        <Field label="Message"><TextArea {...form.bind('message')} rows={9} /></Field>
        <p className="text-xs text-slate-500">One message covers all the overdue invoices. It is written into the history of each of them as a reminder. Nothing is really sent from the prototype.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
