import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ShieldCheckIcon } from 'lucide-react';
import { CREDIT_REASONS } from '@/data/billingKinds.js';
import { documentTotals, lineAmount } from '@/data/billingRules.js';
import { fmtDate } from '@/lib/dates.js';
import { money, num, round2 } from '@/lib/format.js';
import { createCreditNote } from '@/store/billingActions.js';
import { creditApprovalNeeds, creditNotesOf, invoiceViews } from '@/store/billingSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Section, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Page } from '@/ui/Page.jsx';

const ABOUT = {
  purpose: 'Makes a credit note against an invoice that was issued: it says which lines, how many of them, and at what price are taken back, and why.',
  why: [
    'A credit note is always made against one invoice, so the customer and the tax figures come from it. The discount of the invoice applies to the credit as well, so a full credit is exactly the invoice.',
    'Each line of the invoice can be credited in part. A wrong quantity is credited by the quantity that was too many; a wrong price is credited by the difference, at the price field. "Credit the whole invoice" fills every line.',
    'The form shows, before saving, whether the value needs the operations manager or the owner, and stops a credit that is higher than what the invoice can still be credited.',
    'The credit note is saved as a draft. Issuing it (or sending it for approval) is the next step, on the credit note.',
  ],
  assumed: ['The reasons are a sample list. Paying money back to the customer is not modelled.'],
};

const newKey = () => Math.random().toString(36).slice(2, 8);
const linesFor = (inv) => inv.lines.map((l) => ({ key: newKey(), itemId: l.itemId, description: l.description, unit: l.unit, was: l.qty, qty: '', price: String(l.price) }));
const asNumbers = (lines) => lines.map((l) => ({ ...l, qty: Number(l.qty) || 0, price: Number(l.price) || 0 }));

export function CreditNoteForm() {
  const s = useStore();
  const navigate = useNavigate();
  const { user } = useSession();
  const [params] = useSearchParams();
  const preset = s.invoices[params.get('invoice')]?.status === 'issued' ? params.get('invoice') : '';

  const form = useForm(
    { invoiceId: preset, reason: CREDIT_REASONS[0], note: '', lines: preset ? linesFor(s.invoices[preset]) : [] },
    (v) => {
      const inv = s.invoices[v.invoiceId];
      if (!inv) return { invoiceId: 'Choose the invoice to correct.' };
      const credit = documentTotals({ lines: asNumbers(v.lines), discountPct: inv.discountPct || 0, vatRate: inv.vatRate }).total;
      const used = round2(creditNotesOf(s, inv.id).filter((c) => c.status !== 'draft').reduce((n, c) => n + documentTotals(c).total, 0));
      const room = round2(documentTotals(inv).total - used);
      return {
        ...(v.note.trim().length >= 3 || v.reason !== 'Other' ? {} : { note: 'Say what the credit is for.' }),
        ...(!v.lines.some((l) => Number(l.qty) > 0)
          ? { lines: 'Write a quantity on at least one line: what is credited.' }
          : v.lines.some((l) => Number(l.qty) > l.was || Number(l.qty) < 0)
            ? { lines: 'A line cannot be credited for more than was invoiced.' }
            : v.lines.some((l) => l.price === '' || !Number.isFinite(Number(l.price)))
              ? { lines: 'Every credited line needs a price.' }
              : credit <= 0
                ? { lines: 'The credit must be above zero.' }
                : credit > room + 0.004
                  ? { lines: `This credit is more than the invoice can still be credited: AED ${money(room)}${used > 0 ? ` (AED ${money(used)} was credited already)` : ''}.` }
                  : {}),
      };
    },
  );
  const { values } = form;
  const inv = s.invoices[values.invoiceId];
  const customer = inv && s.customers[inv.customerId];

  const invoices = useMemo(
    () =>
      invoiceViews(s)
        .filter((v) => v.inv.status === 'issued')
        .toSorted((a, b) => b.inv.issuedOn.localeCompare(a.inv.issuedOn) || b.inv.number.localeCompare(a.inv.number))
        .map((v) => ({ value: v.inv.id, label: `${v.inv.number} · ${v.customer?.name ?? ''}`, sub: `${v.inv.title} · AED ${money(v.totals.total)} · ${fmtDate(v.inv.issuedOn)}`, avatar: v.customer?.name, shape: 'square' })),
    [s],
  );

  const draft = useMemo(
    () => ({ lines: asNumbers(values.lines), discountPct: inv?.discountPct || 0, vatRate: inv?.vatRate ?? s.settings.vatRate, createdBy: user.id }),
    [values.lines, inv, s.settings.vatRate, user.id],
  );
  const totals = documentTotals(draft);
  const needs = creditApprovalNeeds(draft, s);

  const setLines = (lines) => form.set('lines', lines);
  const change = (key, patch) => setLines(values.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const chooseInvoice = (id) => {
    form.set('invoiceId', id);
    setLines(s.invoices[id] ? linesFor(s.invoices[id]) : []);
  };

  const save = form.submit((v) => {
    const id = createCreditNote({
      invoiceId: v.invoiceId, reason: v.reason, note: v.note.trim(),
      lines: v.lines.map((l) => ({ itemId: l.itemId, description: l.description, unit: l.unit, qty: Number(l.qty) || 0, price: Number(l.price) })),
    });
    toast('Draft credit note made: issue it, or send it for approval');
    navigate(`/billing/credit-notes/${id}`, { replace: true });
  });

  return (
    <Page
      title="New credit note"
      facts="Saved as a draft: it is issued on the next step"
      back="/billing/credit-notes"
      about={ABOUT}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {totals.total > 0 ? <>Credit <strong className="font-semibold tabular-nums text-slate-900">AED {money(totals.total)}</strong> with VAT</> : 'Nothing credited yet'}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => navigate(-1)}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save draft</Button>
          </div>
        </div>
      }
    >
      <form onSubmit={save} className="mx-auto max-w-4xl">
        <Section title="The credit note">
          <Field label="Invoice to correct" required span={2} error={form.error('invoiceId')}
            hint={inv ? `${customer?.name} · issued ${fmtDate(inv.issuedOn)} · AED ${money(documentTotals(inv).total)}` : 'Only an invoice that was issued can be credited.'}>
            <Combobox options={invoices} noun="invoices" placeholder="Choose the invoice" searchPlaceholder="Search number or customer" {...form.bind('invoiceId')} onChange={chooseInvoice} />
          </Field>
          <Field label="Reason" required><Select {...form.bind('reason')} options={CREDIT_REASONS} /></Field>
          <Field label="Note" required={values.reason === 'Other'} error={form.error('note')} hint="Printed on the credit note.">
            <TextInput {...form.bind('note')} autoComplete="off" />
          </Field>
        </Section>

        <Section title="What is credited" description={inv ? `Write, on each line, how many are taken back. ${inv.discountPct > 0 ? `The discount of ${num(inv.discountPct)}% on the invoice applies to the credit too.` : ''}` : 'Choose the invoice first.'} cols={1}>
          {inv && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="xs" onClick={() => setLines(values.lines.map((l) => ({ ...l, qty: String(l.was) })))}>Credit the whole invoice</Button>
                <Button size="xs" variant="ghost" onClick={() => setLines(values.lines.map((l) => ({ ...l, qty: '' })))}>Clear</Button>
              </div>
              <div className="space-y-3">
                <div className="hidden gap-2 px-1 text-xs font-medium text-slate-500 md:grid md:grid-cols-[minmax(0,1fr)_92px_92px_112px_104px]">
                  <span>Line of the invoice</span><span>Invoiced</span><span>Credit</span><span>Price each</span><span className="text-right">Credit amount</span>
                </div>
                {values.lines.map((l, i) => (
                  <div key={l.key} className="grid grid-cols-2 items-center gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_92px_92px_112px_104px] md:border-0 md:p-0">
                    <p className="col-span-2 min-w-0 text-sm text-slate-900 md:col-span-1">{l.description}</p>
                    <p className="text-sm tabular-nums text-slate-600">{num(l.was)} <span className="text-xs text-slate-500">{l.unit}</span></p>
                    <TextInput aria-label={`Quantity to credit on line ${i + 1}`} inputMode="decimal" value={l.qty} onChange={(v) => change(l.key, { qty: v })} placeholder="0" className="!h-10" />
                    <TextInput aria-label={`Price each on line ${i + 1}`} inputMode="decimal" value={l.price} onChange={(v) => change(l.key, { price: v })} className="!h-10" />
                    <p className="text-right text-sm tabular-nums text-slate-900">{money(lineAmount({ qty: Number(l.qty) || 0, price: Number(l.price) || 0 }))}</p>
                  </div>
                ))}
              </div>
              {form.error('lines') && <p role="alert" className="text-xs text-red-700">{form.error('lines')}</p>}

              {totals.total > 0 && (
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-[minmax(0,1fr)_260px]">
                  <div>
                    {needs.needed ? (
                      <p className="flex items-start gap-2 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-950">
                        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>
                          <strong className="font-semibold">This credit note needs approval by the {needs.roleLabel}</strong> before it can be issued.
                          <span className="mt-1 block text-xs">{needs.reasons.join(' · ')}</span>
                        </span>
                      </p>
                    ) : (
                      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        {needs.reasons.length > 0 ? `Within your own authority, so no one else has to approve. (${needs.reasons[0]}.)` : 'No approval is needed: it is within the limit of the accountant.'}
                      </p>
                    )}
                  </div>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd className="tabular-nums">{money(totals.subtotal)}</dd></div>
                    {totals.discount > 0 && <div className="flex justify-between"><dt className="text-slate-600">Discount ({num(draft.discountPct)}%)</dt><dd className="tabular-nums">− {money(totals.discount)}</dd></div>}
                    <div className="flex justify-between"><dt className="text-slate-600">VAT {draft.vatRate}%</dt><dd className="tabular-nums">{money(totals.vat)}</dd></div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><dt>Credit (AED)</dt><dd className="tabular-nums">{money(totals.total)}</dd></div>
                  </dl>
                </div>
              )}
            </>
          )}
        </Section>
        <button type="submit" className="hidden" />
      </form>
    </Page>
  );
}
