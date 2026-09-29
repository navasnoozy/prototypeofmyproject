import { useMemo } from 'react';
import { Link } from 'react-router';
import { PlusIcon, ShoppingCartIcon, ShieldCheckIcon } from 'lucide-react';
import { PO_PURPOSE } from '@/data/purchaseKinds.js';
import { orderTitle } from '@/data/purchaseRules.js';
import { cn } from '@/lib/cn.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { aed, money, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { canApprovePO, forWhat, inSegment, orderViews, SEGMENTS } from '@/store/purchaseSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { ForCell, OrderBadge, PurchaseTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'Every purchase order of the company, from the draft to the closed order: what was ordered, from whom, what it is for, what has arrived, and whether the supplier has billed it.',
  why: [
    'One list with segments, because a buyer asks the same few questions all day: what waits for approval, what should have arrived, what has arrived and is not billed yet.',
    'An order is for stock, for a project or for a job. A project or job order is charged to it at once; an order for stock adds to the balance when the goods arrive (study, sections K.7 and L).',
    'The state of an order after it is sent comes from what really happened, not from a button: the deliveries and the supplier bills decide whether it is partly received, received or closed.',
    '"Late" means the supplier promised a day and it has passed. The buyer chases these first.',
  ],
  assumed: [
    'The approval limits (AED 10,000 for the purchase officer, AED 100,000 for the operations manager) are samples; the owner can change them in Settings.',
    'Supplier names, prices and terms are invented. VAT is 5% on local suppliers; an imported supply carries none on the invoice (sample).',
  ],
};

export function PurchaseOrderList() {
  const s = useStore();
  const { may, user } = useSession();
  const [q, setQ] = useParam('q');
  const [seg, setSeg] = useParam('seg', 'open');
  const [supplier, setSupplier] = useParam('supplier');
  const [purpose, setPurpose] = useParam('for');
  const today = todayISO();

  const views = useMemo(() => orderViews(s, today), [s, today]);
  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map((x) => [x.value, views.filter((v) => inSegment(v, x.value)).length])), [views]);
  const waitingForMe = views.filter((v) => canApprovePO(v.po, s, user.id));

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return views.filter(
      (v) =>
        inSegment(v, seg) &&
        (!supplier || v.po.supplierId === supplier) &&
        (!purpose || v.po.purpose === purpose) &&
        (!needle || `${v.po.number} ${orderTitle(v.po)} ${v.supplier?.name ?? ''} ${forWhat(s, v.po)}`.toLowerCase().includes(needle)),
    );
  }, [views, s, q, seg, supplier, purpose]);

  const columns = useMemo(
    () => [
      { key: 'number', header: 'Order', sortValue: (v) => v.po.number, cell: (v) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap font-medium tabular-nums text-slate-900">{v.po.number}</p>
          <p className="max-w-[26ch] truncate text-xs text-slate-500">{orderTitle(v.po)}</p>
        </div>
      ) },
      { key: 'supplier', header: 'Supplier', sortValue: (v) => v.supplier?.name ?? '', cell: (v) => <span className="block max-w-[28ch] truncate text-slate-800">{v.supplier?.name}</span> },
      { key: 'for', header: 'For', hideBelow: 'lg', sortValue: (v) => forWhat(s, v.po), cell: (v) => <ForCell po={v.po} /> },
      { key: 'status', header: 'State', cell: (v) => <OrderBadge v={v} /> },
      {
        key: 'expected', header: 'Expected', hideBelow: 'md', sortValue: (v) => v.po.expectedOn || '9999',
        cell: (v) => {
          const open = ['sent', 'partly_received', 'approved'].includes(v.status);
          return v.po.expectedOn ? (
            <span className={cn('whitespace-nowrap text-xs', v.late ? 'font-medium text-red-700' : 'text-slate-600')}>
              {fmtDate(v.po.expectedOn)}{open && <span className="block text-slate-500">{relDays(v.po.expectedOn, today)}</span>}
            </span>
          ) : <span className="text-slate-400">—</span>;
        },
      },
      { key: 'total', header: 'Total (AED)', align: 'right', sortValue: (v) => v.totals.total, cell: (v) => money(v.totals.total) },
    ],
    [s, today],
  );

  const table = useTable(rows, columns, { pageSize: 12, initialSort: { key: 'number', dir: 'desc' } });
  const openValue = views.filter((v) => ['sent', 'partly_received'].includes(v.status)).reduce((n, v) => n + v.progress.outstandingNet, 0);

  return (
    <Page
      title="Purchase orders"
      facts={`${plural(counts.open, 'open order')} · AED ${money(openValue)} still to arrive`}
      tabs={<PurchaseTabs />}
      about={ABOUT}
      actions={may('request_purchase') && <Button variant="primary" icon={PlusIcon} to="/purchases/new">New purchase order</Button>}
      footer={<Pagination table={table} noun="orders" />}
    >
      {waitingForMe.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
          <ShieldCheckIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">{waitingForMe.length === 1 ? '1 order waits' : `${waitingForMe.length} orders wait`} for your approval</strong>
            {' '}({aed(waitingForMe.reduce((n, v) => n + v.totals.total, 0))}).
          </span>
          {seg !== 'waiting' ? <Button size="xs" onClick={() => setSeg('waiting')}>Show them</Button> : null}
        </div>
      )}
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search number, supplier, project" />
        <FilterSelect label="Supplier" value={supplier} onChange={setSupplier} options={list(s.suppliers).map((x) => ({ value: x.id, label: x.name }))} />
        <FilterSelect label="For" value={purpose} onChange={setPurpose} options={Object.entries(PO_PURPOSE).map(([value, label]) => ({ value, label }))} />
      </Toolbar>
      <div className="mb-4">
        <Segmented
          size="sm"
          label="Show"
          value={seg}
          onChange={setSeg}
          options={SEGMENTS.map((x) => ({ value: x.value, label: x.label, count: x.value === 'all' ? undefined : counts[x.value] }))}
        />
      </div>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(v) => `/purchases/${v.po.id}`}
        empty={
          <EmptyState icon={ShoppingCartIcon} title="No order here" action={<Button onClick={() => { setQ(''); setSupplier(''); setPurpose(''); setSeg('open'); }}>Clear filters</Button>}>
            Try another segment, fewer words, or clear the filters.
          </EmptyState>
        }
        mobileRow={(v) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{v.po.number} · {v.supplier?.name}</span>
              <span className="text-sm tabular-nums text-slate-900">{money(v.totals.total)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <OrderBadge v={v} />
              <span className="min-w-0 truncate text-xs text-slate-500">{orderTitle(v.po)} · {forWhat(s, v.po)}</span>
            </div>
          </div>
        )}
      />
      {rows.length === 0 && seg === 'all' && views.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          No purchase orders yet. <Link className="font-medium underline" to="/purchases/new">Make the first one</Link>.
        </p>
      )}
    </Page>
  );
}
