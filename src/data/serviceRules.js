import { addDays, addMonths, diffDays } from '../lib/dates.js';
import { round2 } from '../lib/format.js';

// Pure rules of the Service area. They use only relative imports, so the seed
// data and the screens use the very same functions (and they can be checked
// without the application).

/** When a device group is next due. */
export const nextDue = (device) => addMonths(device.lastServiced, device.intervalMonths);

/**
 * The device groups of some systems that a visit on `onDate` has to check:
 * the ones that are due, overdue, or due within `windowDays` after it. A
 * device that is out of service is not tested; it is a deficiency.
 */
export const dueGroups = (devices, systemIds, onDate, windowDays = 45) =>
  devices.filter(
    (d) => systemIds.includes(d.systemId) && d.condition !== 'out_of_service' && diffDays(onDate, nextDue(d)) <= windowDays,
  );

/** The last day of a contract that starts on `startOn` and runs `termMonths`. */
export const contractEnd = (startOn, termMonths) => addDays(addMonths(startOn, termMonths), -1);

/**
 * The visits of a contract: `visitsPerYear` visits in each year of the term,
 * evenly spread, the first two weeks after the start.
 */
export function visitDates(startOn, termMonths, visitsPerYear) {
  const count = Math.max(1, Math.round((termMonths / 12) * visitsPerYear));
  const gap = Math.round(365 / visitsPerYear);
  return Array.from({ length: count }, (_, i) => addDays(startOn, 14 + i * gap));
}

/**
 * The invoices of a contract, in equal parts by billing period, billed in
 * advance. The last part takes the rounding.
 */
export function billingDates(startOn, termMonths, frequency, annualFee) {
  const step = { annual: 12, quarterly: 3, monthly: 1 }[frequency];
  const count = Math.max(1, Math.round(termMonths / step));
  const total = round2((annualFee * termMonths) / 12);
  const part = round2(total / count);
  return Array.from({ length: count }, (_, i) => ({
    dueOn: addMonths(startOn, i * step),
    amount: i === count - 1 ? round2(total - part * (count - 1)) : part,
  }));
}

/**
 * The next long-cycle work of an extinguisher (NFPA 10): the 6-year internal
 * examination and, every second time, the 12-year hydrostatic test. Counted
 * from the year it was made; past milestones are taken as done.
 */
export function longCycle(device, today) {
  if (!device.installedOn) return null;
  for (let years = 6; years <= 60; years += 6) {
    const due = addMonths(device.installedOn, years * 12);
    if (diffDays(today, due) >= -30) {
      return { years, due, label: years % 12 === 0 ? 'Hydrostatic test (12-year cycle)' : 'Internal examination (6-year cycle)' };
    }
  }
  return null;
}
