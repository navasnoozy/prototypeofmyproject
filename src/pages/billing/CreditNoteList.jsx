import { useMemo } from 'react';
import { FileMinusIcon, PlusIcon } from 'lucide-react';
import { documentTotals, unappliedOf } from '@/data/billingRules.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { money, plural, round2 } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { creditLabel } from '@/store/billingSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { BillingTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'The credit notes of the company: the documents that take money off an invoice that was issued, because of a mistake, goods that came back, or a settled dispute.',
  why: [
    'An invoice that was issued cannot be changed or deleted. Tax rules ask for a trail: the wrong invoice stays, and a credit note, with its own number, corrects it (sample rule). The customer receives both.',
    'A credit note is made against one invoice and credits some of its lines, or all. The credit goes to that invoice as far as it still owes money. If the invoice was already paid, the credit stays on account for the next invoice.',
    'A credit note reduces what the company earns, so like a purchase order it follows authority. Small ones are issued by the accountant. Above the first limit the operations manager approves, and above the second the owner. The limits are in Settings.',
  ],
  assumed: [
    'The limits and the reasons are samples. Paying money back to a customer is not modelled: credit stays on account.',
    'A credit note draft cannot be edited: delete it and make it again. This keeps the prototype small; the product may allow edits.',
  ],
};

const SEGMENTS = [
  { value: 'all', label: 'All' },
  { value: 'waiting', label: 'Waiting approval' },
  { value: 'draft', label: 'Drafts' },
  { value: 'issued', label: 'Issued' },
  { value: 'credit', label: 'Credit left' },
];

export function CreditNoteList() {
  const s = useStore();
  const { may } = useSession();
  const [q, setQ] = useParam('q');
  const [seg, setSeg] = useParam('seg', 'all');
  const [customer, setCustomer] = useParam('customer');
  const today = todayISO();

  const all = useMemo(
    () => list(s.creditNotes).map((cn) => ({ cn, total: documentTotals(cn).total, left: cn.status === 'issued' ? unappliedOf(cn, documentTotals(cn).total) : 0, customer: s.customers[cn.customerId], invoice: s.invoices[cn.invoiceId] })),
    [s],
  );
  const inSeg = (r, key) => {
    switch (key) {
      case 'waiting': return r.cn.status === 'waiting_approval';
      case 'draft': return r.cn.status === 'draft';
      case 'issued': return r.cn.status === 'issued';
      case 'credit': return r.left > 0.004;
      default: return true;
    }
  };
  const counts = Object.fromEntries(SEGMENTS.map((x) => [x.value, all.filter((r) => inSeg(r, x.value)).length]));
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (r) => inSeg(r, seg) && (!customer || r.cn.customerId === customer) && (!needle || `${creditLabel(r.cn)} ${r.cn.reason} ${r.customer?.name ?? ''} ${r.invoice?.number ?? ''}`.toLowerCase().includes(needle)),
    );
  }, [all, q, seg, customer]);

  const issued = all.filter((r) => r.cn.status === 'issued');
  const thisYear = issued.filter((r) => r.cn.issuedOn >= `${today.slice(0, 4)}-01-01`);
  const waiting = all.filter((r) => r.cn.status === 'waiting_approval');
  const sum = (rowsOf, key = 'total') => round2(rowsOf.reduce((n, r) => n + r[key], 0));

  const columns = useMemo(
    () => [
      {
        key: 'number', header: 'Credit note', sortValue: (r) => r.cn.number || 'zzz',
        cell: (r) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap font-medium tabular-nums text-slate-900">{creditLabel(r.cn)}</p>
            <p className="max-w-[24ch] truncate text-xs text-slate-500">{r.cn.reason}</p>
          </div>
        ),
      },
      { key: 'customer', header: 'Customer', sortValue: (r) => r.customer?.name ?? '', cell: (r) => <span className="block max-w-[24ch] truncate text-slate-800">{r.customer?.name}</span> },
      { key: 'invoice', header: 'Against', hideBelow: 'xl', sortValue: (r) => r.invoice?.number ?? '', cell: (r) => <span className="whitespace-nowrap tabular-nums text-slate-700">{r.invoice?.number}</span> },
      { key: 'on', header: 'Date', hideBelow: 'xl', sortValue: (r) => r.cn.issuedOn || r.cn.createdOn, cell: (r) => <span className="whitespace-nowrap text-slate-600">{fmtDate(r.cn.issuedOn || r.cn.createdOn)}</span> },
      { key: 'total', header: 'Amount (AED)', align: 'right', sortValue: (r) => r.total, cell: (r) => money(r.total) },
      {
        key: 'left', header: 'Credit left (AED)', align: 'right', hideBelow: 'md', sortValue: (r) => r.left,
        cell: (r) => (r.left > 0.004 ? <span className="font-medium text-orange-700">{money(r.left)}</span> : <span className="text-slate-400">—</span>),
      },
      { key: 'state', header: 'State', cell: (r) => <Status kind="creditNote" value={r.cn.status} /> },
    ],
    [],
  );
  const table = useTable(rows, columns, { pageSize: 12, initialSort: { key: 'on', dir: 'desc' } });

  return (
    <Page
      title="Credit notes"
      facts={`${plural(all.length, 'credit note')} · AED ${money(sum(thisYear))} credited this year${waiting.length > 0 ? ` · ${plural(waiting.length, 'one')} waiting for approval` : ''}`}
      tabs={<BillingTabs />}
      about={ABOUT}
      actions={may('raise_credit_notes') && <Button variant="primary" icon={PlusIcon} to="/billing/credit-notes/new">New credit note</Button>}
      footer={<Pagination table={table} noun="credit notes" />}
    >
      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Credited this year" amount={sum(thisYear)} sub={plural(thisYear.length, 'credit note')} />
        <Stat label="Waiting for approval" amount={sum(waiting)} tone={waiting.length > 0 ? 'text-orange-700' : undefined} sub={plural(waiting.length, 'credit note')} />
        <Stat label="Credit not used yet" amount={sum(all, 'left')} sub={plural(counts.credit, 'credit note')} />
        <Stat label="Drafts" value={counts.draft} sub="not issued" />
      </dl>
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search number, reason, customer, invoice" />
        <FilterSelect label="Customer" value={customer} onChange={setCustomer} options={list(s.customers).filter((c) => all.some((r) => r.cn.customerId === c.id)).map((c) => ({ value: c.id, label: c.name }))} />
      </Toolbar>
      <div className="mb-4">
        <Segmented size="sm" label="Show" value={seg} onChange={setSeg} options={SEGMENTS.map((x) => ({ ...x, count: x.value === 'all' ? undefined : counts[x.value] }))} />
      </div>
      <DataTable
        columns={columns}
        rows={table.rows}
        rowKey={(r) => r.cn.id}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(r) => `/billing/credit-notes/${r.cn.id}`}
        empty={<EmptyState icon={FileMinusIcon} title="No credit note here" action={<Button onClick={() => { setQ(''); setCustomer(''); setSeg('all'); }}>Clear filters</Button>}>{all.length === 0 ? 'A credit note is made from an invoice that was issued: open the invoice and choose "Make a credit note".' : 'Try another segment or clear the filters.'}</EmptyState>}
        mobileRow={(r) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{creditLabel(r.cn)} · {r.customer?.name}</span>
              <span className="text-sm tabular-nums text-slate-900">{money(r.total)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Status kind="creditNote" value={r.cn.status} />
              <span className="min-w-0 truncate text-xs text-slate-500">{r.cn.reason}{r.left > 0.004 ? ` · AED ${money(r.left)} left` : ''}</span>
            </div>
          </div>
        )}
      />
    </Page>
  );
}
