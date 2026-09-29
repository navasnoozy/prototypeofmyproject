import { useMemo } from 'react';
import { BoxIcon } from 'lucide-react';
import { SYSTEM_TYPES } from '@/data/catalog.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { num, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { dueOf, deviceTypeLabel, list } from '@/store/selectors.js';
import { openDeficienciesByDevice } from '@/store/serviceSelectors.js';
import { useStore } from '@/store/store.js';
import { Badge } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { DueCell } from '@/pages/customers/parts.jsx';
import { ServiceTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'Every piece of equipment the company maintains, at every customer, in one list, with the date each is next due. It answers "what is overdue, and where?" without opening the sites one by one.',
  why: [
    'The register is one register: it is kept at each site (that is where people look for it) and read here across all sites, because the coordinator plans by date, not by building.',
    'The due dates are computed from the last service and the interval. Completing a visit moves them, so this list and the sites and the bell always agree.',
    'A flag shows equipment that has an open deficiency, so a device that "passed its date" is never confused with one that is known to be faulty.',
  ],
  assumed: ['The intervals (3, 6 or 12 months) are samples; the real ones come from the standard, the authority and the contract of each site.'],
};

export function EquipmentRegister() {
  const s = useStore();
  const today = todayISO();
  const [q, setQ] = useParam('q');
  const [state, setState] = useParam('due', 'all');
  const [type, setType] = useParam('type');
  const [siteId, setSiteId] = useParam('site');

  const flags = useMemo(() => openDeficienciesByDevice(s), [s.deficiencies]);
  const rows = useMemo(
    () =>
      list(s.devices).map((d) => {
        const system = s.systems[d.systemId];
        return { ...d, system, site: s.sites[d.siteId], due: dueOf(d, today), typeLabel: deviceTypeLabel(system?.type, d.type), flagged: flags[d.id]?.length ?? 0 };
      }),
    [s.devices, s.systems, s.sites, flags, today],
  );
  const counts = useMemo(
    () => ({
      all: rows.length,
      overdue: rows.filter((r) => r.due.status === 'overdue').length,
      soon: rows.filter((r) => r.due.status === 'soon').length,
      out: rows.filter((r) => r.due.status === 'out').length,
      items: rows.reduce((sum, r) => sum + r.qty, 0),
    }),
    [rows],
  );
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (state === 'all' || r.due.status === state) &&
        (!type || r.system?.type === type) &&
        (!siteId || r.siteId === siteId) &&
        (!needle || `${r.tag} ${r.typeLabel} ${r.location} ${r.site?.name}`.toLowerCase().includes(needle)),
    );
  }, [rows, q, state, type, siteId]);

  const columns = useMemo(
    () => [
      {
        key: 'tag', header: 'Equipment', sortValue: (r) => r.typeLabel,
        cell: (r) => (
          <div className="min-w-0">
            <p className="text-slate-900">
              {r.typeLabel}
              {r.qty > 1 && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs font-medium tabular-nums text-slate-600">× {num(r.qty)}</span>}
            </p>
            <p className="text-xs tabular-nums text-slate-500">{r.tag}</p>
          </div>
        ),
      },
      {
        key: 'site', header: 'Site and system', sortValue: (r) => r.site?.name,
        cell: (r) => (
          <div className="min-w-0">
            <p className="max-w-[240px] truncate text-slate-900">{r.site?.name}</p>
            <p className="max-w-[240px] truncate text-xs text-slate-500">{r.system?.name}</p>
          </div>
        ),
      },
      { key: 'where', header: 'Where', hideBelow: 'lg', cell: (r) => <span className="block max-w-[240px] truncate text-slate-700">{r.location}</span> },
      { key: 'last', header: 'Last service', hideBelow: 'md', sortValue: (r) => r.lastServiced, cell: (r) => <span className="whitespace-nowrap tabular-nums text-slate-700">{fmtDate(r.lastServiced)}</span> },
      { key: 'due', header: 'Next due', sortValue: (r) => (r.due.status === 'out' ? '9999' : r.due.next), cell: (r) => <DueCell device={r} /> },
      { key: 'flag', header: '', hideBelow: 'md', cell: (r) => (r.flagged ? <Badge tone="orange" dot>{plural(r.flagged, 'deficiency', 'deficiencies')}</Badge> : null) },
    ],
    [],
  );
  const table = useTable(shown, columns, { pageSize: 12, initialSort: { key: 'due', dir: 'asc' } });
  const clear = () => { setQ(''); setState('all'); setType(''); setSiteId(''); };
  const sites = [...new Set(rows.map((r) => r.siteId))].map((id) => ({ value: id, label: s.sites[id]?.name ?? id })).toSorted((a, b) => a.label.localeCompare(b.label));

  return (
    <Page
      title="Equipment"
      facts={`${plural(counts.items, 'item')} in ${plural(counts.all, 'group')} · ${counts.overdue} overdue · ${counts.soon} due in 30 days${counts.out ? ` · ${counts.out} out of service` : ''}`}
      tabs={<ServiceTabs />}
      about={ABOUT}
      footer={<Pagination table={table} noun="groups" />}
    >
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search equipment, tag, place, site" />
        <div className="no-scrollbar max-w-full overflow-x-auto">
          <Segmented
            size="sm"
            label="Due"
            value={state}
            onChange={setState}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'overdue', label: 'Overdue', count: counts.overdue },
              { value: 'soon', label: 'Due in 30 days', count: counts.soon },
              { value: 'out', label: 'Out of service', count: counts.out },
            ]}
          />
        </div>
        <FilterSelect label="System" value={type} onChange={setType} options={Object.entries(SYSTEM_TYPES).map(([value, t]) => ({ value, label: t.label }))} />
        <FilterSelect label="Site" value={siteId} onChange={setSiteId} options={sites} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        rowHref={(r) => `/customers/sites/${r.siteId}?tab=equipment&open=${r.id}`}
        empty={<EmptyState icon={BoxIcon} title="No equipment matches" action={<Button onClick={clear}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(r) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{r.typeLabel}{r.qty > 1 ? ` × ${r.qty}` : ''}</p>
              <p className="truncate text-xs text-slate-500">{r.site?.name} · {r.tag}</p>
            </div>
            <DueCell device={r} />
          </div>
        )}
      />
    </Page>
  );
}
