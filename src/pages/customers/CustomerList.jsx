import { useMemo } from 'react';
import { PlusIcon, UsersIcon } from 'lucide-react';
import { SEGMENTS } from '@/data/catalog.js';
import { plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { aed } from '@/lib/format.js';
import { customerContacts, customerSites, list, paidSites } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Avatar, Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { CustomersTabs, staffName } from './parts.jsx';

const ABOUT = {
  purpose: 'The list of everyone we work for. From here you open a customer to see its sites, people, terms and history, or add a new one.',
  why: [
    'Customers, sites and contacts are separate lists because the mature products for fire contractors always keep them apart from jobs, and one customer has many sites (record 39, point 3).',
    'The customer is the party that owns the relationship and the terms; the party that pays for a site can be another customer, which is shown on the site (record 39, point 8).',
    'Status is always written in words next to its colour, and a customer on hold stays visible in the list.',
  ],
  assumed: [
    'The columns, the segments and the credit limits are samples based on the reference company\'s practice.',
    'Putting a customer on hold is a manual choice here; in the product it will also follow overdue invoices (Billing, step 7).',
  ],
};

export function CustomerList() {
  const s = useStore();
  const { canEdit } = useSession();
  const [q, setQ] = useParam('q');
  const [status, setStatus] = useParam('status', 'all');
  const [segment, setSegment] = useParam('segment');

  const all = list(s.customers);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (c) =>
        (status === 'all' || c.status === status) &&
        (!segment || c.segment === segment) &&
        (!needle || `${c.name} ${c.code} ${c.group} ${c.trn} ${c.area}`.toLowerCase().includes(needle)),
    );
  }, [all, q, status, segment]);

  const columns = useMemo(
    () => [
      {
        key: 'name', header: 'Customer', sortValue: (c) => c.name,
        cell: (c) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={c.name} shape={c.type === 'individual' ? 'circle' : 'square'} />
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{c.name}</p>
              <p className="truncate text-xs text-slate-500">{c.code}{c.group ? ` · ${c.group}` : ''}</p>
            </div>
          </div>
        ),
      },
      { key: 'segment', header: 'Segment', hideBelow: 'lg', sortValue: (c) => c.segment, cell: (c) => <span className="text-slate-700">{c.segment}</span> },
      {
        key: 'contact', header: 'Main contact', hideBelow: 'xl',
        cell: (c) => {
          const p = customerContacts(s, c.id).find((x) => x.primary);
          return p ? (
            <div className="min-w-0"><p className="truncate text-slate-900">{p.name}</p><p className="truncate text-xs text-slate-500">{p.phone}</p></div>
          ) : <span className="text-slate-400">—</span>;
        },
      },
      {
        key: 'sites', header: 'Sites', align: 'right', sortValue: (c) => customerSites(s, c.id).length,
        cell: (c) => {
          const paying = paidSites(s, c.id).length;
          return (
            <div>
              <p className="text-slate-900">{customerSites(s, c.id).length}</p>
              {paying > 0 && <p className="whitespace-nowrap text-xs text-slate-500">pays for {paying}</p>}
            </div>
          );
        },
      },
      {
        key: 'terms', header: 'Terms', hideBelow: 'md', sortValue: (c) => c.creditLimit,
        cell: (c) => (
          <div><p className="text-slate-900">{c.terms}</p><p className="text-xs text-slate-500">{c.creditLimit ? `Limit ${aed(c.creditLimit).replace('.00', '')}` : 'No credit'}</p></div>
        ),
      },
      { key: 'owner', header: 'Sales owner', hideBelow: 'xl', cell: (c) => <span className="text-slate-700">{staffName(s, c.salesOwner)}</span> },
      { key: 'status', header: 'Status', sortValue: (c) => c.status, cell: (c) => <Status kind="customer" value={c.status} /> },
    ],
    [s],
  );

  const table = useTable(rows, columns, { pageSize: 10, initialSort: { key: 'name', dir: 'asc' } });
  const holds = all.filter((c) => c.status === 'on_hold').length;

  return (
    <Page
      title="Customers"
      facts={`${plural(all.length, 'customer')} · ${plural(list(s.sites).length, 'site')}`}
      tabs={<CustomersTabs />}
      about={ABOUT}
      actions={canEdit('customers') && <Button variant="primary" icon={PlusIcon} to="/customers/new">New customer</Button>}
      footer={<Pagination table={table} noun="customers" />}
    >
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search name, number, TRN, area" />
        <Segmented
          size="sm"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All', count: all.length },
            { value: 'active', label: 'Active', count: all.length - holds },
            { value: 'on_hold', label: 'On hold', count: holds },
          ]}
        />
        <FilterSelect label="Segment" value={segment} onChange={setSegment} options={SEGMENTS} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(c) => `/customers/${c.id}`}
        empty={<EmptyState icon={UsersIcon} title="No customer matches" action={<Button onClick={() => { setQ(''); setStatus('all'); setSegment(''); }}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(c) => (
          <div className="flex items-center gap-3">
            <Avatar name={c.name} shape={c.type === 'individual' ? 'circle' : 'square'} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{c.name}</p>
              <p className="truncate text-xs text-slate-500">{c.segment} · {plural(customerSites(s, c.id).length + paidSites(s, c.id).length, 'site')}</p>
            </div>
            <Status kind="customer" value={c.status} dot={false} />
          </div>
        )}
      />
    </Page>
  );
}
