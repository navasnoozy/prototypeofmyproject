import { todayISO } from '../../lib/dates.js';
import { STAFF } from './staff.js';
import { buildContacts, buildCustomers, buildSites } from './customers.js';
import { buildEquipment } from './equipment.js';
import { DEFAULT_SETTINGS, buildItems, buildSales } from './sales.js';
import { buildProjects } from './projects.js';
import { addStockFields, buildPurchasing } from './purchasing.js';
import { buildService } from './service.js';
import { NUMBER_FORMATS } from '../numbering.js';

// Bump this whenever the shape of the seed changes: a browser that saved an
// older shape then starts again from the new seed instead of breaking.
export const SEED_VERSION = 8;

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

export function buildSeed() {
  const T = todayISO();
  const { systems, devices } = buildEquipment(T);
  const items = addStockFields(buildItems());
  const sales = buildSales(T, { items, systems, devices });
  const sites = buildSites(T);
  const service = buildService(T, { sites, systems, devices, items, quotations: sales.quotations });
  const projects = buildProjects(T, { quotations: sales.quotations, items, systems: service.systems });
  // Suppliers, orders, deliveries, bills and the ledger of stock follow from the projects and the jobs.
  const purchasing = buildPurchasing(T, { items, projects: projects.projects, jobs: service.jobs });
  for (const [jobId, parts] of Object.entries(purchasing.jobParts)) service.jobs[jobId].parts = parts;
  // What accepted quotations started.
  for (const [id, followUp] of Object.entries({ ...service.followUps, ...projects.followUps })) sales.quotations[id].followUp = followUp;
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
    ...sales.events.map((e) => [e.entity, e.entityId, e.by, 24 * e.daysAgo, e.text]),
    ...service.events.map((e) => [e.entity, e.entityId, e.by, 24 * e.daysAgo, e.text]),
    ...projects.events.map((e) => [e.entity, e.entityId, e.by, 24 * e.daysAgo, e.text]),
    ...purchasing.events.map((e) => [e.entity, e.entityId, e.by, 24 * e.daysAgo, e.text]),
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
    sites,
    contacts: buildContacts(),
    systems: service.systems,
    devices: service.devices,
    contracts: service.contracts,
    jobs: service.jobs,
    deficiencies: service.deficiencies,
    certificates: service.certificates,
    returns: service.returns,
    projects: projects.projects,
    absences: projects.absences,
    activity: byId(activity),
    items: purchasing.items,
    suppliers: purchasing.suppliers,
    locations: purchasing.locations,
    purchaseOrders: purchasing.purchaseOrders,
    receipts: purchasing.receipts,
    bills: purchasing.bills,
    movements: purchasing.movements,
    enquiries: sales.enquiries,
    quotations: sales.quotations,
    settings: DEFAULT_SETTINGS,
    counters: { customer: 19, activity: activity.length, ...sales.counters, ...service.counters, ...projects.counters, ...purchasing.counters },
    seededOn: T,
  };
}
