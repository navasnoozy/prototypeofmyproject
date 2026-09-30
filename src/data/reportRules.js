import { addMonths } from '../lib/dates.js';
import { round2 } from '../lib/format.js';

// Pure rules of Reports: the periods, the months of a chart, and the small
// helpers every report uses. Relative imports only, so they can be checked in
// Node without the application.

export const PERIODS = [
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
  { value: '12m', label: 'Last 12 months' },
];

/** { from, to } (both days included) for a period that ends today. "Last 3 months" is this month and the two before it. */
export function periodRange(period, today) {
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (period) {
    case 'month': return { from: monthStart, to: today };
    case 'quarter': return { from: addMonths(monthStart, -2), to: today };
    case 'year': return { from: `${today.slice(0, 4)}-01-01`, to: today };
    default: return { from: addMonths(monthStart, -11), to: today };
  }
}

export const periodLabel = (period) => PERIODS.find((p) => p.value === period)?.label ?? PERIODS[2].label;

/** The months from the one of `from` to the one of `to`, as "YYYY-MM". */
export function monthKeys(from, to) {
  const out = [];
  let cursor = `${from.slice(0, 7)}-01`;
  const last = `${to.slice(0, 7)}-01`;
  while (cursor <= last) {
    out.push(cursor.slice(0, 7));
    cursor = addMonths(cursor, 1);
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-09" is "Sep 26". */
export const monthLabel = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;

export const inRange = (date, range) => Boolean(date) && date >= range.from && date <= range.to;

/** The chart of every report shows the last twelve months, whatever the period of the figures. */
export const chartMonths = (today) => monthKeys(addMonths(`${today.slice(0, 7)}-01`, -11), today);

export const sumOf = (rows, fn) => round2(rows.reduce((n, x) => n + fn(x), 0));

/** Groups rows by a key: { key: [rows] }. */
export function groupRows(rows, keyOf) {
  const out = {};
  for (const row of rows) (out[keyOf(row)] ??= []).push(row);
  return out;
}

/** A percentage with no decimals, or null when there is nothing to divide by. */
export const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);
