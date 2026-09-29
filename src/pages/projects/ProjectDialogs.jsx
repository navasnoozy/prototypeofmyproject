import { equipmentFromQuotation, dlpEnd } from '@/data/projectRules.js';
import { SYSTEM_TYPES } from '@/data/catalog.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { handOver, holdProject, updateProject } from '@/store/projectActions.js';
import { customerContacts, list } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Field, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer, Modal } from '@/ui/Overlay.jsx';

// ---- change the facts of the project -----------------------------------------------------------------
export function EditProjectDrawer({ p, onClose }) {
  const s = useStore();
  const locked = p.phase !== 'approvals'; // the terms of the contract change only before the work starts
  const staff = (roles) => list(s.staff).filter((x) => roles.includes(x.roleKey)).map((x) => ({ value: x.id, label: `${x.name} · ${x.title}` }));
  const form = useForm(
    {
      title: p.title, engineerId: p.engineerId, supervisorId: p.supervisorId, lpo: p.lpo, startOn: p.startOn, endOn: p.endOn,
      advancePct: String(p.advancePct), retentionPct: String(p.retentionPct), dlpMonths: String(p.dlpMonths), notes: p.notes,
    },
    (v) => ({
      ...(v.title.trim().length >= 3 ? {} : { title: 'Give the project a title.' }),
      ...(v.endOn >= v.startOn ? {} : { endOn: 'The end cannot be before the start.' }),
      ...(Number(v.advancePct) >= 0 && Number(v.retentionPct) >= 0 && Number(v.advancePct) + Number(v.retentionPct) <= 100 ? {} : { advancePct: 'Advance and retention cannot be more than 100% together.' }),
    }),
  );
  const save = form.submit((v) => {
    updateProject(p.id, {
      title: v.title.trim(), engineerId: v.engineerId, supervisorId: v.supervisorId, lpo: v.lpo.trim(), startOn: v.startOn, endOn: v.endOn,
      ...(locked ? {} : { advancePct: Number(v.advancePct), retentionPct: Number(v.retentionPct), dlpMonths: Number(v.dlpMonths) }), notes: v.notes.trim(),
    });
    toast('Project details saved');
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Edit the project" subtitle={p.number}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Title" required error={form.error('title')}><TextInput {...form.bind('title')} /></Field>
        <Field label="Project engineer"><Select {...form.bind('engineerId')} options={staff(['engineer', 'manager', 'owner'])} /></Field>
        <Field label="Site supervisor" hint="Who leads the teams on site."><Select {...form.bind('supervisorId')} placeholder="Nobody yet" options={staff(['technician', 'engineer'])} /></Field>
        <Field label="Customer's order number"><TextInput {...form.bind('lpo')} autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><TextInput type="date" {...form.bind('startOn')} /></Field>
          <Field label="Planned end" error={form.error('endOn')}><TextInput type="date" {...form.bind('endOn')} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Advance" error={form.error('advancePct')}><TextInput {...form.bind('advancePct')} suffix="%" inputMode="decimal" disabled={locked} /></Field>
          <Field label="Retention"><TextInput {...form.bind('retentionPct')} suffix="%" inputMode="decimal" disabled={locked} /></Field>
          <Field label="Liability"><TextInput {...form.bind('dlpMonths')} suffix="mo" inputMode="numeric" disabled={locked} /></Field>
        </div>
        {locked && <p className="text-xs text-slate-500">The payment terms are fixed once the design and approvals phase is over.</p>}
        <Field label="Notes"><TextArea {...form.bind('notes')} rows={3} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

// ---- put on hold -----------------------------------------------------------------------------------------
export function HoldDialog({ p, onClose }) {
  const form = useForm({ reason: '' }, (v) => (v.reason.trim() ? {} : { reason: 'Write why the project is on hold.' }));
  const go = form.submit((v) => {
    holdProject(p.id, v.reason.trim());
    toast('Project put on hold');
    onClose();
  });
  return (
    <Modal open onClose={onClose} title={`Put ${p.number} on hold?`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" onClick={go}>Put on hold</Button></>}>
      <p className="mt-1">Work stops on the plan; nothing is deleted. The reason shows on the project until it resumes.</p>
      <form onSubmit={go} className="mt-4">
        <Field label="Why" required error={form.error('reason')}><TextArea {...form.bind('reason')} rows={2} placeholder="For example The customer stopped the site while the drawings change." /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---- hand over -------------------------------------------------------------------------------------------------
export function HandoverDialog({ p, onClose, onDone }) {
  const s = useStore();
  const q = s.quotations[p.quotationId];
  const contacts = customerContacts(s, p.customerId).filter((c) => c.siteIds.length === 0 || c.siteIds.includes(p.siteId));
  const equipment = equipmentFromQuotation(q, s.items);
  const first = contacts.find((c) => c.id === p.contactId) ?? contacts[0];
  const form = useForm({ contactId: first?.id ?? '' }, (v) => (v.contactId ? {} : { contactId: 'Choose who takes over.' }));
  const who = s.contacts[form.values.contactId];
  const end = dlpEnd(todayISO(), p.dlpMonths);
  const go = form.submit(() => {
    const result = handOver(p.id, { receivedBy: who.name, receivedRole: who.title });
    toast(`Handed over: ${plural(result.systemIds.length, 'system')} added to the equipment register`, {
      action: result.quotationId ? { label: 'Open the contract offer', onClick: () => onDone(result.quotationId) } : undefined,
    });
    onClose();
  });
  return (
    <Modal open onClose={onClose} title="Hand over to the customer" width="max-w-lg"
      footer={<><Button onClick={onClose}>Not yet</Button><Button variant="primary" onClick={go}>Hand over</Button></>}>
      <div className="mt-1 space-y-4">
        <p>This is the moment the customer takes over the systems. Three things happen:</p>
        <ol className="list-decimal space-y-2 pl-5 text-slate-700">
          <li>
            The systems go into the equipment register of {s.sites[p.siteId]?.name}, so they can be serviced:
            <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
              {equipment.map((e) => (
                <li key={e.type}>{SYSTEM_TYPES[e.type].label}: {e.devices.map((d) => `${d.qty} × ${SYSTEM_TYPES[e.type].devices[d.deviceType].label.toLowerCase()}`).join(', ')}</li>
              ))}
            </ul>
          </li>
          <li>The defects liability period starts and ends on {fmtDate(end)}. The retention is held until then.</li>
          <li>A maintenance contract is offered: a draft quotation is made for the new systems.</li>
        </ol>
        <form onSubmit={go}>
          <Field label="Taken over by" required error={form.error('contactId')}>
            <Select {...form.bind('contactId')} placeholder="Choose a person" options={contacts.map((c) => ({ value: c.id, label: `${c.name}, ${c.title}` }))} />
          </Field>
          <button type="submit" className="hidden" />
        </form>
      </div>
    </Modal>
  );
}
