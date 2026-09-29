import { useMemo, useState } from 'react';
import { SYSTEM_TYPES } from '@/data/catalog.js';
import { amcSections } from '@/data/amc.js';
import { URGENCY } from '@/data/quotationKinds.js';
import { money, plural } from '@/lib/format.js';
import { importCoverage, saveQuotationDetails } from '@/store/salesActions.js';
import { lineAmount } from '@/store/salesSelectors.js';
import { devicesBySystem, list, summariseDevices, systemsBySite } from '@/store/selectors.js';
import { deficiencyByNumber } from '@/store/links.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Checkbox, Field, Segmented, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer } from '@/ui/Overlay.jsx';
import { contactOptions } from './parts.jsx';

const num = (v) => Number(v || 0);

// Title, person, validity, the terms of the kind, and the general terms.
export function DetailsDrawer({ q, onClose }) {
  const s = useStore();
  const k = q.kindData;
  const form = useForm(
    {
      title: q.title, contactId: q.contactId, validUntil: q.validUntil,
      // project
      durationWeeks: String(k.durationWeeks ?? ''), advancePct: String(k.advancePct ?? ''), retentionPct: String(k.retentionPct ?? ''), cdApproval: k.cdApproval ?? 'contractor',
      // contract
      termMonths: String(k.termMonths ?? '12'), startOn: k.startOn ?? '', visitsPerYear: String(k.visitsPerYear ?? '4'), billing: k.billing ?? 'quarterly', responseHours: String(k.responseHours ?? '4'),
      // repair
      urgency: k.urgency ?? 'normal', deficiencyRef: k.deficiencyRef ?? '', durationDays: String(k.durationDays ?? ''), warrantyMonths: String(k.warrantyMonths ?? ''),
      // supply
      deliveryDays: String(k.deliveryDays ?? ''), deliveryTerms: k.deliveryTerms ?? 'delivered',
      // terms
      payment: q.terms.payment, delivery: q.terms.delivery, warranty: q.terms.warranty, exclusions: q.terms.exclusions, notes: q.terms.notes,
    },
    (v) => ({
      ...(v.title.trim().length >= 3 ? {} : { title: 'Give the quotation a title.' }),
      ...(v.validUntil ? {} : { validUntil: 'Say until when the price holds.' }),
      ...(q.kind === 'project' && !(num(v.advancePct) + num(v.retentionPct) <= 100) ? { advancePct: 'Advance and retention cannot be more than 100% together.' } : {}),
      ...(q.kind === 'repair' && v.deficiencyRef.trim() && !deficiencyByNumber(s, v.deficiencyRef.trim()) ? { deficiencyRef: 'No deficiency has this number.' } : {}),
    }),
  );
  const { values } = form;

  const save = form.submit((v) => {
    const kindData = {
      project: { durationWeeks: num(v.durationWeeks), advancePct: num(v.advancePct), retentionPct: num(v.retentionPct), cdApproval: v.cdApproval },
      contract: { termMonths: num(v.termMonths), startOn: v.startOn, visitsPerYear: num(v.visitsPerYear), billing: v.billing, responseHours: num(v.responseHours) },
      repair: { urgency: v.urgency, deficiencyRef: v.deficiencyRef.trim(), durationDays: num(v.durationDays), warrantyMonths: num(v.warrantyMonths) },
      supply: { deliveryDays: num(v.deliveryDays), deliveryTerms: v.deliveryTerms },
    }[q.kind];
    saveQuotationDetails(
      q.id,
      {
        title: v.title.trim(), contactId: v.contactId, validUntil: v.validUntil,
        kindData: { ...q.kindData, ...kindData },
        terms: { payment: v.payment.trim(), delivery: v.delivery.trim(), warranty: v.warranty.trim(), exclusions: v.exclusions.trim(), notes: v.notes.trim() },
      },
      'Details and terms updated',
    );
    toast('Details saved');
    onClose();
  });

  return (
    <Drawer
      open
      onClose={onClose}
      title="Details and terms"
      subtitle={q.number}
      width="md:w-[560px]"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}
    >
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Title" required error={form.error('title')}><TextInput {...form.bind('title')} /></Field>
        <Field label="Attention of">
          <Combobox options={contactOptions(s, q.customerId)} noun="people" clearable placeholder="Choose a person" searchPlaceholder="Search people" {...form.bind('contactId')} />
        </Field>
        <Field label="Valid until" required error={form.error('validUntil')}><TextInput type="date" {...form.bind('validUntil')} /></Field>

        {q.kind === 'project' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Weeks to complete"><TextInput {...form.bind('durationWeeks')} inputMode="numeric" /></Field>
              <Field label="Advance" error={form.error('advancePct')}><TextInput {...form.bind('advancePct')} inputMode="decimal" suffix="%" /></Field>
              <Field label="Retention"><TextInput {...form.bind('retentionPct')} inputMode="decimal" suffix="%" /></Field>
            </div>
            <Field label="Civil Defence approval of the drawings">
              <Select {...form.bind('cdApproval')} options={[{ value: 'contractor', label: 'We handle it' }, { value: 'customer', label: 'The customer handles it' }]} />
            </Field>
          </>
        )}
        {q.kind === 'contract' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Term"><Select {...form.bind('termMonths')} options={[{ value: '12', label: '12 months' }, { value: '24', label: '24 months' }, { value: '36', label: '36 months' }]} /></Field>
              <Field label="Starts on"><TextInput type="date" {...form.bind('startOn')} /></Field>
              <Field label="Planned visits a year"><Select {...form.bind('visitsPerYear')} options={['1', '2', '4', '6', '12']} /></Field>
              <Field label="Emergency response"><Select {...form.bind('responseHours')} options={[{ value: '2', label: 'Within 2 hours' }, { value: '4', label: 'Within 4 hours' }, { value: '8', label: 'Within 8 hours' }, { value: '24', label: 'Within 24 hours' }]} /></Field>
            </div>
            <Field label="Billing">
              <Segmented label="Billing" value={values.billing} onChange={(v) => form.set('billing', v)} options={[{ value: 'annual', label: 'Yearly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'monthly', label: 'Monthly' }]} />
            </Field>
          </>
        )}
        {q.kind === 'repair' && (
          <>
            <Field label="Urgency">
              <Segmented label="Urgency" value={values.urgency} onChange={(v) => form.set('urgency', v)} options={Object.entries(URGENCY).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="Deficiency reference" hint="The deficiency this repair answers. When the customer accepts, that deficiency is approved." error={form.error('deficiencyRef')}><TextInput {...form.bind('deficiencyRef')} placeholder="DEF-2026-0000" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Days to complete"><TextInput {...form.bind('durationDays')} inputMode="numeric" /></Field>
              <Field label="Warranty (months)"><TextInput {...form.bind('warrantyMonths')} inputMode="numeric" /></Field>
            </div>
          </>
        )}
        {q.kind === 'supply' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Delivery within (days)"><TextInput {...form.bind('deliveryDays')} inputMode="numeric" /></Field>
            <Field label="Delivery terms"><Select {...form.bind('deliveryTerms')} options={[{ value: 'delivered', label: 'Delivered to the site' }, { value: 'collection', label: 'Collected by the customer' }, { value: 'installed', label: 'Delivered and installed' }]} /></Field>
          </div>
        )}

        <Field label="Payment"><TextArea {...form.bind('payment')} rows={2} /></Field>
        <Field label="Delivery and time"><TextArea {...form.bind('delivery')} rows={2} /></Field>
        {q.kind !== 'contract' && <Field label="Warranty"><TextArea {...form.bind('warranty')} rows={2} /></Field>}
        <Field label="Not included"><TextArea {...form.bind('exclusions')} rows={3} /></Field>
        <Field label="Notes for the customer"><TextArea {...form.bind('notes')} rows={2} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

// The systems of the site that a contract covers, with the yearly price of
// each worked out from the equipment register and the maintenance rates.
export function CoverageDrawer({ q, onClose }) {
  const s = useStore();
  const systems = systemsBySite(s)[q.siteId] ?? [];
  const covered = new Set(q.sections.map((x) => x.systemId).filter(Boolean));
  const [chosen, setChosen] = useState(() => systems.filter((x) => !covered.has(x.id)).map((x) => x.id));
  const byCode = useMemo(() => Object.fromEntries(list(s.items).map((i) => [i.code, i])), [s.items]);
  const price = useMemo(
    () =>
      Object.fromEntries(
        systems.map((sys) => {
          const { lines } = amcSections([sys], list(s.devices), byCode);
          return [sys.id, lines.reduce((sum, l) => sum + lineAmount(l), 0)];
        }),
      ),
    [systems, s.devices, byCode],
  );
  const total = chosen.reduce((sum, id) => sum + (price[id] ?? 0), 0);
  const toggle = (id) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const add = () => {
    const result = importCoverage(q.id, chosen);
    toast(`${plural(result.systems, 'system')} added to the quotation`);
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Choose the covered systems"
      subtitle={s.sites[q.siteId]?.name ?? 'No site chosen'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={chosen.length === 0} onClick={add}>
            Add {plural(chosen.length, 'system')} · AED {money(total)}
          </Button>
        </>
      }
    >
      {!q.siteId ? (
        <p className="text-sm text-slate-600">This quotation has no site. Create it again from a site, or add the site to the enquiry, so the equipment register can be used.</p>
      ) : systems.length === 0 ? (
        <p className="text-sm text-slate-600">No system is recorded at this site yet. Add them on the site's Equipment tab first.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-600">
            The quantities are the devices in the equipment register. The yearly price uses the maintenance rates of the catalogue. Devices without a rate are included in the price of their system.
          </p>
          <ul className="divide-y divide-slate-100">
            {systems.map((sys) => {
              const Icon = SYSTEM_TYPES[sys.type].icon;
              const sum = summariseDevices(devicesBySystem(s)[sys.id] ?? []);
              const isCovered = covered.has(sys.id);
              return (
                <li key={sys.id} className="flex items-center gap-3 py-3">
                  <Checkbox checked={isCovered || chosen.includes(sys.id)} onChange={() => !isCovered && toggle(sys.id)} label="" />
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><Icon className="size-[18px]" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{sys.name}</span>
                    <span className="block truncate text-xs text-slate-500">{SYSTEM_TYPES[sys.type].standard} · {plural(sum.items, 'item')}</span>
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    {isCovered ? <span className="text-xs text-slate-500">Covered</span> : price[sys.id] > 0 ? money(price[sys.id]) : <span className="text-xs text-slate-500">No rate</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Drawer>
  );
}
