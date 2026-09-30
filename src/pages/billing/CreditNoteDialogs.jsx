import { useMemo } from 'react';
import { InfoIcon } from 'lucide-react';
import { documentTotals, unappliedOf } from '@/data/billingRules.js';
import { money } from '@/lib/format.js';
import { applyCreditNote, decideCreditApproval, issueCreditNote, submitCreditForApproval } from '@/store/billingActions.js';
import { invoiceView } from '@/store/billingSelectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Field, TextArea, useForm } from '@/ui/Form.jsx';
import { Drawer, Modal } from '@/ui/Overlay.jsx';
import { AllocationEditor, openInvoicesOf, useAllocation } from './Allocation.jsx';

// ---- issue ----------------------------------------------------------------------------------------------------
export function IssueCreditDialog({ cn, onClose }) {
  const s = useStore();
  const inv = s.invoices[cn.invoiceId];
  const v = invoiceView(s, inv);
  const total = documentTotals(cn).total;
  const owed = Math.max(0, v.balance);
  const take = Math.min(total, owed);
  const rest = Math.round((total - take) * 100) / 100;
  const go = () => {
    const number = issueCreditNote(cn.id);
    toast(`${number} issued`);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Issue this credit note?"
      width="max-w-lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Issue credit note</Button></>}
    >
      <div className="mt-1 space-y-3">
        <p>
          <strong className="font-semibold text-slate-900">AED {money(total)}</strong> is credited to {s.customers[cn.customerId]?.name}. The credit note gets its number and today's date, and it can no longer be changed.
        </p>
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {take > 0
              ? `AED ${money(take)} is taken off ${inv.number}, which owes AED ${money(owed)} now.`
              : `${inv.number} is already paid in full, so the whole credit stays on account for the next invoice.`}
            {take > 0 && rest > 0 && ` The other AED ${money(rest)} stays on account.`}
          </span>
        </p>
      </div>
    </Modal>
  );
}

// ---- ask for approval ---------------------------------------------------------------------------------------------
export function CreditApprovalRequestDialog({ cn, needs, onClose }) {
  const form = useForm({ comment: '' });
  const send = form.submit((v) => {
    submitCreditForApproval(cn.id, v.comment.trim());
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
        <Field label="A word for the approver" hint="Optional. Why the customer is credited.">
          <TextArea {...form.bind('comment')} rows={3} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- approve or refuse ------------------------------------------------------------------------------------------------
export function CreditDecisionDialog({ cn, approve, onClose }) {
  const form = useForm({ note: '' }, (v) => (approve || v.note.trim() ? {} : { note: 'Say why, so the maker can fix it.' }));
  const go = form.submit((v) => {
    const number = decideCreditApproval(cn.id, { approve, note: v.note.trim() });
    toast(approve ? `Approved: ${number} issued` : 'Refused: the credit note is back in draft');
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={approve ? 'Approve and issue this credit note?' : 'Refuse this credit note?'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={approve ? 'primary' : 'danger'} onClick={go}>{approve ? 'Approve and issue' : 'Refuse'}</Button></>}
    >
      {approve && <p className="mt-1">AED {money(documentTotals(cn).total)} is credited to the customer. Approving issues the credit note at once.</p>}
      <form onSubmit={go} className="mt-3">
        <Field label={approve ? 'Note (optional)' : 'Reason'} required={!approve} error={form.error('note')}>
          <TextArea {...form.bind('note')} rows={3} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- give the credit that is on account to invoices ------------------------------------------------------------------------
export function ApplyCreditDrawer({ cn, onClose }) {
  const s = useStore();
  const free = unappliedOf(cn, documentTotals(cn).total);
  const open = useMemo(() => openInvoicesOf(s, cn.customerId), [s, cn.customerId]);
  const alloc = useAllocation(open, free);
  const go = () => {
    if (alloc.rows.length === 0 || alloc.left < -0.004) return;
    applyCreditNote(cn.id, alloc.rows);
    toast(`AED ${money(alloc.allocated)} of credit taken off ${alloc.rows.length === 1 ? 'one invoice' : `${alloc.rows.length} invoices`}`);
    onClose();
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title={`Apply ${cn.number}`}
      subtitle={`AED ${money(free)} of the credit is on account`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go} disabled={alloc.rows.length === 0 || alloc.left < -0.004}>Take off the invoices</Button></>}
    >
      <AllocationEditor open={open} amount={free} alloc={alloc} noun="credit" />
    </Drawer>
  );
}
