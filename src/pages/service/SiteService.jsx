import { Link } from 'react-router';
import { PlusIcon } from 'lucide-react';
import { JOB_KINDS } from '@/data/serviceKinds.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { aed, plural } from '@/lib/format.js';
import { PHASES } from '@/data/projectKinds.js';
import { projectsOfSite } from '@/store/projectSelectors.js';
import { contractStatus, contractsOfSite, deficienciesOfSite, jobStatus, jobsOfSite, visitState } from '@/store/serviceSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Card, DefinitionList } from '@/ui/Page.jsx';

// The service history of one site, shown on the site's page (the tab "Service").
export function SiteService({ site }) {
  const s = useStore();
  const { canEdit } = useSession();
  const today = todayISO();
  const contracts = contractsOfSite(s, site.id).toSorted((a, b) => b.startOn.localeCompare(a.startOn));
  const current = contracts.find((c) => ['active', 'expiring', 'awaiting_approval', 'draft'].includes(contractStatus(c, today))) ?? contracts[0];
  const jobs = jobsOfSite(s, site.id).toSorted((a, b) => (b.plannedOn || b.dueOn || '').localeCompare(a.plannedOn || a.dueOn || ''));
  const open = deficienciesOfSite(s, site.id).filter((d) => !['verified', 'declined'].includes(d.status));
  const certificates = list(s.certificates).filter((c) => c.siteId === site.id).toSorted((a, b) => b.issuedOn.localeCompare(a.issuedOn));
  const projects = projectsOfSite(s, site.id);
  const eff = current ? contractStatus(current, today) : null;
  const rows = current?.visitPlan ?? [];
  const done = rows.filter((r) => visitState(r, s.jobs[r.jobId], today) === 'done').length;
  const next = rows.find((r) => ['upcoming', 'unplanned', 'planned'].includes(visitState(r, s.jobs[r.jobId], today)) && r.dueOn >= today) ?? null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card title="Maintenance contract" action={current && <Button variant="ghost" size="xs" to={`/service/${current.id}`}>Open</Button>}>
          {current ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link className="text-sm font-semibold text-slate-900 hover:underline" to={`/service/${current.id}`}>{current.number}</Link>
                <Status kind="contract" value={eff} />
              </div>
              <DefinitionList
                items={[
                  { label: 'Period', value: `${fmtDate(current.startOn)} to ${fmtDate(current.endOn)}` },
                  { label: 'Fee a year', value: `${aed(current.annualFee)} before VAT` },
                  { label: 'Visits done', value: `${done} of ${rows.length}` },
                  { label: 'Next visit', value: next ? `${fmtDate(next.dueOn)} (${relDays(next.dueOn, today)})` : 'None planned' },
                  { label: 'Emergency response', value: `Within ${current.responseHours} hours` },
                ]}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">This site has no maintenance contract. Its visits are call-outs, and they are chargeable.</p>
              {canEdit('sales') && <Button size="sm" to={`/sales/quotations/new?kind=contract&customer=${site.customerId}&site=${site.id}`}>Make a contract quotation</Button>}
            </div>
          )}
        </Card>

        <Card title="Jobs" action={canEdit('service') && <Button variant="ghost" size="xs" icon={PlusIcon} to={`/service/jobs/new?customer=${site.customerId}&site=${site.id}`}>New call-out</Button>}>
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500">No job at this site yet.</p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {jobs.slice(0, 8).map((j) => (
                <li key={j.id}>
                  <Link to={`/service/jobs/${j.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:opacity-80">
                    <span className="w-36 text-sm font-medium tabular-nums text-slate-900">{j.number}</span>
                    <span className="min-w-0 flex-1 basis-44">
                      <span className="block truncate text-sm text-slate-800">{j.title}</span>
                      <span className="block text-xs text-slate-500">{JOB_KINDS[j.kind].label} · {fmtDate(j.completedOn || j.plannedOn || j.dueOn)}</span>
                    </span>
                    <Status kind="job" value={jobStatus(j, today)} dot={false} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {jobs.length > 8 && <p className="mt-3 text-xs text-slate-500">The latest 8 of {jobs.length} jobs.</p>}
        </Card>
      </div>

      <div className="space-y-5">
        <Card title={`Open deficiencies (${open.length})`}>
          {open.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing is open.</p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {open.map((d) => (
                <li key={d.id}>
                  <Link to={`/service/deficiencies/${d.id}`} className="block py-2.5 hover:opacity-80">
                    <span className="flex items-center gap-2"><span className="text-sm font-medium tabular-nums text-slate-900">{d.number}</span><Status kind="severity" value={d.severity} dot={false} /></span>
                    <span className="mt-0.5 block text-sm text-slate-700">{d.title}</span>
                    <span className="block text-xs text-slate-500"><Status kind="deficiency" value={d.status} dot={false} className="!bg-transparent !px-0" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {projects.length > 0 && (
          <Card title={`Projects (${projects.length})`}>
            <ul className="-my-2 divide-y divide-slate-100">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="block py-2.5 hover:opacity-80">
                    <span className="flex items-center gap-2"><span className="text-sm font-medium tabular-nums text-slate-900">{p.number}</span><Status kind="project" value={p.onHold ? 'on_hold' : p.phase} dot={false} /></span>
                    <span className="mt-0.5 block text-sm text-slate-700">{p.title}</span>
                    <span className="block text-xs text-slate-500">{PHASES[p.phase].label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card title="Certificates">
          {certificates.length === 0 ? (
            <p className="text-sm text-slate-500">None issued yet.</p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {certificates.map((c) => (
                <li key={c.id} className="py-2.5 text-sm">
                  <Link className="font-medium tabular-nums text-slate-900 hover:underline" to={`/service/jobs/${c.jobId}?tab=report`}>{c.number}</Link>
                  <p className="text-xs text-slate-500">{plural(c.systemIds.length, 'system')} · issued {fmtDate(c.issuedOn)} · next {fmtDate(c.nextDue)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
