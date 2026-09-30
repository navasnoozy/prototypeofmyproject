import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { EMIRATES, PAYMENT_TERMS, SEGMENTS } from '@/data/catalog.js';
import { ROLES } from '@/data/roles.js';
import { createCustomer, saveContact, updateCustomer } from '@/store/actions.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Section, Segmented, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { EmptyState, Page } from '@/ui/Page.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = (v) => {
  const e = {};
  if (v.name.trim().length < 3) e.name = 'Write the customer\'s full name (at least 3 letters).';
  if (v.trn && !/^\d{15}$/.test(v.trn.replace(/\s/g, ''))) e.trn = 'A TRN has 15 digits.';
  if (v.email && !EMAIL.test(v.email)) e.email = 'This does not look like an e-mail address.';
  if (v.creditLimit !== '' && !(Number(v.creditLimit) >= 0)) e.creditLimit = 'Write an amount of zero or more.';
  if (v.contactEmail && !EMAIL.test(v.contactEmail)) e.contactEmail = 'This does not look like an e-mail address.';
  return e;
};

const ABOUT = {
  purpose: 'Creates a customer, or changes one. Only what the business needs to quote, work and invoice is asked for; the rest can be added later.',
  why: [
    'The TRN (tax registration number) is asked for here because every UAE tax invoice to a VAT-registered customer carries it; it is checked for its 15 digits.',
    'Payment terms and a credit limit belong to the customer: the terms decide the due day of every invoice, and the invoice dialog warns when the limit would be passed.',
    'The first contact can be added in the same step, because a customer without a person to call is not useful.',
    'Errors appear when you leave a field, and go away as soon as you fix them.',
  ],
  assumed: [
    'The list of segments, the payment terms and the emirates are samples.',
    'Whether a customer needs a trade licence number is not asked; the reference company\'s papers will tell (assumptions register).',
  ],
};

export function CustomerForm() {
  const { customerId } = useParams();
  const s = useStore();
  const existing = customerId ? s.customers[customerId] : null;
  if (customerId && !existing) {
    return <Page title="Customer not found" back="/customers"><EmptyState title="This customer does not exist">It may have been deleted.</EmptyState></Page>;
  }
  return <Body key={existing?.id ?? 'new'} existing={existing} />;
}

function Body({ existing }) {
  const s = useStore();
  const navigate = useNavigate();
  const { user } = useSession();
  const owners = useMemo(
    () =>
      list(s.staff)
        .filter((p) => ['owner', 'manager', 'sales'].includes(p.roleKey))
        .map((p) => ({ value: p.id, label: p.name, sub: ROLES[p.roleKey].label, avatar: p.name })),
    [s.staff],
  );

  const form = useForm(
    {
      type: existing?.type ?? 'company',
      name: existing?.name ?? '',
      segment: existing?.segment ?? '',
      group: existing?.group ?? '',
      trn: existing?.trn ?? '',
      phone: existing?.phone ?? '',
      email: existing?.email ?? '',
      address: existing?.address ?? '',
      area: existing?.area ?? '',
      emirate: existing?.emirate ?? 'Dubai',
      terms: existing?.terms ?? 'Net 30',
      creditLimit: existing ? String(existing.creditLimit) : '0',
      salesOwner: existing?.salesOwner ?? (['owner', 'manager', 'sales'].includes(user.roleKey) ? user.id : 'staff_sara'),
      notes: existing?.notes ?? '',
      contactName: '', contactTitle: '', contactPhone: '', contactEmail: '',
    },
    validate,
  );
  const { values } = form;
  const isIndividual = values.type === 'individual';

  const save = form.submit((v) => {
    const data = {
      type: v.type, name: v.name.trim(), segment: v.segment || 'Residential', group: v.group.trim(),
      trn: v.trn.replace(/\s/g, ''), phone: v.phone.trim(), email: v.email.trim(), address: v.address.trim(),
      area: v.area.trim(), emirate: v.emirate, terms: v.terms, creditLimit: Number(v.creditLimit || 0),
      salesOwner: v.salesOwner, notes: v.notes.trim(),
    };
    if (existing) {
      updateCustomer(existing.id, data);
      toast('Customer updated');
      navigate(`/customers/${existing.id}`);
      return;
    }
    const id = createCustomer(data);
    if (v.contactName.trim()) {
      saveContact({
        customerId: id, name: v.contactName.trim(), title: v.contactTitle.trim(), role: 'decision',
        phone: v.contactPhone.trim(), email: v.contactEmail.trim(), primary: true,
      });
    }
    toast('Customer created', { action: { label: 'Add a site', onClick: () => navigate(`/customers/sites/new?customer=${id}`) } });
    navigate(`/customers/${id}`);
  });

  return (
    <Page
      title={existing ? 'Edit customer' : 'New customer'}
      facts={existing ? existing.name : 'Who we work for'}
      back={existing ? `/customers/${existing.id}` : '/customers'}
      about={ABOUT}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" onClick={save}>{existing ? 'Save changes' : 'Create customer'}</Button>
        </div>
      }
    >
      <form onSubmit={save} className="mx-auto max-w-4xl">
        <Section title="Who">
          <Field label="Type" span={2}>
            <Segmented
              label="Type"
              value={values.type}
              onChange={(v) => form.set('type', v)}
              options={[{ value: 'company', label: 'Company' }, { value: 'individual', label: 'Individual' }]}
            />
          </Field>
          <Field label={isIndividual ? 'Full name' : 'Company name'} required span={2} error={form.error('name')}>
            <TextInput {...form.bind('name')} autoComplete="off" />
          </Field>
          <Field label="Segment" hint="Where the business sits; used for filters and reports." error={form.error('segment')}>
            <Select {...form.bind('segment')} options={SEGMENTS} placeholder="Choose a segment" />
          </Field>
          {!isIndividual && (
            <Field label="Group" hint="Only if the company belongs to a group of companies." error={form.error('group')}>
              <TextInput {...form.bind('group')} />
            </Field>
          )}
          <Field label="TRN (tax registration number)" hint="15 digits. Needed on tax invoices to VAT-registered customers." error={form.error('trn')}>
            <TextInput {...form.bind('trn')} inputMode="numeric" placeholder="100000000000003" />
          </Field>
        </Section>

        <Section title="How to reach them">
          <Field label="Phone" error={form.error('phone')}><TextInput {...form.bind('phone')} inputMode="tel" placeholder="+971 4 555 0100" /></Field>
          <Field label="E-mail" error={form.error('email')}><TextInput {...form.bind('email')} inputMode="email" type="email" /></Field>
          <Field label="Address" span={2} error={form.error('address')}><TextInput {...form.bind('address')} placeholder="Building, street" /></Field>
          <Field label="Area" error={form.error('area')}><TextInput {...form.bind('area')} placeholder="For example Business Bay" /></Field>
          <Field label="Emirate" error={form.error('emirate')}><Select {...form.bind('emirate')} options={EMIRATES} /></Field>
        </Section>

        <Section title="Terms" description="What we agreed about paying.">
          <Field label="Payment terms" error={form.error('terms')}><Select {...form.bind('terms')} options={PAYMENT_TERMS} /></Field>
          <Field label="Credit limit" hint="Zero means no credit: pay before or on delivery." error={form.error('creditLimit')}>
            <TextInput {...form.bind('creditLimit')} prefix="AED" inputMode="decimal" />
          </Field>
          <Field label="Sales owner" hint="The person who looks after this customer." error={form.error('salesOwner')}>
            <Combobox options={owners} noun="people" placeholder="Choose a person" searchPlaceholder="Search people" {...form.bind('salesOwner')} />
          </Field>
        </Section>

        {!existing && (
          <Section title="First contact" description="Optional. You can add more people later.">
            <Field label="Name" error={form.error('contactName')}><TextInput {...form.bind('contactName')} autoComplete="off" /></Field>
            <Field label="Job title" error={form.error('contactTitle')}><TextInput {...form.bind('contactTitle')} /></Field>
            <Field label="Phone" error={form.error('contactPhone')}><TextInput {...form.bind('contactPhone')} inputMode="tel" /></Field>
            <Field label="E-mail" error={form.error('contactEmail')}><TextInput {...form.bind('contactEmail')} inputMode="email" type="email" /></Field>
          </Section>
        )}

        <Section title="Notes" cols={1}>
          <Field label="Notes for our team" hint="For example who approves, when to visit, how they like to be contacted." error={form.error('notes')}>
            <TextArea {...form.bind('notes')} rows={3} />
          </Field>
        </Section>
        <button type="submit" className="hidden" />
      </form>
    </Page>
  );
}
