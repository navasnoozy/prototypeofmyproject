// Dates are plain "YYYY-MM-DD" strings (a date-only value has no time zone),
// so nothing here goes through a UTC conversion.

const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISO(new Date());

export const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const addMonths = (iso, n) => {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  // 31 Jan + 1 month is 28 Feb, not 3 March.
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
};

// Whole days from a to b (positive when b is later).
export const diffDays = (a, b) =>
  Math.round((fromISO(b) - fromISO(a)) / 86_400_000);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const fmtDay = (iso) => {
  if (!iso) return '—';
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const fmtMonthYear = (iso) => {
  const d = fromISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const fmtDateTime = (isoDateTime) => {
  const d = new Date(isoDateTime);
  const h = d.getHours();
  const time = `${pad(h % 12 || 12)}:${pad(d.getMinutes())} ${h < 12 ? 'am' : 'pm'}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time}`;
};

// "today", "in 12 days", "3 days ago" for a date-only value.
export const relDays = (iso, today = todayISO()) => {
  const n = diffDays(today, iso);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
};

// "3 minutes ago" for a date-time (activity lists).
export const relTime = (isoDateTime, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - new Date(isoDateTime).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} day${d === 1 ? '' : 's'} ago`;
  return fmtDate(toISO(new Date(isoDateTime)));
};
