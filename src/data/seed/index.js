import { todayISO } from '../../lib/dates.js';
import { STAFF } from './staff.js';
import { buildContacts, buildCustomers, buildSites } from './customers.js';
import { buildEquipment } from './equipment.js';
import { NUMBER_FORMATS } from '../numbering.js';

// Bump this whenever the shape of the seed changes: a browser that saved an
// older shape then starts again from the new seed instead of breaking.
export const SEED_VERSION = 1;

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

export function buildSeed() {
  const T = todayISO();
  const { systems, devices } = buildEquipment(T);
  const activity = [
    ['customer', 'cus_marina', 'staff_sara', 24 * 40, 'Payment terms set to Net 30'],
    ['customer', 'cus_marina', 'staff_sara', 24 * 1400, 'Customer created'],
    ['customer', 'cus_alnoor', 'staff_sara', 24 * 1500, 'Customer created'],
    ['customer', 'cus_alnoor', 'staff_layla', 24 * 210, 'Credit limit raised to AED 250,000'],
    ['customer', 'cus_meridian', 'staff_layla', 24 * 1800, 'Customer created'],
    ['customer', 'cus_meridian', 'staff_omar', 24 * 95, 'Site added: Gulf Meridian Staff Accommodation'],
    ['customer', 'cus_rose', 'staff_priya', 24 * 12, 'Customer put on hold: two invoices more than 60 days overdue'],
    ['customer', 'cus_rose', 'staff_sara', 24 * 700, 'Customer created'],
    ['customer', 'cus_zenith', 'staff_layla', 24 * 600, 'Customer created'],
    ['customer', 'cus_nexus', 'staff_hassan', 24 * 30, 'Note updated: clean-agent rooms need written approval before any discharge test'],
    ['customer', 'cus_bright', 'staff_hassan', 24 * 60, 'Note updated: fire drills in March and October'],
    ['site', 'site_marina', 'staff_hassan', 24 * 140, 'Civil Defence file details checked'],
    ['site', 'site_marina', 'staff_hassan', 24 * 300, 'Fire alarm system serviced (annual visit)'],
    ['site', 'site_meridian', 'staff_hassan', 24 * 95, 'Fire alarm system serviced (annual visit)'],
    ['site', 'site_sahara1', 'staff_omar', 24 * 84, 'Pump test with the client\'s operations team'],
    ['site', 'site_mall', 'staff_hassan', 24 * 90, 'Fire alarm system serviced (annual visit)'],
  ].map(([entity, entityId, by, h, text], i) => ({
    id: `act_${i + 1}`, entity, entityId, by, at: hoursAgo(h), text,
  }));

  // Customers get their numbers in the order of the list (CUS-0001 ...).
  const customers = buildCustomers(T);
  Object.values(customers).forEach((c, i) => {
    c.code = NUMBER_FORMATS.customer(i + 1);
  });

  return {
    staff: byId(STAFF),
    customers,
    sites: buildSites(T),
    contacts: buildContacts(),
    systems,
    devices,
    activity: byId(activity),
    counters: { customer: 19, activity: activity.length },
    seededOn: T,
  };
}
