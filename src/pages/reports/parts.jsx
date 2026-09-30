import { DownloadIcon } from 'lucide-react';
import { PERIODS } from '@/data/reportRules.js';
import { cn } from '@/lib/cn.js';
import { downloadCsv } from '@/lib/csv.js';
import { useParam } from '@/lib/useParam.js';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { Card, NavTabs, Toolbar } from '@/ui/Page.jsx';

// Small pieces shared by the five report pages.

export const ReportTabs = () => (
  <NavTabs
    items={[
      { to: '/reports', label: 'Money' },
      { to: '/reports/sales', label: 'Sales' },
      { to: '/reports/service', label: 'Service' },
      { to: '/reports/projects', label: 'Projects' },
      { to: '/reports/stock', label: 'Stock' },
    ]}
  />
);

/** The period of the figures, kept in the address (?period=) so a copied link shows the same view. */
export function useReportPeriod() {
  const [value, set] = useParam('period', 'year');
  return [PERIODS.some((p) => p.value === value) ? value : 'year', set];
}

/** The row above the figures: the period, and what the figures are counted from. */
export const PeriodBar = ({ period, onChange, note }) => (
  <Toolbar>
    <Segmented size="sm" label="Period" value={period} onChange={onChange} options={PERIODS} />
    {note && <p className="text-xs text-slate-500">{note}</p>}
  </Toolbar>
);

/** A table for a report. columns: [{ key, header, align: 'right', cell(row), className }]; `foot` is one extra row of cells. */
export function SimpleTable({ columns, rows, rowKey, empty = 'Nothing in this period.', foot }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs font-medium text-slate-500">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('border-b border-slate-200 px-2 py-2', c.align === 'right' && 'text-right', c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="align-top">
              {columns.map((c) => (
                <td key={c.key} className={cn('border-b border-slate-100 px-2 py-2.5 text-slate-800', c.align === 'right' && 'text-right tabular-nums', c.className)}>{c.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="font-semibold text-slate-900">
              {foot.map((cell, i) => <td key={columns[i].key} className={cn('px-2 py-2.5', columns[i].align === 'right' && 'text-right tabular-nums', columns[i].className)}>{cell}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** "Download CSV" for one table: the file is made in the browser. */
export const CsvButton = ({ file, header, rows }) => (
  <Button variant="ghost" size="xs" icon={DownloadIcon} onClick={() => downloadCsv(file, header, rows)}>Download CSV</Button>
);

/** A card with a title, an optional download and a table (or anything) inside. */
export const TableCard = ({ title, csv, children, className }) => (
  <Card title={title} action={csv && <CsvButton {...csv} />} className={className}>{children}</Card>
);
