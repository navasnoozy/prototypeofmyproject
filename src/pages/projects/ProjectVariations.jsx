import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { diffDays, fmtDate, todayISO } from '@/lib/dates.js';
import { aed, plural } from '@/lib/format.js';
import { createVariation, decideVariation, deleteVariation, submitVariation, updateVariation } from '@/store/projectActions.js';
import { toast } from '@/store/toast.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Field, Segmented, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer, Modal } from '@/ui/Overlay.jsx';
import { EmptyState } from '@/ui/Page.jsx';
import { Stat, signed } from './parts.jsx';

function VariationDrawer({ p, variation, onClose }) {
  const form = useForm(
    {
      title: variation?.title ?? '', reason: variation?.reason ?? '', value: variation ? String(variation.value) : '',
      cost: variation ? String(variation.cost) : '', days: variation ? String(variation.days) : '0',
    },
    (v) => ({
      ...(v.title.trim().length >= 3 ? {} : { title: 'Give the variation a title.' }),
      ...(v.reason.trim() ? {} : { reason: 'Say why the scope changes.' }),
      ...(v.value !== '' && Number.isFinite(Number(v.value)) ? {} : { value: 'Write the price change (a minus for an omission).' }),
      ...(Number(v.cost) >= 0 || v.cost === '' ? {} : { cost: 'Write our estimated cost.' }),
    }),
  );
  const save = form.submit((v) => {
    const data = { title: v.title.trim(), reason: v.reason.trim(), value: Number(v.value), cost: Number(v.cost || 0), days: Number(v.days || 0) };
    if (variation) updateVariation(p.id, variation.id, data);
    else createVariation(p.id, data);
    toast(variation ? 'Variation saved' : 'Variation drafted');
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title={variation ? `Edit ${variation.number}` : 'New variation'} subtitle={p.number}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{variation ? 'Save' : 'Draft the variation'}</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Title" required error={form.error('title')}><TextInput {...form.bind('title')} autoComplete="off" /></Field>
        <Field label="Why the scope changes" required error={form.error('reason')} hint="The instruction or the change that asks for it."><TextArea {...form.bind('reason')} rows={3} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Change of price" required error={form.error('value')} hint="A minus for an omission."><TextInput {...form.bind('value')} prefix="AED" inputMode="decimal" /></Field>
          <Field label="Our estimated cost" error={form.error('cost')}><TextInput {...form.bind('cost')} prefix="AED" inputMode="decimal" /></Field>
        </div>
        <Field label="Extra days for the project" hint="The planned end moves when the customer approves."><TextInput {...form.bind('days')} inputMode="numeric" /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

function DecideDialog({ p, variation, onClose }) {
  const form = useForm({ result: 'approved', ref: '', note: '' }, (v) => (v.result === 'rejected' && !v.note.trim() ? { note: 'Write the reason the customer gave.' } : {}));
  const approved = form.values.result === 'approved';
  const go = form.submit((v) => {
    decideVariation(p.id, variation.id, { approved: v.result === 'approved', ref: v.ref.trim(), note: v.note.trim() });
    toast(v.result === 'approved' ? `${variation.number} approved: it is now a package of the project` : `${variation.number} rejected`);
    onClose();
  });
  return (
    <Modal open onClose={onClose} title={`The customer's answer on ${variation.number}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={approved ? 'primary' : 'danger'} onClick={go}>{approved ? 'Approved' : 'Rejected'}</Button></>}>
      <form onSubmit={go} className="mt-3 grid grid-cols-1 gap-4">
        <Segmented label="Answer" value={form.values.result} onChange={(v) => form.set('result', v)} options={[{ value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
        {approved && <p className="text-sm text-slate-600">It becomes a package of the project with its own price ({signed(variation.value)}), budget and progress{variation.days > 0 ? `, and the planned end moves by ${plural(variation.days, 'day')}` : ''}.</p>}
        <Field label="Customer's reference"><TextInput {...form.bind('ref')} autoComplete="off" placeholder="Their instruction or order number" /></Field>
        <Field label={approved ? 'Note' : 'Reason given'} required={!approved} error={form.error('note')}><TextArea {...form.bind('note')} rows={2} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export function ProjectVariations({ p, manage }) {
  const [editing, setEditing] = useState(null); // { variation|null }
  const [deciding, setDeciding] = useState(null);
  const today = todayISO();
  const sum = (status) => p.variations.filter((v) => v.status === status).reduce((n, v) => n + v.value, 0);
  const editable = manage && p.phase !== 'complete';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-slate-600">
          A variation is a change of scope asked for by the customer or the consultant. It is priced, sent to the customer and, once approved, becomes a package of the project: it is claimed, budgeted and tracked like the rest.
        </p>
        {editable && <Button icon={PlusIcon} onClick={() => setEditing({ variation: null })}>New variation</Button>}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Approved" value={signed(sum('approved'))} sub={plural(p.variations.filter((v) => v.status === 'approved').length, 'variation')} />
        <Stat label="Waiting for the customer" value={signed(sum('submitted'))} sub={plural(p.variations.filter((v) => v.status === 'submitted').length, 'variation')} />
        <Stat label="Draft" value={signed(sum('draft'))} />
        <Stat label="Rejected" value={signed(sum('rejected'))} />
      </dl>
      {p.variations.length === 0 ? (
        <EmptyState title="No variation yet">A change of scope is drafted here, priced, and sent to the customer.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {p.variations.map((v) => (
            <li key={v.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold tabular-nums text-slate-900">{v.number}</span>
                <Status kind="variation" value={v.status} dot={false} />
                <span className="ml-auto text-sm font-semibold tabular-nums text-slate-900">{signed(v.value)}</span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-slate-900">{v.title}</p>
              <p className="text-sm text-slate-600">{v.reason}</p>
              <p className="mt-2 text-xs text-slate-500">
                Our estimated cost {aed(v.cost)} · {v.days > 0 ? `${plural(v.days, 'extra day')}` : 'no extra time'} · raised {fmtDate(v.raisedOn)}
                {v.status === 'submitted' ? ` · waiting ${plural(diffDays(v.submittedOn, today), 'day')}` : ''}
                {v.decidedOn ? ` · answered ${fmtDate(v.decidedOn)}` : ''}{v.ref ? ` · ${v.ref}` : ''}
              </p>
              {v.note && <p className="mt-1 text-xs text-slate-600">{v.note}</p>}
              {editable && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {v.status === 'draft' && <Button size="xs" variant="primary" onClick={() => { submitVariation(p.id, v.id); toast(`${v.number} submitted to the customer`); }}>Submit to the customer</Button>}
                  {v.status === 'draft' && <Button size="xs" onClick={() => setEditing({ variation: v })}>Edit</Button>}
                  {v.status === 'draft' && <Button size="xs" variant="danger-ghost" onClick={() => deleteVariation(p.id, v.id)}>Delete</Button>}
                  {v.status === 'submitted' && <Button size="xs" variant="primary" onClick={() => setDeciding(v)}>Record the customer's answer</Button>}
                  {v.status === 'rejected' && <Button size="xs" onClick={() => updateVariation(p.id, v.id, { status: 'draft', decidedOn: '', note: '' })}>Revise and send again</Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <VariationDrawer p={p} variation={editing.variation} onClose={() => setEditing(null)} />}
      {deciding && <DecideDialog p={p} variation={deciding} onClose={() => setDeciding(null)} />}
    </div>
  );
}
