import { PrinterIcon } from 'lucide-react';
import { orderTotals, orderTitle } from '@/data/purchaseRules.js';
import { COMPANY } from '@/data/seed/staff.js';
import { fmtDate } from '@/lib/dates.js';
import { money, num } from '@/lib/format.js';
import { deliverLabel } from '@/store/purchaseSelectors.js';
import { useStore } from '@/store/store.js';
import { Button } from '@/ui/Button.jsx';

// The order as the supplier receives it. "Print" saves it as a PDF: the
// application's own frame is hidden when printing.
export function PurchaseOrderPreview({ v }) {
  const s = useStore();
  const { po, supplier } = v;
  const t = orderTotals(po);
  const project = s.projects[po.projectId];
  const job = s.jobs[po.jobId];
  const site = s.sites[project?.siteId ?? job?.siteId];
  const deliverAt = po.deliverTo === 'site' ? [site?.name, site?.address, site?.area].filter(Boolean).join(', ') : `${s.locations[po.deliverTo]?.name ?? 'Main store'}, ${COMPANY.address}`;
  const by = s.staff[po.approval.decidedBy] ?? s.staff[po.createdBy];

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">This is how the supplier sees the order. The project package of each line is for us only and is not printed.</p>
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
            <p className="text-xl font-bold uppercase tracking-wide">Purchase order</p>
            <p className="mt-1 font-semibold">{po.number}</p>
            <p className="text-slate-600">Date: {fmtDate(po.sent?.on ?? po.createdOn)}</p>
            {po.expectedOn && <p className="text-slate-600">Delivery by: {fmtDate(po.expectedOn)}</p>}
            {po.supplierRef && <p className="text-slate-600">Your reference: {po.supplierRef}</p>}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 border-b border-slate-200 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</p>
            <p className="mt-1 font-semibold">{supplier?.name}</p>
            <p className="text-slate-600">{supplier?.address}</p>
            {supplier?.trn && <p className="text-slate-600">TRN {supplier.trn}</p>}
            <p className="mt-1 text-slate-800">Attention: {supplier?.contactName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deliver to</p>
            <p className="mt-1 font-semibold">{po.deliverTo === 'site' ? 'Site' : 'Store'}</p>
            <p className="text-slate-600">{deliverAt || deliverLabel(s, po)}</p>
            <p className="mt-1 text-slate-800">Please quote {po.number} on the delivery note and on the invoice.</p>
          </div>
        </section>

        <p className="py-4 text-[15px] font-semibold">{orderTitle(po)}</p>

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
            {po.lines.map((l, i) => (
              <tr key={l.id} className="align-top">
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-500">{i + 1}</td>
                <td className="border-b border-slate-100 px-2 py-1.5">{l.description}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums">{num(l.qty)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-600">{l.unit}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums">{money(l.cost)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-right tabular-nums">{money(l.qty * l.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5">
            <div className="flex justify-between"><dt>Net amount</dt><dd className="tabular-nums">{money(t.net)}</dd></div>
            <div className="flex justify-between"><dt>VAT {po.vatRate}%</dt><dd className="tabular-nums">{money(t.vat)}</dd></div>
            <div className="flex justify-between border-t border-slate-400 pt-2 text-[15px] font-bold"><dt>Total (AED)</dt><dd className="tabular-nums">{money(t.total)}</dd></div>
          </dl>
        </div>

        <dl className="mt-6 space-y-2 border-t border-slate-200 pt-4">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[150px_1fr]"><dt className="font-semibold text-slate-700">Payment terms</dt><dd>{Number(supplier?.terms) === 0 ? 'Cash on delivery.' : `${supplier?.terms} days from the date of the invoice.`}</dd></div>
          {po.notes && <div className="grid grid-cols-1 gap-1 sm:grid-cols-[150px_1fr]"><dt className="font-semibold text-slate-700">Notes</dt><dd className="whitespace-pre-line">{po.notes}</dd></div>}
        </dl>

        <footer className="mt-10 flex flex-wrap items-end justify-between gap-6 text-slate-600">
          <div>
            <div className="h-10 w-56 border-b border-slate-400" />
            <p className="mt-1">Authorised by {by?.name}, {by?.title}</p>
          </div>
          <p className="text-xs">Please confirm this order and the delivery day by e-mail.</p>
        </footer>
      </article>
    </div>
  );
}
