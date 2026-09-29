import { useState } from 'react';
import { Link } from 'react-router';
import { ShieldCheckIcon } from 'lucide-react';
import { SYSTEM_TYPES } from '@/data/catalog.js';
import { longCycle } from '@/data/serviceRules.js';
import { cn } from '@/lib/cn.js';
import { addMonths, diffDays, fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { num, plural } from '@/lib/format.js';
import { submitReturn } from '@/store/serviceActions.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Badge } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Field, TextInput, useForm } from '@/ui/Form.jsx';
import { Modal } from '@/ui/Overlay.jsx';
import { Card, EmptyState, Page } from '@/ui/Page.jsx';
import { ServiceTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'What the authority and the customers expect the company to keep in order: the maintenance certificates and when each is due again, the monthly return to the Civil Defence, the certificates of the sites, the long-cycle work of extinguishers, and the contracts that wait for approval.',
  why: [
    'In the UAE the authority receives maintenance contracts and expects a status report during the year; in Dubai a monthly return is described (study, standards table). This page collects what would be in it.',
    'A certificate is issued from a completed visit and says when the next one is due, so an expired certificate is seen weeks before it is a problem.',
    'Extinguishers have long cycles that a yearly visit does not catch: an internal examination every 6 years and a hydrostatic test every 12 (NFPA 10). They are listed by date so they are planned like any other work.',
  ],
  assumed: [
    'Everything about the return, the certificates and the approval by the authority is a sample. Which emirate needs what, on which form, by which day, is the first question of the research of phase 2.',
    'The month of the return and its due day (the 10th) are assumed.',
  ],
};

const monthName = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
};

// What one month's return would say, counted from the records.
function returnFacts(s, month) {
  const inMonth = (d) => typeof d === 'string' && d.startsWith(month);
  const jobs = list(s.jobs).filter((j) => inMonth(j.completedOn));
  const found = list(s.deficiencies).filter((d) => inMonth(d.foundOn));
  return {
    visits: jobs.filter((j) => j.kind === 'planned_visit').length,
    callouts: jobs.filter((j) => j.kind === 'call_out').length,
    repairs: jobs.filter((j) => j.kind === 'repair').length,
    certificates: list(s.certificates).filter((c) => inMonth(c.issuedOn)).length,
    found: found.length,
    impairments: found.filter((d) => d.severity === 'impairment').length,
  };
}

function ReturnDialog({ month, onClose }) {
  const s = useStore();
  const facts = returnFacts(s, month);
  const form = useForm({ reference: `CDR-${month.replace('-', '')}-${100 + list(s.returns).length}` }, (v) => (v.reference.trim() ? {} : { reference: 'Write the reference.' }));
  const go = form.submit((v) => {
    submitReturn(month, v.reference.trim());
    toast(`Return for ${monthName(month)} submitted`);
    onClose();
  });
  return (
    <Modal open onClose={onClose} title={`Return for ${monthName(month)}`} width="max-w-lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Submit return</Button></>}>
      <dl className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ['Planned visits done', facts.visits], ['Call-outs done', facts.callouts], ['Repairs done', facts.repairs],
          ['Certificates issued', facts.certificates], ['Deficiencies found', facts.found], ['Impairments found', facts.impairments],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5"><dt className="text-xs text-slate-500">{label}</dt><dd className="text-lg font-semibold tabular-nums text-slate-900">{value}</dd></div>
        ))}
      </dl>
      <form onSubmit={go} className="mt-4">
        <Field label="Reference of the submission (sample)" required error={form.error('reference')}><TextInput {...form.bind('reference')} autoComplete="off" /></Field>
        <button type="submit" className="hidden" />
      </form>
      <p className="mt-3 text-xs text-slate-500">Sample: nothing is really sent. The content and the form of the return are confirmed in the research of phase 2.</p>
    </Modal>
  );
}

export function Compliance() {
  const s = useStore();
  const { canEdit } = useSession();
  const today = todayISO();
  const [returning, setReturning] = useState('');

  const certificates = list(s.certificates).toSorted((a, b) => a.nextDue.localeCompare(b.nextDue));
  const thisMonth = today.slice(0, 7);
  const months = [0, 1, 2, 3, 4, 5].map((n) => addMonths(`${thisMonth}-01`, -n).slice(0, 7));
  const previous = months[1];
  const sitesCd = list(s.sites)
    .filter((x) => x.civilDefence?.certificateExpiry)
    .map((x) => ({ site: x, days: diffDays(today, x.civilDefence.certificateExpiry) }))
    .filter((x) => x.days <= 120)
    .toSorted((a, b) => a.days - b.days);
  const extinguishers = list(s.devices)
    .filter((d) => s.systems[d.systemId]?.type === 'extinguishers')
    .map((d) => ({ d, cycle: longCycle(d, today) }))
    .filter((x) => x.cycle && diffDays(today, x.cycle.due) <= 365)
    .toSorted((a, b) => a.cycle.due.localeCompare(b.cycle.due));
  const waiting = list(s.contracts).filter((c) => c.status === 'awaiting_approval');

  return (
    <Page title="Compliance" facts="Certificates, the monthly return and what the authority expects" tabs={<ServiceTabs />} about={ABOUT}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Maintenance certificates" className="xl:col-span-2" bodyClassName="!px-2">
          {certificates.length === 0 ? (
            <EmptyState icon={ShieldCheckIcon} title="No certificate yet">A certificate is issued with the service report of a planned visit.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {certificates.map((c) => {
                const days = diffDays(today, c.nextDue);
                return (
                  <li key={c.id}>
                    <Link to={`/service/jobs/${c.jobId}?tab=report`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-3 hover:bg-slate-50">
                      <span className="w-32 text-sm font-medium tabular-nums text-slate-900">{c.number}</span>
                      <span className="min-w-0 flex-1 basis-48">
                        <span className="block truncate text-sm text-slate-900">{s.sites[c.siteId]?.name}</span>
                        <span className="block truncate text-xs text-slate-500">{plural(c.systemIds.length, 'system')} · issued {fmtDate(c.issuedOn)}</span>
                      </span>
                      <span className="text-sm text-slate-700">Next visit {fmtDate(c.nextDue)}</span>
                      <Badge tone={days < 0 ? 'red' : days <= 30 ? 'orange' : 'green'} dot>{relDays(c.nextDue, today)}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Monthly return to the Civil Defence (sample)">
          <ul className="divide-y divide-slate-100">
            {months.map((m) => {
              const ret = s.returns[m];
              const facts = returnFacts(s, m);
              return (
                <li key={m} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm">
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="font-medium text-slate-900">{monthName(m)}</p>
                    <p className="text-xs text-slate-500">{plural(facts.visits, 'visit')} · {plural(facts.certificates, 'certificate')} · {plural(facts.found, 'deficiency', 'deficiencies')} found</p>
                  </div>
                  {ret ? (
                    <span className="text-xs text-green-800"><Badge tone="green" dot>Submitted</Badge> <span className="ml-1 tabular-nums text-slate-500">{ret.reference}</span></span>
                  ) : m === thisMonth ? (
                    <Badge tone="neutral">Month in progress</Badge>
                  ) : (
                    <>
                      <Badge tone={m === previous ? 'orange' : 'red'} dot>{m === previous ? 'To submit by the 10th' : 'Not submitted'}</Badge>
                      {canEdit('service') && <Button size="xs" variant={m === previous ? 'primary' : 'secondary'} onClick={() => setReturning(m)}>Submit</Button>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card title="Certificates of the sites">
            {sitesCd.length === 0 ? (
              <p className="text-sm text-slate-500">No site certificate expires within 4 months.</p>
            ) : (
              <ul className="-my-2 divide-y divide-slate-100">
                {sitesCd.map(({ site, days }) => (
                  <li key={site.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Link to={`/customers/sites/${site.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:underline">{site.name}</Link>
                    <span className="tabular-nums text-slate-600">{fmtDate(site.civilDefence.certificateExpiry)}</span>
                    <Badge tone={days < 0 ? 'red' : 'orange'} dot>{days < 0 ? `Expired ${-days} days ago` : `In ${days} days`}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">Sample data: the certificate of a site as the authority gives it.</p>
          </Card>
          <Card title="Contracts waiting for the authority">
            {waiting.length === 0 ? (
              <p className="text-sm text-slate-500">None.</p>
            ) : (
              <ul className="-my-2 divide-y divide-slate-100">
                {waiting.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Link to={`/service/${c.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:underline">{c.number} · {s.sites[c.siteId]?.name}</Link>
                    <span className="text-slate-600">since {relDays(c.cdApproval.submittedOn, today).replace(' ago', '')}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Extinguishers: long-cycle work in the next 12 months" className="xl:col-span-2" bodyClassName="!px-2">
          {extinguishers.length === 0 ? (
            <p className="px-3 text-sm text-slate-500">Nothing is due.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {extinguishers.map(({ d, cycle }) => (
                <li key={d.id}>
                  <Link to={`/customers/sites/${d.siteId}?tab=equipment&open=${d.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-3 hover:bg-slate-50">
                    <span className="min-w-0 flex-1 basis-56">
                      <span className="block truncate text-sm text-slate-900">{SYSTEM_TYPES.extinguishers.devices[d.type]?.label ?? d.type} × {num(d.qty)} <span className="text-slate-500">({d.tag})</span></span>
                      <span className="block truncate text-xs text-slate-500">{s.sites[d.siteId]?.name} · made {d.installedOn.slice(0, 4)}</span>
                    </span>
                    <span className="text-sm text-slate-700">{cycle.label}</span>
                    <span className={cn('text-sm tabular-nums', diffDays(today, cycle.due) < 0 ? 'font-medium text-red-700' : 'text-slate-700')}>{fmtDate(cycle.due)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 px-3 text-xs text-slate-500">Worked out from the year of manufacture (NFPA 10): sample dates.</p>
        </Card>
      </div>
      {returning && <ReturnDialog month={returning} onClose={() => setReturning('')} />}
    </Page>
  );
}
