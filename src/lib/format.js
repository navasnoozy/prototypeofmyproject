// Money in this prototype is AED, written with two decimals (fils). The real
// product keeps money as decimal strings (skill rule 10); a number is enough
// for a prototype whose amounts are already rounded.

const MONEY = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const WHOLE = new Intl.NumberFormat('en-US');

export const money = (n) => MONEY.format(n ?? 0);
export const aed = (n) => `AED ${MONEY.format(n ?? 0)}`;
export const num = (n) => WHOLE.format(n ?? 0);

// Round to fils, avoiding 0.1 + 0.2 style drift.
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const initials = (name = '') =>
  name
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

// Highlight helper for search: splits text around the first match.
export const splitMatch = (text, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return [text, '', ''];
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return [text, '', ''];
  return [text.slice(0, i), text.slice(i, i + q.length), text.slice(i + q.length)];
};
