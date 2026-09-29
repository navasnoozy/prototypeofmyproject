import { useMemo } from 'react';
import { FileTextIcon, PlusIcon } from 'lucide-react';
import { KINDS } from '@/data/quotationKinds.js';
import { cn } from '@/lib/cn.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { money, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { effectiveStatus, latestQuotations, quotationLabel, quoteTotals } from '@/store/salesSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { KindTag, SalesTabs, staffName } from './parts.jsx';

const ABOUT = {
  purpose: 'Every quotation, of every kind, in one list: what is being written, what waits for approval, what the customer has and what they answered.',
  why: [
    'One list for four kinds (project, contract, repair, supply) because one document with one set of states serves all of them (record 39, point 4). A repair quotation started from a deficiency in Service is listed here too.',
    'A revision replaces the earlier one in this list; the earlier versions stay in the quotation\'s own history.',
    'A quotation that was sent and is past its validity is shown as expired, so a forgotten follow-up is visible.',
  ],
  assumed: [
    'The total is shown with VAT (5%), as the customer sees it; cost and margin are on the quotation itself, for those who may see them.',
    'Validity of 30 days is a sample default and a setting of the company.',
  ],
};

const GROUPS = {
  draft: ['draft'],
  approval: ['waiting_approval', 'approved'],
  sent: ['sent'],
  accepted: ['accepted'],
  rejected: ['rejected'],
};

export function QuotationList() {
  const s = useStore();
  const { canEdit } = useSession();
  const [q, setQ] = useParam('q');
  const [status, setStatus] = useParam('status', 'all');
  const [kind, setKind] = useParam('kind');
  const [by, setBy] = useParam('by');
  const today = todayISO();

  const all = latestQuotations(s);
  const counts = useMemo(() => {
    const c = { all: all.length };
    for (const [key, list] of Object.entries(GROUPS)) c[key] = all.filter((x) => list.includes(x.status)).length;
    return c;
  }, [all]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (x) =>
        (status === 'all' || GROUPS[status]?.includes(x.status)) &&
        (!kind || x.kind === kind) &&
        (!by || x.preparedBy === by) &&
        (!needle || `${x.number} ${x.title} ${s.customers[x.customerId]?.name}`.toLowerCase().includes(needle)),
    );
  }, [all, q, status, kind, by, s.customers]);

  const columns = useMemo(
    () => [
      {
        key: 'number', header: 'Quotation', sortValue: (x) => x.number,
        cell: (x) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{quotationLabel(x)}</p>
            <p className="truncate text-xs text-slate-500">{x.title}</p>
          </div>
        ),
      },
      {
        key: 'customer', header: 'Customer', hideBelow: 'md', sortValue: (x) => s.customers[x.customerId]?.name,
        cell: (x) => (
          <div className="min-w-0">
            <p className="truncate text-slate-900">{s.customers[x.customerId]?.name}</p>
            <p className="truncate text-xs text-slate-500">{s.sites[x.siteId]?.name ?? 'No site'}</p>
          </div>
        ),
      },
      { key: 'kind', header: 'Kind', hideBelow: 'lg', sortValue: (x) => x.kind, cell: (x) => <KindTag kind={x.kind} /> },
      { key: 'by', header: 'Prepared by', hideBelow: 'xl', sortValue: (x) => staffName(s, x.preparedBy), cell: (x) => <span className="text-slate-700">{staffName(s, x.preparedBy)}</span> },
      {
        key: 'valid', header: 'Valid until', hideBelow: 'lg', sortValue: (x) => x.validUntil,
        cell: (x) => {
          const open = ['draft', 'waiting_approval', 'approved', 'sent'].includes(x.status);
          const over = open && x.validUntil < today;
          return (
            <div>
              <p className="tabular-nums text-slate-900">{fmtDate(x.validUntil)}</p>
              {open && <p className={cn('text-xs', over ? 'font-medium text-red-700' : 'text-slate-500')}>{relDays(x.validUntil, today)}</p>}
            </div>
          );
        },
      },
      { key: 'total', header: 'Total (AED)', align: 'right', sortValue: (x) => quoteTotals(x, s.settings.vatRate).total, cell: (x) => money(quoteTotals(x, s.settings.vatRate).total) },
      { key: 'status', header: 'Status', sortValue: (x) => x.status, cell: (x) => <Status kind="quotation" value={effectiveStatus(x, today)} /> },
    ],
    [s, today],
  );

  const table = useTable(rows, columns, { pageSize: 10, initialSort: { key: 'number', dir: 'desc' } });
  const waiting = counts.approval;

  return (
    <Page
      title="Quotations"
      facts={`${plural(all.length, 'quotation')}${waiting ? ` · ${waiting} in approval` : ''}`}
      tabs={<SalesTabs />}
      about={ABOUT}
      actions={canEdit('sales') && <Button variant="primary" icon={PlusIcon} to="/sales/quotations/new">New quotation</Button>}
      footer={<Pagination table={table} noun="quotations" />}
    >
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search number, title, customer" />
        <Segmented
          size="sm"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'draft', label: 'Draft', count: counts.draft },
            { value: 'approval', label: 'Approval', count: counts.approval },
            { value: 'sent', label: 'Sent', count: counts.sent },
            { value: 'accepted', label: 'Accepted', count: counts.accepted },
            { value: 'rejected', label: 'Rejected', count: counts.rejected },
          ]}
        />
        <FilterSelect label="Kind" value={kind} onChange={setKind} options={Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label }))} />
        <FilterSelect label="Prepared by" value={by} onChange={setBy} options={[...new Set(all.map((x) => x.preparedBy))].map((id) => ({ value: id, label: staffName(s, id) }))} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(x) => `/sales/quotations/${x.id}`}
        empty={<EmptyState icon={FileTextIcon} title="No quotation matches" action={<Button onClick={() => { setQ(''); setStatus('all'); setKind(''); setBy(''); }}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(x) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{quotationLabel(x)} · {x.title}</p>
              <p className="truncate text-xs text-slate-500">{s.customers[x.customerId]?.name} · AED {money(quoteTotals(x, s.settings.vatRate).total)}</p>
            </div>
            <Status kind="quotation" value={effectiveStatus(x, today)} dot={false} />
          </div>
        )}
      />
    </Page>
  );
}
