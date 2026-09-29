import { todayISO } from '@/lib/dates.js';
import { endContract, recordContractApproval, submitContractToAuthority, updateContract } from '@/store/serviceActions.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Field, Segmented, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer, Modal } from '@/ui/Overlay.jsx';

// ---- submit to the authority -----------------------------------------------------
export function SubmitDialog({ c, onClose }) {
  const form = useForm(
    { reference: `CD-AMC-${70000 + Math.floor(Math.random() * 900)}`, submittedOn: todayISO() },
    (v) => ({ ...(v.reference.trim() ? {} : { reference: 'Write the reference of the submission.' }), ...(v.submittedOn ? {} : { submittedOn: 'Say the day.' }) }),
  );
  const go = form.submit((v) => {
    submitContractToAuthority(c.id, { reference: v.reference.trim(), submittedOn: v.submittedOn });
    toast('Submitted: now waiting for the authority');
    onClose();
  });
  return (
    <Modal open onClose={onClose} title="Submit the contract to the authority?"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Submit</Button></>}>
      <p className="mt-1">In the UAE the authority approves each annual maintenance contract and expects visits during the year. This step is a sample: the exact way in each emirate is confirmed in the research of phase 2.</p>
      <form onSubmit={go} className="mt-4 grid gap-4">
        <Field label="Reference of the submission" required error={form.error('reference')}><TextInput {...form.bind('reference')} autoComplete="off" /></Field>
        <Field label="Submitted on" required error={form.error('submittedOn')}><TextInput type="date" {...form.bind('submittedOn')} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- the authority's answer -----------------------------------------------------------
export function DecisionDialog({ c, onClose }) {
  const form = useForm(
    { result: 'approved', reference: c.cdApproval.reference, note: '' },
    (v) => (v.result === 'rejected' && !v.note.trim() ? { note: 'Write what the authority asked for.' } : {}),
  );
  const approved = form.values.result === 'approved';
  const go = form.submit((v) => {
    recordContractApproval(c.id, { approved: v.result === 'approved', reference: v.reference.trim(), note: v.note.trim() });
    toast(v.result === 'approved' ? 'Approved: the contract is active and its visits are released' : 'Refused: the contract is back in draft');
    onClose();
  });
  return (
    <Modal open onClose={onClose} title="The authority's answer"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={approved ? 'primary' : 'danger'} onClick={go}>{approved ? 'Approved: activate' : 'Refused'}</Button></>}>
      <form onSubmit={go} className="mt-3 grid gap-4">
        <Segmented label="Answer" value={form.values.result} onChange={(v) => form.set('result', v)} options={[{ value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Refused' }]} />
        <Field label="Approval reference"><TextInput {...form.bind('reference')} autoComplete="off" /></Field>
        <Field label={approved ? 'Note (optional)' : 'What the authority asked for'} required={!approved} error={form.error('note')}><TextArea {...form.bind('note')} rows={3} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- end -------------------------------------------------------------------------------
const END_REASONS = ['The customer did not renew', 'The customer cancelled', 'Replaced by a new contract', 'The site was sold or closed', 'Other'];
export function EndDialog({ c, onClose }) {
  const form = useForm({ reason: '' }, (v) => (v.reason ? {} : { reason: 'Choose the reason.' }));
  const go = form.submit((v) => {
    endContract(c.id, v.reason);
    toast('Contract ended; its upcoming visits are cancelled');
    onClose();
  });
  return (
    <Modal open onClose={onClose} title={`End ${c.number}?`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" onClick={go}>End contract</Button></>}>
      <p className="mt-1">The visits that are not done are cancelled. The history stays.</p>
      <form onSubmit={go} className="mt-4">
        <Field label="Reason" required error={form.error('reason')}><Select {...form.bind('reason')} options={END_REASONS} placeholder="Choose a reason" /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- edit the terms of a draft --------------------------------------------------------------
export function TermsDrawer({ c, onClose }) {
  const form = useForm(
    {
      startOn: c.startOn, termMonths: String(c.termMonths), visitsPerYear: String(c.visitsPerYear), responseHours: String(c.responseHours),
      billing: c.billing, annualFee: String(c.annualFee),
    },
    (v) => ({
      ...(v.startOn ? {} : { startOn: 'Say when the contract starts.' }),
      ...(Number(v.annualFee) > 0 ? {} : { annualFee: 'Write the fee for one year.' }),
    }),
  );
  const { values } = form;
  const save = form.submit((v) => {
    updateContract(c.id, {
      startOn: v.startOn, termMonths: Number(v.termMonths), visitsPerYear: Number(v.visitsPerYear), responseHours: Number(v.responseHours),
      billing: v.billing, annualFee: Number(v.annualFee),
    }, 'Terms updated: the visit plan and the billing plan were made again');
    toast('Terms saved: the plans follow them');
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Edit the terms" subtitle={c.number}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Starts on" required error={form.error('startOn')}><TextInput type="date" {...form.bind('startOn')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Term"><Select {...form.bind('termMonths')} options={[{ value: '12', label: '12 months' }, { value: '24', label: '24 months' }, { value: '36', label: '36 months' }]} /></Field>
          <Field label="Planned visits a year"><Select {...form.bind('visitsPerYear')} options={['1', '2', '4', '6', '12']} /></Field>
        </div>
        <Field label="Emergency response"><Select {...form.bind('responseHours')} options={[{ value: '2', label: 'Within 2 hours' }, { value: '4', label: 'Within 4 hours' }, { value: '8', label: 'Within 8 hours' }, { value: '24', label: 'Within 24 hours' }]} /></Field>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-slate-700">Billing</p>
          <Segmented label="Billing" value={values.billing} onChange={(v) => form.set('billing', v)} options={[{ value: 'annual', label: 'Yearly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'monthly', label: 'Monthly' }]} />
        </div>
        <Field label="Fee for one year" hint="Before VAT." required error={form.error('annualFee')}><TextInput {...form.bind('annualFee')} prefix="AED" inputMode="decimal" /></Field>
        <p className="text-xs text-slate-500">While the contract is a draft, the visit plan and the billing plan follow these terms.</p>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

