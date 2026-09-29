import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ENQUIRY_SOURCES, KINDS } from '@/data/quotationKinds.js';
import { todayISO } from '@/lib/dates.js';
import { createEnquiry, updateEnquiry } from '@/store/salesActions.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Checkbox, Field, Section, Segmented, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { EmptyState, Page } from '@/ui/Page.jsx';
import { contactOptions, customerOptions, siteOptions, staffOptions } from './parts.jsx';

const validate = (v) => {
  const e = {};
  if (!v.customerId) e.customerId = 'Choose the customer who asked.';
  if (v.title.trim().length < 3) e.title = 'Describe the request in a few words.';
  if (!v.ownerId) e.ownerId = 'Choose who looks after this enquiry.';
  if (!v.receivedOn) e.receivedOn = 'Say when it came in.';
  if (v.dueOn && v.receivedOn && v.dueOn < v.receivedOn) e.dueOn = 'The date for the quotation cannot be before the enquiry came in.';
  if (v.estValue !== '' && !(Number(v.estValue) >= 0)) e.estValue = 'Write an amount of zero or more.';
  return e;
};

const ABOUT = {
  purpose: 'Registers a request from a customer, so it is followed until a quotation is sent and the answer comes.',
  why: [
    'The kind decides what the quotation will look like: a project has a bill of quantities, a contract covers systems, a repair has parts and labour, a supply has items.',
    'The date for the quotation is asked for because tenders and customers set one, and a late quotation is a lost one.',
    'A site survey is a step of its own: someone must go and count before the price is written (study, workflow 1).',
  ],
  assumed: ['The list of sources and the estimate field are samples; the estimate is a rough value for the pipeline, not the price.'],
};

export function EnquiryForm() {
  const { enquiryId } = useParams();
  const s = useStore();
  const existing = enquiryId ? s.enquiries[enquiryId] : null;
  if (enquiryId && !existing) {
    return <Page title="Enquiry not found" back="/sales"><EmptyState title="This enquiry does not exist">It may have been deleted.</EmptyState></Page>;
  }
  return <Body key={existing?.id ?? 'new'} existing={existing} />;
}

function Body({ existing }) {
  const s = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, roleKey } = useSession();
  const preset = params.get('customer') ?? '';

  const form = useForm(
    {
      customerId: existing?.customerId ?? (s.customers[preset] ? preset : ''),
      siteId: existing?.siteId ?? '',
      contactId: existing?.contactId ?? '',
      kind: existing?.kind ?? 'project',
      title: existing?.title ?? '',
      description: existing?.description ?? '',
      source: existing?.source ?? 'phone',
      receivedOn: existing?.receivedOn ?? todayISO(),
      dueOn: existing?.dueOn ?? '',
      ownerId: existing?.ownerId ?? (['owner', 'manager', 'sales'].includes(roleKey) ? user.id : 'staff_sara'),
      estValue: existing ? String(existing.estValue || '') : '',
      surveyNeeded: existing?.survey.needed ?? false,
      surveyOn: existing?.survey.plannedOn ?? '',
      surveyBy: existing?.survey.assigneeId ?? '',
    },
    validate,
  );
  const { values } = form;
  const customers = useMemo(() => customerOptions(s), [s]);
  const owners = useMemo(() => staffOptions(s, ['owner', 'manager', 'sales']), [s]);
  const surveyors = useMemo(() => staffOptions(s, ['engineer', 'technician', 'coordinator', 'manager']), [s]);
  const customer = s.customers[values.customerId];

  const save = form.submit((v) => {
    const data = {
      customerId: v.customerId, siteId: v.siteId, contactId: v.contactId, kind: v.kind, title: v.title.trim(),
      description: v.description.trim(), source: v.source, receivedOn: v.receivedOn, dueOn: v.dueOn, ownerId: v.ownerId,
      estValue: Number(v.estValue || 0), surveyNeeded: v.surveyNeeded, surveyOn: v.surveyOn, surveyBy: v.surveyBy,
    };
    if (existing) {
      updateEnquiry(existing.id, data);
      toast('Enquiry updated');
      navigate(`/sales/${existing.id}`);
    } else {
      const id = createEnquiry(data);
      toast('Enquiry registered');
      navigate(`/sales/${id}`);
    }
  });

  return (
    <Page
      title={existing ? 'Edit enquiry' : 'New enquiry'}
      facts={existing ? existing.number : 'A request from a customer'}
      back={existing ? `/sales/${existing.id}` : '/sales'}
      about={ABOUT}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" onClick={save}>{existing ? 'Save changes' : 'Register enquiry'}</Button>
        </div>
      }
    >
      <form onSubmit={save} className="mx-auto max-w-4xl">
        <Section title="Who asked">
          <Field label="Customer" required span={2} error={form.error('customerId')}>
            <Combobox
              options={customers} noun="customers" placeholder="Choose a customer" searchPlaceholder="Search customers"
              {...form.bind('customerId')}
              onChange={(v) => {
                form.set('customerId', v);
                form.set('siteId', '');
                form.set('contactId', list(s.contacts).find((p) => p.customerId === v && p.primary)?.id ?? '');
              }}
            />
          </Field>
          {customer?.status === 'on_hold' && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-900 md:col-span-2">
              <strong className="font-semibold">This customer is on hold.</strong> {customer.holdReason} A quotation for it will need the owner's approval.
            </p>
          )}
          <Field label="Site" hint="Leave empty if the site is new or not known yet." error={form.error('siteId')}>
            <Combobox options={siteOptions(s, values.customerId)} noun="sites" placeholder={values.customerId ? 'Choose a site' : 'Choose a customer first'} searchPlaceholder="Search sites" clearable {...form.bind('siteId')} disabled={!values.customerId} />
          </Field>
          <Field label="Contact" error={form.error('contactId')}>
            <Combobox options={contactOptions(s, values.customerId)} noun="people" placeholder={values.customerId ? 'Choose a person' : 'Choose a customer first'} searchPlaceholder="Search people" clearable {...form.bind('contactId')} disabled={!values.customerId} />
          </Field>
        </Section>

        <Section title="What is asked">
          <Field label="Kind of work" span={2}>
            <Segmented
              label="Kind of work"
              value={values.kind}
              onChange={(v) => form.set('kind', v)}
              options={Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label, icon: k.icon }))}
            />
            <p className="mt-1 text-xs text-slate-500">{KINDS[values.kind].blurb}</p>
          </Field>
          <Field label="Title" required span={2} error={form.error('title')}>
            <TextInput {...form.bind('title')} placeholder="For example Fire alarm upgrade, Wing B" autoComplete="off" />
          </Field>
          <Field label="Details" span={2} error={form.error('description')}>
            <TextArea {...form.bind('description')} rows={3} />
          </Field>
        </Section>

        <Section title="Timing and owner">
          <Field label="How it came in" error={form.error('source')}>
            <Select {...form.bind('source')} options={Object.entries(ENQUIRY_SOURCES).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Came in on" required error={form.error('receivedOn')}>
            <TextInput type="date" {...form.bind('receivedOn')} />
          </Field>
          <Field label="Quotation due by" hint="The customer's or the tender's date." error={form.error('dueOn')}>
            <TextInput type="date" {...form.bind('dueOn')} />
          </Field>
          <Field label="Estimated value" hint="A rough value for the pipeline." error={form.error('estValue')}>
            <TextInput {...form.bind('estValue')} prefix="AED" inputMode="decimal" />
          </Field>
          <Field label="Owner" required span={2} error={form.error('ownerId')}>
            <Combobox options={owners} noun="people" placeholder="Choose a person" searchPlaceholder="Search people" {...form.bind('ownerId')} />
          </Field>
        </Section>

        <Section title="Site survey" description="Someone goes to count and measure before the price is written." cols={2}>
          <div className="md:col-span-2">
            <Checkbox label="A site survey is needed" checked={values.surveyNeeded} onChange={(v) => form.set('surveyNeeded', v)} />
          </div>
          {values.surveyNeeded && (
            <>
              <Field label="Planned for" hint="Leave empty to plan it later." error={form.error('surveyOn')}>
                <TextInput type="date" {...form.bind('surveyOn')} />
              </Field>
              <Field label="Done by" error={form.error('surveyBy')}>
                <Combobox options={surveyors} noun="people" placeholder="Choose a person" searchPlaceholder="Search people" clearable {...form.bind('surveyBy')} />
              </Field>
            </>
          )}
        </Section>
        <button type="submit" className="hidden" />
      </form>
    </Page>
  );
}
