import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { InfoIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { termsDays } from '@/data/billingKinds.js';
import { documentTotals, dueFor, lineAmount } from '@/data/billingRules.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { money, num } from '@/lib/format.js';
import { saveInvoice } from '@/store/billingActions.js';
import { accountOf, sourceOf } from '@/store/billingSelectors.js';
import { list } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Section, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { EmptyState, Page } from '@/ui/Page.jsx';
import { contactOptions, customerOptions, siteOptions } from '@/pages/sales/parts.jsx';

const ABOUT = {
  purpose: 'Writes an invoice that has no other record behind it, or changes a draft. It is saved as a draft: the number, the date and the due day are given when the invoice is issued.',
  why: [
    'Most invoices are not written here. They are made from a contract instalment, a project claim, a job or an accepted supply, from the list "Ready to invoice", and arrive with the lines filled in. This form is for the rest: a small sale at the counter, a fee, a correction.',
    'A draft made from a contract or a project claim keeps its lines: they are the working of a signed document and must agree with it. The reference, the notes and the contact can still be written.',
    'The lines come from the catalogue at the selling price, and any price can be changed. A line that is not in the catalogue is typed by hand. A negative price is a deduction.',
    'The form shows the payment terms of the customer and the day the invoice will fall due, and warns if the customer would go over its credit limit, so nobody is surprised at the moment of issuing.',
  ],
  assumed: ['The catalogue prices, the payment terms and the credit limits are invented.'],
};

const newKey = () => Math.random().toString(36).slice(2, 8);

export function InvoiceForm() {
  const { invoiceId } = useParams();
  const s = useStore();
  const existing = invoiceId ? s.invoices[invoiceId] : null;
  if (invoiceId && (!existing || existing.status !== 'draft')) {
    return (
      <Page title="Invoice" back="/billing">
        <EmptyState
          title={existing ? 'Only a draft can be edited' : 'This invoice does not exist'}
          action={<Button variant="primary" to={existing ? `/billing/${invoiceId}` : '/billing'}>{existing ? 'Open the invoice' : 'All invoices'}</Button>}
        >
          {existing ? 'An issued invoice is fixed. To correct it, make a credit note.' : 'A draft may have been deleted.'}
        </EmptyState>
      </Page>
    );
  }
  return <Body key={existing?.id ?? 'new'} existing={existing} />;
}

function Body({ existing }) {
  const s = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromRecord = Boolean(existing && existing.source.kind !== 'manual');
  const locked = Boolean(existing?.locked);
  const src = existing ? sourceOf(s, existing) : null;

  const toRow = (l) => ({ key: newKey(), id: l.id, itemId: l.itemId, description: l.description, unit: l.unit, qty: String(l.qty), price: String(l.price) });
  const form = useForm(
    existing
      ? {
          customerId: existing.customerId, siteId: existing.siteId, contactId: existing.contactId, reference: existing.reference, supplyOn: existing.supplyOn,
          title: existing.title, notes: existing.notes, discountPct: String(existing.discountPct || ''), lines: existing.lines.map(toRow),
        }
      : {
          customerId: s.customers[params.get('customer')] ? params.get('customer') : '', siteId: '', contactId: '', reference: '', supplyOn: todayISO(),
          title: '', notes: '', discountPct: '', lines: [],
        },
    (v) => ({
      ...(v.customerId ? {} : { customerId: 'Choose the customer.' }),
      ...(v.title.trim().length >= 3 ? {} : { title: 'Say in a few words what the invoice is for.' }),
      ...(v.supplyOn ? {} : { supplyOn: 'Say the day the goods or the service were supplied.' }),
      ...(Number(v.discountPct || 0) < 0 || Number(v.discountPct || 0) > 100 ? { discountPct: 'The discount is a percentage from 0 to 100.' } : {}),
      ...(locked
        ? {}
        : v.lines.length === 0
          ? { lines: 'Add at least one item.' }
          : v.lines.some((l) => !(Number(l.qty) > 0) || l.price === '' || !Number.isFinite(Number(l.price)) || l.description.trim().length < 2)
            ? { lines: 'Every line needs a description, a quantity above zero and a unit price.' }
            : {}),
    }),
  );
  const { values } = form;
  const customer = s.customers[values.customerId];

  const customers = useMemo(() => customerOptions(s), [s]);
  const sites = useMemo(() => siteOptions(s, values.customerId), [s, values.customerId]);
  const contacts = useMemo(() => contactOptions(s, values.customerId), [s, values.customerId]);
  const itemOptions = useMemo(
    () => list(s.items).filter((i) => i.active).map((i) => ({ value: i.id, label: i.name, sub: `${i.code} · AED ${money(i.price)} per ${i.unit}` })),
    [s.items],
  );

  const draft = useMemo(
    () => ({
      lines: values.lines.map((l) => ({ ...l, qty: Number(l.qty) || 0, price: Number(l.price) || 0 })),
      discountPct: Number(values.discountPct) || 0, vatRate: existing?.vatRate ?? s.settings.vatRate,
    }),
    [values.lines, values.discountPct, existing?.vatRate, s.settings.vatRate],
  );
  const totals = documentTotals(draft);
  const account = values.customerId ? accountOf(s, values.customerId) : null;
  const after = account ? account.balance + totals.total : 0;
  const days = customer ? termsDays(customer.terms) : 0;

  const setLines = (lines) => form.set('lines', lines);
  const addItem = (itemId) => {
    const it = s.items[itemId];
    if (!it) return;
    setLines([...values.lines, { key: newKey(), itemId: it.id, description: it.name, unit: it.unit, qty: '1', price: String(it.price) }]);
  };
  const addTyped = (text) => setLines([...values.lines, { key: newKey(), itemId: '', description: text || 'New line', unit: 'lot', qty: '1', price: '' }]);
  const change = (key, patch) => setLines(values.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const chooseCustomer = (id) => {
    form.set('customerId', id);
    form.set('siteId', '');
    form.set('contactId', '');
  };

  const save = form.submit((v) => {
    const id = saveInvoice({
      id: existing?.id, customerId: v.customerId, siteId: v.siteId, contactId: v.contactId, reference: v.reference.trim(), supplyOn: v.supplyOn,
      title: v.title.trim(), notes: v.notes.trim(), discountPct: Number(v.discountPct || 0),
      lines: v.lines.map((l) => ({ id: l.id, itemId: l.itemId, description: l.description.trim(), unit: l.unit.trim() || 'nos', qty: Number(l.qty), price: Number(l.price) })),
    });
    toast(existing ? 'Draft saved' : 'Draft invoice made: check it and issue it');
    navigate(`/billing/${id}`, { replace: true });
  });

  return (
    <Page
      title={existing ? 'Edit the draft invoice' : 'New invoice'}
      facts={existing ? (fromRecord ? `Made from ${src.label}` : 'A draft') : 'Saved as a draft: the number is given when it is issued'}
      back={existing ? `/billing/${existing.id}` : '/billing'}
      about={ABOUT}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {values.lines.length > 0 ? <>Total <strong className="font-semibold tabular-nums text-slate-900">AED {money(totals.total)}</strong> with VAT</> : 'No items yet'}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => navigate(-1)}>Cancel</Button>
            <Button variant="primary" onClick={save}>{existing ? 'Save changes' : 'Save draft'}</Button>
          </div>
        </div>
      }
    >
      <form onSubmit={save} className="mx-auto max-w-4xl">
        {fromRecord && (
          <p className="mb-5 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              This draft was made from <strong className="font-semibold">{src.label}</strong>, so the customer and the site come with it and cannot be changed here.{' '}
              {locked ? 'Its lines are the working of that record and stay as they are.' : 'The lines can be changed.'}
            </span>
          </p>
        )}

        <Section title="The invoice">
          <Field label="Customer" required span={2} error={form.error('customerId')}
            hint={customer ? `${customer.terms} · ${customer.trn ? `TRN ${customer.trn}` : 'no TRN on record'}${customer.creditLimit > 0 ? ` · credit limit AED ${money(customer.creditLimit)}` : ''}` : 'The company that pays this invoice.'}>
            <Combobox options={customers} noun="customers" placeholder="Choose the customer" searchPlaceholder="Search customers" disabled={fromRecord} {...form.bind('customerId')} onChange={chooseCustomer} />
          </Field>
          <Field label="Site" hint="Optional. The building the goods or the service were for.">
            <Combobox options={sites} noun="sites" placeholder={values.customerId ? 'Choose a site' : 'Choose the customer first'} searchPlaceholder="Search sites" clearable disabled={fromRecord || !values.customerId} {...form.bind('siteId')} />
          </Field>
          <Field label="Contact" hint="Optional. Who the invoice is addressed to.">
            <Combobox options={contacts} noun="contacts" placeholder={values.customerId ? 'Choose a contact' : 'Choose the customer first'} searchPlaceholder="Search contacts" clearable disabled={!values.customerId} {...form.bind('contactId')} />
          </Field>
          <Field label="Title" required span={2} error={form.error('title')} hint="Shown in the lists and at the top of the invoice.">
            <TextInput {...form.bind('title')} autoComplete="off" placeholder="For example Fire extinguishers supplied to the Marina Tower" />
          </Field>
          <Field label="Date of supply" required error={form.error('supplyOn')} hint="The day the goods were delivered or the service was done.">
            <TextInput type="date" {...form.bind('supplyOn')} max={todayISO()} />
          </Field>
          <Field label="Customer's reference" hint="Their purchase order (LPO) number, if they gave one.">
            <TextInput {...form.bind('reference')} autoComplete="off" />
          </Field>
          <Field label="Notes" span={2} hint="Printed on the invoice.">
            <TextArea {...form.bind('notes')} rows={2} />
          </Field>
        </Section>

        <Section
          title="Items"
          description={locked ? 'These lines come from the record the invoice was made from and cannot be changed here.' : 'Choose from the catalogue, or type a name to add a line that is not in it. A negative price is a deduction.'}
          cols={1}
        >
          {values.lines.length > 0 && (
            <div className="space-y-3">
              <div className="hidden gap-2 px-1 text-xs font-medium text-slate-500 md:grid md:grid-cols-[minmax(0,1fr)_84px_84px_112px_104px_36px]">
                <span>Description</span><span>Quantity</span><span>Unit</span><span>Unit price</span><span className="text-right">Amount</span><span />
              </div>
              {values.lines.map((l, i) => (
                <div key={l.key} className="grid grid-cols-2 items-center gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_84px_84px_112px_104px_36px] md:border-0 md:p-0">
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <TextInput aria-label={`Description of item ${i + 1}`} value={l.description} onChange={(v) => change(l.key, { description: v })} disabled={locked} className="!h-10" />
                  </div>
                  <TextInput aria-label={`Quantity of item ${i + 1}`} inputMode="decimal" value={l.qty} onChange={(v) => change(l.key, { qty: v })} disabled={locked} className="!h-10" />
                  <TextInput aria-label={`Unit of item ${i + 1}`} value={l.unit} onChange={(v) => change(l.key, { unit: v })} disabled={locked} className="!h-10" />
                  <TextInput aria-label={`Unit price of item ${i + 1}`} inputMode="decimal" value={l.price} onChange={(v) => change(l.key, { price: v })} disabled={locked} placeholder="0.00" className="!h-10" />
                  <p className="text-right text-sm tabular-nums text-slate-900">{money(lineAmount({ qty: Number(l.qty) || 0, price: Number(l.price) || 0 }))}</p>
                  <div className="col-span-2 flex justify-end md:col-span-1">
                    {!locked && <IconButton icon={Trash2Icon} label={`Remove item ${i + 1}`} size="xs" onClick={() => setLines(values.lines.filter((x) => x.key !== l.key))} />}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!locked && (
            <div className="max-w-xl">
              <Combobox
                options={itemOptions}
                noun="items"
                placeholder={values.lines.length === 0 ? 'Add the first item…' : 'Add another item…'}
                searchPlaceholder="Search the catalogue"
                value=""
                onChange={addItem}
                onCreate={addTyped}
                createLabel={(text) => (text ? `Add “${text}” as a line typed by hand` : 'Add a line typed by hand')}
              />
            </div>
          )}
          {form.error('lines') && <p role="alert" className="text-xs text-red-700">{form.error('lines')}</p>}

          {values.lines.length > 0 && (
            <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-3">
                {customer && (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {customer.name} pays on <strong className="font-semibold text-slate-900">{customer.terms}</strong>: {days === 0 ? 'the invoice falls due the day it is issued.' : `if the invoice is issued today it falls due on ${fmtDate(dueFor(todayISO(), days))}.`}
                  </p>
                )}
                {account && account.limit > 0 && after > account.limit && (
                  <p className="flex items-start gap-2 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-950">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      <strong className="font-semibold">This takes the customer over its credit limit.</strong> It owes AED {money(account.balance)} now; with this invoice AED {money(after)}, and the limit is AED {money(account.limit)}.
                    </span>
                  </p>
                )}
                {!locked && (
                  <div className="max-w-48">
                    <Field label="Discount" error={form.error('discountPct')} hint={draft.discountPct > 0 ? `${num(draft.discountPct)}% off the subtotal` : undefined}>
                      <TextInput {...form.bind('discountPct')} inputMode="decimal" suffix="%" placeholder="0" />
                    </Field>
                  </div>
                )}
              </div>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd className="tabular-nums">{money(totals.subtotal)}</dd></div>
                {totals.discount > 0 && <div className="flex justify-between"><dt className="text-slate-600">Discount ({num(draft.discountPct)}%)</dt><dd className="tabular-nums">− {money(totals.discount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-slate-600">Taxable amount</dt><dd className="tabular-nums">{money(totals.net)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-600">VAT {draft.vatRate}%</dt><dd className="tabular-nums">{money(totals.vat)}</dd></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><dt>Total (AED)</dt><dd className="tabular-nums">{money(totals.total)}</dd></div>
              </dl>
            </div>
          )}
        </Section>
        <button type="submit" className="hidden" />
      </form>
    </Page>
  );
}
