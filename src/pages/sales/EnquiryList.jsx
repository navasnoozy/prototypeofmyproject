import { useMemo } from 'react';
import { InboxIcon, PlusIcon } from 'lucide-react';
import { KINDS } from '@/data/quotationKinds.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { cn } from '@/lib/cn.js';
import { money, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { KindTag, SalesTabs, staffName } from './parts.jsx';

const ABOUT = {
  purpose: 'Every request that has come in, from the first call to a quotation. An enquiry is followed until it is won or lost, so nothing waits unseen.',
  why: [
    'The selling chain of our study is: enquiry, site survey or drawings, estimate, quotation, approval, sending, follow-up, then accepted, rejected or expired (study, workflow 1).',
    'An enquiry has its own kind (project, contract, repair, supply), so the quotation that follows starts with the right form and the right terms.',
    'The date for the quotation is shown in red when it has passed: the customer is waiting.',
  ],
  assumed: [
    'The stages (new, site survey, estimating, quoted, won, lost) and the list of sources are samples from the reference company\'s practice.',
    'Whether small repairs and supplies are registered as enquiries at all, or quoted straight away, is an open question (study, section R).',
  ],
};

const OPEN = ['new', 'survey', 'estimating', 'quoted'];

export function EnquiryList() {
  const s = useStore();
  const { canEdit } = useSession();
  const [q, setQ] = useParam('q');
  const [status, setStatus] = useParam('status', 'open');
  const [kind, setKind] = useParam('kind');
  const [owner, setOwner] = useParam('owner');
  const today = todayISO();

  const all = list(s.enquiries);
  const counts = useMemo(
    () => ({
      all: all.length,
      open: all.filter((e) => OPEN.includes(e.status)).length,
      won: all.filter((e) => e.status === 'won').length,
      lost: all.filter((e) => e.status === 'lost').length,
    }),
    [all],
  );
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (e) =>
        (status === 'all' || (status === 'open' ? OPEN.includes(e.status) : e.status === status)) &&
        (!kind || e.kind === kind) &&
        (!owner || e.ownerId === owner) &&
        (!needle || `${e.number} ${e.title} ${s.customers[e.customerId]?.name} ${e.description}`.toLowerCase().includes(needle)),
    );
  }, [all, q, status, kind, owner, s.customers]);

  const columns = useMemo(
    () => [
      {
        key: 'title', header: 'Enquiry', sortValue: (e) => e.number,
        cell: (e) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{e.title}</p>
            <p className="truncate text-xs text-slate-500">{e.number} · {s.customers[e.customerId]?.name}</p>
          </div>
        ),
      },
      { key: 'kind', header: 'Kind', hideBelow: 'lg', sortValue: (e) => e.kind, cell: (e) => <KindTag kind={e.kind} /> },
      { key: 'owner', header: 'Owner', hideBelow: 'xl', sortValue: (e) => staffName(s, e.ownerId), cell: (e) => <span className="text-slate-700">{staffName(s, e.ownerId)}</span> },
      {
        key: 'due', header: 'Quotation due', hideBelow: 'md', sortValue: (e) => e.dueOn || '9999',
        cell: (e) => {
          const late = OPEN.slice(0, 3).includes(e.status) && e.dueOn && e.dueOn < today;
          return e.dueOn ? (
            <div>
              <p className="tabular-nums text-slate-900">{fmtDate(e.dueOn)}</p>
              <p className={cn('text-xs', late ? 'font-medium text-red-700' : 'text-slate-500')}>{relDays(e.dueOn, today)}</p>
            </div>
          ) : <span className="text-slate-400">—</span>;
        },
      },
      { key: 'value', header: 'Estimate (AED)', align: 'right', hideBelow: 'lg', sortValue: (e) => e.estValue, cell: (e) => (e.estValue ? money(e.estValue) : '—') },
      { key: 'status', header: 'Status', sortValue: (e) => e.status, cell: (e) => <Status kind="enquiry" value={e.status} /> },
    ],
    [s, today],
  );

  const table = useTable(rows, columns, { pageSize: 10, initialSort: { key: 'due', dir: 'asc' } });
  const late = all.filter((e) => OPEN.slice(0, 3).includes(e.status) && e.dueOn && e.dueOn < today).length;

  return (
    <Page
      title="Enquiries"
      facts={`${plural(counts.open, 'open enquiry', 'open enquiries')}${late ? ` · ${late} late` : ''}`}
      tabs={<SalesTabs />}
      about={ABOUT}
      actions={canEdit('sales') && <Button variant="primary" icon={PlusIcon} to="/sales/new">New enquiry</Button>}
      footer={<Pagination table={table} noun="enquiries" />}
    >
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search number, title, customer" />
        <Segmented
          size="sm"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'won', label: 'Won', count: counts.won },
            { value: 'lost', label: 'Lost', count: counts.lost },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        <FilterSelect label="Kind" value={kind} onChange={setKind} options={Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label }))} />
        <FilterSelect
          label="Owner"
          value={owner}
          onChange={setOwner}
          options={[...new Set(all.map((e) => e.ownerId))].map((id) => ({ value: id, label: staffName(s, id) }))}
        />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(e) => `/sales/${e.id}`}
        empty={<EmptyState icon={InboxIcon} title="No enquiry matches" action={<Button onClick={() => { setQ(''); setStatus('open'); setKind(''); setOwner(''); }}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(e) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{e.title}</p>
              <p className="truncate text-xs text-slate-500">{e.number} · {s.customers[e.customerId]?.name}</p>
            </div>
            <Status kind="enquiry" value={e.status} dot={false} />
          </div>
        )}
      />
    </Page>
  );
}
