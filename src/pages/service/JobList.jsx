import { useMemo } from 'react';
import { ClipboardListIcon, PlusIcon } from 'lucide-react';
import { JOB_KINDS, WINDOWS } from '@/data/serviceKinds.js';
import { URGENCY } from '@/data/quotationKinds.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { jobStatus } from '@/store/serviceSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Badge, Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { JobKindTag, ServiceTabs, staffNames } from './parts.jsx';

const ABOUT = {
  purpose: 'Every piece of field work in one list: the planned visits of the contracts, the call-outs when a customer reports a fault, and the repairs. This is the coordinator\'s working list: what needs a day and people, what is under way, and what is done but not yet reported.',
  why: [
    'One record for all three kinds of work (planned visit, call-out, repair), because the technician does the same things in all of them: attend, check, record, get a signature, report (study, section D.3).',
    'A visit released from a contract stays "upcoming" until 30 days before its date, then turns into "needs planning" by itself, so nothing depends on someone remembering.',
    '"To report" lists the jobs that are done but whose report has not gone to the customer. In this trade the report is what proves the work and what allows the invoice, so an unsent report is money and compliance at risk.',
    'A technician opens this list already filtered to his own jobs.',
  ],
  assumed: [
    'The 30-day rule, the three kinds of job and the urgency words are samples; the day-by-day calendar comes with Schedule (step 5).',
  ],
};

const GROUPS = {
  open: ['unplanned', 'planned', 'in_progress'],
  unplanned: ['unplanned'],
  to_report: ['completed'],
  upcoming: ['upcoming'],
  closed: ['report_sent', 'cancelled'],
};

// The date that matters for a job in its state.
export const whenOf = (j, today) => {
  if (['completed', 'report_sent'].includes(j.status)) return { date: j.completedOn, label: 'Done' };
  if (j.status === 'cancelled') return { date: j.dueOn, label: 'Cancelled' };
  if (j.plannedOn) return { date: j.plannedOn, label: j.status === 'in_progress' ? 'Started' : 'Planned' };
  return { date: j.dueOn, label: j.status === 'upcoming' ? 'Visit due' : 'Needed by' };
};

export function JobList() {
  const s = useStore();
  const { user, roleKey, canEdit } = useSession();
  const today = todayISO();
  const isTech = roleKey === 'technician';
  const [q, setQ] = useParam('q');
  const [status, setStatus] = useParam('status', 'open');
  const [kind, setKind] = useParam('kind');
  const [assignee, setAssignee] = useParam('assignee', isTech ? 'me' : '');

  const withStatus = useMemo(() => list(s.jobs).map((j) => ({ ...j, eff: jobStatus(j, today) })), [s.jobs, today]);
  const counts = useMemo(() => {
    const c = { all: withStatus.length };
    for (const [key, group] of Object.entries(GROUPS)) c[key] = withStatus.filter((x) => group.includes(x.eff)).length;
    return c;
  }, [withStatus]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return withStatus.filter(
      (j) =>
        (status === 'all' || GROUPS[status]?.includes(j.eff)) &&
        (!kind || j.kind === kind) &&
        (!assignee || assignee === 'all' || j.assigneeIds.includes(assignee === 'me' ? user.id : assignee)) &&
        (!needle || `${j.number} ${j.title} ${s.sites[j.siteId]?.name} ${s.customers[j.customerId]?.name}`.toLowerCase().includes(needle)),
    );
  }, [withStatus, q, status, kind, assignee, user.id, s.sites, s.customers]);

  const columns = useMemo(
    () => [
      {
        key: 'number', header: 'Job', sortValue: (j) => j.number,
        cell: (j) => (
          <div className="min-w-0">
            <p className="font-medium tabular-nums text-slate-900">{j.number}</p>
            <p className="max-w-[300px] truncate text-xs text-slate-500">{j.title}</p>
          </div>
        ),
      },
      {
        key: 'site', header: 'Site', hideBelow: 'md', sortValue: (j) => s.sites[j.siteId]?.name,
        cell: (j) => (
          <div className="min-w-0">
            <p className="max-w-[240px] truncate text-slate-900">{s.sites[j.siteId]?.name}</p>
            <p className="max-w-[240px] truncate text-xs text-slate-500">{s.customers[j.customerId]?.name}</p>
          </div>
        ),
      },
      {
        key: 'kind', header: 'Kind', hideBelow: 'lg',
        cell: (j) => (
          <div className="flex flex-col items-start gap-1">
            <JobKindTag kind={j.kind} />
            {j.urgency !== 'normal' && <Badge tone={j.urgency === 'emergency' ? 'red' : 'orange'}>{URGENCY[j.urgency]}</Badge>}
          </div>
        ),
      },
      {
        key: 'when', header: 'When', sortValue: (j) => whenOf(j, today).date || '9999',
        cell: (j) => {
          const w = whenOf(j, today);
          return (
            <div>
              <p className="tabular-nums text-slate-900">{fmtDate(w.date)}{j.window && j.plannedOn ? <span className="text-slate-500"> · {WINDOWS[j.window].split(' (')[0]}</span> : ''}</p>
              <p className="text-xs text-slate-500">{w.label}{w.date ? `, ${relDays(w.date, today)}` : ''}</p>
            </div>
          );
        },
      },
      { key: 'who', header: 'People', hideBelow: 'xl', cell: (j) => <span className="block max-w-[200px] truncate text-slate-700">{staffNames(s, j.assigneeIds)}</span> },
      { key: 'status', header: 'Status', sortValue: (j) => j.eff, cell: (j) => <Status kind="job" value={j.eff} /> },
    ],
    [s, today],
  );
  const table = useTable(rows, columns, { pageSize: 10, initialSort: { key: 'when', dir: 'asc' } });

  const staffFilter = [{ value: 'me', label: 'Me' }, ...list(s.staff).filter((p) => ['technician', 'engineer'].includes(p.roleKey) && p.id !== user.id).map((p) => ({ value: p.id, label: p.name }))];
  const clear = () => { setQ(''); setStatus('open'); setKind(''); setAssignee(isTech ? 'me' : ''); };

  return (
    <Page
      title="Jobs"
      facts={`${plural(counts.open, 'open job')}${counts.unplanned ? ` · ${counts.unplanned} need planning` : ''}${counts.to_report ? ` · ${counts.to_report} to report` : ''}`}
      tabs={<ServiceTabs />}
      about={ABOUT}
      actions={canEdit('service') && <Button variant="primary" icon={PlusIcon} to="/service/jobs/new">New call-out</Button>}
      footer={<Pagination table={table} noun="jobs" />}
    >
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search number, title, site, customer" />
        <div className="no-scrollbar max-w-full overflow-x-auto">
          <Segmented
            size="sm"
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'open', label: 'Open', count: counts.open },
              { value: 'unplanned', label: 'Needs planning', count: counts.unplanned },
              { value: 'to_report', label: 'To report', count: counts.to_report },
              { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
              { value: 'closed', label: 'Closed', count: counts.closed },
              { value: 'all', label: 'All', count: counts.all },
            ]}
          />
        </div>
        <FilterSelect label="Kind" value={kind} onChange={setKind} options={Object.entries(JOB_KINDS).map(([value, k]) => ({ value, label: k.label }))} />
        <FilterSelect
          label="Person"
          value={assignee}
          onChange={(v) => setAssignee(v || (isTech ? 'all' : ''))}
          options={staffFilter}
        />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(j) => `/service/jobs/${j.id}`}
        empty={
          <EmptyState icon={ClipboardListIcon} title={status === 'open' && !q && !kind && !assignee ? 'Nothing open' : 'No job matches'} action={<Button onClick={clear}>Clear filters</Button>}>
            {status === 'to_report' ? 'Every finished job has its report sent.' : 'Try fewer words or clear the filters.'}
          </EmptyState>
        }
        mobileRow={(j) => {
          const w = whenOf(j, today);
          return (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{j.title}</p>
                <p className="truncate text-xs text-slate-500">{s.sites[j.siteId]?.name} · {JOB_KINDS[j.kind].label} · {w.date ? fmtDate(w.date) : ''}</p>
              </div>
              <Status kind="job" value={j.eff} dot={false} />
            </div>
          );
        }}
      />
    </Page>
  );
}
