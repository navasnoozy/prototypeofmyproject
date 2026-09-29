import { useMemo } from 'react';
import { REQUIREMENT, SEVERITY } from '@/data/serviceKinds.js';
import { cn } from '@/lib/cn.js';
import { createDeficiency, declineDeficiency, reportDeficiency, updateDeficiency, verifyDeficiency } from '@/store/serviceActions.js';
import { deviceLabel } from '@/store/serviceSelectors.js';
import { customerContacts, devicesBySystem, list, systemsBySite } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer, Modal } from '@/ui/Overlay.jsx';
import { PhotoStrip } from '@/ui/Photos.jsx';

const dotTone = { blue: 'bg-blue-500', orange: 'bg-orange-500', red: 'bg-red-500' };

// ---- record a deficiency, or change its words ----------------------------------------
//   site      fixed when opened from a site or a job
//   prefill   { systemId, deviceId, title, severity, description } from a failed check
//   deficiency  edit mode: only the words can change
export function DeficiencyDrawer({ siteId = '', jobId = '', prefill = {}, deficiency = null, onClose, onSaved }) {
  const s = useStore();
  const { user } = useSession();
  const editing = Boolean(deficiency);
  const form = useForm(
    {
      photos: deficiency?.photos ?? [],
      siteId: deficiency?.siteId ?? siteId,
      systemId: deficiency?.systemId ?? prefill.systemId ?? '',
      deviceId: deficiency?.deviceId ?? prefill.deviceId ?? '',
      severity: deficiency?.severity ?? prefill.severity ?? 'noncritical',
      title: deficiency?.title ?? prefill.title ?? '',
      description: deficiency?.description ?? prefill.description ?? '',
    },
    (v) => ({
      ...(v.siteId ? {} : { siteId: 'Choose the site.' }),
      ...(v.systemId ? {} : { systemId: 'Choose the system it is in.' }),
      ...(v.title.trim().length >= 5 ? {} : { title: 'Say what is wrong in a few words.' }),
    }),
  );
  const { values } = form;
  const siteChoices = useMemo(
    () => list(s.sites).map((x) => ({ value: x.id, label: x.name, sub: s.customers[x.customerId]?.name })),
    [s.sites, s.customers],
  );
  const systems = values.siteId ? systemsBySite(s)[values.siteId] ?? [] : [];
  const system = s.systems[values.systemId];
  const devices = values.systemId ? devicesBySystem(s)[values.systemId] ?? [] : [];

  const save = form.submit((v) => {
    if (editing) {
      updateDeficiency(deficiency.id, { title: v.title.trim(), description: v.description.trim(), photos: v.photos });
      toast('Deficiency updated');
      onClose();
      return;
    }
    const id = createDeficiency({
      systemId: v.systemId, deviceId: v.deviceId, severity: v.severity, title: v.title.trim(), description: v.description.trim(),
      requirement: REQUIREMENT[system.type], jobId, photos: v.photos,
    });
    toast(v.severity === 'impairment' ? 'Impairment recorded: the system is out of service. Tell the customer now.' : 'Deficiency recorded', { tone: v.severity === 'impairment' ? 'error' : 'default' });
    onSaved?.(id);
    onClose();
  });

  return (
    <Drawer
      open
      onClose={onClose}
      title={editing ? `Edit ${deficiency.number}` : 'Record a deficiency'}
      subtitle={s.sites[values.siteId]?.name}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{editing ? 'Save changes' : 'Record deficiency'}</Button></>}
    >
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        {!editing && !siteId && (
          <Field label="Site" required error={form.error('siteId')}>
            <Combobox options={siteChoices} noun="sites" placeholder="Choose a site" searchPlaceholder="Search sites" {...form.bind('siteId')} onChange={(v) => { form.set('siteId', v); form.set('systemId', ''); form.set('deviceId', ''); }} />
          </Field>
        )}
        <Field label="System" required error={form.error('systemId')}>
          <Select
            {...form.bind('systemId')}
            onChange={(v) => { form.set('systemId', v); form.set('deviceId', ''); }}
            placeholder={values.siteId ? 'Choose the system' : 'Choose a site first'}
            options={systems.map((x) => ({ value: x.id, label: x.name }))}
            disabled={editing || !values.siteId}
          />
        </Field>
        <Field label="Equipment" hint="Leave empty when it is the whole system.">
          <Select
            {...form.bind('deviceId')}
            placeholder="The whole system"
            options={devices.map((d) => ({ value: d.id, label: deviceLabel(s, d) }))}
            disabled={editing || !values.systemId}
          />
        </Field>
        <fieldset disabled={editing} className="min-w-0">
          <legend className="mb-1.5 text-xs font-medium text-slate-700">How serious</legend>
          <div role="radiogroup" aria-label="How serious" className="grid grid-cols-1 gap-2">
            {Object.entries(SEVERITY).map(([value, sev]) => {
              const selected = values.severity === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={editing}
                  onClick={() => form.set('severity', value)}
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border bg-white p-3 text-left transition-colors duration-150 ease-standard disabled:opacity-60',
                    selected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400',
                  )}
                >
                  <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', dotTone[sev.tone])} aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{sev.label}</span>
                    <span className="block text-xs text-slate-500">{sev.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        {values.severity === 'impairment' && !editing && (
          <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-900">
            <strong className="font-semibold">This takes {values.deviceId ? 'the equipment' : 'the system'} out of service.</strong> It shows in the register and in the bell until someone verifies the repair. The owner must be told at once.
          </p>
        )}
        <Field label="What is wrong" required error={form.error('title')}>
          <TextInput {...form.bind('title')} placeholder="For example Three detectors in the corridor do not respond" autoComplete="off" />
        </Field>
        <Field label="Details" hint={system ? `Rule it breaks: ${REQUIREMENT[system.type]}` : undefined}>
          <TextArea {...form.bind('description')} rows={3} placeholder="Where, how many, what you saw, what you think is the cause." />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">Photos (the evidence)</p>
          <PhotoStrip photos={values.photos} editable by={user.id} onChange={(photos) => form.set('photos', photos)} />
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

// ---- tell the customer, in writing -------------------------------------------------------------
const HOW = ['By email, with the service report', 'By letter', 'Signed by the customer on the visit', 'By WhatsApp, then confirmed by email'];
export function ReportDialog({ d, onClose }) {
  const s = useStore();
  const site = s.sites[d.siteId];
  const contacts = customerContacts(s, site.customerId).filter((c) => c.siteIds.length === 0 || c.siteIds.includes(site.id));
  const form = useForm(
    { contactId: contacts.find((c) => c.primary)?.id ?? contacts[0]?.id ?? '', how: HOW[0] },
    (v) => (v.contactId ? {} : { contactId: 'Choose who was told.' }),
  );
  const go = form.submit((v) => {
    reportDeficiency(d.id, { contactId: v.contactId, note: v.how });
    toast('Reported to the customer');
    onClose();
  });
  return (
    <Modal open onClose={onClose} title="Report to the customer"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Record as reported</Button></>}>
      <p className="mt-1">The customer decides on the repair, so tell them in writing. {d.severity === 'impairment' ? 'An impairment must be told at once.' : ''}</p>
      <form onSubmit={go} className="mt-4 grid gap-4">
        <Field label="Told to" required error={form.error('contactId')}>
          <Select {...form.bind('contactId')} placeholder="Choose a person" options={contacts.map((c) => ({ value: c.id, label: `${c.name}, ${c.title}` }))} />
        </Field>
        <Field label="How"><Select {...form.bind('how')} options={HOW} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export function DeclineDialog({ d, onClose }) {
  const form = useForm({ note: '' }, (v) => (v.note.trim() ? {} : { note: 'Write what the customer said.' }));
  const go = form.submit((v) => {
    declineDeficiency(d.id, v.note.trim());
    toast('Recorded: the customer declined the repair');
    onClose();
  });
  return (
    <Modal open onClose={onClose} title="The customer declined the repair"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" onClick={go}>Record as declined</Button></>}>
      <p className="mt-1">The deficiency stays on the record. It is proof that the customer was told and chose not to repair.</p>
      <form onSubmit={go} className="mt-4">
        <Field label="What the customer said" required error={form.error('note')}><TextArea {...form.bind('note')} rows={3} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export function VerifyDialog({ d, onClose }) {
  const form = useForm({ note: '' });
  const go = form.submit((v) => {
    verifyDeficiency(d.id, { note: v.note.trim() });
    toast(d.severity === 'impairment' ? 'Verified: the system is back in service' : 'Verified and closed');
    onClose();
  });
  return (
    <Modal open onClose={onClose} title="Verify the repair?"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Verify and close</Button></>}>
      <p className="mt-1">
        Check that the repair works (by a test or a visit), then close the deficiency.
        {d.severity === 'impairment' ? ' The system or equipment goes back in service.' : ''}
      </p>
      <form onSubmit={go} className="mt-4">
        <Field label="How it was checked (optional)"><TextArea {...form.bind('note')} rows={2} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
