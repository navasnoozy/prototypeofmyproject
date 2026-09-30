import { Link } from 'react-router';
import { periodLabel } from '@/data/reportRules.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { money, plural } from '@/lib/format.js';
import { moneyReport } from '@/store/reportSelectors.js';
import { useStore } from '@/store/store.js';
import { Card, Page } from '@/ui/Page.jsx';
import { ColumnChart } from '@/ui/Charts.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { PeriodBar, ReportTabs, SimpleTable, TableCard, useReportPeriod } from './parts.jsx';

const ABOUT = {
  purpose: 'How much money the company invoiced and collected, what customers still owe and how late it is, what the company owes its suppliers, and where the invoices come from.',
  why: [
    'The figures come from the same invoices, receipts and supplier bills as the Billing and Purchases areas. Nothing is typed here and nothing is stored: change an invoice and this page changes.',
    'Invoiced and received are shown before VAT and as money in, so the two can be compared month by month. VAT is not income of the company; it is passed to the tax authority.',
    '"Days to pay" is the time from the invoice to its last receipt, for the invoices that were paid in full during the period. It is the quickest sign of a customer that is slowing down.',
    'The chart always shows the last twelve months, whatever the period above it: the period only changes the figures and the tables.',
  ],
  assumed: [
    'Figures are counted from the day of the invoice and the day of the receipt, not from the day of the supply or of the bank statement (no bank in the prototype).',
    'The supplier bills are the ones recorded in Purchases. Payments to suppliers are only marked as paid there.',
  ],
};

export function MoneyReport() {
  const s = useStore();
  const [period, setPeriod] = useReportPeriod();
  const today = todayISO();
  const r = moneyReport(s, period, today);

  const sourceRows = r.bySource;
  const csv = {
    source: { file: `invoiced-by-source-${period}.csv`, header: ['Source', 'Invoices', 'Amount before VAT (AED)'], rows: sourceRows.map((x) => [x.label, x.count, x.net.toFixed(2)]) },
    customers: {
      file: `invoiced-by-customer-${period}.csv`, header: ['Customer', 'Invoices', 'Amount before VAT (AED)', 'Owed now (AED)'],
      rows: r.byCustomer.map((x) => [x.customer?.name, x.count, x.net.toFixed(2), x.owed.toFixed(2)]),
    },
  };

  return (
    <Page
      title="Money"
      facts={`${periodLabel(period)}: ${fmtDate(r.range.from)} to ${fmtDate(r.range.to)}`}
      tabs={<ReportTabs />}
      about={ABOUT}
    >
      <PeriodBar period={period} onChange={setPeriod} note="Amounts are in AED, before VAT." />
      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Invoiced" amount={r.invoiced} sub={plural(r.invoiceCount, 'invoice')} />
        <Stat label="Received" amount={r.received} sub={plural(r.receiptCount, 'receipt')} />
        <Stat label="Owed to us now" amount={r.owed} sub={plural(r.owedCount, 'invoice')} />
        <Stat label="Overdue now" amount={r.overdue} tone={r.overdue > 0 ? 'text-red-700' : undefined} sub={plural(r.overdueCount, 'invoice')} />
        <Stat label="We owe suppliers" amount={r.billsToPay} sub={`${plural(r.billsCount, 'bill')}${r.billsOverdue > 0 ? `, AED ${money(r.billsOverdue)} overdue` : ''}`} tone={r.billsOverdue > 0 ? 'text-orange-700' : undefined} />
        <Stat label="Days to pay" value={r.daysToPay === null ? '—' : `${r.daysToPay} days`} sub="on average, invoices paid in this period" />
      </dl>

      <Card title="Invoiced and received, month by month" className="mb-5">
        <ColumnChart
          data={r.chart}
          label="Invoiced before VAT and money received, for each of the last twelve months"
          series={[{ key: 'invoiced', label: 'Invoiced before VAT', tone: 'dark' }, { key: 'received', label: 'Received', tone: 'light' }]}
        />
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <TableCard title="Where the invoices come from" csv={csv.source}>
          <SimpleTable
            rows={sourceRows}
            rowKey={(x) => x.kind}
            columns={[
              { key: 'label', header: 'Source', cell: (x) => x.label },
              { key: 'count', header: 'Invoices', align: 'right', cell: (x) => x.count },
              { key: 'net', header: 'Amount (AED)', align: 'right', cell: (x) => money(x.net) },
              { key: 'share', header: 'Share', align: 'right', cell: (x) => (r.invoiced > 0 ? `${Math.round((x.net / r.invoiced) * 100)}%` : '') },
            ]}
            foot={sourceRows.length > 0 ? ['Total', r.invoiceCount, money(r.invoiced), ''] : undefined}
          />
        </TableCard>
        <TableCard title="Biggest customers" csv={csv.customers}>
          <SimpleTable
            rows={r.top}
            rowKey={(x) => x.customer?.id}
            columns={[
              { key: 'customer', header: 'Customer', cell: (x) => (x.customer ? <Link to={`/billing/statements/${x.customer.id}`} className="font-medium underline-offset-2 hover:underline">{x.customer.name}</Link> : '') },
              { key: 'net', header: 'Invoiced (AED)', align: 'right', cell: (x) => money(x.net) },
              { key: 'share', header: 'Share', align: 'right', cell: (x) => (x.share === null ? '' : `${x.share}%`) },
              { key: 'owed', header: 'Owed now (AED)', align: 'right', cell: (x) => (x.owed > 0 ? money(x.owed) : <span className="text-slate-400">—</span>) },
            ]}
          />
        </TableCard>
      </div>
    </Page>
  );
}
