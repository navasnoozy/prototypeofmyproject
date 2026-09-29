import { useMemo, useState } from 'react';
import { PlusIcon, TruckIcon } from 'lucide-react';
import { ITEM_CATEGORIES } from '@/data/quotationKinds.js';
import { todayISO } from '@/lib/dates.js';
import { money } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { supplierStats } from '@/store/purchaseSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Avatar, Badge } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { PurchaseTabs } from './parts.jsx';
import { SupplierDrawer } from './SupplierDrawer.jsx';

const ABOUT = {
  purpose: 'The companies we buy from, with their payment terms and what we owe them. A supplier is chosen on every purchase order, and its terms decide when a bill falls due.',
  why: [
    'Each supplier shows what is open with it (orders not yet delivered) and what we owe (bills not yet paid), because the buyer and the accountant both start from the supplier.',
    'The payment terms live on the supplier, not on each order: the due day of a bill is worked out from them.',
    'A supplier abroad does not charge UAE VAT on its invoice; the order picks this up from the supplier (the import VAT is paid at customs, a sample rule).',
  ],
  assumed: ['Every company, person, TRN and e-mail address is invented; the e-mail addresses use the reserved .example domain.'],
};

export function SupplierList() {
  const s = useStore();
  const { may } = useSession();
  const editable = may('manage_suppliers');
  const [q, setQ] = useParam('q');
  const [category, setCategory] = useParam('category');
  const [show, setShow] = useParam('show', 'active');
  const [adding, setAdding] = useParam('new');
  const [drawer, setDrawer] = useState(false);
  const today = todayISO();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list(s.suppliers)
      .filter((x) => (show === 'all' || x.active) && (!category || x.categories.includes(category)) && (!needle || `${x.name} ${x.contactName} ${x.area} ${x.categories.join(' ')}`.toLowerCase().includes(needle)))
      .map((x) => ({ supplier: x, stats: supplierStats(s, x.id, today) }));
  }, [s, q, category, show, today]);

  const columns = useMemo(
    () => [
      {
        key: 'name', header: 'Supplier', sortValue: (r) => r.supplier.name,
        cell: (r) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={r.supplier.name} shape="square" />
            <div className="min-w-0">
              <p className="max-w-[34ch] truncate font-medium text-slate-900">{r.supplier.name}</p>
              <p className="truncate text-xs text-slate-500">{r.supplier.kind} · {r.supplier.area}</p>
            </div>
          </div>
        ),
      },
      { key: 'categories', header: 'Supplies', hideBelow: 'xl', cell: (r) => <span className="block max-w-[26ch] truncate text-slate-600">{r.supplier.categories.join(', ') || '—'}</span> },
      { key: 'terms', header: 'Terms', hideBelow: 'md', sortValue: (r) => Number(r.supplier.terms), cell: (r) => <span className="whitespace-nowrap text-slate-700">{Number(r.supplier.terms) === 0 ? 'Cash' : `Net ${r.supplier.terms}`}</span> },
      { key: 'open', header: 'Open orders', align: 'right', hideBelow: 'md', sortValue: (r) => r.stats.open, cell: (r) => r.stats.open || <span className="text-slate-400">—</span> },
      {
        key: 'unpaid', header: 'We owe (AED)', align: 'right', sortValue: (r) => r.stats.unpaid,
        cell: (r) => (r.stats.unpaid > 0 ? <span className={r.stats.overdue > 0 ? 'font-medium text-red-700' : ''}>{money(r.stats.unpaid)}</span> : <span className="text-slate-400">—</span>),
      },
      { key: 'state', header: 'State', hideBelow: 'xl', cell: (r) => (r.supplier.active ? <Badge tone="green" dot>In use</Badge> : <Badge>Not used</Badge>) },
    ],
    [],
  );
  const table = useTable(rows, columns, { pageSize: 12, initialSort: { key: 'name', dir: 'asc' } });
  const owed = rows.reduce((n, r) => n + r.stats.unpaid, 0);
  const showDrawer = drawer || adding === '1';
  const closeDrawer = () => { setDrawer(false); setAdding(''); };

  return (
    <Page
      title="Suppliers"
      facts={`${list(s.suppliers).filter((x) => x.active).length} in use · AED ${money(owed)} owed in bills`}
      tabs={<PurchaseTabs />}
      about={ABOUT}
      actions={editable && <Button variant="primary" icon={PlusIcon} onClick={() => setDrawer(true)}>New supplier</Button>}
      footer={<Pagination table={table} noun="suppliers" />}
    >
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search name, person, area" />
        <FilterSelect label="Supplies" value={category} onChange={setCategory} options={ITEM_CATEGORIES.filter((c) => !/Maintenance|Labour|Documentation/.test(c))} />
        <Segmented size="sm" label="Show" value={show} onChange={setShow} options={[{ value: 'active', label: 'In use' }, { value: 'all', label: 'All' }]} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        rowKey={(r) => r.supplier.id}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(r) => `/purchases/suppliers/${r.supplier.id}`}
        empty={<EmptyState icon={TruckIcon} title="No supplier matches" action={<Button onClick={() => { setQ(''); setCategory(''); setShow('active'); }}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(r) => (
          <div className="flex items-center gap-3">
            <Avatar name={r.supplier.name} shape="square" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{r.supplier.name}</p>
              <p className="truncate text-xs text-slate-500">{r.supplier.kind} · {r.supplier.area}</p>
            </div>
            {r.stats.unpaid > 0 && <span className="text-sm tabular-nums text-slate-700">{money(r.stats.unpaid)}</span>}
          </div>
        )}
      />
      <SupplierDrawer open={showDrawer} onClose={closeDrawer} />
    </Page>
  );
}
