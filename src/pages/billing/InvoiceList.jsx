import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PlusIcon, ReceiptIcon } from 'lucide-react';
import { INVOICE_SOURCE } from '@/data/billingKinds.js';
import { cn } from '@/lib/cn.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { money, plural, round2 } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { createInvoiceFromSource } from '@/store/billingActions.js';
import { invoiceLabel, invoiceViews, isOwed, toInvoice } from '@/store/billingSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { Card, EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { BillingTabs, InvoiceBadge, SourceTag } from './parts.jsx';

const ABOUT = {
  purpose: 'Every tax invoice of the company, from the draft to the paid invoice, and, above the list, the work that is finished and not invoiced yet.',
  why: [
    'An invoice is never typed from nothing. It is made from a record of another area: an instalment of a maintenance contract, a certified project claim, a chargeable job whose report has gone, or an accepted supply. The lines and the amounts come with it, and the record learns the invoice number, so nothing is invoiced twice.',
    'The panel "Ready to invoice" is the first thing to look at: work that is done and not invoiced is money waiting. An instalment that was due and never invoiced is shown in red.',
    'An issued invoice cannot be changed. A mistake is corrected with a credit note, as tax rules ask (sample).',
    'Payment is not a button on the invoice. It is a receipt that takes the money and says which invoices it pays, so one transfer can pay several invoices, and money that is not allocated stays on account.',
  ],
  assumed: [
    'The invoice follows the usual content of a UAE tax invoice (the word "Tax Invoice", our TRN and the customer\'s TRN, a number, the dates, the lines, VAT at 5% and the total in AED). How many days after the supply it must be issued, and the coming e-invoicing format, are open questions for the product\'s research.',
    'A call-out is charged when the site has no contract: the call-out charge (which takes the first hour), the technician\'s time beyond it, and the parts. Under a contract it is covered. These charges are a sample of how a company might price it.',
    'The value added tax on a claim is charged on the amount due now; VAT on the retention is charged when the retention is released (sample, to be confirmed).',
  ],
};

const SEGMENTS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'unsent', label: 'Not sent' },
  { value: 'draft', label: 'Drafts' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All' },
];
const inSegment = (v, seg) => {
  switch (seg) {
    case 'unpaid': return isOwed(v);
    case 'overdue': return v.state === 'overdue';
    case 'unsent': return v.inv.status === 'issued' && !v.inv.sent;
    case 'draft': return v.inv.status === 'draft';
    case 'paid': return ['paid', 'credited'].includes(v.state);
    default: return true;
  }
};

/** The work that is finished and not invoiced. */
function ReadyCard({ items, may }) {
  const s = useStore();
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 4);
  const make = (item) => {
    const id = createInvoiceFromSource(item.source);
    if (!item.draftId) toast('Draft made: check it and issue it');
    navigate(`/billing/${id}`);
  };
  const when = (x) => {
    if (x.kind === 'contract') return x.late > 0 ? { text: `due ${plural(x.late, 'day')} ago`, tone: 'text-red-700 font-medium' } : x.late === 0 ? { text: 'due today', tone: 'text-orange-700' } : { text: `due in ${plural(-x.late, 'day')}`, tone: 'text-slate-500' };
    return { text: `waiting ${plural(Math.max(x.late, 0), 'day')}`, tone: x.late > 14 ? 'text-orange-700' : 'text-slate-500' };
  };
  return (
    <Card
      title={`Ready to invoice (${items.length})`}
      className="mb-5"
      action={<span className="text-xs tabular-nums text-slate-500">AED {money(round2(items.reduce((n, x) => n + x.amount, 0)))} before VAT</span>}
      bodyClassName="!px-2"
    >
      <ul className="divide-y divide-slate-100">
        {shown.map((x) => {
          const w = when(x);
          return (
            <li key={x.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5">
              <span className="min-w-0 flex-1 basis-64">
                <span className="flex items-center gap-2">
                  <SourceTag kind={x.kind} className="shrink-0 text-xs" />
                  <span className="truncate text-sm font-medium text-slate-900">{x.title}</span>
                </span>
                <span className="block truncate text-xs text-slate-500">{s.customers[x.customerId]?.name} · {x.sub}</span>
              </span>
              <span className={cn('text-xs', w.tone)}>{w.text}</span>
              <span className="w-24 text-right text-sm tabular-nums text-slate-900">{money(x.amount)}</span>
              {may && <Button size="xs" variant={x.draftId ? 'secondary' : 'primary'} onClick={() => make(x)}>{x.draftId ? 'Open the draft' : 'Make invoice'}</Button>}
            </li>
          );
        })}
      </ul>
      {items.length > 4 && (
        <div className="px-3 pt-2">
          <button type="button" onClick={() => setAll((a) => !a)} className="text-xs font-medium text-slate-700 underline underline-offset-2">
            {all ? 'Show fewer' : `Show all ${items.length}`}
          </button>
        </div>
      )}
    </Card>
  );
}

export function InvoiceList() {
  const s = useStore();
  const { may } = useSession();
  const issuer = may('issue_invoices');
  const [q, setQ] = useParam('q');
  const [seg, setSeg] = useParam('seg', 'unpaid');
  const [customer, setCustomer] = useParam('customer');
  const [source, setSource] = useParam('source');
  const today = todayISO();

  const views = useMemo(() => invoiceViews(s, today), [s, today]);
  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map((x) => [x.value, views.filter((v) => inSegment(v, x.value)).length])), [views]);
  const queue = useMemo(() => toInvoice(s, today), [s, today]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return views.filter(
      (v) =>
        inSegment(v, seg) &&
        (!customer || v.inv.customerId === customer) &&
        (!source || v.inv.source.kind === source) &&
        (!needle || `${invoiceLabel(v.inv)} ${v.inv.title} ${v.customer?.name ?? ''} ${v.site?.name ?? ''} ${v.inv.reference}`.toLowerCase().includes(needle)),
    );
  }, [views, q, seg, customer, source]);

  const owed = views.filter(isOwed);
  const overdue = owed.filter((v) => v.state === 'overdue');
  const thirtyDaysAgo = new Date(new Date(today).getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const received = list(s.payments).filter((p) => p.on >= thirtyDaysAgo).reduce((n, p) => n + p.amount, 0);

  const columns = useMemo(
    () => [
      {
        key: 'number', header: 'Invoice', sortValue: (v) => v.inv.number || 'zzz',
        cell: (v) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap font-medium tabular-nums text-slate-900">{invoiceLabel(v.inv)}</p>
            <p className="max-w-[22ch] truncate text-xs text-slate-500">{v.inv.title}</p>
          </div>
        ),
      },
      {
        key: 'customer', header: 'Customer', sortValue: (v) => v.customer?.name ?? '',
        cell: (v) => (
          <div className="min-w-0">
            <p className="max-w-[22ch] truncate text-slate-800">{v.customer?.name}</p>
            {v.site && <p className="max-w-[22ch] truncate text-xs text-slate-500">{v.site.name}</p>}
          </div>
        ),
      },
      { key: 'source', header: 'From', hideBelow: 'xl', sortValue: (v) => v.inv.source.kind, cell: (v) => <SourceTag kind={v.inv.source.kind} /> },
      { key: 'issued', header: 'Issued', hideBelow: 'xl', sortValue: (v) => v.inv.issuedOn || '9999', cell: (v) => <span className="whitespace-nowrap text-slate-600">{fmtDate(v.inv.issuedOn)}</span> },
      {
        key: 'due', header: 'Due', hideBelow: 'md', sortValue: (v) => v.inv.dueOn || '9999',
        cell: (v) => (v.inv.status === 'draft' ? <span className="text-slate-400">—</span> : (
          <span className={cn('whitespace-nowrap text-xs', v.state === 'overdue' ? 'font-medium text-red-700' : 'text-slate-600')}>
            {fmtDate(v.inv.dueOn)}
            {isOwed(v) && <span className="block text-slate-500">{relDays(v.inv.dueOn, today)}</span>}
          </span>
        )),
      },
      { key: 'total', header: 'Total (AED)', align: 'right', sortValue: (v) => v.totals.total, cell: (v) => money(v.totals.total) },
      {
        key: 'balance', header: 'Owed (AED)', align: 'right', hideBelow: 'lg', sortValue: (v) => v.balance,
        cell: (v) => (isOwed(v) ? <span className={cn(v.state === 'overdue' && 'font-medium text-red-700')}>{money(v.balance)}</span> : <span className="text-slate-400">—</span>),
      },
      { key: 'state', header: 'State', cell: (v) => <InvoiceBadge v={v} /> },
    ],
    [today],
  );
  const table = useTable(rows, columns, { pageSize: 12, initialSort: { key: 'due', dir: 'asc' } });

  return (
    <Page
      title="Invoices"
      facts={`${plural(owed.length, 'invoice')} unpaid · AED ${money(round2(owed.reduce((n, v) => n + v.balance, 0)))} owed to us${overdue.length > 0 ? ` · AED ${money(round2(overdue.reduce((n, v) => n + v.balance, 0)))} overdue` : ''}`}
      tabs={<BillingTabs />}
      about={ABOUT}
      actions={issuer && <Button variant="primary" icon={PlusIcon} to="/billing/new">New invoice</Button>}
      footer={<Pagination table={table} noun="invoices" />}
    >
      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Owed to us" amount={round2(owed.reduce((n, v) => n + v.balance, 0))} sub={plural(owed.length, 'invoice')} />
        <Stat label="Overdue" amount={round2(overdue.reduce((n, v) => n + v.balance, 0))} tone={overdue.length > 0 ? 'text-red-700' : undefined} sub={plural(overdue.length, 'invoice')} />
        <Stat label="Ready to invoice" amount={round2(queue.reduce((n, x) => n + x.amount, 0))} sub={plural(queue.length, 'thing')} tone={queue.some((x) => x.kind === 'contract' && x.late > 0) ? 'text-orange-700' : undefined} />
        <Stat label="Received, last 30 days" amount={round2(received)} sub={plural(list(s.payments).filter((p) => p.on >= thirtyDaysAgo).length, 'receipt')} />
      </dl>

      {queue.length > 0 && <ReadyCard items={queue} may={issuer} />}

      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search number, customer, site, reference" />
        <FilterSelect label="Customer" value={customer} onChange={setCustomer} options={list(s.customers).filter((c) => views.some((v) => v.inv.customerId === c.id)).map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect label="From" value={source} onChange={setSource} options={Object.entries(INVOICE_SOURCE).map(([value, label]) => ({ value, label }))} />
      </Toolbar>
      <div className="mb-4">
        <Segmented size="sm" label="Show" value={seg} onChange={setSeg} options={SEGMENTS.map((x) => ({ value: x.value, label: x.label, count: x.value === 'all' ? undefined : counts[x.value] }))} />
      </div>
      <DataTable
        columns={columns}
        rows={table.rows}
        rowKey={(v) => v.inv.id}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(v) => `/billing/${v.inv.id}`}
        empty={<EmptyState icon={ReceiptIcon} title="No invoice here" action={<Button onClick={() => { setQ(''); setCustomer(''); setSource(''); setSeg('unpaid'); }}>Clear filters</Button>}>Try another segment, fewer words, or clear the filters.</EmptyState>}
        mobileRow={(v) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{invoiceLabel(v.inv)} · {v.customer?.name}</span>
              <span className="text-sm tabular-nums text-slate-900">{money(isOwed(v) ? v.balance : v.totals.total)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <InvoiceBadge v={v} />
              <span className="min-w-0 truncate text-xs text-slate-500">{v.inv.status === 'draft' ? v.inv.title : `due ${fmtDate(v.inv.dueOn)}`}</span>
            </div>
          </div>
        )}
      />
      {views.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          No invoice yet. <Link className="font-medium underline" to="/billing/new">Make the first one</Link>.
        </p>
      )}
    </Page>
  );
}
