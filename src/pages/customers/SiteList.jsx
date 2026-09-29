import { useMemo } from 'react';
import { MapPinIcon, PlusIcon } from 'lucide-react';
import { BUILDING_TYPES, EMIRATES } from '@/data/catalog.js';
import { fmtDate } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { list, siteHealth, siteSummary } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { CustomersTabs, HealthBadge, SiteTile, customerName } from './parts.jsx';

const ABOUT = {
  purpose: 'Every building or place we work at, with the state of its equipment. Use it to find a site, or to see which sites have service overdue.',
  why: [
    'Sites are their own list because one customer has many sites and the work (visits, quotations, invoices) always belongs to a site (record 39, point 3).',
    'The "Service" column is the worst state of the equipment at the site, in words: overdue, due soon, on schedule. It is computed from each device\'s last service and its interval.',
    'The site shows who owns it and, when different, who pays, because in facilities management the party that pays is often not the owner (record 39, point 8).',
  ],
  assumed: [
    'Due soon means within 30 days (sample). The real rule comes from the contract and the standard for each system.',
    'A site that is under construction has no equipment yet; it gets systems at handover (Projects, step 5).',
  ],
};

export function SiteList() {
  const s = useStore();
  const { canEdit } = useSession();
  const [q, setQ] = useParam('q');
  const [due, setDue] = useParam('due', 'all');
  const [emirate, setEmirate] = useParam('emirate');
  const [type, setType] = useParam('type');

  const all = list(s.sites);
  const withSummary = useMemo(() => all.map((x) => ({ ...x, sum: siteSummary(s, x.id) })), [all, s]);
  const counts = useMemo(() => {
    const c = { all: withSummary.length, overdue: 0, soon: 0, ok: 0 };
    for (const x of withSummary) {
      const h = siteHealth(x.sum);
      if (c[h] !== undefined) c[h] += 1;
    }
    return c;
  }, [withSummary]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return withSummary.filter(
      (x) =>
        (due === 'all' || siteHealth(x.sum) === due) &&
        (!emirate || x.emirate === emirate) &&
        (!type || x.type === type) &&
        (!needle || `${x.name} ${x.address} ${x.area} ${customerName(s, x.customerId)} ${x.civilDefence?.fileNo ?? ''}`.toLowerCase().includes(needle)),
    );
  }, [withSummary, q, due, emirate, type, s]);

  const columns = useMemo(
    () => [
      {
        key: 'name', header: 'Site', sortValue: (x) => x.name,
        cell: (x) => (
          <div className="flex min-w-0 items-center gap-3">
            <SiteTile />
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{x.name}</p>
              <p className="truncate text-xs text-slate-500">{x.address}, {x.area}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'customer', header: 'Customer', hideBelow: 'md', sortValue: (x) => customerName(s, x.customerId),
        cell: (x) => (
          <div className="min-w-0">
            <p className="truncate text-slate-900">{customerName(s, x.customerId)}</p>
            {x.billToId !== x.customerId && <p className="truncate text-xs text-slate-500">Bills to {customerName(s, x.billToId)}</p>}
          </div>
        ),
      },
      { key: 'type', header: 'Type', hideBelow: 'xl', sortValue: (x) => x.type, cell: (x) => <span className="text-slate-700">{x.type}</span> },
      { key: 'systems', header: 'Systems', align: 'right', sortValue: (x) => x.sum.systems, cell: (x) => x.sum.systems },
      {
        key: 'health', header: 'Service', sortValue: (x) => ({ overdue: 0, soon: 1, ok: 2, none: 3 })[siteHealth(x.sum)],
        cell: (x) => <HealthBadge summary={x.sum} />,
      },
      {
        key: 'next', header: 'Next due', hideBelow: 'lg', sortValue: (x) => x.sum.nextDue ?? '9999',
        cell: (x) => <span className="tabular-nums text-slate-700">{x.sum.nextDue ? fmtDate(x.sum.nextDue) : '—'}</span>,
      },
    ],
    [s],
  );

  const table = useTable(rows, columns, { pageSize: 10, initialSort: { key: 'name', dir: 'asc' } });

  return (
    <Page
      title="Sites"
      facts={`${plural(all.length, 'site')} for ${plural(new Set(all.map((x) => x.customerId)).size, 'customer')}`}
      tabs={<CustomersTabs />}
      about={ABOUT}
      actions={canEdit('customers') && <Button variant="primary" icon={PlusIcon} to="/customers/sites/new">New site</Button>}
      footer={<Pagination table={table} noun="sites" />}
    >
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search site, address, customer" />
        <Segmented
          size="sm"
          label="Service state"
          value={due}
          onChange={setDue}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'overdue', label: 'Overdue', count: counts.overdue },
            { value: 'soon', label: 'Due soon', count: counts.soon },
            { value: 'ok', label: 'On schedule', count: counts.ok },
          ]}
        />
        <FilterSelect label="Emirate" value={emirate} onChange={setEmirate} options={EMIRATES} />
        <FilterSelect label="Type" value={type} onChange={setType} options={BUILDING_TYPES} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(x) => `/customers/sites/${x.id}`}
        empty={<EmptyState icon={MapPinIcon} title="No site matches" action={<Button onClick={() => { setQ(''); setDue('all'); setEmirate(''); setType(''); }}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(x) => (
          <div className="flex items-center gap-3">
            <SiteTile />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{x.name}</p>
              <p className="truncate text-xs text-slate-500">{customerName(s, x.customerId)} · {x.area}</p>
            </div>
            <HealthBadge summary={x.sum} />
          </div>
        )}
      />
    </Page>
  );
}
