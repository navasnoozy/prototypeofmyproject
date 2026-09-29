import { addDays } from '../../lib/dates.js';
import { emptyPOApproval, STORE_ID, vanLocationId } from '../purchaseKinds.js';
import { dueDate, orderNet, round3, stockLinesOfReceipt, valueLevel, vanShortfall, weightedAverage } from '../purchaseRules.js';
import { STAFF } from './staff.js';
import { DEFAULT_SETTINGS } from './sales.js';

// The purchasing side of the sample company: who it buys from, where it keeps
// stock, what it keeps, forty-odd purchase orders with their deliveries and
// bills, and the ledger of stock that follows from them. Everything is
// invented. The ledger is not written by hand: it is replayed here from the
// receipts, the parts of the jobs, the issues to projects, the van top-ups and
// the counts, with the same rules the application uses, so the balances add up.

// ---- suppliers ------------------------------------------------------------------------------
export const SUPPLIERS = [
  { id: 'sup_gulfline', name: 'Gulfline Fire Systems Trading LLC', kind: 'Distributor', area: 'Al Quoz, Dubai', address: 'Showroom 4, Al Quoz Industrial Area 3, Dubai', contactName: 'Tariq Mansoor', phone: '+971 4 555 0201', email: 'sales@gulfline.example', trn: '100200300400003', terms: 45, taxable: true, categories: ['Fire alarm', 'Voice alarm', 'Smoke control'], notes: 'Main source of panels, detectors and batteries. Price list valid for 90 days.', active: true },
  { id: 'sup_sharqi', name: 'Sharqi Cable and Cable Tray Trading LLC', kind: 'Distributor', area: 'Sharjah Industrial Area 4', address: 'Unit 12, Industrial Area 4, Sharjah', contactName: 'Anwar Siddiqui', phone: '+971 6 555 0202', email: 'orders@sharqicable.example', trn: '100200300400011', terms: 30, taxable: true, categories: ['Fire alarm'], notes: 'Fire-resistant cable by the drum, trays and conduits. Delivers to site.', active: true },
  { id: 'sup_steel', name: 'Emirates Steel Pipe and Fittings FZE', kind: 'Manufacturer', area: 'Jebel Ali Free Zone', address: 'Plot 5, Jebel Ali Free Zone South, Dubai', contactName: 'Vikram Rao', phone: '+971 4 555 0203', email: 'projects@emiratessteelpipe.example', trn: '100200300400029', terms: 30, taxable: true, categories: ['Sprinkler and hydrant'], notes: 'Pipe, grooved fittings and couplings for the sprinkler and hydrant work.', active: true },
  { id: 'sup_precision', name: 'Precision Sprinkler Components LLC', kind: 'Distributor', area: 'Dubai Investments Park', address: 'Warehouse 22, Dubai Investments Park 2', contactName: 'Samir Haddad', phone: '+971 4 555 0204', email: 'sales@precisionsprinkler.example', trn: '100200300400037', terms: 45, taxable: true, categories: ['Sprinkler and hydrant'], notes: 'Heads, zone control valves, flow switches. Approved brands only.', active: true },
  { id: 'sup_hydra', name: 'Hydra Hose and Hydrant Supplies LLC', kind: 'Distributor', area: 'Al Qusais, Dubai', address: 'Shop 3, Al Qusais Industrial Area 1', contactName: 'Joby Thomas', phone: '+971 4 555 0205', email: 'sales@hydrahose.example', trn: '100200300400045', terms: 30, taxable: true, categories: ['Sprinkler and hydrant'], notes: 'Hose reels, landing valves, hydrants, cabinets.', active: true },
  { id: 'sup_alnoor', name: 'Al Noor Pumps and Controllers LLC', kind: 'Distributor', area: 'Ras Al Khor, Dubai', address: 'Warehouse 9, Ras Al Khor Industrial Area 3', contactName: 'Imtiaz Ahmed', phone: '+971 4 555 0206', email: 'sales@alnoorpumps.example', trn: '100200300400052', terms: 30, taxable: true, categories: ['Pumps and tanks'], notes: 'Fire pump sets with controllers. Delivery takes six to eight weeks.', active: true },
  { id: 'sup_falcon', name: 'Falcon Extinguisher and Refill Centre LLC', kind: 'Distributor', area: 'Al Quoz, Dubai', address: 'Unit 7, Al Quoz Industrial Area 1', contactName: 'Khalid Yousuf', phone: '+971 4 555 0207', email: 'orders@falconfire.example', trn: '100200300400060', terms: 30, taxable: true, categories: ['Extinguishers'], notes: 'Extinguishers, fire blankets, refills and hydrostatic tests.', active: true },
  { id: 'sup_lumisafe', name: 'LumiSafe Emergency Lighting FZCO', kind: 'Manufacturer', area: 'Dubai Silicon Oasis', address: 'Office 210, Dubai Silicon Oasis', contactName: 'Priyanka Shah', phone: '+971 4 555 0208', email: 'sales@lumisafe.example', trn: '100200300400078', terms: 60, taxable: true, categories: ['Emergency lighting'], notes: 'LED emergency fittings and exit signs, three hours. Sixty days credit.', active: true },
  { id: 'sup_nordwerk', name: 'Nordwerk Suppression GmbH (through a local agent)', kind: 'Importer', area: 'Hamburg, Germany', address: 'Hamburg, Germany. Agent office: Business Bay, Dubai', contactName: 'Lena Brandt', phone: '+49 40 555 0209', email: 'export@nordwerk.example', trn: '', terms: 30, taxable: false, categories: ['Suppression'], notes: 'Kitchen hood and clean agent parts. Imported: no VAT on the invoice; the import VAT is paid at customs (sample).', active: true },
  { id: 'sup_oldtown', name: 'Old Town Fire Supplies', kind: 'Distributor', area: 'Deira, Dubai', address: 'Deira, Dubai', contactName: 'Mohan Das', phone: '+971 4 555 0210', email: 'oldtownfire@oldtown.example', trn: '100200300400086', terms: 0, taxable: true, categories: ['Extinguishers'], notes: 'Not used since a wrong delivery two years ago.', active: false },
];

// The supplier each catalogue item is usually bought from (it prefills an order line).
const PREFERRED = {
  'FA-PNL-2L': 'sup_gulfline', 'FA-PNL-4L': 'sup_gulfline', 'FA-RPT': 'sup_gulfline', 'FA-SD': 'sup_gulfline', 'FA-HD': 'sup_gulfline',
  'FA-MCP': 'sup_gulfline', 'FA-SND': 'sup_gulfline', 'FA-IOM': 'sup_gulfline', 'FA-CBL': 'sup_sharqi', 'FA-BAT': 'sup_gulfline',
  'SP-HEAD': 'sup_precision', 'SP-ZCV': 'sup_precision', 'SP-FLOW': 'sup_precision', 'HY-REEL': 'sup_hydra', 'HY-LV': 'sup_hydra', 'HY-HYD': 'sup_hydra',
  'PU-EL': 'sup_alnoor', 'PU-DI': 'sup_alnoor', 'PU-JP': 'sup_alnoor', 'FE-ABC6': 'sup_falcon', 'FE-ABC9': 'sup_falcon', 'FE-CO2': 'sup_falcon',
  'FE-FOAM': 'sup_falcon', 'FE-WC': 'sup_falcon', 'FE-BLK': 'sup_falcon', 'EL-FIT': 'sup_lumisafe', 'EL-EXIT': 'sup_lumisafe',
  'KH-SYS': 'sup_nordwerk', 'VA-CTL': 'sup_gulfline', 'VA-SPK': 'sup_gulfline', 'SC-DMP': 'sup_gulfline',
};

// ---- what is kept in stock -------------------------------------------------------------------
// min: the smallest quantity in the store before it is reordered; reorder: the
// usual order quantity; par: what a van should carry.
const STOCK = {
  'FA-SD': { min: 250, reorder: 120, par: 8 },
  'FA-HD': { min: 30, reorder: 60, par: 4 },
  'FA-MCP': { min: 20, reorder: 40, par: 3 },
  'FA-SND': { min: 100, reorder: 40, par: 3 },
  'FA-IOM': { min: 65, reorder: 30, par: 3 },
  'FA-BAT': { min: 24, reorder: 12, par: 2 },
  'FA-CBL': { min: 600, reorder: 1000, par: 60 },
  'SP-HEAD': { min: 150, reorder: 300, par: 12 },
  'SP-FLOW': { min: 6, reorder: 12, par: 0 },
  'FE-ABC6': { min: 40, reorder: 80, par: 6 },
  'FE-ABC9': { min: 120, reorder: 60, par: 4 },
  'FE-CO2': { min: 10, reorder: 20, par: 2 },
  'FE-FOAM': { min: 8, reorder: 16, par: 0 },
  'FE-BLK': { min: 10, reorder: 30, par: 0 },
  'EL-FIT': { min: 40, reorder: 60, par: 4 },
  'EL-EXIT': { min: 150, reorder: 60, par: 4 },
};

/** The catalogue with the stock fields added. Items not in STOCK are not kept in stock. */
export function addStockFields(items) {
  return Object.fromEntries(
    Object.entries(items).map(([id, it]) => {
      const cfg = STOCK[it.code];
      return [id, {
        ...it,
        stocked: Boolean(cfg), minStore: cfg?.min ?? 0, reorderQty: cfg?.reorder ?? 0, vanPar: cfg?.par ?? 0,
        supplierId: PREFERRED[it.code] ?? '', avgCost: it.cost,
      }];
    }),
  );
}

// Quantities in the store on the first day of the ledger.
const OPENING = {
  'FA-SD': 90, 'FA-HD': 40, 'FA-MCP': 30, 'FA-SND': 30, 'FA-IOM': 20, 'FA-BAT': 10, 'FA-CBL': 900, 'SP-HEAD': 260, 'SP-FLOW': 8,
  'FE-ABC6': 70, 'FE-ABC9': 40, 'FE-CO2': 12, 'FE-FOAM': 10, 'FE-BLK': 16, 'EL-FIT': 60, 'EL-EXIT': 44,
};
const LEDGER_START = -120;

// Parts used on completed jobs of the seed: [job, [[code, quantity]]]. They are
// taken from the van of the first person on the job.
const JOB_PARTS = [
  ['jb_25', [['FA-SD', 3], ['FA-IOM', 1]]],
  ['jb_21', [['FE-ABC6', 2]]],
  ['jb_9', [['FA-SD', 1]]],
  ['jb_15', [['FA-IOM', 1]]],
  ['jb_8', [['FA-IOM', 1], ['FA-CBL', 30]]],
  ['jb_26', [['FA-SD', 1]]],
];

// ---- the builder -------------------------------------------------------------------------------
export function buildPurchasing(T, { items, projects, jobs }) {
  const D = (n) => addDays(T, n);
  const byCode = Object.fromEntries(Object.values(items).map((i) => [i.code, i]));
  const supplierById = Object.fromEntries(SUPPLIERS.map((s) => [s.id, s]));
  const staffById = Object.fromEntries(STAFF.map((p) => [p.id, p]));
  const limits = DEFAULT_SETTINGS.approvals;
  const P = projects;
  const pkgs = (id) => P[id].packages;

  // -- places
  const locations = {
    [STORE_ID]: { id: STORE_ID, name: 'Main store, Al Quoz', kind: 'store', staffId: '' },
    ...Object.fromEntries(
      STAFF.filter((p) => p.van).map((p) => [vanLocationId(p.id), { id: vanLocationId(p.id), name: p.van, kind: 'van', staffId: p.id }]),
    ),
  };
  const vanOf = (staffId) => (staffById[staffId]?.van ? vanLocationId(staffId) : '');
  const vanOfJob = (job) => job.assigneeIds.map(vanOf).find(Boolean) ?? STORE_ID;

  // -- purchase orders -----------------------------------------------------------------------
  // Lines: [code, qty, cost?] from the catalogue, or { text, unit, qty, cost }.
  const specs = [];
  const PO = (o) => specs.push({ status: 'sent', purpose: 'stock', by: 'staff_faisal', deliverTo: STORE_ID, receipts: [], bills: [], ...o });

  // Projects.
  const [el1, , voA] = pkgs('prj_1');
  const [fa2, sp2, pu2, , vo2] = pkgs('prj_2');
  const [pp3] = pkgs('prj_3');
  PO({ sup: 'sup_lumisafe', on: -246, purpose: 'project', project: 'prj_1', pkg: el1.id, by: 'staff_nadia', deliverTo: 'site', title: 'Emergency fittings and exit signs', expected: -238,
    lines: [['EL-FIT', 90], ['EL-EXIT', 105], { text: 'Freight to site', qty: 1, cost: 30 }],
    receipts: [{ on: -240, note: 'Delivered to the camp office and counted with the camp boss' }], bills: [{ on: -240, ref: 'LS-4471', paid: -200 }] });
  PO({ sup: 'sup_lumisafe', on: -214, purpose: 'project', project: 'prj_1', pkg: voA.id, by: 'staff_nadia', deliverTo: 'site', title: 'Exit signs for the laundry block', expected: -208,
    lines: [['EL-EXIT', 20], { text: 'Freight to site', qty: 1, cost: 20 }],
    receipts: [{ on: -212 }], bills: [{ on: -212, ref: 'LS-4630', paid: -175 }] });
  PO({ sup: 'sup_steel', on: -79, purpose: 'project', project: 'prj_2', pkg: sp2.id, by: 'staff_nadia', deliverTo: 'site', title: 'Steel pipes and fittings', expected: -72,
    lines: [{ text: 'Black steel pipe, schedule 40, 50 to 150 mm', unit: 'm', qty: 3400, cost: 28.5 }, { text: 'Grooved fittings and couplings', qty: 1, cost: 55100 }],
    receipts: [{ on: -72, note: 'Delivered to the Tower B laydown area in three trucks' }], bills: [{ on: -71, ref: 'ESP-88213', paid: -45 }] });
  PO({ sup: 'sup_sharqi', on: -68, purpose: 'project', project: 'prj_2', pkg: fa2.id, by: 'staff_nadia', deliverTo: 'site', title: 'Fire alarm cables and cable trays', expected: -63,
    lines: [['FA-CBL', 12000], { text: 'Cable trays, galvanised, with covers', qty: 1, cost: 50900 }],
    receipts: [{ on: -63 }], bills: [{ on: -62, ref: 'SCT-20933', paid: -36 }] });
  PO({ sup: 'sup_precision', on: -48, purpose: 'project', project: 'prj_2', pkg: sp2.id, by: 'staff_nadia', deliverTo: 'site', title: 'Sprinkler heads and valves', expected: -40,
    lines: [['SP-HEAD', 2400], ['SP-ZCV', 30], ['SP-FLOW', 60], { text: 'Test drain valves and gauges', qty: 1, cost: 14000 }],
    receipts: [{ on: -42 }], bills: [{ on: -41, ref: 'PSC-7712', paid: null }] });
  PO({ sup: 'sup_alnoor', on: -53, purpose: 'project', project: 'prj_3', pkg: pp3.id, by: 'staff_nadia', deliverTo: 'site', title: 'Electric fire pump set with controller', expected: -32,
    lines: [['PU-EL', 1]], receipts: [{ on: -31, note: 'Lifted into the valve room with the crane' }], bills: [{ on: -30, ref: 'ANP-3391', paid: -2 }] });
  PO({ sup: 'sup_alnoor', on: -53, purpose: 'project', project: 'prj_3', pkg: pp3.id, by: 'staff_nadia', deliverTo: 'site', title: 'Jockey pump set', expected: -32,
    lines: [['PU-JP', 1]], receipts: [{ on: -31 }], bills: [{ on: -30, ref: 'ANP-3392', paid: -2 }] });
  PO({ sup: 'sup_alnoor', on: -27, purpose: 'project', project: 'prj_2', pkg: pu2.id, by: 'staff_nadia', deliverTo: 'site', title: 'Electric, diesel and jockey pumps', expected: 17,
    lines: [['PU-EL', 1], ['PU-JP', 1], { text: 'Diesel fire pump set 500 gpm, with controller', unit: 'set', qty: 1, cost: 63200 }] });
  PO({ sup: 'sup_gulfline', on: -13, purpose: 'project', project: 'prj_2', pkg: fa2.id, by: 'staff_nadia', deliverTo: 'site', title: 'Detectors, call points and sounders', expected: -2,
    lines: [['FA-SD', 480], ['FA-MCP', 60], ['FA-SND', 120], ['FA-HD', 90], ['FA-IOM', 90], { text: 'Isolators and detector bases', qty: 1, cost: 7310 }],
    receipts: [{ on: -3, note: 'First delivery: the rest is due this week', lines: [[0, 240], [1, 60], [2, 60], [3, 90], [4, 90]] }] });
  PO({ sup: 'sup_gulfline', on: -11, purpose: 'project', project: 'prj_2', pkg: fa2.id, by: 'staff_nadia', deliverTo: 'site', title: 'Fire alarm panels and repeaters', expected: 12,
    lines: [['FA-PNL-4L', 2], ['FA-RPT', 6], { text: 'Network cards and loop drivers', qty: 1, cost: 5000 }] });
  PO({ sup: 'sup_precision', on: -10, purpose: 'project', project: 'prj_2', pkg: sp2.id, by: 'staff_nadia', deliverTo: 'site', title: 'Zone control valves and flow switches', expected: 14,
    lines: [['SP-ZCV', 24], ['SP-FLOW', 48], { text: 'Valve tamper switches', qty: 1, cost: 9120 }] });
  PO({ sup: 'sup_hydra', on: -8, purpose: 'project', project: 'prj_2', pkg: sp2.id, by: 'staff_nadia', deliverTo: 'site', title: 'Hose reels and landing valves', expected: 16,
    lines: [['HY-REEL', 20], ['HY-LV', 30], { text: 'Hose reel cabinets, recessed', qty: 1, cost: 4200 }] });
  PO({ sup: 'sup_gulfline', on: -31, purpose: 'project', project: 'prj_2', pkg: vo2.id, by: 'staff_nadia', deliverTo: 'site', title: 'Interface modules for the smoke control variation', expected: -14,
    lines: [['FA-IOM', 100], { text: 'Relay modules for damper control', qty: 1, cost: 5300 }] });

  // A part for one repair job.
  PO({ sup: 'sup_nordwerk', on: -6, purpose: 'job', job: 'jb_3', title: 'Fusible links and nozzle caps for the kitchen hood repair', expected: 0, vatRate: 0,
    lines: [{ text: 'Fusible link, 165 degrees F', unit: 'nos', qty: 24, cost: 36 }, { text: 'Nozzle cap', unit: 'nos', qty: 12, cost: 22 }] });

  // Stock for the store.
  PO({ sup: 'sup_gulfline', on: -124, lines: [['FA-SD', 100], ['FA-HD', 40], ['FA-MCP', 30]], receipts: [{ on: -117 }], bills: [{ on: -116, ref: 'GF-19770' }] });
  PO({ sup: 'sup_falcon', on: -118, lines: [['FE-ABC6', 60], ['FE-ABC9', 40], ['FE-CO2', 10], ['FE-FOAM', 10], ['FE-BLK', 12]], receipts: [{ on: -111 }], bills: [{ on: -110, ref: 'FE-58201' }] });
  PO({ sup: 'sup_lumisafe', on: -103, lines: [['EL-FIT', 60], ['EL-EXIT', 60]], receipts: [{ on: -95 }], bills: [{ on: -94, ref: 'LS-4802' }] });
  PO({ sup: 'sup_sharqi', on: -92, lines: [['FA-CBL', 2000]], receipts: [{ on: -86 }], bills: [{ on: -85, ref: 'SCT-20388' }] });
  PO({ sup: 'sup_precision', on: -81, lines: [['SP-HEAD', 300], ['SP-FLOW', 10]], receipts: [{ on: -74 }], bills: [{ on: -73, ref: 'PSC-7205' }] });
  PO({ sup: 'sup_gulfline', on: -66, lines: [['FA-SND', 40], ['FA-IOM', 30], ['FA-BAT', 10]], receipts: [{ on: -58 }], bills: [{ on: -57, ref: 'GF-20418' }] });
  PO({ sup: 'sup_falcon', on: -50, lines: [['FE-ABC6', 40], ['FE-ABC9', 30], ['FE-CO2', 6]], receipts: [{ on: -44 }], bills: [{ on: -43, ref: 'FE-58977', paid: null }] });
  PO({ sup: 'sup_gulfline', on: -37, lines: [['FA-SD', 60], ['FA-MCP', 20], ['FA-HD', 20]], receipts: [{ on: -30 }], bills: [{ on: -29, ref: 'GF-20844', paid: null }] });
  PO({ sup: 'sup_lumisafe', on: -24, lines: [['EL-FIT', 30], ['EL-EXIT', 30]], receipts: [{ on: -17 }], bills: [{ on: -16, ref: 'LS-5120', paid: null }] });
  PO({ sup: 'sup_gulfline', on: -4, sentOn: -3, expected: 3, lines: [['FA-SND', 40], ['FA-IOM', 30], ['FA-BAT', 12]] });
  PO({ sup: 'sup_gulfline', on: -1, status: 'waiting_approval', expected: 8, lines: [['FA-SD', 200]], note: 'The detectors are running low and the project order is taking most of the supplier\'s stock.' });
  PO({ sup: 'sup_falcon', on: 0, status: 'draft', by: 'staff_faisal', lines: [['FE-ABC9', 60]] });

  // -- numbers, ids, approvals ----------------------------------------------------------------------
  const ordered = specs.map((sp, i) => ({ sp, i })).toSorted((a, b) => a.sp.on - b.sp.on || a.i - b.i).map((x) => x.sp);
  const purchaseOrders = {};
  const receipts = {};
  const bills = {};
  const events = [];
  let grnSeq = 0;
  let billSeq = 0;
  const ev = (entity, id, by, day, text) => events.push({ entity, entityId: id, by, daysAgo: -day, text });
  const APPROVER = { 1: 'staff_omar', 2: 'staff_layla' };
  const pad = (n) => String(n).padStart(4, '0');
  const yr = T.slice(0, 4);

  ordered.forEach((sp, index) => {
    const n = index + 1;
    const id = `po_${n}`;
    const number = `PO-${yr}-${pad(n)}`;
    const sup = supplierById[sp.sup];
    const lines = sp.lines.map((row, k) => {
      const lineId = `pl_${n}_${k + 1}`;
      if (!Array.isArray(row)) return { id: lineId, itemId: '', description: row.text, unit: row.unit ?? 'lot', qty: row.qty, cost: row.cost, packageId: sp.pkg ?? '' };
      const [code, qty, cost] = row;
      const it = byCode[code];
      return { id: lineId, itemId: it.id, description: it.name, unit: it.unit, qty, cost: cost ?? it.cost, packageId: sp.pkg ?? '' };
    });
    const createdOn = D(sp.on);
    const vatRate = sp.vatRate ?? (sup.taxable ? DEFAULT_SETTINGS.vatRate : 0);
    const po = {
      id, number, supplierId: sp.sup, status: sp.status, purpose: sp.purpose, projectId: sp.project ?? '', jobId: sp.job ?? '',
      deliverTo: sp.deliverTo, title: sp.title ?? '', createdOn, createdBy: sp.by, expectedOn: sp.expected !== undefined ? D(sp.expected) : '',
      supplierRef: '', notes: sp.note ?? '', vatRate, lines, approval: emptyPOApproval(), sent: null, cancelled: null, closedShort: null,
    };
    // Approval by value, as the application works it out: nobody above the person's own authority.
    const level = valueLevel(orderNet(po), limits);
    const authority = staffById[sp.by].roleKey === 'owner' ? 2 : staffById[sp.by].roleKey === 'manager' ? 1 : 0;
    if (level > authority) {
      const role = level === 2 ? 'owner' : 'manager';
      const reason = `Value is above AED ${(level === 2 ? limits.poManagerLimit : limits.poLimit).toLocaleString('en-US')}`;
      po.approval = { ...emptyPOApproval(), required: role, reasons: [reason], requestedBy: sp.by, requestedOn: createdOn };
      if (sp.status === 'waiting_approval') {
        ev('po', id, sp.by, sp.on, `Sent for approval to the ${role === 'owner' ? 'owner' : 'operations manager'}`);
      } else if (sp.status !== 'draft') {
        po.approval = { ...po.approval, decision: 'approved', decidedBy: APPROVER[level], decidedOn: D(sp.on + 1) };
        ev('po', id, sp.by, sp.on, `Sent for approval to the ${role === 'owner' ? 'owner' : 'operations manager'}`);
        ev('po', id, APPROVER[level], sp.on + 1, 'Approved');
      }
    }
    if (sp.status === 'sent') {
      const sentOffset = sp.sentOn ?? (level > authority ? sp.on + 2 : sp.on + 1);
      po.sent = { on: D(sentOffset), to: sup.email, message: '' };
      ev('po', id, 'staff_faisal', sentOffset, `Sent to ${sup.name}`);
    }
    ev('po', id, sp.by, sp.on, 'Purchase order created');
    purchaseOrders[id] = po;

    for (const r of sp.receipts) {
      grnSeq += 1;
      const rid = `rc_${grnSeq}`;
      const spec = r.lines ?? lines.map((l, k) => [k, l.qty]);
      receipts[rid] = {
        id: rid, number: '', poId: id, on: D(r.on), byId: sp.deliverTo === 'site' ? (P[sp.project]?.supervisorId || P[sp.project]?.engineerId || sp.by) : 'staff_bilal',
        deliveryNote: `DN-${sup.name.slice(0, 2).toUpperCase()}${5000 + grnSeq * 7}`, note: r.note ?? '', to: sp.deliverTo,
        lines: spec.filter(([, qty]) => qty > 0).map(([k, qty]) => ({ lineId: lines[k].id, qty })),
      };
    }
    for (const b of sp.bills) {
      billSeq += 1;
      const bid = `bl_${billSeq}`;
      const on = D(b.on);
      const dueOn = dueDate(on, sup.terms);
      // An old bill is paid a few days before it is due, unless the row says it is not.
      const paidOn = b.paid === null ? '' : b.paid !== undefined ? D(b.paid) : dueOn <= addDays(T, -5) ? addDays(dueOn, -4) : '';
      const rows = b.lines ?? lines.map((l, k) => [k, l.qty]);
      bills[bid] = {
        id: bid, number: '', poId: id, supplierId: sp.sup, supplierRef: b.ref, on, dueOn, paidOn, paidRef: paidOn ? `TRF-${paidOn.replaceAll('-', '')}` : '',
        recordedBy: 'staff_priya', lines: rows.map(([k, qty, cost]) => ({ lineId: lines[k].id, qty, cost: cost ?? lines[k].cost })),
      };
    }
  });

  // GRN and bill numbers follow the dates.
  Object.values(receipts).toSorted((a, b) => a.on.localeCompare(b.on) || a.id.localeCompare(b.id)).forEach((r, i) => { r.number = `GRN-${yr}-${pad(i + 1)}`; });
  Object.values(bills).toSorted((a, b) => a.on.localeCompare(b.on) || a.id.localeCompare(b.id)).forEach((b, i) => { b.number = `BILL-${yr}-${pad(i + 1)}`; });
  for (const r of Object.values(receipts)) {
    const po = purchaseOrders[r.poId];
    const day = -Math.round((new Date(T) - new Date(r.on)) / 86_400_000);
    ev('po', po.id, r.byId, day, `Goods received: ${r.number} (${r.lines.length} of ${po.lines.length} lines)`);
  }
  for (const b of Object.values(bills)) {
    const po = purchaseOrders[b.poId];
    const day = -Math.round((new Date(T) - new Date(b.on)) / 86_400_000);
    ev('po', po.id, 'staff_priya', day, `Supplier bill ${b.supplierRef} recorded (${b.number})`);
    if (b.paidOn) ev('po', po.id, 'staff_priya', -Math.round((new Date(T) - new Date(b.paidOn)) / 86_400_000), `Bill ${b.supplierRef} paid`);
  }

  // -- the ledger of stock, replayed in date order ----------------------------------------------------
  const stockItems = Object.values(items).filter((i) => i.stocked);
  const bal = Object.fromEntries(stockItems.map((i) => [i.id, {}]));
  const avg = Object.fromEntries(stockItems.map((i) => [i.id, i.cost]));
  const totalOf = (itemId) => Object.values(bal[itemId]).reduce((n, q) => n + q, 0);
  const movements = [];
  let trSeq = 0;
  const post = (m) => {
    movements.push({ id: '', note: '', byId: 'staff_bilal', ...m });
    bal[m.itemId][m.locationId] = round3((bal[m.itemId][m.locationId] ?? 0) + m.qty);
  };

  const timeline = [];
  for (const [code, qty] of Object.entries(OPENING)) timeline.push({ on: D(LEDGER_START), pri: 0, run: () => post({ on: D(LEDGER_START), kind: 'opening', itemId: byCode[code].id, locationId: STORE_ID, qty, unitCost: byCode[code].cost, ref: { kind: 'opening' }, note: 'Opening balance of the ledger' }) });
  for (const r of Object.values(receipts)) {
    const po = purchaseOrders[r.poId];
    const lines = stockLinesOfReceipt(po, r, items);
    if (lines.length === 0) continue;
    timeline.push({
      on: r.on, pri: 1,
      run: () => {
        for (const l of lines) {
          avg[l.itemId] = weightedAverage(totalOf(l.itemId), avg[l.itemId], l.qty, l.unitCost);
          post({ on: r.on, kind: 'receipt', itemId: l.itemId, locationId: r.to, qty: l.qty, unitCost: l.unitCost, ref: { kind: 'grn', id: r.id, number: r.number, poId: po.id, poNumber: po.number }, byId: r.byId });
        }
      },
    });
  }
  // A transfer is two rows that share an id.
  const transfer = (on, from, to, list, note) => {
    trSeq += 1;
    const tid = `tr_${trSeq}`;
    for (const [itemId, qty] of list) {
      const unitCost = avg[itemId];
      post({ on, kind: 'transfer_out', itemId, locationId: from, qty: -qty, unitCost, ref: { kind: 'transfer', id: tid, from, to }, note });
      post({ on, kind: 'transfer_in', itemId, locationId: to, qty, unitCost, ref: { kind: 'transfer', id: tid, from, to }, note });
    }
  };
  const vans = Object.values(locations).filter((l) => l.kind === 'van');
  vans.forEach((van, vi) => {
    for (const off of [LEDGER_START + 1, -60, -31, -8]) {
      const on = D(off + vi);
      timeline.push({
        on, pri: 2,
        run: () => {
          const list = [];
          for (const it of stockItems) {
            const take = Math.min(vanShortfall(it, bal[it.id][van.id] ?? 0), Math.max(0, bal[it.id][STORE_ID] ?? 0));
            if (take > 0) list.push([it.id, take]);
          }
          if (list.length > 0) transfer(on, STORE_ID, van.id, list, `${van.name} topped up to its par level`);
        },
      });
    }
  });
  // One van lends to another.
  timeline.push({ on: D(-40), pri: 3, run: () => transfer(D(-40), vans[2].id, vans[0].id, [[byCode['FE-CO2'].id, 1], [byCode['FE-ABC6'].id, 2]], `${vans[2].name} lent extinguishers to ${vans[0].name} for the mall job`) });
  // Counts.
  const count = (off, locationId, code, delta, reason) => timeline.push({
    on: D(off), pri: 3,
    run: () => post({ on: D(off), kind: 'count', itemId: byCode[code].id, locationId, qty: delta, unitCost: avg[byCode[code].id], ref: { kind: 'count' }, note: reason }),
  });
  count(-60, STORE_ID, 'FA-CBL', -45, 'Lost or not recorded: offcuts and waste');
  count(-60, STORE_ID, 'FE-BLK', -1, 'Damaged or expired');
  count(-28, vans[2].id, 'SP-HEAD', -2, 'Damaged or expired');
  count(-9, STORE_ID, 'FA-SD', -2, 'Counted differently');
  // Parts used on jobs.
  const jobParts = {};
  for (const [jobId, list] of JOB_PARTS) {
    const job = jobs[jobId];
    const locationId = vanOfJob(job);
    const on = job.completedOn || job.plannedOn;
    const parts = list.map(([code, qty], k) => ({ id: `prt_${jobId}_${k + 1}`, itemId: byCode[code].id, description: byCode[code].name, unit: byCode[code].unit, qty, fromId: locationId, movementId: '' }));
    jobParts[jobId] = parts;
    timeline.push({
      on, pri: 4,
      run: () => {
        for (const part of parts) {
          post({ on, kind: 'issue_job', itemId: part.itemId, locationId, qty: -part.qty, unitCost: avg[part.itemId], ref: { kind: 'job', id: job.id, number: job.number, partId: part.id }, byId: job.assigneeIds[0] ?? 'staff_bilal' });
        }
      },
    });
  }
  // Stock issued to projects.
  const issue = (off, projectId, packageId, code, qty, note) => timeline.push({
    on: D(off), pri: 4,
    run: () => post({ on: D(off), kind: 'issue_project', itemId: byCode[code].id, locationId: STORE_ID, qty: -qty, unitCost: avg[byCode[code].id], ref: { kind: 'project', id: projectId, number: P[projectId].number, packageId }, note, byId: 'staff_bilal' }),
  });
  issue(-58, 'prj_1', el1.id, 'EL-FIT', 4, 'Defects liability: replaced fittings that failed the battery test');
  issue(-22, 'prj_2', fa2.id, 'FA-CBL', 300, 'Cable for the control room extension');
  issue(-14, 'prj_2', sp2.id, 'SP-HEAD', 48, 'Heads for the mock-up floor');

  timeline.toSorted((a, b) => a.on.localeCompare(b.on) || a.pri - b.pri).forEach((e) => e.run());
  movements.forEach((m, i) => { m.id = `mv_${i + 1}`; });
  // Tie each seeded job part to its movement.
  for (const parts of Object.values(jobParts)) {
    for (const part of parts) part.movementId = movements.find((m) => m.ref?.partId === part.id)?.id ?? '';
  }
  const finalItems = Object.fromEntries(Object.entries(items).map(([id, it]) => [id, it.stocked ? { ...it, avgCost: avg[id] } : it]));

  return {
    suppliers: Object.fromEntries(SUPPLIERS.map((s) => [s.id, s])),
    locations,
    items: finalItems,
    purchaseOrders,
    receipts,
    bills,
    movements: Object.fromEntries(movements.map((m) => [m.id, m])),
    jobParts,
    events,
    counters: { po: ordered.length, grn: grnSeq, bill: billSeq, movement: movements.length, transfer: trSeq },
  };
}

