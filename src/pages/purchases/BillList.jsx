import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ReceiptTextIcon } from 'lucide-react';
import { orderTitle } from '@/data/purchaseRules.js';
import { cn } from '@/lib/cn.js';
import { diffDays, fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { money, plural, round2 } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { billRows, orderView, toBillRows } from '@/store/purchaseSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { Card, EmptyState, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { BillDialog, PaidDialog } from './PurchaseOrderDialogs.jsx';
import { PurchaseTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'What the suppliers have billed us: which bills are due, which are overdue, which are paid. Under the list are the orders whose goods have arrived and whose bill has not.',
  why: [
    'A bill is always recorded against a purchase order, so it can be checked against what was ordered and what arrived (the three-way check). A bill that does not match is flagged when it is entered.',
    'The due day comes from the payment terms of the supplier. Overdue bills are red and reach the accountant through the bell.',
    'Goods that arrived without a bill are money owed that nobody has written down yet, so they have their own list.',
  ],
  assumed: ['Paying is only recorded here: the bank, the accounts and the VAT return are not part of the prototype (the study places them with the accounting system).'],
};

const SEGMENTS = [
  { value: 'pay', label: 'To pay' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All' },
];

export function BillList() {
  const s = useStore();
  const { may } = useSession();
  const [q, setQ] = useParam('q');
  const [seg, setSeg] = useParam('seg', 'pay');
  const [paying, setPaying] = useState(null);
  const [billing, setBilling] = useState(null);
  const today = todayISO();

  const all = useMemo(() => billRows(s, today), [s, today]);
  const unbilled = useMemo(() => toBillRows(s, today), [s, today]);
  const inSeg = (r, key) => (key === 'pay' ? r.state !== 'paid' : key === 'overdue' ? r.state === 'overdue' : key === 'paid' ? r.state === 'paid' : true);
  const counts = Object.fromEntries(SEGMENTS.map((x) => [x.value, all.filter((r) => inSeg(r, x.value)).length]));
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((r) => inSeg(r, seg) && (!needle || `${r.bill.supplierRef} ${r.bill.number} ${r.po.number} ${r.supplier?.name}`.toLowerCase().includes(needle)));
  }, [all, q, seg]);

  const columns = useMemo(
    () => [
      {
        key: 'bill', header: 'Bill', sortValue: (r) => r.bill.number,
        cell: (r) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap font-medium text-slate-900">{r.bill.supplierRef}</p>
            <p className="text-xs tabular-nums text-slate-500">{r.bill.number}</p>
          </div>
        ),
      },
      { key: 'supplier', header: 'Supplier', sortValue: (r) => r.supplier?.name ?? '', cell: (r) => <span className="block max-w-[28ch] truncate text-slate-800">{r.supplier?.name}</span> },
      { key: 'po', header: 'Order', hideBelow: 'md', sortValue: (r) => r.po.number, cell: (r) => <Link to={`/purchases/${r.po.id}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-medium tabular-nums underline-offset-2 hover:underline">{r.po.number}</Link> },
      { key: 'on', header: 'Billed', hideBelow: 'lg', sortValue: (r) => r.bill.on, cell: (r) => <span className="whitespace-nowrap text-slate-600">{fmtDate(r.bill.on)}</span> },
      {
        key: 'due', header: 'Due', sortValue: (r) => r.bill.dueOn,
        cell: (r) => (
          <span className={cn('whitespace-nowrap text-xs', r.state === 'overdue' ? 'font-medium text-red-700' : 'text-slate-600')}>
            {r.state === 'paid' ? `Paid ${fmtDate(r.bill.paidOn)}` : <>{fmtDate(r.bill.dueOn)}<span className="block text-slate-500">{relDays(r.bill.dueOn, today)}</span></>}
          </span>
        ),
      },
      { key: 'amount', header: 'Amount (AED)', align: 'right', sortValue: (r) => r.totals.total, cell: (r) => money(r.totals.total) },
      { key: 'state', header: 'State', cell: (r) => <Status kind="bill" value={r.state} /> },
      ...(may('pay_bills')
        ? [{ key: 'act', header: '', cell: (r) => (r.state !== 'paid' ? <Button size="xs" onClick={(e) => { e.stopPropagation(); setPaying(r); }}>Mark as paid</Button> : null) }]
        : []),
    ],
    [today, may],
  );
  const table = useTable(rows, columns, { pageSize: 12, initialSort: { key: 'due', dir: 'asc' } });

  const unpaid = all.filter((r) => r.state !== 'paid');
  const sum = (list) => round2(list.reduce((n, r) => n + r.totals.total, 0));
  const soon = unpaid.filter((r) => r.state === 'due' && diffDays(today, r.bill.dueOn) <= 7);

  return (
    <Page
      title="Supplier bills"
      facts={`${plural(unpaid.length, 'bill')} to pay · AED ${money(sum(unpaid))}`}
      tabs={<PurchaseTabs />}
      about={ABOUT}
      footer={<Pagination table={table} noun="bills" />}
    >
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="To pay" amount={sum(unpaid)} sub={plural(unpaid.length, 'bill')} />
        <Stat label="Overdue" amount={sum(unpaid.filter((r) => r.state === 'overdue'))} tone={unpaid.some((r) => r.state === 'overdue') ? 'text-red-700' : undefined} />
        <Stat label="Due within a week" amount={sum(soon)} />
        <Stat label="Arrived, not billed" amount={round2(unbilled.reduce((n, v) => n + v.progress.toBillNet, 0))} sub={plural(unbilled.length, 'order')} />
      </dl>
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search bill, supplier, order" />
        <Segmented size="sm" label="Show" value={seg} onChange={setSeg} options={SEGMENTS.map((x) => ({ value: x.value, label: x.label, count: x.value === 'all' ? undefined : counts[x.value] }))} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        rowKey={(r) => r.bill.id}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(r) => `/purchases/${r.po.id}`}
        empty={<EmptyState icon={ReceiptTextIcon} title="No bill here" action={<Button onClick={() => { setQ(''); setSeg('pay'); }}>Clear filters</Button>}>Try another segment or clear the search.</EmptyState>}
        mobileRow={(r) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{r.supplier?.name}</span>
              <span className="text-sm tabular-nums text-slate-900">{money(r.totals.total)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Status kind="bill" value={r.state} />
              <span className="text-xs text-slate-500">{r.bill.supplierRef} · {r.state === 'paid' ? `paid ${fmtDate(r.bill.paidOn)}` : `due ${fmtDate(r.bill.dueOn)}`}</span>
            </div>
          </div>
        )}
      />

      {unbilled.length > 0 && (
        <Card title="Arrived, not billed yet" className="mt-6" bodyClassName="!px-2">
          <ul className="divide-y divide-slate-100">
            {unbilled.map((v) => (
              <li key={v.po.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5">
                <Link to={`/purchases/${v.po.id}`} className="w-28 shrink-0 text-sm font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline">{v.po.number}</Link>
                <span className="min-w-0 flex-1 basis-48">
                  <span className="block truncate text-sm text-slate-800">{v.supplier?.name}</span>
                  <span className="block truncate text-xs text-slate-500">{orderTitle(v.po)}</span>
                </span>
                <span className="text-sm tabular-nums text-slate-900">AED {money(v.progress.toBillNet)}</span>
                {may('record_bills') && <Button size="xs" onClick={() => setBilling(v)}>Record bill</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {paying && <PaidDialog bill={paying.bill} po={paying.po} onClose={() => setPaying(null)} />}
      {billing && <BillDialog v={orderView(s, s.purchaseOrders[billing.po.id], today)} onClose={() => setBilling(null)} />}
    </Page>
  );
}
