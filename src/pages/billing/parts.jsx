import { FileSignatureIcon, HardHatIcon, PackageIcon, ReceiptIcon, WrenchIcon } from 'lucide-react';
import { AGE_BUCKETS, INVOICE_SOURCE } from '@/data/billingKinds.js';
import { lineAmount } from '@/data/billingRules.js';
import { cn } from '@/lib/cn.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { money, num } from '@/lib/format.js';
import { accountOf, invoiceViews, isOwed, receivables } from '@/store/billingSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Badge, Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Card, NavTabs } from '@/ui/Page.jsx';

// Small pieces shared by the screens of the Billing area.

export function BillingTabs() {
  const s = useStore();
  const today = todayISO();
  const owed = invoiceViews(s, today).filter(isOwed).length;
  const waiting = list(s.creditNotes).filter((c) => c.status === 'waiting_approval').length;
  return (
    <NavTabs
      items={[
        { to: '/billing', label: 'Invoices', count: owed },
        { to: '/billing/receipts', label: 'Receipts', count: list(s.payments).length },
        { to: '/billing/credit-notes', label: 'Credit notes', count: waiting > 0 ? waiting : undefined },
        { to: '/billing/statements', label: 'Statements', count: receivables(s, today).length },
      ]}
    />
  );
}

/** The state of an invoice; an overdue invoice that was partly paid says so. */
export const InvoiceBadge = ({ v }) => (
  <span className="inline-flex flex-wrap items-center gap-1.5">
    <Status kind="invoice" value={v.state} />
    {v.state === 'overdue' && v.settled.paid > 0 && <Badge>Part paid</Badge>}
    {v.inv.status === 'issued' && !v.inv.sent && v.state !== 'paid' && <Badge tone="blue">Not sent</Badge>}
  </span>
);

const ICONS = { contract: FileSignatureIcon, claim: HardHatIcon, job: WrenchIcon, supply: PackageIcon, manual: ReceiptIcon };

/** Where an invoice comes from: an icon and a word, in plain slate. */
export function SourceTag({ kind, className }) {
  const Icon = ICONS[kind] ?? ReceiptIcon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-slate-700', className)}>
      <Icon className="size-4 text-slate-500" aria-hidden="true" />
      {INVOICE_SOURCE[kind] ?? kind}
    </span>
  );
}

/** The lines of an invoice or a credit note: a table on a desktop, a list on a phone. */
export function LinesTable({ lines, empty = 'No items.' }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-medium text-slate-500">
              <th scope="col" className="border-b border-slate-200 px-3 py-2">Description</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Quantity</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Unit price</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="border-b border-slate-100 px-3 py-2.5 text-slate-900">{l.description}</td>
                <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5 text-right tabular-nums">{num(l.qty)} <span className="text-xs text-slate-500">{l.unit}</span></td>
                <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-600">{money(l.price)}</td>
                <td className={cn('border-b border-slate-100 px-3 py-2.5 text-right tabular-nums', lineAmount(l) < 0 ? 'text-slate-600' : 'text-slate-900')}>{money(lineAmount(l))}</td>
              </tr>
            ))}
            {lines.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-slate-100 px-3 md:hidden">
        {lines.map((l) => (
          <li key={l.id} className="py-2.5">
            <p className="text-sm text-slate-900">{l.description}</p>
            <p className="text-xs tabular-nums text-slate-500">{num(l.qty)} {l.unit} at {money(l.price)}</p>
            <p className="text-right text-sm tabular-nums text-slate-900">{money(lineAmount(l))}</p>
          </li>
        ))}
        {lines.length === 0 && <li className="py-6 text-center text-sm text-slate-500">{empty}</li>}
      </ul>
    </>
  );
}

// The colours of the ageing: grey is not due, orange is late, red is very late.
export const AGE_TONE = { current: 'bg-slate-300', d30: 'bg-amber-300', d60: 'bg-orange-400', d90: 'bg-red-400', d90p: 'bg-red-700' };

/** How old a debt is: one bar split by age, each part as wide as its money. `buckets` is { current, d30, d60, d90, d90p }. */
export function AgeBar({ buckets, thick = false, className }) {
  const total = AGE_BUCKETS.reduce((n, b) => n + buckets[b.key], 0);
  const text = AGE_BUCKETS.filter((b) => buckets[b.key] > 0.004).map((b) => `${b.label}: AED ${money(buckets[b.key])}`).join(', ');
  return (
    <div role="img" aria-label={text || 'Nothing owed'} title={text} className={cn('flex overflow-hidden rounded-full bg-slate-100', thick ? 'h-3' : 'h-2', className)}>
      {total > 0 && AGE_BUCKETS.map((b) => buckets[b.key] > 0.004 && <span key={b.key} className={AGE_TONE[b.key]} style={{ width: `${(buckets[b.key] / total) * 100}%` }} />)}
    </div>
  );
}

const MoneyRow = ({ label, value, tone }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
    <dt className="shrink-0 text-slate-600">{label}</dt>
    <dd className={cn('ml-auto min-w-0 text-right tabular-nums', tone ?? 'text-slate-900')}>{value}</dd>
  </div>
);

/** What one customer owes, on the customer's own page: for the people who see Billing. */
export function CustomerMoneyCard({ customerId }) {
  const s = useStore();
  const { may } = useSession();
  const a = accountOf(s, customerId);
  const nothing = a.balance <= 0.004 && a.onAccount <= 0.004 && !a.lastPayment;
  return (
    <Card title="Money" action={<Button variant="ghost" size="xs" to={`/billing/statements/${customerId}`}>Statement</Button>}>
      {nothing ? (
        <p className="text-sm text-slate-500">No invoice has been made for this customer yet.</p>
      ) : (
        <div className="space-y-3">
          <dl className="space-y-2 text-sm">
            <MoneyRow label="Owes on invoices" value={`AED ${money(a.balance)}`} tone="font-semibold text-slate-900" />
            {a.overdue > 0.004 && <MoneyRow label="Overdue" value={`AED ${money(a.overdue)}`} tone="font-medium text-red-700" />}
            {a.overdue > 0.004 && <MoneyRow label="Oldest" value={`${a.oldest} days late`} tone="text-red-700" />}
            {a.limit > 0 && <MoneyRow label="Credit limit" value={a.over ? `over by AED ${money(a.balance - a.limit)}` : `${Math.round(a.used)}% of AED ${money(a.limit)}`} tone={a.over ? 'font-medium text-orange-700' : undefined} />}
            {a.onAccount > 0.004 && <MoneyRow label="Money on account" value={`AED ${money(a.onAccount)}`} tone="text-orange-700" />}
            {a.lastPayment && <MoneyRow label="Last payment" value={`AED ${money(a.lastPayment.amount)}, ${fmtDate(a.lastPayment.on)}`} />}
          </dl>
          {a.balance > 0.004 && <AgeBar buckets={a.buckets} />}
        </div>
      )}
      {(may('issue_invoices') || may('receive_payments')) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {may('issue_invoices') && <Button size="xs" to={`/billing/new?customer=${customerId}`}>New invoice</Button>}
          {may('receive_payments') && <Button size="xs" to={`/billing/receipts?new=1&payer=${customerId}`}>Record payment</Button>}
        </div>
      )}
    </Card>
  );
}
