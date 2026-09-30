import { Link } from 'react-router';
import { periodLabel } from '@/data/reportRules.js';
import { JOB_KINDS } from '@/data/serviceKinds.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { money, num, plural } from '@/lib/format.js';
import { serviceReport } from '@/store/reportSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Badge } from '@/ui/Badge.jsx';
import { Card, Page } from '@/ui/Page.jsx';
import { ColumnChart } from '@/ui/Charts.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { PeriodBar, ReportTabs, SimpleTable, TableCard, useReportPeriod } from './parts.jsx';

const ABOUT = {
  purpose: 'How the service side is doing: the maintenance contracts and what they are worth, the visits and call-outs done, what was found wrong and is still open, and which contracts must be renewed soon.',
  why: [
    'A maintenance contract is the steady income of a service company, so the first figure is how many are active and what a year of them is worth. The table of contracts ending in ninety days is the renewal work of the coming quarter.',
    '"On time" is the share of planned visits, due in the period, that were finished on or before their due day. A visit that is missed is a compliance problem before it is a money problem.',
    'Open deficiencies are counted by severity as NFPA 25 names them (non-critical, critical, impairment). An impairment means a system is out of order: it is the one figure that should always be zero.',
    'Technician time is the hours written on the completed jobs of the period, per person. It is the base for a later look at how busy people are; it is not a time sheet.',
  ],
  assumed: [
    'Hours come from the time written on each job. Travel time and time that was not written on a job are not counted.',
    'Which visits are "due" in a period follows the visit plan of each contract; the plan itself is a sample (evenly spread).',
  ],
};

export function ServiceReport() {
  const s = useStore();
  const { access } = useSession();
  const [period, setPeriod] = useReportPeriod();
  const today = todayISO();
  const r = serviceReport(s, period, today);
  const kindLabels = r.kinds.map((k) => JOB_KINDS[k].label);

  const endingCsv = {
    file: 'contracts-ending-in-90-days.csv',
    header: ['Contract', 'Customer', 'Site', 'Ends on', 'Days left', 'Annual fee (AED)', 'Renewal quotation'],
    rows: r.ending.map((x) => [x.contract.number, x.customer?.name, x.site?.name, x.contract.endOn, x.daysLeft, x.contract.annualFee.toFixed(2), x.renewal?.number ?? '']),
  };
  const peopleCsv = { file: `technician-time-${period}.csv`, header: ['Person', 'Jobs', 'Hours'], rows: r.people.map((x) => [x.person?.name, x.jobs, x.hours]) };

  return (
    <Page title="Service" facts={`${periodLabel(period)}: ${fmtDate(r.range.from)} to ${fmtDate(r.range.to)}`} tabs={<ReportTabs />} about={ABOUT}>
      <PeriodBar period={period} onChange={setPeriod} note="Contracts, deficiencies and equipment are shown as they stand today." />
      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Active contracts" value={r.activeContracts} sub={`AED ${money(r.annualValue)} a year`} />
        <Stat label="Jobs done" value={r.jobsDone} sub={`${plural(r.callOuts, 'call-out')} asked for${r.emergencies > 0 ? `, ${r.emergencies} emergency` : ''}`} />
        <Stat label="Visits on time" value={r.visitsOnTime === null ? '—' : `${r.visitsOnTime}%`} sub={`${r.visitsDone} of ${plural(r.visitsDue, 'visit')} due`} tone={r.visitsOnTime !== null && r.visitsOnTime < 80 ? 'text-orange-700' : undefined} />
        <Stat label="Open deficiencies" value={r.deficiencies} sub={r.deficiencies > 0 ? `the oldest ${plural(r.oldestDeficiency, 'day')}` : 'none'} tone={r.bySeverity.find((x) => x.key === 'impairment')?.count > 0 ? 'text-red-700' : undefined} />
        <Stat label="Equipment overdue" value={num(r.devices.overdue)} sub={`${num(r.devices.soon)} more due soon`} tone={r.devices.overdue > 0 ? 'text-orange-700' : undefined} />
        <Stat label="Contracts ending soon" value={r.ending.length} sub="within 90 days" tone={r.ending.length > 0 ? 'text-orange-700' : undefined} />
      </dl>

      <Card title="Jobs completed, month by month" className="mb-5">
        <ColumnChart
          data={r.chart}
          label={`Number of ${kindLabels.join(', ').toLowerCase()} completed in each of the last twelve months`}
          format={(n) => String(n)}
          whole
          series={[{ key: 'planned_visit', label: 'Planned visits', tone: 'dark' }, { key: 'call_out', label: 'Call-outs', tone: 'blue' }, { key: 'repair', label: 'Repairs', tone: 'orange' }]}
        />
      </Card>

      <TableCard title="Contracts ending in the next 90 days" csv={endingCsv} className="mb-5">
        <SimpleTable
          rows={r.ending}
          rowKey={(x) => x.contract.id}
          empty="No contract ends in the next 90 days."
          columns={[
            { key: 'contract', header: 'Contract', cell: (x) => (access('service') ? <Link to={`/service/${x.contract.id}`} className="font-medium underline-offset-2 hover:underline">{x.contract.number}</Link> : x.contract.number) },
            { key: 'customer', header: 'Customer and site', cell: (x) => <><span className="block">{x.customer?.name}</span><span className="block text-xs text-slate-500">{x.site?.name}</span></> },
            { key: 'ends', header: 'Ends', cell: (x) => <span className="whitespace-nowrap">{fmtDate(x.contract.endOn)}</span> },
            { key: 'left', header: 'Days left', align: 'right', cell: (x) => x.daysLeft },
            { key: 'fee', header: 'A year (AED)', align: 'right', cell: (x) => money(x.contract.annualFee) },
            { key: 'renewal', header: 'Renewal', cell: (x) => (x.renewal ? <span className="whitespace-nowrap">{x.renewal.number}</span> : <span className="text-orange-700">Not started</span>) },
          ]}
        />
      </TableCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Open deficiencies by severity">
          <ul className="divide-y divide-slate-100">
            {r.bySeverity.map((x) => (
              <li key={x.key} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <Badge tone={x.tone}>{x.label}</Badge>
                <span className="text-lg font-semibold tabular-nums text-slate-900">{x.count}</span>
              </li>
            ))}
          </ul>
          {access('service') && <Link to="/service/deficiencies" className="mt-3 inline-block text-sm font-medium text-slate-900 underline underline-offset-2">Open the deficiencies</Link>}
        </Card>
        <TableCard title="Technician time" csv={peopleCsv}>
          <SimpleTable
            rows={r.people}
            rowKey={(x) => x.person?.id}
            empty="No time was written on a completed job in this period."
            columns={[
              { key: 'person', header: 'Person', cell: (x) => x.person?.name },
              { key: 'jobs', header: 'Jobs', align: 'right', cell: (x) => x.jobs },
              { key: 'hours', header: 'Hours', align: 'right', cell: (x) => x.hours },
            ]}
          />
        </TableCard>
      </div>
    </Page>
  );
}
