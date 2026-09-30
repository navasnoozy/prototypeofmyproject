import { Link } from 'react-router';
import { PROJECT_STATUS } from '@/data/projectKinds.js';
import { cn } from '@/lib/cn.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { money, plural } from '@/lib/format.js';
import { projectsReport } from '@/store/reportSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Card, Page } from '@/ui/Page.jsx';
import { BarList } from '@/ui/Charts.jsx';
import { ProgressBar, Stat } from '@/pages/projects/parts.jsx';
import { ReportTabs, SimpleTable, TableCard } from './parts.jsx';

const ABOUT = {
  purpose: 'Every project side by side: what it is worth, how far it is, what it has cost against its budget, what has been claimed and paid, and how much retention the customer is holding.',
  why: [
    'A project earns money only if its cost stays inside its budget, so the chart puts the two next to each other for every project. The cost is what has been ordered or billed (committed and incurred); a bar turns red when it passes the budget.',
    'The forecast margin is the value minus the larger of the budget and the cost so far: it is what the project is expected to earn if the rest costs what was planned.',
    'Claimed, certified and paid follow the claims of each project. The difference between certified and paid is what the customer still owes on the work; retention is the money the customer holds back until the end of the defects liability period.',
    'A project has no period: these figures are as they stand today.',
  ],
  assumed: ['The cost of labour and of other costs is what was written on the project by hand; materials come from Purchases and Inventory.'],
};

export function ProjectsReport() {
  const s = useStore();
  const { access } = useSession();
  const r = projectsReport(s);
  const phase = (p) => PROJECT_STATUS[p.onHold ? 'on_hold' : p.phase]?.[1] ?? p.phase;

  const csv = {
    file: 'projects.csv',
    header: ['Project', 'Title', 'Customer', 'Phase', 'Done (%)', 'Value (AED)', 'Budget (AED)', 'Cost so far (AED)', 'Forecast margin (AED)', 'Claimed (AED)', 'Paid (AED)', 'Retention held (AED)'],
    rows: r.rows.map((x) => [x.project.number, x.project.title, x.customer?.name, phase(x.project), Math.round(x.percent), x.value.toFixed(2), x.budget.toFixed(2), x.cost.toFixed(2), x.margin.toFixed(2), x.claimed.toFixed(2), x.paid.toFixed(2), x.retention.toFixed(2)]),
  };

  return (
    <Page title="Projects" facts={`As they stand on ${fmtDate(todayISO())}`} tabs={<ReportTabs />} about={ABOUT}>
      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Projects under way" value={r.active} sub={`of ${plural(r.rows.length, 'project')}`} />
        <Stat label="Contract value" amount={r.value} sub="all projects, with approved variations" />
        <Stat label="Cost so far" amount={r.cost} sub={`budget AED ${money(r.budget)}${r.overPackages > 0 ? ` · ${plural(r.overPackages, 'package')} over` : ''}`} tone={r.cost > r.budget ? 'text-red-700' : undefined} />
        <Stat label="Claimed" amount={r.claimed} sub={`certified AED ${money(r.certified)}`} />
        <Stat label="Paid" amount={r.paid} sub={`AED ${money(r.certified - r.paid)} certified, not paid yet`} />
        <Stat label="Retention held" amount={r.retention} sub="held back by the customers" />
      </dl>

      <Card title="Budget and cost, project by project" className="mb-5">
        <BarList
          label="Budget and cost so far of each project"
          rows={r.rows.map((x) => ({ key: x.project.id, label: `${x.project.number}: ${x.project.title}`, sub: `${x.customer?.name ?? ''} · ${phase(x.project)}`, values: [x.budget, x.cost], flag: x.cost > x.budget }))}
          series={[{ key: 'budget', label: 'Budget', tone: 'light' }, { key: 'cost', label: 'Cost so far (red when over the budget)', tone: 'dark' }]}
          perRow
        />
      </Card>

      <TableCard title="Project by project" csv={csv}>
        <SimpleTable
          rows={r.rows}
          rowKey={(x) => x.project.id}
          columns={[
            { key: 'project', header: 'Project', className: 'min-w-[12rem]', cell: (x) => <><span className="block font-medium">{access('projects') ? <Link to={`/projects/${x.project.id}`} className="underline-offset-2 hover:underline">{x.project.number}</Link> : x.project.number}</span><span className="block text-xs text-slate-500">{x.customer?.name}</span></> },
            { key: 'phase', header: 'Phase', cell: (x) => <span className="whitespace-nowrap">{phase(x.project)}</span> },
            { key: 'done', header: 'Done', className: 'min-w-[6rem]', cell: (x) => <ProgressBar value={x.percent} /> },
            { key: 'value', header: 'Value', align: 'right', cell: (x) => money(x.value) },
            { key: 'cost', header: 'Cost', align: 'right', cell: (x) => <span className={cn(x.cost > x.budget && 'font-medium text-red-700')}>{money(x.cost)}</span> },
            { key: 'margin', header: 'Margin', align: 'right', cell: (x) => <span className={cn(x.margin < 0 && 'font-medium text-red-700')}>{money(x.margin)} <span className="text-xs text-slate-500">({Math.round(x.marginPct)}%)</span></span> },
            { key: 'paid', header: 'Paid', align: 'right', className: 'hidden xl:table-cell', cell: (x) => money(x.paid) },
            { key: 'retention', header: 'Retention', align: 'right', className: 'hidden xl:table-cell', cell: (x) => (x.retention > 0 ? money(x.retention) : <span className="text-slate-400">—</span>) },
          ]}
          foot={['Total', '', '', money(r.value), money(r.cost), '', money(r.paid), money(r.retention)]}
        />
      </TableCard>
    </Page>
  );
}
