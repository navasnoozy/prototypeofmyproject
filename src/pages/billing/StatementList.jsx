import { useMemo } from 'react';
import { UsersRoundIcon } from 'lucide-react';
import { AGE_BUCKETS } from '@/data/billingKinds.js';
import { cn } from '@/lib/cn.js';
import { todayISO } from '@/lib/dates.js';
import { money, plural, round2 } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { receivables } from '@/store/billingSelectors.js';
import { useStore } from '@/store/store.js';
import { Badge } from '@/ui/Badge.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { Card, EmptyState, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { AGE_TONE, AgeBar, BillingTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'What each customer owes us and how old it is, in one list, so the person who collects the money knows whom to call first.',
  why: [
    'Age is counted from the due day, not from the invoice day: an invoice that is not due yet is "not due", and one that is 45 days past its due day is in the 31 to 60 column. A customer that is late by more than 60 days is a risk, and the bell tells the finance people.',
    'The bar in each row shows the age of that customer\'s debt at a glance: grey is not due, orange is late, red is very late.',
    'The credit limit is a control of the company, not of the customer: a customer that is over its limit shows it here, and the invoice dialog warns before another invoice is issued.',
    'Money on account (a receipt or a credit note that no invoice has taken yet) is shown beside what is owed, because it is what the customer may take off its next payment.',
  ],
  assumed: ['Ageing in columns of 30 days from the due day is the usual practice; the company may prefer other columns. The credit limits are invented.'],
};

const SEGMENTS = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'late60', label: 'Over 60 days' },
  { value: 'over', label: 'Over the limit' },
];
const inSegment = (a, seg) => {
  switch (seg) {
    case 'overdue': return a.overdue > 0.004;
    case 'late60': return a.buckets.d90 + a.buckets.d90p > 0.004;
    case 'over': return a.over;
    default: return true;
  }
};

export function StatementList() {
  const s = useStore();
  const [q, setQ] = useParam('q');
  const [seg, setSeg] = useParam('seg', 'all');
  const today = todayISO();

  const all = useMemo(() => receivables(s, today), [s, today]);
  const counts = Object.fromEntries(SEGMENTS.map((x) => [x.value, all.filter((a) => inSegment(a, x.value)).length]));
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((a) => inSegment(a, seg) && (!needle || `${a.customer.name} ${a.customer.code}`.toLowerCase().includes(needle)));
  }, [all, q, seg]);

  const totals = Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, round2(all.reduce((n, a) => n + a.buckets[b.key], 0))]));
  const owed = round2(Object.values(totals).reduce((n, x) => n + x, 0));
  const overdue = round2(owed - totals.current);

  const columns = useMemo(
    () => [
      {
        key: 'customer', header: 'Customer', sortValue: (a) => a.customer.name,
        cell: (a) => (
          <div className="min-w-0">
            <p className="max-w-[28ch] truncate font-medium text-slate-900">{a.customer.name}</p>
            <p className="max-w-[28ch] truncate text-xs text-slate-500">{a.customer.code} · {a.customer.terms}{a.customer.status === 'on_hold' ? ' · on hold' : ''}</p>
          </div>
        ),
      },
      { key: 'age', header: 'Age of the debt', hideBelow: 'md', sortValue: (a) => a.oldest, cell: (a) => <AgeBar buckets={a.buckets} className="w-32" /> },
      ...AGE_BUCKETS.map((b) => ({
        key: b.key, header: b.label, align: 'right', hideBelow: 'xl', sortValue: (a) => a.buckets[b.key],
        cell: (a) => (a.buckets[b.key] > 0.004 ? <span className={cn(b.key === 'd90' || b.key === 'd90p' ? 'font-medium text-red-700' : b.key === 'current' ? 'text-slate-700' : 'text-orange-700')}>{money(a.buckets[b.key])}</span> : <span className="text-slate-300">—</span>),
      })),
      {
        key: 'owed', header: 'Owed (AED)', align: 'right', sortValue: (a) => a.balance,
        cell: (a) => <span className="font-medium text-slate-900">{money(a.balance)}</span>,
      },
      {
        key: 'overdue', header: 'Overdue (AED)', align: 'right', hideBelow: 'lg', sortValue: (a) => a.overdue,
        cell: (a) => (a.overdue > 0.004 ? <span className="text-red-700">{money(a.overdue)}</span> : <span className="text-slate-400">—</span>),
      },
      {
        key: 'limit', header: 'Credit limit', hideBelow: 'lg', sortValue: (a) => a.used,
        cell: (a) => (a.limit > 0
          ? (a.over
            ? <Badge tone="red">Over by {money(round2(a.balance - a.limit))}</Badge>
            : <span className="text-xs text-slate-600">{Math.round(a.used)}% of {money(a.limit)}</span>)
          : <span className="text-xs text-slate-400">no limit</span>),
      },
      {
        key: 'account', header: 'On account', align: 'right', hideBelow: 'xl', sortValue: (a) => a.onAccount,
        cell: (a) => (a.onAccount > 0.004 ? <span className="text-slate-700">{money(a.onAccount)}</span> : <span className="text-slate-300">—</span>),
      },
    ],
    [],
  );
  const table = useTable(rows, columns, { pageSize: 12, initialSort: { key: 'owed', dir: 'desc' } });

  return (
    <Page
      title="Statements"
      facts={`AED ${money(owed)} owed by ${plural(all.filter((a) => a.balance > 0.004).length, 'customer')}${overdue > 0 ? ` · AED ${money(overdue)} overdue` : ''}`}
      tabs={<BillingTabs />}
      about={ABOUT}
      footer={<Pagination table={table} noun="customers" />}
    >
      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Owed to us" amount={owed} sub={plural(all.filter((a) => a.balance > 0.004).length, 'customer')} />
        <Stat label="Overdue" amount={overdue} tone={overdue > 0 ? 'text-red-700' : undefined} sub={`${plural(counts.overdue, 'customer')} late`} />
        <Stat label="More than 60 days late" amount={round2(totals.d90 + totals.d90p)} tone={totals.d90 + totals.d90p > 0 ? 'text-red-700' : undefined} sub={plural(counts.late60, 'customer')} />
        <Stat label="Over the credit limit" value={counts.over} tone={counts.over > 0 ? 'text-orange-700' : undefined} sub={counts.over === 1 ? 'customer' : 'customers'} />
      </dl>

      {owed > 0 && (
        <Card title="Age of what customers owe" className="mb-5">
          <AgeBar buckets={totals} thick />
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
            {AGE_BUCKETS.map((b) => (
              <li key={b.key} className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className={cn('size-2.5 rounded-full', AGE_TONE[b.key])} aria-hidden="true" />{b.label}</span>
                <span className="block tabular-nums text-slate-900">{money(totals[b.key])}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search customer" />
        <Segmented size="sm" label="Show" value={seg} onChange={setSeg} options={SEGMENTS.map((x) => ({ ...x, count: x.value === 'all' ? undefined : counts[x.value] }))} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        rowKey={(a) => a.customer.id}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(a) => `/billing/statements/${a.customer.id}`}
        empty={<EmptyState icon={UsersRoundIcon} title={all.length === 0 ? 'Nobody owes anything' : 'No customer here'}>{all.length === 0 ? 'Every issued invoice is paid.' : 'Try another segment or fewer words.'}</EmptyState>}
        mobileRow={(a) => (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{a.customer.name}</span>
              <span className="text-sm font-medium tabular-nums text-slate-900">{money(a.balance)}</span>
            </div>
            <AgeBar buckets={a.buckets} />
            <p className="text-xs text-slate-500">
              {a.overdue > 0.004 ? <span className="text-red-700">AED {money(a.overdue)} overdue, the oldest {plural(a.oldest, 'day')}</span> : 'Nothing overdue'}
              {a.over && <span className="text-orange-700"> · over the limit</span>}
            </p>
          </div>
        )}
      />
    </Page>
  );
}
