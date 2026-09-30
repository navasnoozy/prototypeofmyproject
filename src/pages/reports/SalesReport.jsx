import { periodLabel } from '@/data/reportRules.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { money, plural } from '@/lib/format.js';
import { salesReport } from '@/store/reportSelectors.js';
import { useStore } from '@/store/store.js';
import { Card, Page } from '@/ui/Page.jsx';
import { ColumnChart } from '@/ui/Charts.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { PeriodBar, ReportTabs, SimpleTable, TableCard, useReportPeriod } from './parts.jsx';

const ABOUT = {
  purpose: 'How much work was quoted, how much was won and lost, how good the company is at winning it, and what is still waiting for the customer\'s answer.',
  why: [
    'Quoted is counted on the day a quotation was sent to the customer; won and lost are counted on the day the customer answered. A quotation that was revised counts once, by its latest revision.',
    'The win rate is won divided by won plus lost. A quotation still waiting is neither, so a good quarter is not spoiled by quotations that are simply young.',
    'By kind and by person answer two different questions: which sort of work the company wins, and who wins it. A low rate on repairs is a different problem from a low rate for one person.',
    'Values are the net of the quotation, after its discount and before VAT.',
    '"Why work is lost" uses the reason recorded when the customer said no, or when an enquiry was closed as lost without a quotation (its estimated value counts). It is only as good as the reasons people choose.',
  ],
  assumed: ['A quotation that expired without an answer stays "waiting" here until somebody records the answer or lets it lapse.'],
};

const rate = (x) => (x.winRate === null ? <span className="text-slate-400">—</span> : `${x.winRate}%`);

export function SalesReport() {
  const s = useStore();
  const [period, setPeriod] = useReportPeriod();
  const r = salesReport(s, period, todayISO());

  const columns = (first) => [
    { key: 'label', header: first, cell: (x) => x.label },
    { key: 'sent', header: 'Sent', align: 'right', cell: (x) => x.sent },
    { key: 'sentValue', header: 'Quoted (AED)', align: 'right', cell: (x) => money(x.sentValue) },
    { key: 'won', header: 'Won', align: 'right', cell: (x) => x.won },
    { key: 'wonValue', header: 'Won (AED)', align: 'right', cell: (x) => money(x.wonValue) },
    { key: 'rate', header: 'Win rate', align: 'right', cell: rate },
  ];
  const csvOf = (name, rows) => ({
    file: `quotations-by-${name}-${period}.csv`,
    header: [name === 'kind' ? 'Kind' : 'Person', 'Sent', 'Quoted (AED)', 'Won', 'Won (AED)', 'Lost', 'Win rate (%)'],
    rows: rows.map((x) => [x.label, x.sent, x.sentValue.toFixed(2), x.won, x.wonValue.toFixed(2), x.lost, x.winRate ?? '']),
  });

  return (
    <Page title="Sales" facts={`${periodLabel(period)}: ${fmtDate(r.range.from)} to ${fmtDate(r.range.to)}`} tabs={<ReportTabs />} about={ABOUT}>
      <PeriodBar period={period} onChange={setPeriod} note="Values are the net of the quotations, in AED." />
      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Quoted" amount={r.sentValue} sub={plural(r.sent, 'quotation')} />
        <Stat label="Won" amount={r.wonValue} sub={plural(r.won, 'quotation')} />
        <Stat label="Win rate" value={r.winRate === null ? '—' : `${r.winRate}%`} sub={`${r.won} won, ${r.lost} lost`} />
        <Stat label="Waiting for the customer" amount={r.waitingValue} sub={plural(r.waiting, 'quotation')} />
        <Stat label="Open enquiries" value={r.openEnquiries} sub={r.lateEnquiries > 0 ? `${r.lateEnquiries} late to quote` : 'none late to quote'} tone={r.lateEnquiries > 0 ? 'text-orange-700' : undefined} />
      </dl>

      <Card title="Quoted and won, month by month" className="mb-5">
        <ColumnChart
          data={r.chart}
          label="Value of quotations sent and value won, for each of the last twelve months"
          series={[{ key: 'sent', label: 'Quoted', tone: 'dark' }, { key: 'won', label: 'Won', tone: 'green' }]}
        />
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <TableCard title="By kind of work" csv={csvOf('kind', r.byKind)}>
          <SimpleTable rows={r.byKind} rowKey={(x) => x.key} columns={columns('Kind')} empty="No quotation in this period." />
        </TableCard>
        <TableCard title="By person" csv={csvOf('person', r.byPerson)}>
          <SimpleTable rows={r.byPerson} rowKey={(x) => x.key} columns={columns('Person')} empty="No quotation in this period." />
        </TableCard>
      </div>

      <div className="mt-5">
        <TableCard
          title="Why work is lost"
          csv={{
            file: `why-work-is-lost-${period}.csv`,
            header: ['Reason', 'Lost', 'Value (AED)', 'Share of value (%)'],
            rows: r.byReason.map((x) => [x.reason, x.count, x.value.toFixed(2), x.share ?? '']),
          }}
        >
          <SimpleTable
            rows={r.byReason}
            rowKey={(x) => x.reason}
            columns={[
              { key: 'reason', header: 'Reason', cell: (x) => x.reason },
              { key: 'count', header: 'Lost', align: 'right', cell: (x) => x.count },
              { key: 'value', header: 'Value (AED)', align: 'right', cell: (x) => money(x.value) },
              { key: 'share', header: 'Share of value', align: 'right', cell: (x) => (x.share === null ? '' : `${x.share}%`) },
            ]}
            empty="No work was lost in this period."
          />
        </TableCard>
      </div>
    </Page>
  );
}
