import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { KINDS } from '@/data/quotationKinds.js';
import { cn } from '@/lib/cn.js';
import { createQuotation } from '@/store/salesActions.js';
import { list } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Section, TextInput, useForm } from '@/ui/Form.jsx';
import { Page } from '@/ui/Page.jsx';
import { contactOptions, customerOptions, siteOptions } from './parts.jsx';

const ABOUT = {
  purpose: 'Starts a quotation. First the kind, because it decides what the quotation asks for; then the customer, the site and the person.',
  why: [
    'One quotation with four kinds (record 39, point 4): the project has a bill of quantities, the contract covers systems from the equipment register, the repair lists parts and labour, the supply lists items.',
    'Starting from an enquiry fills in customer, site, contact and kind for you, and moves the enquiry on to "estimating".',
    'The quotation starts as a draft with the usual terms of its kind; nothing is sent until you say so.',
  ],
  assumed: ['The default terms of each kind are samples; the company keeps its own templates (Sales owns "quotation templates and terms").'],
};

const titleFor = (kind, siteName) =>
  ({
    project: siteName ? `Installation at ${siteName}` : 'Installation',
    contract: siteName ? `Maintenance contract, ${siteName}` : 'Maintenance contract',
    repair: siteName ? `Repair at ${siteName}` : 'Repair',
    supply: 'Supply of equipment',
  })[kind];

export function QuotationNew() {
  const s = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const enquiry = s.enquiries[params.get('enquiry')] ?? null;
  // "Make repair quotation" on a deficiency arrives with ?deficiency=DEF-...
  const deficiency = list(s.deficiencies).find((d) => d.number === params.get('deficiency')) ?? null;
  const presetCustomer = enquiry?.customerId ?? (s.customers[params.get('customer')] ? params.get('customer') : '');
  const presetSite = enquiry?.siteId ?? params.get('site') ?? '';
  const [titleTouched, setTitleTouched] = useState(Boolean(enquiry) || Boolean(deficiency));

  const form = useForm(
    {
      kind: enquiry?.kind ?? (deficiency ? 'repair' : KINDS[params.get('kind')] ? params.get('kind') : ''),
      customerId: presetCustomer,
      siteId: s.sites[presetSite] ? presetSite : '',
      contactId: enquiry?.contactId ?? (deficiency?.reportedTo || list(s.contacts).find((p) => p.customerId === presetCustomer && p.primary)?.id) ?? '',
      enquiryId: enquiry?.id ?? '',
      title: enquiry?.title ?? (deficiency ? `Repair: ${deficiency.title}` : KINDS[params.get('kind')] ? titleFor(params.get('kind'), s.sites[presetSite]?.name) : ''),
    },
    (v) => ({
      ...(v.kind ? {} : { kind: 'Choose the kind of quotation.' }),
      ...(v.customerId ? {} : { customerId: 'Choose the customer.' }),
      ...(v.title.trim().length >= 3 ? {} : { title: 'Give the quotation a title.' }),
    }),
  );
  const { values } = form;
  const customers = useMemo(() => customerOptions(s), [s]);
  const enquiries = useMemo(
    () =>
      list(s.enquiries)
        .filter((e) => e.customerId === values.customerId && !['won', 'lost'].includes(e.status))
        .map((e) => ({ value: e.id, label: e.title, sub: `${e.number} · ${KINDS[e.kind].label}` })),
    [s.enquiries, values.customerId],
  );
  const customer = s.customers[values.customerId];

  // Until the person types a title, it follows the kind and the site.
  const suggest = (kind, siteId) => {
    if (!titleTouched) form.set('title', kind ? titleFor(kind, s.sites[siteId]?.name) : '');
  };

  const save = form.submit((v) => {
    const id = createQuotation({ ...v, title: v.title.trim(), deficiencyRef: v.kind === 'repair' ? deficiency?.number : undefined });
    toast('Quotation created as a draft');
    navigate(`/sales/quotations/${id}`, { replace: true });
  });

  return (
    <Page
      title="New quotation"
      facts={enquiry ? `For ${enquiry.number}` : deficiency ? `For deficiency ${deficiency.number}` : 'Project, contract, repair or supply'}
      back={enquiry ? `/sales/${enquiry.id}` : deficiency ? `/service/deficiencies/${deficiency.id}` : '/sales/quotations'}
      about={ABOUT}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" onClick={save}>Create draft</Button>
        </div>
      }
    >
      <form onSubmit={save} className="mx-auto max-w-4xl">
        {deficiency && (
          <p className="mb-5 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-950">
            <strong className="font-semibold">Repair for {deficiency.number}.</strong> {deficiency.title}. When the customer accepts this quotation, the deficiency is approved and the repair job can be created.
          </p>
        )}
        <Section title="What kind of quotation" cols={1}>
          <div role="radiogroup" aria-label="Kind of quotation" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(KINDS).map(([value, k]) => {
              const Icon = k.icon;
              const selected = values.kind === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    form.set('kind', value);
                    suggest(value, values.siteId);
                  }}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-2xl border bg-white p-4 text-left transition-colors duration-150 ease-standard',
                    selected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400',
                  )}
                >
                  <span className={cn('grid size-9 place-items-center rounded-xl', selected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700')}>
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{k.label}</span>
                  <span className="text-xs text-slate-500">{k.blurb}</span>
                </button>
              );
            })}
          </div>
          {form.error('kind') && <p role="alert" className="text-xs text-red-700">{form.error('kind')}</p>}
        </Section>

        <Section title="For whom">
          <Field label="Customer" required span={2} error={form.error('customerId')} hint="The customer the quotation is addressed to. It can differ from the owner of the site.">
            <Combobox
              options={customers} noun="customers" placeholder="Choose a customer" searchPlaceholder="Search customers"
              {...form.bind('customerId')}
              onChange={(v) => {
                form.set('customerId', v);
                form.set('siteId', '');
                form.set('enquiryId', '');
                form.set('contactId', list(s.contacts).find((p) => p.customerId === v && p.primary)?.id ?? '');
                suggest(values.kind, '');
              }}
            />
          </Field>
          {customer?.status === 'on_hold' && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-900 md:col-span-2">
              <strong className="font-semibold">This customer is on hold.</strong> {customer.holdReason} The quotation will need the owner's approval.
            </p>
          )}
          <Field label="Site" hint="The building the work is for." error={form.error('siteId')}>
            <Combobox
              options={siteOptions(s, values.customerId)} noun="sites" clearable
              placeholder={values.customerId ? 'Choose a site' : 'Choose a customer first'} searchPlaceholder="Search sites"
              {...form.bind('siteId')}
              onChange={(v) => {
                form.set('siteId', v);
                suggest(values.kind, v);
              }}
              disabled={!values.customerId}
            />
          </Field>
          <Field label="Attention of" error={form.error('contactId')}>
            <Combobox options={contactOptions(s, values.customerId)} noun="people" clearable placeholder={values.customerId ? 'Choose a person' : 'Choose a customer first'} searchPlaceholder="Search people" {...form.bind('contactId')} disabled={!values.customerId} />
          </Field>
          <Field label="Enquiry" span={2} hint="Optional. Links the quotation to the request it answers." error={form.error('enquiryId')}>
            <Combobox options={enquiries} noun="enquiries" clearable placeholder={enquiries.length ? 'Choose an enquiry' : 'This customer has no open enquiry'} searchPlaceholder="Search enquiries" {...form.bind('enquiryId')} disabled={enquiries.length === 0} />
          </Field>
        </Section>

        <Section title="Title" cols={1}>
          <Field label="Title of the quotation" required error={form.error('title')}>
            <TextInput
              value={values.title}
              onChange={(v) => {
                setTitleTouched(true);
                form.set('title', v);
              }}
              onBlur={form.bind('title').onBlur}
              placeholder="For example Fire alarm upgrade, Wing B"
              autoComplete="off"
            />
          </Field>
        </Section>
        <button type="submit" className="hidden" />
      </form>
    </Page>
  );
}
