import { cn } from '@/lib/cn.js';
import { money } from '@/lib/format.js';

// Two small charts drawn with plain HTML and CSS (the prototype has no chart
// library). Each one says what it shows in words for a screen reader, and the
// same numbers are always in a table beside or under it.

export const SERIES_TONE = {
  dark: { bar: 'bg-slate-900', dot: 'bg-slate-900' },
  light: { bar: 'bg-slate-300', dot: 'bg-slate-300' },
  blue: { bar: 'bg-blue-600', dot: 'bg-blue-600' },
  green: { bar: 'bg-green-600', dot: 'bg-green-600' },
  orange: { bar: 'bg-orange-500', dot: 'bg-orange-500' },
  red: { bar: 'bg-red-600', dot: 'bg-red-600' },
};

/** The legend under a chart. series: [{ key, label, tone }]. */
export const Legend = ({ series }) => (
  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
    {series.map((x) => (
      <li key={x.key} className="flex items-center gap-1.5">
        <span className={cn('size-2.5 rounded-full', SERIES_TONE[x.tone].dot)} aria-hidden="true" />
        {x.label}
      </li>
    ))}
  </ul>
);

// A "nice" top for the scale: 1, 2, 2.5 or 5 times a power of ten.
function niceMax(value) {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

const compact = (n) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${+(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}k` : String(Math.round(n)));

/**
 * Columns by month. data: [{ key, label, values: [a, b, ...] }], one value per series; `label` says what the chart shows.
 * `whole` is for counts: the scale then goes up in whole numbers.
 */
export function ColumnChart({ data, series, label, format = money, height = 176, whole = false }) {
  const biggest = Math.max(0, ...data.flatMap((d) => d.values));
  const top = whole ? Math.max(2, Math.ceil(biggest / 2) * 2) : niceMax(biggest);
  const ticks = [1, 0.5, 0];
  return (
    <figure>
      <div role="img" aria-label={label} className="overflow-x-auto pb-1">
        <div className="flex gap-2 pt-2" style={{ minWidth: `${Math.max(320, data.length * 44 + 40)}px` }}>
          <div className="relative w-9 shrink-0 text-right text-[11px] tabular-nums text-slate-400" style={{ height }} aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t) * 100}%` }}>{compact(top * t)}</span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height }}>
              {ticks.map((t) => (
                <span key={t} className="absolute inset-x-0 border-t border-dashed border-slate-200" style={{ top: `${(1 - t) * 100}%` }} aria-hidden="true" />
              ))}
              <div className="absolute inset-0 flex items-end gap-1" aria-hidden="true">
                {data.map((d) => (
                  <div key={d.key} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5" title={`${d.label}: ${series.map((x, i) => `${x.label} ${format(d.values[i])}`).join(', ')}`}>
                    {d.values.map((v, i) => (
                      <span
                        key={series[i].key}
                        className={cn('w-full max-w-4 rounded-t-[3px]', SERIES_TONE[series[i].tone].bar)}
                        style={{ height: v > 0 ? `max(2px, ${(v / top) * 100}%)` : 0 }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-1.5 flex gap-1" aria-hidden="true">
              {data.map((d) => <span key={d.key} className="min-w-0 flex-1 truncate text-center text-[11px] text-slate-500">{d.label}</span>)}
            </div>
          </div>
        </div>
      </div>
      {/* The class is on a wrapper: a table ignores the 1 px size of sr-only, and its cells would widen the page on a phone. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">Month</th>{series.map((x) => <th key={x.key} scope="col">{x.label}</th>)}</tr></thead>
          <tbody>{data.map((d) => <tr key={d.key}><th scope="row">{d.label}</th>{d.values.map((v, i) => <td key={series[i].key}>{format(v)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <Legend series={series} />
    </figure>
  );
}

/**
 * One horizontal bar (or two) per row. rows: [{ key, label, sub, values: [a, b], flag }], `flag` paints the
 * last bar red (over budget). The bars of all rows share one scale, unless `perRow` is set: then each row
 * has its own scale, so a small row is as easy to read as a big one (its longest bar is full).
 */
export function BarList({ rows, series, label, format = money, perRow = false }) {
  const shared = Math.max(1, ...rows.flatMap((r) => r.values));
  return (
    <figure>
      <ul role="img" aria-label={label} className="space-y-3.5">
        {rows.map((r) => {
          const top = perRow ? Math.max(1, ...r.values) : shared;
          return (
          <li key={r.key} className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-center">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-900">{r.label}</span>
              {r.sub && <span className="block truncate text-xs text-slate-500">{r.sub}</span>}
            </span>
            <span className="min-w-0 space-y-1" aria-hidden="true">
              {r.values.map((v, i) => (
                <span key={series[i].key} className="flex items-center gap-2">
                  <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={cn('block h-full rounded-full', r.flag && i === r.values.length - 1 ? SERIES_TONE.red.bar : SERIES_TONE[series[i].tone].bar)}
                      style={{ width: `${Math.min(100, (v / top) * 100)}%` }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-600">{format(v)}</span>
                </span>
              ))}
            </span>
          </li>
          );
        })}
      </ul>
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">Row</th>{series.map((x) => <th key={x.key} scope="col">{x.label}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key}><th scope="row">{r.label}</th>{r.values.map((v, i) => <td key={series[i].key}>{format(v)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <Legend series={series} />
    </figure>
  );
}
