import { PrinterIcon } from 'lucide-react';
import { termsDays } from '@/data/billingKinds.js';
import { documentTotals, lineAmount } from '@/data/billingRules.js';
import { COMPANY } from '@/data/seed/staff.js';
import { fmtDate } from '@/lib/dates.js';
import { money, num } from '@/lib/format.js';
import { useStore } from '@/store/store.js';
import { Button } from '@/ui/Button.jsx';

// The invoice, or the credit note, as the customer receives it. "Print" saves it as
// a PDF: the application's own frame is hidden when printing. `kind` is "invoice" or
// "credit"; a credit note names the invoice it corrects.
export function DocumentPreview({ doc, kind = 'invoice', against }) {
  const s = useStore();
  const t = documentTotals(doc);
  const customer = s.customers[doc.customerId];
  const site = s.sites[doc.siteId];
  const contact = s.contacts[doc.contactId];
  const isInvoice = kind === 'invoice';
  const issued = doc.status === 'issued';
  const days = termsDays(doc.terms ?? customer?.terms);

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {issued ? `This is how the customer sees the ${isInvoice ? 'invoice' : 'credit note'}.` : `A draft is not valid until it is issued: it shows a mark where the number will be.`}
        </p>
        <Button icon={PrinterIcon} onClick={() => window.print()}>Print or save as PDF</Button>
      </div>

      <article className="relative mx-auto max-w-[840px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-[13px] leading-5 text-slate-900 shadow-sm sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {!issued && (
          <p aria-hidden="true" className="pointer-events-none absolute right-6 top-24 -rotate-12 select-none text-5xl font-bold uppercase tracking-widest text-slate-200">Draft</p>
        )}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-300 pb-5">
          <div>
            <p className="text-lg font-bold tracking-tight">{COMPANY.name}</p>
            <p className="mt-1 text-slate-600">{COMPANY.address}</p>
            <p className="text-slate-600">{COMPANY.phone} · {COMPANY.email}</p>
            <p className="text-slate-600">TRN {COMPANY.trn}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide">{isInvoice ? 'Tax invoice' : 'Tax credit note'}</p>
            <p className="mt-1 font-semibold">{doc.number || 'Number given when issued'}</p>
            <p className="text-slate-600">Date: {issued ? fmtDate(isInvoice ? doc.issuedOn : doc.issuedOn) : '—'}</p>
            {isInvoice && issued && <p className="text-slate-600">Due: {fmtDate(doc.dueOn)}</p>}
            {isInvoice && doc.supplyOn && <p className="text-slate-600">Date of supply: {fmtDate(doc.supplyOn)}</p>}
            {isInvoice && doc.reference && <p className="text-slate-600">Your reference: {doc.reference}</p>}
            {!isInvoice && against && <p className="text-slate-600">Corrects invoice {against.number} of {fmtDate(against.issuedOn)}</p>}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 border-b border-slate-200 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isInvoice ? 'Invoice to' : 'Credit to'}</p>
            <p className="mt-1 font-semibold">{customer?.name}</p>
            <p className="text-slate-600">{[customer?.address, customer?.area, customer?.emirate].filter(Boolean).join(', ')}</p>
            <p className="text-slate-600">{customer?.trn ? `TRN ${customer.trn}` : 'TRN: not registered'}</p>
            {contact && <p className="mt-1 text-slate-800">Attention: {contact.name}, {contact.title}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Site</p>
            <p className="mt-1 font-semibold">{site?.name ?? '—'}</p>
            {site && <p className="text-slate-600">{[site.address, site.area, site.emirate].filter(Boolean).join(', ')}</p>}
            {!isInvoice && <p className="mt-1 text-slate-800">Reason: {doc.reason}</p>}
          </div>
        </section>

        <p className="py-4 text-[15px] font-semibold">{doc.title ?? doc.reason}</p>

        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <th className="w-10 px-2 py-2 font-semibold">No.</th>
              <th className="px-2 py-2 font-semibold">Description</th>
              <th className="w-16 px-2 py-2 text-right font-semibold">Qty</th>
              <th className="w-14 px-2 py-2 font-semibold">Unit</th>
              <th className="w-24 px-2 py-2 text-right font-semibold">Unit price</th>
              <th className="w-28 px-2 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={l.id} className="align-top">
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-500">{i + 1}</td>
                <td className="border-b border-slate-100 px-2 py-1.5">{l.description}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums">{num(l.qty)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-600">{l.unit}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums">{l.price < 0 ? `− ${money(-l.price)}` : money(l.price)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums">{lineAmount(l) < 0 ? `− ${money(-lineAmount(l))}` : money(lineAmount(l))}</td>
              </tr>
            ))}
            {doc.lines.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-slate-500">No items yet.</td></tr>}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{money(t.subtotal)}</dd></div>
            {t.discount > 0 && <div className="flex justify-between"><dt>Discount ({doc.discountPct}%)</dt><dd className="tabular-nums">− {money(t.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Taxable amount</dt><dd className="tabular-nums">{money(t.net)}</dd></div>
            <div className="flex justify-between"><dt>VAT {doc.vatRate}%</dt><dd className="tabular-nums">{money(t.vat)}</dd></div>
            <div className="flex justify-between border-t border-slate-400 pt-2 text-[15px] font-bold"><dt>Total (AED)</dt><dd className="tabular-nums">{money(t.total)}</dd></div>
          </dl>
        </div>

        <dl className="mt-6 space-y-2 border-t border-slate-200 pt-4">
          {isInvoice && (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[150px_1fr]"><dt className="font-semibold text-slate-700">Payment terms</dt><dd>{days === 0 ? 'Payment on delivery.' : `${days} days from the date of the invoice.`}</dd></div>
          )}
          {isInvoice && (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[150px_1fr]"><dt className="font-semibold text-slate-700">Pay by transfer to</dt><dd>{COMPANY.name}, Emirates Sample Bank, IBAN AE00 0000 0000 0000 0000 000 (sample). Please quote {doc.number || 'the invoice number'}.</dd></div>
          )}
          {doc.notes && <div className="grid grid-cols-1 gap-1 sm:grid-cols-[150px_1fr]"><dt className="font-semibold text-slate-700">Notes</dt><dd className="whitespace-pre-line">{doc.notes}</dd></div>}
          {!isInvoice && doc.note && <div className="grid grid-cols-1 gap-1 sm:grid-cols-[150px_1fr]"><dt className="font-semibold text-slate-700">Note</dt><dd className="whitespace-pre-line">{doc.note}</dd></div>}
        </dl>

        <footer className="mt-10 flex flex-wrap items-end justify-between gap-6 text-slate-600">
          <div>
            <div className="h-10 w-56 border-b border-slate-400" />
            <p className="mt-1">Authorised signatory, {COMPANY.short}</p>
          </div>
          <p className="text-xs">Amounts are in UAE dirhams (AED).</p>
        </footer>
      </article>
    </div>
  );
}
