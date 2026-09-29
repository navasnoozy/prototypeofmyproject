import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeftRightIcon, ClipboardCheckIcon, PackageIcon, TriangleAlertIcon } from 'lucide-react';
import { orderTitle } from '@/data/purchaseRules.js';
import { cn } from '@/lib/cn.js';
import { diffDays, fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { money, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { createDraftOrders } from '@/store/purchaseActions.js';
import { locationList, lowStockRows, negativeBalances, reorderGroups, stockRows, stockValue, vanOfPerson, vanShortfalls } from '@/store/inventorySelectors.js';
import { orderView } from '@/store/purchaseSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { Card, EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { ReceiveDialog } from '@/pages/purchases/PurchaseOrderDialogs.jsx';
import { InventoryTabs, shortPlace } from './parts.jsx';
import { CountDrawer, TransferDrawer } from './StockDrawers.jsx';

const ABOUT = {
  purpose: 'What is in the store and in each van, what is below its minimum and needs ordering, which deliveries are expected, and what each van lacks against its usual level.',
  why: [
    'Stock is kept in places: the main store and one van for each technician who has one (study, section L: warehouses include trucks). A van is stock like any other, so a part used on a job comes out of the van of the technician.',
    'A balance is never typed in: it is the sum of movements (deliveries, parts used on jobs, transfers, counts). To fix a balance, count the place: the difference becomes a movement with a reason.',
    'The minimum and the usual order quantity are set per item. Below the minimum, and not covered by an order that is on its way, an item is suggested for reordering, grouped by supplier so one draft order is made for each.',
    'A balance below zero means a part was used that nobody recorded as stock. It is shown in red and the place needs a count.',
  ],
  assumed: ['The minimums, the van levels and every quantity are samples. Stock is valued at the average cost of the deliveries.'],
};

const Qty = ({ value, className }) => (
  <span className={cn('tabular-nums', value < 0 ? 'font-semibold text-red-700' : value === 0 ? 'text-slate-400' : 'text-slate-900', className)}>{value < 0 ? `−${Math.abs(value)}` : value}</span>
);

export function Stock() {
  const s = useStore();
  const navigate = useNavigate();
  const { may, user, roleKey } = useSession();
  const today = todayISO();
  const myVan = vanOfPerson(s, user.id);
  const [q, setQ] = useParam('q');
  const [state, setState] = useParam('state');
  const [at, setAt] = useParam('at', roleKey === 'technician' && myVan ? myVan.id : 'all');
  const [drawer, setDrawer] = useState(null); // { type: 'transfer', preset } | { type: 'count', locationId }
  const [receiving, setReceiving] = useState(null);

  const places = locationList(s);
  const vans = places.filter((l) => l.kind === 'van');
  const rows = useMemo(() => stockRows(s), [s]);
  const place = s.locations[at] ?? null;
  const low = lowStockRows(rows);
  const negative = negativeBalances(s);
  const groups = reorderGroups(s, rows);
  const controller = may('stock_control');
  const buyer = may('request_purchase');
  const seeCost = may('see_cost');

  const deliveries = list(s.purchaseOrders)
    .filter((po) => po.status === 'sent' && po.deliverTo !== 'site')
    .map((po) => orderView(s, po, today))
    .filter((v) => !v.progress.allReceived)
    .toSorted((a, b) => (a.po.expectedOn || '9999').localeCompare(b.po.expectedOn || '9999'));
  const vanNeeds = Object.fromEntries(vans.map((v) => [v.id, vanShortfalls(s, v.id)]));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!needle || `${r.item.code} ${r.item.name} ${r.item.category}`.toLowerCase().includes(needle)) &&
        (!state || (state === 'low' ? ['low', 'out'].includes(r.state) : r.state === state)) &&
        (at === 'all' || at === 'loc_store' || (r.item.vanPar > 0 || (r.row[at] ?? 0) !== 0)),
    );
  }, [rows, q, state, at]);

  const columns = useMemo(() => {
    const item = { key: 'item', header: 'Item', sortValue: (r) => r.item.code, cell: (r) => (
      <div className="min-w-0">
        <p className="max-w-[40ch] truncate text-slate-900">{r.item.name}</p>
        <p className="text-xs text-slate-500">{r.item.code}</p>
      </div>
    ) };
    if (at === 'all') {
      return [
        item,
        { key: 'store', header: 'Store', align: 'right', sortValue: (r) => r.store, cell: (r) => <Qty value={r.store} /> },
        ...vans.map((v) => ({ key: v.id, header: shortPlace(v), align: 'right', hideBelow: 'lg', sortValue: (r) => r.row[v.id] ?? 0, cell: (r) => <Qty value={r.row[v.id] ?? 0} /> })),
        { key: 'total', header: 'Total', align: 'right', hideBelow: 'md', sortValue: (r) => r.total, cell: (r) => <Qty value={r.total} className="font-medium" /> },
        { key: 'ordered', header: 'On order', align: 'right', hideBelow: 'lg', sortValue: (r) => r.onOrder, cell: (r) => (r.onOrder ? <span className="tabular-nums text-blue-700">+{r.onOrder}</span> : <span className="text-slate-400">—</span>) },
        { key: 'min', header: 'Minimum', align: 'right', hideBelow: 'xl', sortValue: (r) => r.item.minStore, cell: (r) => <span className="tabular-nums text-slate-500">{r.item.minStore}</span> },
        { key: 'state', header: 'Store', cell: (r) => <Status kind="stock" value={r.state} /> },
      ];
    }
    if (place?.kind === 'store') {
      return [
        item,
        { key: 'store', header: 'In the store', align: 'right', sortValue: (r) => r.store, cell: (r) => <Qty value={r.store} className="font-medium" /> },
        { key: 'min', header: 'Minimum', align: 'right', hideBelow: 'md', sortValue: (r) => r.item.minStore, cell: (r) => <span className="tabular-nums text-slate-500">{r.item.minStore}</span> },
        { key: 'ordered', header: 'On order', align: 'right', hideBelow: 'md', sortValue: (r) => r.onOrder, cell: (r) => (r.onOrder ? <span className="tabular-nums text-blue-700">+{r.onOrder}</span> : <span className="text-slate-400">—</span>) },
        ...(seeCost ? [{ key: 'value', header: 'Value (AED)', align: 'right', hideBelow: 'lg', sortValue: (r) => r.store * (r.item.avgCost ?? r.item.cost), cell: (r) => <span className="text-slate-600">{money(r.store * (r.item.avgCost ?? r.item.cost))}</span> }] : []),
        { key: 'state', header: 'State', cell: (r) => <Status kind="stock" value={r.state} /> },
      ];
    }
    return [
      item,
      { key: 'van', header: `In ${shortPlace(place)}`, align: 'right', sortValue: (r) => r.row[at] ?? 0, cell: (r) => <Qty value={r.row[at] ?? 0} className="font-medium" /> },
      { key: 'par', header: 'Usual level', align: 'right', hideBelow: 'md', sortValue: (r) => r.item.vanPar, cell: (r) => <span className="tabular-nums text-slate-500">{r.item.vanPar || '—'}</span> },
      {
        key: 'state', header: 'State',
        cell: (r) => {
          const have = r.row[at] ?? 0;
          if (have < 0) return <Status kind="stock" value="out" />;
          if (r.item.vanPar > 0 && have < r.item.vanPar) return <span className="inline-flex items-center rounded-sm bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">Needs {r.item.vanPar - have}</span>;
          return <span className="text-xs text-slate-500">{r.item.vanPar > 0 ? 'At its level' : ''}</span>;
        },
      },
    ];
  }, [at, place, vans, seeCost]);

  const table = useTable(filtered, columns, { pageSize: 16, initialSort: { key: 'item', dir: 'asc' } });

  const makeDrafts = (group) => {
    const ids = createDraftOrders([{ supplierId: group.supplierId, rows: group.rows.map((r) => ({ item: r.item, qty: r.reorder })) }]);
    toast('Draft order made', { action: { label: 'Open it', onClick: () => navigate(`/purchases/${ids[0]}`) } });
  };
  const topUp = (van) => setDrawer({
    type: 'transfer',
    preset: { from: 'loc_store', to: van.id, lines: vanNeeds[van.id].map((r) => ({ itemId: r.item.id, qty: Math.min(r.need, Math.max(0, r.inStore)) })).filter((l) => l.qty > 0) },
  });

  return (
    <Page
      title="Stock"
      facts={`${plural(rows.length, 'item')} kept in stock · ${low.length > 0 ? `${low.length} below the minimum` : 'none below the minimum'}`}
      tabs={<InventoryTabs />}
      about={ABOUT}
      menu={controller ? [{ label: 'Count stock', icon: ClipboardCheckIcon, onClick: () => setDrawer({ type: 'count', locationId: place?.id ?? 'loc_store' }) }] : undefined}
      actions={controller && <Button variant="primary" icon={ArrowLeftRightIcon} onClick={() => setDrawer({ type: 'transfer' })}>Transfer stock</Button>}
      footer={<Pagination table={table} noun="items" />}
    >
      {negative.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
          <TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">{plural(negative.length, 'balance')} below zero:</strong>{' '}
            {negative.slice(0, 3).map((n) => `${n.item.code} in ${shortPlace(n.location)} (${n.qty})`).join(', ')}. Parts were used that were never recorded as stock: count the place.
          </span>
          {controller && <Button size="xs" onClick={() => setDrawer({ type: 'count', locationId: negative[0].location.id })}>Count now</Button>}
        </div>
      )}

      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {seeCost && <Stat label="Stock value" amount={stockValue(rows)} sub="At average cost, all places" />}
        <Stat label="Below the minimum" value={low.length} sub="In the store" tone={low.length > 0 ? 'text-orange-700' : undefined} />
        <Stat label="Deliveries expected" value={deliveries.length} sub={deliveries[0]?.po.expectedOn ? `Next ${fmtDate(deliveries[0].po.expectedOn)}` : undefined} />
        <Stat label="Vans below their level" value={vans.filter((v) => vanNeeds[v.id].length > 0).length} sub={`of ${vans.length}`} />
      </dl>

      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search code or name" />
        <FilterSelect label="State" value={state} onChange={setState} options={[{ value: 'low', label: 'Below minimum' }, { value: 'ordered', label: 'Ordered' }, { value: 'ok', label: 'In stock' }]} />
      </Toolbar>
      <div className="mb-4">
        <Segmented
          size="sm"
          label="Where"
          value={at}
          onChange={setAt}
          options={[{ value: 'all', label: 'All places' }, ...places.map((l) => ({ value: l.id, label: shortPlace(l) }))]}
        />
      </div>

      {place?.kind === 'van' && vanNeeds[place.id].length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">{place.name} is below its usual level on {plural(vanNeeds[place.id].length, 'item')}:</strong>{' '}
            {vanNeeds[place.id].slice(0, 4).map((r) => `${r.item.code} (needs ${r.need})`).join(', ')}{vanNeeds[place.id].length > 4 ? '…' : ''}.
          </span>
          {controller && <Button size="xs" onClick={() => topUp(place)}>Top up from the store</Button>}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={table.rows}
        rowKey={(r) => r.item.id}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(r) => `/inventory?open=${r.item.id}`}
        empty={<EmptyState icon={PackageIcon} title="No item matches" action={<Button onClick={() => { setQ(''); setState(''); }}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(r) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{r.item.name}</p>
              <p className="truncate text-xs text-slate-500">{r.item.code} · store {r.store}{r.inVans !== 0 ? ` · vans ${r.inVans}` : ''}</p>
            </div>
            <Status kind="stock" value={r.state} />
          </div>
        )}
      />

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="To reorder" action={low.length > 0 && <span className="text-xs text-slate-500">{plural(low.length, 'item')}</span>}>
          {groups.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing is below its minimum, or what is low is already on order.</p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {groups.map((g) => (
                <li key={g.supplierId || 'none'} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{g.supplier?.name ?? 'No usual supplier'}</p>
                    {buyer && g.supplierId && <Button size="xs" onClick={() => makeDrafts(g)}>Make a draft order</Button>}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {g.rows.map((r) => (
                      <li key={r.item.id} className="text-sm text-slate-700">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="min-w-0 truncate">{r.item.name}</span>
                          <span className="text-xs tabular-nums text-slate-500">store {r.store} · minimum {r.item.minStore} · order {r.reorder}</span>
                        </span>
                        {r.pending.length > 0 && (
                          <span className="block text-xs text-slate-500">
                            Already in {r.pending.map((po) => <Link key={po.id} to={`/purchases/${po.id}`} className="font-medium underline-offset-2 hover:underline">{po.number}</Link>).reduce((a, b) => [a, ', ', b])} ({r.pending[0].status === 'draft' ? 'draft' : 'not sent yet'}).
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Deliveries expected" action={deliveries.length > 0 && <span className="text-xs text-slate-500">{plural(deliveries.length, 'order')}</span>}>
          {deliveries.length === 0 ? (
            <p className="text-sm text-slate-500">No order for the store or a van is on its way.</p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {deliveries.map((v) => (
                <li key={v.po.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link to={`/purchases/${v.po.id}`} className="w-28 shrink-0 text-sm font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline">{v.po.number}</Link>
                    <span className="min-w-0 flex-1 basis-40">
                      <span className="block truncate text-sm text-slate-800">{v.supplier?.name}</span>
                      <span className="block truncate text-xs text-slate-500">{orderTitle(v.po)} · to {shortPlace(s.locations[v.po.deliverTo])}</span>
                    </span>
                    <span className={cn('text-xs', v.late ? 'font-medium text-red-700' : 'text-slate-600')}>
                      {v.po.expectedOn ? `${fmtDate(v.po.expectedOn)} · ${relDays(v.po.expectedOn, today)}` : 'No day given'}
                      {v.late && ` (${diffDays(v.po.expectedOn, today)} days late)`}
                    </span>
                    {may('receive_goods') && <Button size="xs" onClick={() => setReceiving(v)}>Receive</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <TransferDrawer key={drawer?.type === 'transfer' ? JSON.stringify(drawer.preset ?? {}) : 'off'} open={drawer?.type === 'transfer'} onClose={() => setDrawer(null)} preset={drawer?.preset} />
      <CountDrawer open={drawer?.type === 'count'} onClose={() => setDrawer(null)} locationId={drawer?.locationId} />
      {receiving && <ReceiveDialog v={orderView(s, s.purchaseOrders[receiving.po.id], today)} onClose={() => setReceiving(null)} />}
    </Page>
  );
}
