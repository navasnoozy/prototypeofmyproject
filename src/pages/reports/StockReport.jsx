import { Link } from 'react-router';
import { periodLabel } from '@/data/reportRules.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { money, num, plural } from '@/lib/format.js';
import { stockReport } from '@/store/reportSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Card, Page } from '@/ui/Page.jsx';
import { BarList } from '@/ui/Charts.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { PeriodBar, ReportTabs, SimpleTable, TableCard, useReportPeriod } from './parts.jsx';

const ABOUT = {
  purpose: 'What the stock is worth and where it is, what is low and should be ordered, what has not moved for a long time, and how much moved in the period.',
  why: [
    'The value is the quantity on hand times the average cost of each item, in the store and in the vans. The balances are worked out from the ledger of movements, so this page agrees with the Inventory area to the last unit.',
    '"Below the minimum" repeats the reorder suggestions of the Stock page, with what is already on order taken off, so nobody orders twice.',
    'Stock that has not moved for ninety days ties up money and may be out of date (detectors and batteries have a shelf life). The list is the place to look before the next order.',
    'The movements of the period are counted by what happened: received, used on a job, issued to a project, sold, transferred, counted.',
  ],
  assumed: ['A stock item that was only counted is not treated as a movement of use. Opening balances are left out of the count of movements.'],
};

export function StockReport() {
  const s = useStore();
  const { access } = useSession();
  const [period, setPeriod] = useReportPeriod();
  const r = stockReport(s, period, todayISO());

  const lowCsv = {
    file: 'stock-below-minimum.csv',
    header: ['Code', 'Item', 'In the store', 'Minimum', 'On order', 'Suggested order', 'Supplier'],
    rows: r.low.map((x) => [x.item.code, x.item.name, x.store, x.item.minStore, x.onOrder, x.reorder, x.supplier?.name ?? '']),
  };
  const idleCsv = {
    file: 'stock-not-moved-90-days.csv',
    header: ['Code', 'Item', 'On hand', 'Value (AED)', 'Last movement'],
    rows: r.idle.map((x) => [x.item.code, x.item.name, x.total, x.value.toFixed(2), x.last]),
  };

  return (
    <Page title="Stock" facts={`${periodLabel(period)}: ${fmtDate(r.range.from)} to ${fmtDate(r.range.to)}`} tabs={<ReportTabs />} about={ABOUT}>
      <PeriodBar period={period} onChange={setPeriod} note="Only the count of movements follows the period; the rest is as it stands today." />
      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Stock value" amount={r.value} sub={`store AED ${money(r.storeValue)}, vans AED ${money(r.vanValue)}`} />
        <Stat label="Items below the minimum" value={r.lowCount} sub={r.negative > 0 ? `${plural(r.negative, 'place')} need a count` : 'no place needs a count'} tone={r.lowCount > 0 ? 'text-orange-700' : undefined} />
        <Stat label="On order for stock" amount={r.onOrderValue} sub={plural(r.onOrderCount, 'order')} />
        <Stat label="Movements" value={num(r.movements)} sub="in this period" />
        <Stat label="Items kept in stock" value={r.itemCount} sub={`${plural(r.idle.length, 'item')} not moved for 90 days`} />
      </dl>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Value by category">
          <BarList
            label="Value of the stock in each category"
            rows={r.byCategory.map((x) => ({ key: x.category, label: x.category, sub: plural(x.items, 'item'), values: [x.value] }))}
            series={[{ key: 'value', label: 'Value (AED)', tone: 'dark' }]}
          />
        </Card>
        <Card title="What moved in this period">
          {r.byKind.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing moved in this period.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {r.byKind.map((x) => (
                <li key={x.kind} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-sm">
                  <span className="text-slate-800">{x.label}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{x.count}</span>
                </li>
              ))}
            </ul>
          )}
          {access('inventory') && <Link to="/inventory/movements" className="mt-3 inline-block text-sm font-medium text-slate-900 underline underline-offset-2">Open the ledger</Link>}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <TableCard title="Below the minimum" csv={lowCsv}>
          <SimpleTable
            rows={r.low}
            rowKey={(x) => x.item.id}
            empty="Nothing is below its minimum."
            columns={[
              { key: 'item', header: 'Item', cell: (x) => <><span className="block font-medium">{x.item.name}</span><span className="block text-xs text-slate-500">{x.item.code}{x.supplier ? ` · ${x.supplier.name}` : ''}</span></> },
              { key: 'store', header: 'In store', align: 'right', cell: (x) => x.store },
              { key: 'min', header: 'Minimum', align: 'right', cell: (x) => x.item.minStore },
              { key: 'order', header: 'On order', align: 'right', cell: (x) => (x.onOrder > 0 ? x.onOrder : <span className="text-slate-400">—</span>) },
              { key: 'need', header: 'Order', align: 'right', cell: (x) => <span className="font-medium">{x.reorder}</span> },
            ]}
          />
        </TableCard>
        <TableCard title="Not moved for 90 days" csv={idleCsv}>
          <SimpleTable
            rows={r.idle}
            rowKey={(x) => x.item.id}
            empty="Every item in stock moved in the last 90 days."
            columns={[
              { key: 'item', header: 'Item', cell: (x) => <><span className="block font-medium">{x.item.name}</span><span className="block text-xs text-slate-500">{x.item.code}</span></> },
              { key: 'qty', header: 'On hand', align: 'right', cell: (x) => x.total },
              { key: 'value', header: 'Value (AED)', align: 'right', cell: (x) => money(x.value) },
              { key: 'last', header: 'Last moved', cell: (x) => <span className="whitespace-nowrap">{x.last ? fmtDate(x.last) : 'never'}</span> },
            ]}
          />
        </TableCard>
      </div>
    </Page>
  );
}
