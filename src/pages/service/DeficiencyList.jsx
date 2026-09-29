import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { DEFICIENCY_STATUS, SEVERITY } from '@/data/serviceKinds.js';
import { cn } from '@/lib/cn.js';
import { diffDays, fmtDate, todayISO } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { SYSTEM_TYPES } from '@/data/catalog.js';
import { DeficiencyDrawer } from './DeficiencyDialogs.jsx';
import { ServiceTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'Everything that was found wrong at a customer\'s equipment, and how far each one has come: told to the customer, quoted, approved, repaired, verified. It is the list that keeps the company safe: a deficiency that nobody follows is a liability.',
  why: [
    'The class (non-critical, critical, impairment) is separate from the state. A critical deficiency can be new or repaired; mixing the two in one field is the mistake of simple systems (study, D.3).',
    'An impairment means a system or a part is out of order. It takes the system out of service in the register and shows in the bell until someone verifies the repair, because the owner must be told at once and in writing.',
    '"Next step" says what the company has to do now, so the list works as a queue for the coordinator.',
    'A deficiency the customer declined stays on the record: it is the proof that the customer was told.',
  ],
  assumed: [
    'The three classes follow NFPA 25 (2011 and later). Which words UAE technicians and customers use is still open (study, section R).',
  ],
};

const GROUPS = {
  open: (d) => !['verified', 'declined'].includes(d.status),
  impairment: (d) => d.severity === 'impairment' && d.status !== 'verified',
  declined: (d) => d.status === 'declined',
  closed: (d) => d.status === 'verified',
  all: () => true,
};

export const NEXT_STEP = {
  found: 'Report to the customer',
  reported: 'Make the repair quotation',
  quoted: 'Waiting for the customer',
  approved: 'Create the repair job',
  repaired: 'Verify the repair',
  verified: '',
  declined: '',
};

export function DeficiencyList() {
  const s = useStore();
  const navigate = useNavigate();
  const { canEdit } = useSession();
  const today = todayISO();
  const [q, setQ] = useParam('q');
  const [group, setGroup] = useParam('group', 'open');
  const [status, setStatus] = useParam('status');
  const [severity, setSeverity] = useParam('severity');
  const [adding, setAdding] = useState(false);

  const all = list(s.deficiencies);
  const counts = useMemo(() => Object.fromEntries(Object.entries(GROUPS).map(([key, fn]) => [key, all.filter(fn).length])), [all]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (d) =>
        GROUPS[group]?.(d) &&
        (!status || d.status === status) &&
        (!severity || d.severity === severity) &&
        (!needle || `${d.number} ${d.title} ${s.sites[d.siteId]?.name}`.toLowerCase().includes(needle)),
    );
  }, [all, q, group, status, severity, s.sites]);

  const columns = useMemo(
    () => [
      {
        key: 'number', header: 'Deficiency', sortValue: (d) => d.number,
        cell: (d) => (
          <div className="min-w-0">
            <p className="font-medium tabular-nums text-slate-900">{d.number}</p>
            <p className="max-w-[340px] truncate text-xs text-slate-500">{d.title}</p>
          </div>
        ),
      },
      {
        key: 'site', header: 'Site', hideBelow: 'md', sortValue: (d) => s.sites[d.siteId]?.name,
        cell: (d) => (
          <div className="min-w-0">
            <p className="max-w-[220px] truncate text-slate-900">{s.sites[d.siteId]?.name}</p>
            <p className="max-w-[220px] truncate text-xs text-slate-500">{SYSTEM_TYPES[s.systems[d.systemId]?.type]?.label}</p>
          </div>
        ),
      },
      { key: 'severity', header: 'Class', sortValue: (d) => ['impairment', 'critical', 'noncritical'].indexOf(d.severity), cell: (d) => <Status kind="severity" value={d.severity} /> },
      { key: 'status', header: 'State', hideBelow: 'lg', cell: (d) => <Status kind="deficiency" value={d.status} dot={false} /> },
      {
        key: 'age', header: 'Found', hideBelow: 'lg', sortValue: (d) => d.foundOn,
        cell: (d) => {
          const age = diffDays(d.foundOn, today);
          const open = !['verified', 'declined'].includes(d.status);
          return (
            <div>
              <p className="tabular-nums text-slate-900">{fmtDate(d.foundOn)}</p>
              <p className={cn('text-xs', open && age > 30 ? 'font-medium text-red-700' : open && age > 14 ? 'text-orange-700' : 'text-slate-500')}>{age === 0 ? 'today' : plural(age, 'day')}</p>
            </div>
          );
        },
      },
      { key: 'next', header: 'Next step', hideBelow: 'xl', cell: (d) => <span className="text-slate-700">{NEXT_STEP[d.status] || '—'}</span> },
    ],
    [s, today],
  );
  const table = useTable(rows, columns, { pageSize: 10, initialSort: { key: 'severity', dir: 'asc' } });
  const clear = () => { setQ(''); setGroup('open'); setStatus(''); setSeverity(''); };

  return (
    <Page
      title="Deficiencies"
      facts={`${plural(counts.open, 'open deficiency', 'open deficiencies')}${counts.impairment ? ` · ${plural(counts.impairment, 'impairment')}` : ''}`}
      tabs={<ServiceTabs />}
      about={ABOUT}
      actions={canEdit('service') && <Button variant="primary" icon={PlusIcon} onClick={() => setAdding(true)}>Record deficiency</Button>}
      footer={<Pagination table={table} noun="deficiencies" />}
    >
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search number, title, site" />
        <div className="no-scrollbar max-w-full overflow-x-auto">
          <Segmented
            size="sm"
            label="Group"
            value={group}
            onChange={setGroup}
            options={[
              { value: 'open', label: 'Open', count: counts.open },
              { value: 'impairment', label: 'Impairments', count: counts.impairment },
              { value: 'declined', label: 'Declined', count: counts.declined },
              { value: 'closed', label: 'Closed', count: counts.closed },
              { value: 'all', label: 'All', count: counts.all },
            ]}
          />
        </div>
        <FilterSelect label="Class" value={severity} onChange={setSeverity} options={Object.entries(SEVERITY).map(([value, v]) => ({ value, label: v.label }))} />
        <FilterSelect label="State" value={status} onChange={setStatus} options={Object.entries(DEFICIENCY_STATUS).map(([value, [, text]]) => ({ value, label: text }))} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(d) => `/service/deficiencies/${d.id}`}
        empty={<EmptyState icon={TriangleAlertIcon} title="No deficiency matches" action={<Button onClick={clear}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(d) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{d.number} · {d.title}</p>
              <p className="truncate text-xs text-slate-500">{s.sites[d.siteId]?.name} · {NEXT_STEP[d.status] || DEFICIENCY_STATUS[d.status][1]}</p>
            </div>
            <Status kind="severity" value={d.severity} dot={false} />
          </div>
        )}
      />
      {adding && <DeficiencyDrawer onClose={() => setAdding(false)} onSaved={(id) => navigate(`/service/deficiencies/${id}`)} />}
    </Page>
  );
}
