import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowRightLeftIcon } from 'lucide-react';
import { MOVEMENT_KINDS, MOVEMENT_TONE } from '@/data/purchaseKinds.js';
import { cn } from '@/lib/cn.js';
import { fmtDate } from '@/lib/dates.js';
import { money, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { locationList, movementRef, movementRows } from '@/store/inventorySelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Badge } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { InventoryTabs, shortPlace } from './parts.jsx';

const ABOUT = {
  purpose: 'The ledger of stock: every delivery, every part used on a job, every item issued to a project, every transfer and every count, one row each, with the place, the quantity and the document it belongs to.',
  why: [
    'A balance is only trusted if it can be explained. This list is the explanation: the balance of any item in any place is the sum of its rows here, and nothing else changes a balance (study, section L).',
    'A row is never edited or deleted. A mistake is corrected by another row: a part taken off a job returns to the van, a wrong count is counted again.',
    'Each row names the document it came from and links to it: the delivery (with its purchase order), the job, or the project.',
  ],
  assumed: ['The opening balances and all the history are invented. The value of a row uses the average cost of the item on that day.'],
};

export function Movements() {
  const s = useStore();
  const { may } = useSession();
  const seeCost = may('see_cost');
  const [q, setQ] = useParam('q');
  const [kind, setKind] = useParam('kind');
  const [where, setWhere] = useParam('at');

  const all = useMemo(() => movementRows(s), [s]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((m) => {
      const item = s.items[m.itemId];
      const ref = movementRef(s, m);
      return (
        (!kind || m.kind === kind) &&
        (!where || m.locationId === where) &&
        (!needle || `${item?.code} ${item?.name} ${ref.label} ${m.note}`.toLowerCase().includes(needle))
      );
    });
  }, [all, s, q, kind, where]);

  const columns = useMemo(
    () => [
      { key: 'on', header: 'Date', sortValue: (m) => m.on + String(Number(m.id.replace('mv_', ''))).padStart(6, '0'), cell: (m) => <span className="whitespace-nowrap text-slate-600">{fmtDate(m.on)}</span> },
      {
        key: 'item', header: 'Item', sortValue: (m) => s.items[m.itemId]?.code ?? '',
        cell: (m) => (
          <div className="min-w-0">
            <p className="max-w-[36ch] truncate text-slate-900">{s.items[m.itemId]?.name}</p>
            <p className="text-xs text-slate-500">{s.items[m.itemId]?.code}</p>
          </div>
        ),
      },
      { key: 'place', header: 'Place', hideBelow: 'md', sortValue: (m) => shortPlace(s.locations[m.locationId]), cell: (m) => <span className="whitespace-nowrap text-slate-700">{shortPlace(s.locations[m.locationId])}</span> },
      { key: 'kind', header: 'What happened', hideBelow: 'lg', sortValue: (m) => MOVEMENT_KINDS[m.kind], cell: (m) => <Badge tone={MOVEMENT_TONE[m.kind]}>{MOVEMENT_KINDS[m.kind]}</Badge> },
      {
        key: 'qty', header: 'Quantity', align: 'right', sortValue: (m) => m.qty,
        cell: (m) => (
          <span className={cn('whitespace-nowrap font-medium tabular-nums', m.qty < 0 ? 'text-slate-900' : 'text-green-700')}>
            {m.qty > 0 ? '+' : '−'}{Math.abs(m.qty)} <span className="text-xs font-normal text-slate-500">{s.items[m.itemId]?.unit}</span>
          </span>
        ),
      },
      ...(seeCost ? [{ key: 'value', header: 'Value (AED)', align: 'right', hideBelow: 'xl', sortValue: (m) => m.qty * m.unitCost, cell: (m) => <span className="text-slate-500">{money(m.qty * m.unitCost)}</span> }] : []),
      {
        key: 'doc', header: 'Document', hideBelow: 'md',
        cell: (m) => {
          const ref = movementRef(s, m);
          const text = ref.label || m.note;
          if (!text) return <span className="text-slate-400">—</span>;
          return ref.to ? (
            <Link to={ref.to} onClick={(e) => e.stopPropagation()} className="block max-w-[26ch] truncate text-sm font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline">{text}</Link>
          ) : (
            <span className="block max-w-[30ch] truncate text-sm text-slate-600" title={m.note}>{text}</span>
          );
        },
      },
      { key: 'by', header: 'By', hideBelow: 'xl', cell: (m) => <span className="whitespace-nowrap text-slate-600">{s.staff[m.byId]?.name.split(' ')[0] ?? '—'}</span> },
    ],
    [s, seeCost],
  );
  const table = useTable(rows, columns, { pageSize: 15, initialSort: { key: 'on', dir: 'desc' } });

  return (
    <Page
      title="Movements"
      facts={`${plural(all.length, 'movement')} in the ledger`}
      tabs={<InventoryTabs />}
      about={ABOUT}
      footer={<Pagination table={table} noun="movements" />}
    >
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search item, document, note" />
        <FilterSelect label="What happened" value={kind} onChange={setKind} options={Object.entries(MOVEMENT_KINDS).map(([value, label]) => ({ value, label }))} />
        <FilterSelect label="Place" value={where} onChange={setWhere} options={locationList(s).map((l) => ({ value: l.id, label: shortPlace(l) }))} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        empty={<EmptyState icon={ArrowRightLeftIcon} title="No movement matches" action={<Button onClick={() => { setQ(''); setKind(''); setWhere(''); }}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(m) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{s.items[m.itemId]?.name}</p>
              <p className="truncate text-xs text-slate-500">{fmtDate(m.on)} · {shortPlace(s.locations[m.locationId])} · {MOVEMENT_KINDS[m.kind]}</p>
            </div>
            <span className={cn('text-sm font-medium tabular-nums', m.qty < 0 ? 'text-slate-900' : 'text-green-700')}>{m.qty > 0 ? '+' : '−'}{Math.abs(m.qty)}</span>
          </div>
        )}
      />
    </Page>
  );
}
