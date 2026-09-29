import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { BUILDING_TYPES, EMIRATES } from '@/data/catalog.js';
import { createSite, updateSite } from '@/store/actions.js';
import { list } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Section, Segmented, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { EmptyState, Page } from '@/ui/Page.jsx';

const validate = (v) => {
  const e = {};
  if (!v.customerId) e.customerId = 'Choose the customer who owns this site.';
  if (v.name.trim().length < 3) e.name = 'Write the site\'s name (at least 3 letters).';
  if (!v.address.trim()) e.address = 'Write the address so the team can find it.';
  if (v.payer === 'other' && !v.billToId) e.billToId = 'Choose who pays.';
  if (v.floors !== '' && !(Number(v.floors) >= 0)) e.floors = 'Write a number.';
  if (v.builtUp !== '' && !(Number(v.builtUp) >= 0)) e.builtUp = 'Write a number.';
  return e;
};

const ABOUT = {
  purpose: 'Adds a site to a customer, or changes one. A site is where the systems are, so quotations, visits and invoices point at it.',
  why: [
    'Who owns the site and who pays for it are asked separately, because in facilities management they are often different companies (record 39, point 8).',
    'Access notes are asked for because every technician needs them before arriving: where to report, when work is allowed, what to bring.',
    'Whether a site is operating or under construction matters: a building under construction has no systems to service yet.',
  ],
  assumed: ['The building types and the emirates are samples. Civil Defence details are entered on the site page afterwards.'],
};

export function SiteForm() {
  const { siteId } = useParams();
  const s = useStore();
  const existing = siteId ? s.sites[siteId] : null;
  if (siteId && !existing) {
    return <Page title="Site not found" back="/customers/sites"><EmptyState title="This site does not exist">It may have been deleted.</EmptyState></Page>;
  }
  return <Body key={existing?.id ?? 'new'} existing={existing} />;
}

function Body({ existing }) {
  const s = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetCustomer = params.get('customer') ?? '';

  const customers = useMemo(
    () => list(s.customers).map((c) => ({
      value: c.id, label: c.name, sub: `${c.code} · ${c.segment}`, avatar: c.name,
      shape: c.type === 'individual' ? 'circle' : 'square',
      badge: c.status === 'on_hold' ? { tone: 'red', text: 'On hold' } : undefined,
    })),
    [s.customers],
  );

  const form = useForm(
    {
      customerId: existing?.customerId ?? (s.customers[presetCustomer] ? presetCustomer : ''),
      name: existing?.name ?? '',
      type: existing?.type ?? '',
      stage: existing?.stage ?? 'operating',
      address: existing?.address ?? '',
      area: existing?.area ?? '',
      emirate: existing?.emirate ?? 'Dubai',
      floors: existing ? String(existing.floors) : '',
      builtUp: existing ? String(existing.builtUp) : '',
      payer: existing && existing.billToId !== existing.customerId ? 'other' : 'owner',
      billToId: existing && existing.billToId !== existing.customerId ? existing.billToId : '',
      access: existing?.access ?? '',
    },
    validate,
  );
  const { values } = form;

  const save = form.submit((v) => {
    const data = {
      customerId: v.customerId, name: v.name.trim(), type: v.type || 'Office tower', stage: v.stage,
      address: v.address.trim(), area: v.area.trim(), emirate: v.emirate,
      floors: Number(v.floors || 1), builtUp: Number(v.builtUp || 0),
      billToId: v.payer === 'other' ? v.billToId : v.customerId,
      access: v.access.trim(),
    };
    if (existing) {
      updateSite(existing.id, data);
      toast('Site updated');
      navigate(`/customers/sites/${existing.id}`);
    } else {
      const id = createSite(data);
      toast('Site created', { action: { label: 'Add equipment', onClick: () => navigate(`/customers/sites/${id}?tab=equipment`) } });
      navigate(`/customers/sites/${id}`);
    }
  });

  return (
    <Page
      title={existing ? 'Edit site' : 'New site'}
      facts={existing ? existing.name : 'A building or a place we work at'}
      back={existing ? `/customers/sites/${existing.id}` : '/customers/sites'}
      about={ABOUT}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" onClick={save}>{existing ? 'Save changes' : 'Create site'}</Button>
        </div>
      }
    >
      <form onSubmit={save} className="mx-auto max-w-4xl">
        <Section title="Site">
          <Field label="Owner (customer)" required span={2} error={form.error('customerId')}>
            <Combobox options={customers} noun="customers" placeholder="Choose a customer" searchPlaceholder="Search customers" {...form.bind('customerId')} />
          </Field>
          <Field label="Site name" required span={2} error={form.error('name')}>
            <TextInput {...form.bind('name')} autoComplete="off" placeholder="For example Marina Crest Towers" />
          </Field>
          <Field label="Type of building">
            <Select {...form.bind('type')} options={BUILDING_TYPES} placeholder="Choose a type" />
          </Field>
          <Field label="Stage">
            <Segmented
              label="Stage"
              value={values.stage}
              onChange={(v) => form.set('stage', v)}
              options={[{ value: 'operating', label: 'Operating' }, { value: 'construction', label: 'Under construction' }]}
            />
          </Field>
        </Section>

        <Section title="Place">
          <Field label="Address" required span={2} error={form.error('address')}>
            <TextInput {...form.bind('address')} placeholder="Building, street" />
          </Field>
          <Field label="Area"><TextInput {...form.bind('area')} placeholder="For example Business Bay" /></Field>
          <Field label="Emirate"><Select {...form.bind('emirate')} options={EMIRATES} /></Field>
          <Field label="Floors" error={form.error('floors')}><TextInput {...form.bind('floors')} inputMode="numeric" /></Field>
          <Field label="Built-up area" error={form.error('builtUp')}><TextInput {...form.bind('builtUp')} inputMode="numeric" suffix="m²" /></Field>
        </Section>

        <Section title="Who pays" description="The invoices for this site go to the payer.">
          <Field label="Payer" span={2}>
            <Segmented
              label="Payer"
              value={values.payer}
              onChange={(v) => form.set('payer', v)}
              options={[{ value: 'owner', label: 'The owner' }, { value: 'other', label: 'Another customer' }]}
            />
          </Field>
          {values.payer === 'other' && (
            <Field label="Bill to" required span={2} error={form.error('billToId')} hint="For example the facilities management company that pays for a building it manages.">
              <Combobox options={customers.filter((c) => c.value !== values.customerId)} noun="customers" placeholder="Choose the paying customer" searchPlaceholder="Search customers" {...form.bind('billToId')} />
            </Field>
          )}
        </Section>

        <Section title="Access" cols={1}>
          <Field label="Access notes for the team" hint="Where to report, when work is allowed, permits, parking.">
            <TextArea {...form.bind('access')} rows={3} />
          </Field>
        </Section>
        <button type="submit" className="hidden" />
      </form>
    </Page>
  );
}
