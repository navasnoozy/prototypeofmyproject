import { addDays, fromISO } from '../lib/dates.js';
import { round2 } from '../lib/format.js';
import { HANDOVER_MAP, TEST_TEMPLATES } from './projectKinds.js';

// Pure rules of the Projects and Schedule areas. They use only relative
// imports, so the seed and the screens use the very same functions (and the
// money can be checked without the application).

const total = (rows, fn) => rows.reduce((n, x) => n + fn(x), 0);

// ---- value, budget and progress ---------------------------------------------------------
// A package is one part of the work with its own price and its own budget: a
// section of the accepted quotation, or an approved variation.
export const contractValue = (p) => round2(total(p.packages, (x) => x.value));
export const originalValue = (p) => round2(total(p.packages.filter((x) => x.kind === 'work'), (x) => x.value));
export const budgetTotal = (p) => round2(total(p.packages, (x) => x.cost));

/** The value of the work done: each package's price by its percent complete. */
export const workDone = (p, progress) =>
  round2(total(p.packages, (x) => (x.value * ((progress ? progress[x.id] : x.progress) ?? 0)) / 100));
export const percentComplete = (p) => {
  const value = contractValue(p);
  return value > 0 ? (workDone(p) / value) * 100 : 0;
};
export const currentProgress = (p) => Object.fromEntries(p.packages.map((x) => [x.id, x.progress]));

// ---- claims ---------------------------------------------------------------------------------
// The customer pays an advance at the start; every progress claim is
// cumulative: the work done so far, less the retention held back and the share
// of the advance that is paid back with the work. What is due is the difference
// from the last claim.
export const advanceTotal = (p) => round2((originalValue(p) * p.advancePct) / 100);

/**
 * The figures of a progress claim.
 *   progress      percent complete by package id
 *   previousNet   the cumulative net of the last progress claim (0 for the first)
 *   value         the contract value it is worked out against
 */
export function claimFigures(p, progress, previousNet = 0, value = contractValue(p)) {
  const gross = workDone(p, progress);
  const retention = round2((gross * p.retentionPct) / 100);
  const advance = value > 0 ? round2(Math.min(advanceTotal(p), (advanceTotal(p) * gross) / value)) : 0;
  const net = round2(gross - retention - advance);
  return { gross, retention, advance, net, amount: round2(net - previousNet), value };
}

/** A certified claim is worked out again from what the customer's engineer certified. */
export const certifiedFigures = (p, claim, previousNet) =>
  claimFigures(p, scaleProgress(claim, claim.certifiedGross), previousNet, claim.value);

// The certified gross is a money value; to reuse `claimFigures` it is turned into
// an equal share of every package's price.
function scaleProgress(claim, certifiedGross) {
  const ratio = claim.gross > 0 ? certifiedGross / claim.gross : 0;
  return Object.fromEntries(Object.entries(claim.progress).map(([id, pct]) => [id, pct * ratio]));
}

export const progressClaims = (p) => p.claims.filter((c) => c.kind === 'progress');
/** The cumulative net that counts for the next claim: certified if certified, else as claimed. */
export const netOf = (claim) => claim.certNet ?? claim.net ?? 0;
export const lastNet = (p) => {
  const done = progressClaims(p).filter((c) => c.status !== 'draft');
  return done.length ? netOf(done[done.length - 1]) : 0;
};
export const retentionHeld = (p) => {
  const done = progressClaims(p).filter((c) => c.status !== 'draft');
  if (done.length === 0) return 0;
  const last = done[done.length - 1];
  return last.certRetention ?? last.retention ?? 0;
};
export const amountOf = (claim) => claim.certAmount ?? claim.amount ?? 0;
export const claimedTotal = (p) => round2(total(p.claims.filter((c) => c.status !== 'draft'), (c) => c.amount ?? 0));
export const paidTotal = (p) => round2(total(p.claims.filter((c) => c.status === 'paid'), amountOf));

// ---- costs ------------------------------------------------------------------------------------
// A cost row is either ordered and not billed yet ("committed") or billed or
// booked ("incurred"). Both count as money the project has to pay.
export function costTotals(p, packageId) {
  const rows = packageId ? p.costs.filter((c) => c.packageId === packageId) : p.costs;
  const incurred = round2(total(rows.filter((c) => c.state === 'incurred'), (c) => c.amount));
  const committed = round2(total(rows.filter((c) => c.state === 'committed'), (c) => c.amount));
  return { incurred, committed, exposure: round2(incurred + committed) };
}

/** What the project is expected to earn if the rest costs what the budget says. */
export function forecast(p) {
  const value = contractValue(p);
  const budget = budgetTotal(p);
  const { exposure } = costTotals(p);
  const expectedCost = Math.max(budget, exposure);
  return { value, budget, exposure, expectedCost, margin: round2(value - expectedCost), marginPct: value > 0 ? ((value - expectedCost) / value) * 100 : 0 };
}

// ---- dates ------------------------------------------------------------------------------------------
export const isWeekend = (iso) => [0, 6].includes(fromISO(iso).getDay());

/** The first day of the week (Monday) that holds a date. */
export const weekStart = (iso) => {
  const day = fromISO(iso).getDay();
  return addDays(iso, -((day + 6) % 7));
};

/** The working days (Monday to Friday) of a piece of site work, from its first day. */
export function workingDates(start, days) {
  const out = [];
  let d = start;
  while (out.length < Math.max(1, days)) {
    if (!isWeekend(d)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

/** The end of the defects liability period, counted from the day of handover. */
export function dlpEnd(handedOverOn, months) {
  const d = fromISO(handedOverOn);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A tag such as "EFP-01" for one item, or "SD-001 to SD-528" for a group, continuing an earlier count. */
export function tagRange(prefix, first, qty) {
  const pad = (n, w) => String(n).padStart(w, '0');
  return qty === 1 ? `${prefix}-${pad(first, 2)}` : `${prefix}-${pad(first, 3)} to ${prefix}-${pad(first + qty - 1, 3)}`;
}

// ---- from an accepted quotation to a project ---------------------------------------------------------
const codeOf = (items, line) => items[line.itemId]?.code ?? '';

/** The kinds of system that the lines of a quotation (or one section of it) will become. */
export const systemTypesOf = (q, items, sectionId) => [
  ...new Set(q.lines.filter((l) => !sectionId || l.sectionId === sectionId).map((l) => HANDOVER_MAP[codeOf(items, l)]?.[0]).filter(Boolean)),
];

/** One package per section of the quotation, at its price after the discount and with its cost as the budget. */
export function packagesFromQuotation(q, items, newId) {
  return q.sections.map((sec) => {
    const lines = q.lines.filter((l) => l.sectionId === sec.id);
    const price = lines.reduce((n, l) => n + l.qty * l.price, 0);
    const cost = lines.reduce((n, l) => n + l.qty * l.cost, 0);
    const docs = lines.length > 0 && lines.every((l) => /^DOC-|^LB-TEST/.test(codeOf(items, l)));
    return {
      id: newId('pkg'), kind: 'work', sectionId: sec.id, title: sec.title, docs,
      value: round2(price * (1 - (q.discountPct || 0) / 100)), cost: round2(cost), progress: 0, types: systemTypesOf(q, items, sec.id),
    };
  });
}

/** The acceptance tests of the systems in the packages, each test once. */
export function testsFromPackages(packages, newId) {
  const seen = new Set();
  const rows = [];
  for (const pkg of packages) {
    for (const type of pkg.types ?? []) {
      if (seen.has(type)) continue;
      seen.add(type);
      for (const title of TEST_TEMPLATES[type] ?? []) rows.push({ id: newId('tst'), packageId: pkg.id, systemType: type, title, result: '', on: '', by: '', note: '' });
    }
  }
  return rows;
}

/** The documents every project must produce (the Civil Defence approval only when we handle it). */
export function defaultDocuments(newId, cdByContractor) {
  return [
    { kind: 'method', title: 'Method statement and risk assessment' },
    { kind: 'drawings', title: 'Shop drawings' },
    { kind: 'calcs', title: 'Design calculations' },
    cdByContractor && { kind: 'cd_drawings', title: 'Civil Defence approval of the drawings' },
    { kind: 'submittal', title: 'Material submittals' },
    { kind: 'test_report', title: 'Test reports' },
    { kind: 'asbuilt', title: 'As-built drawings' },
    { kind: 'om', title: 'Operation and maintenance manuals' },
    { kind: 'warranty', title: 'Warranty certificates' },
  ]
    .filter(Boolean)
    .map((d) => ({ id: newId('doc'), ref: '', rev: '', status: 'planned', on: '', ...d }));
}

export const emptyHandover = () => ({
  cdRequestedOn: '', cdCertificate: null, handedOverOn: '', receivedBy: '', receivedRole: '',
  systemIds: [], contractQuotationId: '', dlpEnd: '', retentionReleasedOn: '',
});

/** What the handover writes into the register: [{ type, devices: [{ deviceType, qty }] }], from the lines of the quotation. */
export function equipmentFromQuotation(q, items) {
  const by = {};
  for (const line of q.lines) {
    const target = HANDOVER_MAP[codeOf(items, line)];
    if (!target) continue;
    const [type, deviceType] = target;
    by[type] ??= {};
    by[type][deviceType] = (by[type][deviceType] ?? 0) + line.qty;
  }
  return Object.entries(by).map(([type, devices]) => ({ type, devices: Object.entries(devices).map(([deviceType, qty]) => ({ deviceType, qty })) }));
}
