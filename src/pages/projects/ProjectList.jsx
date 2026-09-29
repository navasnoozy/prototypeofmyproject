import { useMemo } from 'react';
import { Link } from 'react-router';
import { CircleCheckIcon, HardHatIcon } from 'lucide-react';
import { contractValue, forecast, paidTotal, percentComplete } from '@/data/projectRules.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { aed, money, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { latestQuotations, quotationLabel, quoteTotals } from '@/store/salesSelectors.js';
import { isActive, projectStatus } from '@/store/projectSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { cn } from '@/lib/cn.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { ProgressBar } from './parts.jsx';

const ABOUT = {
  purpose: 'Every installation project, from the award to the release of the retention. It answers three questions at a glance: how far is the work, how much has been claimed and paid, and is the money going as budgeted.',
  why: [
    'A project is kept apart from service work because it differs in every column: it lasts weeks or months, it is planned by stages and a budget, it is paid by claims with retention, and it produces drawings, test records and handover documents (study, D.4).',
    'A project is always started from an accepted quotation: its packages, prices and budgets come from the quotation\'s sections and costs. That is why there is no "New project" button (the mature products work the same way).',
    'Defects liability is a phase of its own, because after handover the customer still holds the retention for a year and the company still owes repairs.',
    'Small works of hours or a few days are jobs in Service, not projects (record 39, point 6).',
  ],
  assumed: [
    'Retention, advance and the defects liability period are taken from the quotation and a default of 12 months. Real terms vary by contract; the UAE norm was not checked (study, section R, question 1).',
    'The expected margin assumes the rest of the work costs what the budget says.',
  ],
};

const GROUPS = {
  active: (p) => isActive(p),
  liability: (p) => p.phase === 'retention',
  complete: (p) => p.phase === 'complete',
  all: () => true,
};

export function ProjectList() {
  const s = useStore();
  const { canEdit } = useSession();
  const today = todayISO();
  const [q, setQ] = useParam('q');
  const [group, setGroup] = useParam('group', 'active');

  const all = list(s.projects);
  const counts = useMemo(() => Object.fromEntries(Object.entries(GROUPS).map(([key, fn]) => [key, all.filter(fn).length])), [all]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (p) =>
        GROUPS[group]?.(p) &&
        (!needle || `${p.number} ${p.title} ${s.customers[p.customerId]?.name} ${s.sites[p.siteId]?.name}`.toLowerCase().includes(needle)),
    );
  }, [all, q, group, s.customers, s.sites]);

  // Accepted project quotations that no one has started yet.
  const ready = latestQuotations(s).filter((x) => x.kind === 'project' && x.status === 'accepted' && !x.followUp);

  const columns = useMemo(
    () => [
      {
        key: 'number', header: 'Project', sortValue: (p) => p.number,
        cell: (p) => (
          <div className="min-w-0">
            <p className="font-medium tabular-nums text-slate-900">{p.number}</p>
            <p className="max-w-[300px] truncate text-xs text-slate-500">{p.title}</p>
          </div>
        ),
      },
      {
        key: 'customer', header: 'Customer and site', hideBelow: 'md', sortValue: (p) => s.customers[p.customerId]?.name,
        cell: (p) => (
          <div className="min-w-0">
            <p className="max-w-[240px] truncate text-slate-900">{s.customers[p.customerId]?.name}</p>
            <p className="max-w-[240px] truncate text-xs text-slate-500">{s.sites[p.siteId]?.name}</p>
          </div>
        ),
      },
      { key: 'phase', header: 'Phase', sortValue: (p) => p.phase, cell: (p) => <Status kind="project" value={projectStatus(p)} /> },
      { key: 'value', header: 'Value (AED)', align: 'right', hideBelow: 'lg', sortValue: (p) => contractValue(p), cell: (p) => money(contractValue(p)) },
      { key: 'done', header: 'Work done', hideBelow: 'md', sortValue: (p) => percentComplete(p), className: 'min-w-[140px]', cell: (p) => <ProgressBar value={percentComplete(p)} tone={p.onHold ? 'orange' : 'dark'} /> },
      { key: 'paid', header: 'Paid (AED)', align: 'right', hideBelow: 'xl', sortValue: (p) => paidTotal(p), cell: (p) => money(paidTotal(p)) },
      {
        key: 'margin', header: 'Margin', align: 'right', hideBelow: 'xl', sortValue: (p) => forecast(p).marginPct,
        cell: (p) => { const f = forecast(p); return <span className={cn('tabular-nums', f.marginPct < 20 ? 'font-medium text-red-700' : 'text-slate-700')}>{f.marginPct.toFixed(0)}%</span>; },
      },
      {
        key: 'end', header: 'Ends', hideBelow: 'lg', sortValue: (p) => (p.phase === 'retention' ? p.handover.dlpEnd : p.endOn),
        cell: (p) => {
          const date = p.phase === 'retention' ? p.handover.dlpEnd : p.endOn;
          return (
            <div>
              <p className="tabular-nums text-slate-900">{fmtDate(date)}</p>
              <p className={cn('text-xs', p.phase !== 'retention' && p.phase !== 'complete' && date < today ? 'font-medium text-red-700' : 'text-slate-500')}>
                {p.phase === 'retention' ? 'liability ' : ''}{relDays(date, today)}
              </p>
            </div>
          );
        },
      },
    ],
    [s, today],
  );
  const table = useTable(rows, columns, { pageSize: 10, initialSort: { key: 'number', dir: 'asc' } });

  return (
    <Page
      title="Projects"
      facts={`${plural(counts.active, 'active project')}${counts.liability ? ` · ${counts.liability} in defects liability` : ''}`}
      about={ABOUT}
      footer={<Pagination table={table} noun="projects" />}
    >
      {ready.length > 0 && canEdit('projects') && (
        <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-green-900"><CircleCheckIcon className="size-4" aria-hidden="true" /> Accepted project quotations to start</p>
          <ul className="mt-2 space-y-1 text-sm text-green-950">
            {ready.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link className="font-medium underline underline-offset-2" to={`/sales/quotations/${x.id}`}>{quotationLabel(x)}</Link>
                <span>{s.customers[x.customerId]?.name} · {aed(quoteTotals(x, s.settings.vatRate).net)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search number, title, customer, site" />
        <Segmented
          size="sm"
          label="Group"
          value={group}
          onChange={setGroup}
          options={[
            { value: 'active', label: 'Active', count: counts.active },
            { value: 'liability', label: 'Defects liability', count: counts.liability },
            { value: 'complete', label: 'Complete', count: counts.complete },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(p) => `/projects/${p.id}`}
        empty={<EmptyState icon={HardHatIcon} title="No project here" action={<Button onClick={() => { setQ(''); setGroup('active'); }}>Clear filters</Button>}>A project starts from an accepted project quotation in Sales.</EmptyState>}
        mobileRow={(p) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{p.number} · {p.title}</p>
              <p className="truncate text-xs text-slate-500">{s.customers[p.customerId]?.name} · {Math.round(percentComplete(p))}% done</p>
            </div>
            <Status kind="project" value={projectStatus(p)} dot={false} />
          </div>
        )}
      />
    </Page>
  );
}
