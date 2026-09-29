import { useMemo } from 'react';
import { ANSWER_VIA, LOST_REASONS } from '@/data/quotationKinds.js';
import { COMPANY } from '@/data/seed/staff.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { decideApproval, recordAnswer, sendQuotation, submitForApproval } from '@/store/salesActions.js';
import { quotationLabel } from '@/store/salesSelectors.js';
import { customerContacts } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Checkbox, Field, Segmented, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { Modal } from '@/ui/Overlay.jsx';
import { contactOptions } from './parts.jsx';

// ---- ask for approval ------------------------------------------------------------------
export function RequestApprovalDialog({ q, needs, onClose }) {
  const form = useForm({ comment: '' });
  const send = form.submit((v) => {
    submitForApproval(q.id, v.comment.trim());
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
        <Field label="A word for the approver" hint="Optional. Why the price is right, what the customer expects.">
          <TextArea {...form.bind('comment')} rows={3} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- approve or refuse -------------------------------------------------------------------
export function DecisionDialog({ q, approve, onClose }) {
  const form = useForm({ note: '' }, (v) => (approve || v.note.trim() ? {} : { note: 'Say why, so the preparer can fix it.' }));
  const go = form.submit((v) => {
    decideApproval(q.id, { approve, note: v.note.trim() });
    toast(approve ? 'Approved: it can be sent' : 'Refused: the quotation is back in draft');
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={approve ? `Approve ${quotationLabel(q)}?` : `Refuse ${quotationLabel(q)}?`}
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

// ---- send to the customer -------------------------------------------------------------------
export function SendDialog({ q, onClose }) {
  const s = useStore();
  const { user } = useSession();
  const contacts = useMemo(() => customerContacts(s, q.customerId).filter((p) => p.email), [s, q.customerId]);
  const first = s.contacts[q.contactId]?.name.split(' ').slice(-1)[0];
  const form = useForm(
    {
      to: contacts.some((p) => p.id === q.contactId) ? [q.contactId] : contacts.slice(0, 1).map((p) => p.id),
      message: `Dear ${first ? `Mr/Ms ${first}` : 'Sir or Madam'},\n\nPlease find our quotation ${quotationLabel(q)} for ${q.title}. It is valid until ${fmtDate(q.validUntil)}.\n\nPlease call me if you have any question.\n\nKind regards,\n${user.name}\n${COMPANY.name}`,
    },
    (v) => (v.to.length > 0 ? {} : { to: 'Choose who receives it.' }),
  );
  const send = form.submit((v) => {
    sendQuotation(q.id, { to: v.to, message: v.message.trim() });
    toast('Quotation sent (simulated: nothing leaves this prototype)');
    onClose();
  });
  const toggle = (id) => form.set('to', form.values.to.includes(id) ? form.values.to.filter((x) => x !== id) : [...form.values.to, id]);
  return (
    <Modal
      open
      onClose={onClose}
      title="Send to the customer"
      width="max-w-lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={send}>Send quotation</Button></>}
    >
      <form onSubmit={send} className="mt-3 grid gap-4">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-slate-700">To</legend>
          <div className="grid grid-cols-1 gap-2">
            {contacts.map((p) => (
              <Checkbox key={p.id} checked={form.values.to.includes(p.id)} onChange={() => toggle(p.id)} label={`${p.name} · ${p.email}`} />
            ))}
            {contacts.length === 0 && <p className="text-sm text-slate-500">This customer has no contact with an e-mail address. Add one first.</p>}
          </div>
          {form.error('to') && <p role="alert" className="mt-1 text-xs text-red-700">{form.error('to')}</p>}
        </fieldset>
        <Field label="Message"><TextArea {...form.bind('message')} rows={8} /></Field>
        <p className="text-xs text-slate-500">The quotation is attached as a PDF (simulated). Nothing is really sent from the prototype.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- record the customer's answer --------------------------------------------------------------
export function AnswerDialog({ q, onClose }) {
  const s = useStore();
  const form = useForm(
    { result: 'accepted', on: todayISO(), via: 'email', reference: '', byContactId: q.contactId, reason: '', note: '' },
    (v) => ({
      ...(v.on ? {} : { on: 'Say when the answer came.' }),
      ...(v.result === 'rejected' && !v.reason ? { reason: 'Choose the reason.' } : {}),
    }),
  );
  const { values } = form;
  const accepted = values.result === 'accepted';
  const save = form.submit((v) => {
    recordAnswer(q.id, {
      result: v.result, on: v.on, via: v.via, reference: v.reference.trim(), byContactId: v.byContactId, byName: '',
      reason: v.result === 'rejected' ? v.reason : '', note: v.note.trim(),
    });
    toast(v.result === 'accepted' ? 'Marked as accepted' : 'Marked as rejected');
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Record the customer's answer"
      width="max-w-lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={accepted ? 'primary' : 'danger'} onClick={save}>{accepted ? 'Mark as accepted' : 'Mark as rejected'}</Button></>}
    >
      <form onSubmit={save} className="mt-3 grid gap-4">
        <Segmented
          label="Answer"
          value={values.result}
          onChange={(v) => form.set('result', v)}
          options={[{ value: 'accepted', label: 'Accepted' }, { value: 'rejected', label: 'Rejected' }]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Answer came on" required error={form.error('on')}><TextInput type="date" {...form.bind('on')} /></Field>
          <Field label="How it came">
            <Select {...form.bind('via')} options={Object.entries(ANSWER_VIA).map(([value, label]) => ({ value, label }))} />
          </Field>
        </div>
        <Field label="From">
          <Combobox options={contactOptions(s, q.customerId)} noun="people" clearable placeholder="Choose a person" searchPlaceholder="Search people" {...form.bind('byContactId')} />
        </Field>
        {accepted ? (
          <Field label="Customer order number" hint="The LPO or reference on the customer's paper, if there is one.">
            <TextInput {...form.bind('reference')} autoComplete="off" />
          </Field>
        ) : (
          <Field label="Reason" required error={form.error('reason')}>
            <Select {...form.bind('reason')} options={LOST_REASONS} placeholder="Choose a reason" />
          </Field>
        )}
        <Field label="Note"><TextArea {...form.bind('note')} rows={2} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
