import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { URGENCY } from '@/data/quotationKinds.js';
import { CALL_VIA } from '@/data/serviceKinds.js';
import { addDays, todayISO } from '@/lib/dates.js';
import { createJob } from '@/store/serviceActions.js';
import { list, systemsBySite } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Section, Segmented, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { Page } from '@/ui/Page.jsx';
import { contactOptions, customerOptions, siteOptions } from '@/pages/sales/parts.jsx';

const ABOUT = {
  purpose: 'Registers a call-out: a customer reports a fault and someone must attend. The job is created and waits for the coordinator to give it a day and the people who go.',
  why: [
    'The form asks first who called and what is wrong, in the customer\'s words, because that is what the technician needs on the way to the site.',
    'It shows at once whether the site has an active contract (and how fast we promised to attend) or not (then the visit is chargeable), so the person on the phone can say it to the customer.',
    'Urgency sets the day the job is needed by; an emergency is needed today. Changing the day by hand is allowed.',
  ],
  assumed: [
    'Whether a call-out under a contract is free or charged depends on the contract; the prototype only says whether a contract exists.',
    'The three urgency words and the default days are samples.',
  ],
};

const DAYS = { normal: 3, urgent: 1, emergency: 0 };

export function JobForm() {
  const s = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetCustomer = s.customers[params.get('customer')] ? params.get('customer') : s.sites[params.get('site')]?.customerId ?? '';
  const presetSite = s.sites[params.get('site')] ? params.get('site') : '';
  const [dueTouched, setDueTouched] = useState(false);

  const form = useForm(
    {
      customerId: presetCustomer,
      siteId: presetSite,
      contactId: list(s.contacts).find((p) => p.customerId === presetCustomer && p.primary)?.id ?? '',
      via: 'phone',
      fault: '',
      title: '',
      urgency: 'normal',
      systemId: '',
      dueOn: addDays(todayISO(), DAYS.normal),
    },
    (v) => ({
      ...(v.customerId ? {} : { customerId: 'Choose the customer who called.' }),
      ...(v.siteId ? {} : { siteId: 'Choose the site with the fault.' }),
      ...(v.fault.trim().length >= 5 ? {} : { fault: 'Write what the customer says is wrong.' }),
      ...(v.title.trim().length >= 3 ? {} : { title: 'Give the job a short title.' }),
      ...(v.dueOn ? {} : { dueOn: 'Say the day it is needed by.' }),
    }),
  );
  const { values } = form;
  const customers = useMemo(() => customerOptions(s), [s]);
  const customer = s.customers[values.customerId];
  const site = s.sites[values.siteId];
  const systems = values.siteId ? systemsBySite(s)[values.siteId] ?? [] : [];
  const contract = list(s.contracts).find((c) => c.siteId === values.siteId && c.status === 'active' && c.endOn >= todayISO());

  const save = form.submit((v) => {
    const id = createJob({
      kind: 'call_out', customerId: v.customerId, siteId: v.siteId, title: v.title.trim(), description: v.fault.trim(),
      urgency: v.urgency, dueOn: v.dueOn, systemIds: v.systemId ? [v.systemId] : [],
      reportedBy: s.contacts[v.contactId]?.name ?? '', via: v.via, fault: v.fault.trim(),
    });
    toast('Call-out registered: it needs planning');
    navigate(`/service/jobs/${id}`, { replace: true });
  });

  return (
    <Page
      title="New call-out"
      facts="A customer reports a fault"
      back="/service/jobs"
      about={ABOUT}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" onClick={save}>Register call-out</Button>
        </div>
      }
    >
      <form onSubmit={save} className="mx-auto max-w-4xl">
        <Section title="Who called">
          <Field label="Customer" required span={2} error={form.error('customerId')}>
            <Combobox
              options={customers} noun="customers" placeholder="Choose a customer" searchPlaceholder="Search customers"
              {...form.bind('customerId')}
              onChange={(v) => {
                form.set('customerId', v);
                form.set('siteId', '');
                form.set('systemId', '');
                form.set('contactId', list(s.contacts).find((p) => p.customerId === v && p.primary)?.id ?? '');
              }}
            />
          </Field>
          {customer?.status === 'on_hold' && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-900 md:col-span-2">
              <strong className="font-semibold">This customer is on hold.</strong> {customer.holdReason} Ask the owner before you send anyone.
            </p>
          )}
          <Field label="Site" required error={form.error('siteId')}>
            <Combobox
              options={siteOptions(s, values.customerId)} noun="sites" placeholder={values.customerId ? 'Choose a site' : 'Choose a customer first'}
              searchPlaceholder="Search sites" {...form.bind('siteId')} disabled={!values.customerId}
              onChange={(v) => { form.set('siteId', v); form.set('systemId', ''); }}
            />
          </Field>
          <Field label="Who called" error={form.error('contactId')}>
            <Combobox options={contactOptions(s, values.customerId)} noun="people" placeholder={values.customerId ? 'Choose a person' : 'Choose a customer first'} searchPlaceholder="Search people" clearable {...form.bind('contactId')} disabled={!values.customerId} />
          </Field>
          {site && (
            contract ? (
              <p className="rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-900 md:col-span-2">
                <strong className="font-semibold">Under contract {contract.number}.</strong> Promised response: within {contract.responseHours} hours.
              </p>
            ) : (
              <p className="rounded-xl bg-orange-50 px-4 py-2.5 text-sm text-orange-950 md:col-span-2">
                <strong className="font-semibold">No active contract at this site.</strong> The visit is chargeable: tell the customer before sending anyone.
              </p>
            )
          )}
        </Section>

        <Section title="What is wrong">
          <Field label="What the customer says" required span={2} error={form.error('fault')} hint="In the customer's words: where, what happens, since when.">
            <TextArea {...form.bind('fault')} rows={3} placeholder="For example The alarm goes off in the lift lobby two or three times a night." />
          </Field>
          <Field label="Short title" required span={2} error={form.error('title')} hint="What the technician sees in the list.">
            <TextInput {...form.bind('title')} placeholder="For example False alarms in the lift lobby" autoComplete="off" />
          </Field>
          <Field label="Which system" hint="Optional, if the customer knows." error={form.error('systemId')}>
            <Select {...form.bind('systemId')} placeholder={values.siteId ? 'Not known yet' : 'Choose a site first'} options={systems.map((x) => ({ value: x.id, label: x.name }))} disabled={!values.siteId} />
          </Field>
          <Field label="How it came in">
            <Select {...form.bind('via')} options={Object.entries(CALL_VIA).map(([value, label]) => ({ value, label }))} />
          </Field>
        </Section>

        <Section title="How urgent">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-slate-700">Urgency</p>
            <Segmented
              label="Urgency"
              value={values.urgency}
              onChange={(v) => {
                form.set('urgency', v);
                if (!dueTouched) form.set('dueOn', addDays(todayISO(), DAYS[v]));
              }}
              options={Object.entries(URGENCY).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <Field label="Needed by" required error={form.error('dueOn')}>
            <TextInput
              type="date"
              value={values.dueOn}
              onChange={(v) => { setDueTouched(true); form.set('dueOn', v); }}
              onBlur={form.bind('dueOn').onBlur}
            />
          </Field>
        </Section>
        <button type="submit" className="hidden" />
      </form>
    </Page>
  );
}
