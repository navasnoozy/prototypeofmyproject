import { PrinterIcon } from 'lucide-react';
import { KINDS, URGENCY } from '@/data/quotationKinds.js';
import { COMPANY } from '@/data/seed/staff.js';
import { fmtDate } from '@/lib/dates.js';
import { money, num } from '@/lib/format.js';
import { lineAmount, quotationLabel, quoteTotals } from '@/store/salesSelectors.js';
import { useStore } from '@/store/store.js';
import { Button } from '@/ui/Button.jsx';

const BILLING = { annual: 'once a year in advance', quarterly: 'every quarter in advance', monthly: 'every month in advance' };

function Terms({ label, children }) {
  return children ? (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[150px_1fr]">
      <dt className="font-semibold text-slate-700">{label}</dt>
      <dd className="whitespace-pre-line text-slate-800">{children}</dd>
    </div>
  ) : null;
}

// The quotation as the customer receives it. "Print" saves it as a PDF: the
// application's own frame is hidden when printing.
export function QuotationPreview({ q }) {
  const s = useStore();
  const t = quoteTotals(q, s.settings.vatRate);
  const customer = s.customers[q.customerId];
  const site = s.sites[q.siteId];
  const contact = s.contacts[q.contactId];
  const by = s.staff[q.preparedBy];
  const k = q.kindData;
  const grouped = q.kind === 'project' || q.kind === 'contract';

  const specifics = {
    project: [
      ['Time to complete', `${k.durationWeeks} weeks from the advance payment and access to the site.`],
      ['Civil Defence approval', k.cdApproval === 'contractor' ? 'We prepare and follow up the submission.' : 'The customer submits and follows up.'],
    ],
    contract: [
      ['Term', `${k.termMonths} months from ${fmtDate(k.startOn)}.`],
      ['Planned visits', `${k.visitsPerYear} visits a year, with a service report after each visit.`],
      ['Billing', `The yearly fee is billed ${BILLING[k.billing]}.`],
      ['Emergency response', `A technician attends within ${k.responseHours} hours of a call.`],
    ],
    repair: [
      ['Urgency', URGENCY[k.urgency]],
      ['Time to complete', `${k.durationDays} day${k.durationDays === 1 ? '' : 's'} after approval and access.`],
    ],
    supply: [['Delivery', `Within ${k.deliveryDays} days of the order.`]],
  }[q.kind];

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">This is how the customer sees the quotation. Cost and margin are never printed.</p>
        <Button icon={PrinterIcon} onClick={() => window.print()}>Print or save as PDF</Button>
      </div>

      <article className="mx-auto max-w-[840px] rounded-2xl border border-slate-200 bg-white p-6 text-[13px] leading-5 text-slate-900 shadow-sm sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-300 pb-5">
          <div>
            <p className="text-lg font-bold tracking-tight">{COMPANY.name}</p>
            <p className="mt-1 text-slate-600">{COMPANY.address}</p>
            <p className="text-slate-600">{COMPANY.phone} · {COMPANY.email}</p>
            <p className="text-slate-600">TRN {COMPANY.trn}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide">Quotation</p>
            <p className="mt-1 font-semibold">{quotationLabel(q)}</p>
            <p className="text-slate-600">Date: {fmtDate(q.createdOn)}</p>
            <p className="text-slate-600">Valid until: {fmtDate(q.validUntil)}</p>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 border-b border-slate-200 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</p>
            <p className="mt-1 font-semibold">{customer?.name}</p>
            <p className="text-slate-600">{[customer?.address, customer?.area, customer?.emirate].filter(Boolean).join(', ')}</p>
            {customer?.trn && <p className="text-slate-600">TRN {customer.trn}</p>}
            {contact && <p className="mt-1 text-slate-800">Attention: {contact.name}, {contact.title}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Site</p>
            <p className="mt-1 font-semibold">{site?.name ?? '—'}</p>
            {site && <p className="text-slate-600">{[site.address, site.area, site.emirate].filter(Boolean).join(', ')}</p>}
            <p className="mt-1 text-slate-800">{KINDS[q.kind].label} quotation</p>
          </div>
        </section>

        <p className="py-4 text-[15px] font-semibold">{q.title}</p>

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
            {q.sections.map((sec, si) => {
              const lines = q.lines.filter((l) => l.sectionId === sec.id);
              if (lines.length === 0) return null;
              return [
                grouped && (
                  <tr key={`${sec.id}-h`}>
                    <td colSpan={6} className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-[12px] font-semibold">{sec.title}</td>
                  </tr>
                ),
                ...lines.map((l, i) => (
                  <tr key={l.id} className="align-top">
                    <td className="border-b border-slate-100 px-2 py-1.5 text-slate-500">{grouped ? `${si + 1}.${i + 1}` : i + 1}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5">{l.description}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums">{num(l.qty)}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 text-slate-600">{l.unit}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums">{money(l.price)}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums">{money(lineAmount(l))}</td>
                  </tr>
                )),
              ];
            })}
            {q.lines.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-6 text-center text-slate-500">No items yet.</td></tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{money(t.subtotal)}</dd></div>
            {t.discount > 0 && <div className="flex justify-between"><dt>Discount ({q.discountPct}%)</dt><dd className="tabular-nums">− {money(t.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Net amount</dt><dd className="tabular-nums">{money(t.net)}</dd></div>
            <div className="flex justify-between"><dt>VAT {s.settings.vatRate}%</dt><dd className="tabular-nums">{money(t.vat)}</dd></div>
            <div className="flex justify-between border-t border-slate-400 pt-2 text-[15px] font-bold"><dt>Total (AED)</dt><dd className="tabular-nums">{money(t.total)}</dd></div>
          </dl>
        </div>

        <section className="mt-8 border-t border-slate-200 pt-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Terms</h2>
          <dl className="space-y-2">
            {specifics.map(([label, text]) => <Terms key={label} label={label}>{text}</Terms>)}
            <Terms label="Payment">{q.terms.payment}</Terms>
            <Terms label="Delivery">{q.terms.delivery}</Terms>
            <Terms label="Warranty">{q.terms.warranty}</Terms>
            <Terms label="Not included">{q.terms.exclusions}</Terms>
            <Terms label="Notes">{q.terms.notes}</Terms>
            <Terms label="Prices">All prices are in UAE dirhams. VAT is charged at {s.settings.vatRate}%. The prices hold until {fmtDate(q.validUntil)}.</Terms>
          </dl>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">For {COMPANY.short}</p>
            <p className="mt-8 border-t border-slate-400 pt-1 font-semibold">{by?.name}</p>
            <p className="text-slate-600">{by?.title}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accepted for the customer</p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <p className="border-t border-slate-400 pt-1 text-slate-600">Name and signature</p>
              <p className="border-t border-slate-400 pt-1 text-slate-600">Date and stamp</p>
            </div>
            <p className="mt-6 border-t border-slate-400 pt-1 text-slate-600">Customer order (LPO) number</p>
          </div>
        </section>
      </article>
    </div>
  );
}
