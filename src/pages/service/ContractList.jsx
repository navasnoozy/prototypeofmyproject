import { useMemo } from 'react';
import { Link } from 'react-router';
import { CircleCheckIcon, FileSignatureIcon } from 'lucide-react';
import { CD_STATUS } from '@/data/serviceKinds.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { cn } from '@/lib/cn.js';
import { aed, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { latestQuotations, quotationLabel, quoteTotals } from '@/store/salesSelectors.js';
import { contractStatus, visitState } from '@/store/serviceSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { ServiceTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'Every maintenance contract: what it covers, until when, what the customer pays, and whether the authority has approved it. From here you open the three linked parts of a contract: its terms, its visit plan and its billing plan.',
  why: [
    'A maintenance contract is three linked parts in the mature products: the commercial terms, the schedule of the service, and the schedule of the billing. The visits come from the schedule, not from the terms (study, section E).',
    'A contract ends in a year, and losing it silently is the costliest mistake of a maintenance company, so "ends soon" (within 60 days) is a state you can filter and it appears in the bell.',
    'The UAE authority approves each annual maintenance contract and expects follow-up visits and a status report during the year (study, standards table). Whether every emirate works this way is not confirmed: the approval step is marked as sample.',
  ],
  assumed: [
    'A contract covers one site (the quotation is for one site); a customer with several sites has several contracts.',
    'Ending soon means 60 days; the authority\'s waiting time and the rules of the emirates are samples until the research of phase 2.',
  ],
};

const FILTERS = {
  active: ['active', 'expiring'],
  expiring: ['expiring'],
  pending: ['draft', 'awaiting_approval'],
  ended: ['ended'],
};

export function ContractList() {
  const s = useStore();
  const { canEdit } = useSession();
  const today = todayISO();
  const [q, setQ] = useParam('q');
  const [status, setStatus] = useParam('status', 'active');
  const [cd, setCd] = useParam('cd');

  const all = list(s.contracts);
  const withStatus = useMemo(() => all.map((c) => ({ ...c, eff: contractStatus(c, today) })), [all, today]);
  const counts = useMemo(() => {
    const c = { all: withStatus.length };
    for (const [key, group] of Object.entries(FILTERS)) c[key] = withStatus.filter((x) => group.includes(x.eff)).length;
    return c;
  }, [withStatus]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return withStatus.filter(
      (c) =>
        (status === 'all' || FILTERS[status]?.includes(c.eff)) &&
        (!cd || c.cdApproval.status === cd) &&
        (!needle || `${c.number} ${c.title} ${s.customers[c.customerId]?.name}`.toLowerCase().includes(needle)),
    );
  }, [withStatus, q, status, cd, s.customers]);

  // Accepted contract quotations that no one has started yet.
  const ready = latestQuotations(s).filter((x) => x.kind === 'contract' && x.status === 'accepted' && !x.followUp);

  const columns = useMemo(
    () => [
      {
        key: 'number', header: 'Contract', sortValue: (c) => c.number,
        cell: (c) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{c.number}</p>
            <p className="truncate text-xs text-slate-500">{s.sites[c.siteId]?.name}</p>
          </div>
        ),
      },
      { key: 'customer', header: 'Customer', hideBelow: 'md', sortValue: (c) => s.customers[c.customerId]?.name, cell: (c) => <span className="block max-w-[220px] truncate text-slate-700">{s.customers[c.customerId]?.name}</span> },
      {
        key: 'term', header: 'Period', hideBelow: 'lg', sortValue: (c) => c.endOn,
        cell: (c) => (
          <div>
            <p className="tabular-nums text-slate-900">{fmtDate(c.startOn)} to {fmtDate(c.endOn)}</p>
            {['active', 'expiring'].includes(c.eff) && <p className={cn('text-xs', c.eff === 'expiring' ? 'font-medium text-orange-700' : 'text-slate-500')}>ends {relDays(c.endOn, today)}</p>}
          </div>
        ),
      },
      {
        key: 'visits', header: 'Visits', align: 'right', hideBelow: 'xl',
        cell: (c) => {
          const done = c.visitPlan.filter((r) => visitState(r, s.jobs[r.jobId], today) === 'done').length;
          return <span className="tabular-nums text-slate-700">{done} of {c.visitPlan.length}</span>;
        },
      },
      { key: 'fee', header: 'Fee a year (AED)', align: 'right', hideBelow: 'md', sortValue: (c) => c.annualFee, cell: (c) => c.annualFee.toLocaleString('en-US', { minimumFractionDigits: 2 }) },
      { key: 'cd', header: 'Authority', hideBelow: 'lg', cell: (c) => <Status kind="cd" value={c.cdApproval.status} dot={false} /> },
      { key: 'status', header: 'Status', sortValue: (c) => c.eff, cell: (c) => <Status kind="contract" value={c.eff} /> },
    ],
    [s, today],
  );

  const table = useTable(rows, columns, { pageSize: 10, initialSort: { key: 'term', dir: 'asc' } });

  return (
    <Page
      title="Contracts"
      facts={`${plural(counts.active, 'active contract')}${counts.expiring ? ` · ${counts.expiring} ending soon` : ''}${counts.pending ? ` · ${counts.pending} not active yet` : ''}`}
      tabs={<ServiceTabs />}
      about={ABOUT}
      footer={<Pagination table={table} noun="contracts" />}
    >
      {ready.length > 0 && canEdit('service') && (
        <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-green-900">
            <CircleCheckIcon className="size-4" aria-hidden="true" /> Accepted contract quotations to start
          </p>
          <ul className="mt-2 space-y-1 text-sm text-green-950">
            {ready.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link className="font-medium underline underline-offset-2" to={`/sales/quotations/${x.id}`}>{quotationLabel(x)}</Link>
                <span>{s.customers[x.customerId]?.name} · {s.sites[x.siteId]?.name} · {aed(quoteTotals(x, s.settings.vatRate).net)} a year</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search number, site, customer" />
        <div className="no-scrollbar max-w-full overflow-x-auto">
          <Segmented
            size="sm"
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'active', label: 'Active', count: counts.active },
              { value: 'expiring', label: 'Ends soon', count: counts.expiring },
              { value: 'pending', label: 'Not active yet', count: counts.pending },
              { value: 'ended', label: 'Ended', count: counts.ended },
              { value: 'all', label: 'All', count: counts.all },
            ]}
          />
        </div>
        <FilterSelect label="Authority" value={cd} onChange={setCd} options={Object.entries(CD_STATUS).map(([value, [, text]]) => ({ value, label: text }))} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(c) => `/service/${c.id}`}
        empty={<EmptyState icon={FileSignatureIcon} title="No contract matches" action={<Button onClick={() => { setQ(''); setStatus('active'); setCd(''); }}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(c) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{c.number} · {s.sites[c.siteId]?.name}</p>
              <p className="truncate text-xs text-slate-500">{s.customers[c.customerId]?.name} · ends {fmtDate(c.endOn)}</p>
            </div>
            <Status kind="contract" value={c.eff} dot={false} />
          </div>
        )}
      />
    </Page>
  );
}
