import { addDays } from '../../lib/dates.js';
import { amcSections } from '../amc.js';
import { defaultKindData, defaultTerms, emptyApproval } from '../quotationKinds.js';

// The item catalogue: what the company sells and uses, with a cost and a
// selling price (AED, before VAT). All prices are samples. The catalogue lives in
// Inventory (Items); the stock fields are added by data/seed/purchasing.js.
const RAW_ITEMS = [
  // code, name, category, unit, cost, price, kind
  ['FA-PNL-2L', 'Addressable fire alarm panel, 2 loops', 'Fire alarm', 'nos', 6200, 9400],
  ['FA-PNL-4L', 'Addressable fire alarm panel, 4 loops', 'Fire alarm', 'nos', 11800, 17500],
  ['FA-RPT', 'Repeater panel, LCD', 'Fire alarm', 'nos', 1650, 2600],
  ['FA-SD', 'Addressable smoke detector, photoelectric', 'Fire alarm', 'nos', 64, 115],
  ['FA-HD', 'Addressable heat detector', 'Fire alarm', 'nos', 62, 112],
  ['FA-MCP', 'Manual call point, addressable', 'Fire alarm', 'nos', 78, 145],
  ['FA-SND', 'Sounder with strobe, addressable', 'Fire alarm', 'nos', 118, 210],
  ['FA-IOM', 'Input / output module', 'Fire alarm', 'nos', 95, 175],
  ['FA-CBL', 'Fire-resistant cable, 2 x 1.5 mm²', 'Fire alarm', 'm', 3.8, 6.5],
  ['FA-BAT', 'Battery set, 2 x 12 V 38 Ah', 'Fire alarm', 'set', 520, 880],
  ['SP-HEAD', 'Pendent sprinkler head, 68 °C', 'Sprinkler and hydrant', 'nos', 11, 24],
  ['SP-PIPE', 'Sprinkler pipe, supplied and installed', 'Sprinkler and hydrant', 'm', 42, 78],
  ['SP-ZCV', 'Zone control valve assembly', 'Sprinkler and hydrant', 'nos', 1450, 2350],
  ['SP-FLOW', 'Water flow switch', 'Sprinkler and hydrant', 'nos', 210, 380],
  ['HY-REEL', 'Hose reel, complete', 'Sprinkler and hydrant', 'nos', 1150, 1900],
  ['HY-LV', 'Landing valve, 2.5 inch', 'Sprinkler and hydrant', 'nos', 460, 780],
  ['HY-HYD', 'External fire hydrant', 'Sprinkler and hydrant', 'nos', 2300, 3600],
  ['PU-EL', 'Electric fire pump set 750 gpm, with controller', 'Pumps and tanks', 'set', 68000, 96000],
  ['PU-DI', 'Diesel fire pump set 750 gpm, with controller', 'Pumps and tanks', 'set', 92000, 128000],
  ['PU-JP', 'Jockey pump set, with controller', 'Pumps and tanks', 'set', 9800, 14500],
  ['FE-ABC6', 'Extinguisher, ABC powder 6 kg', 'Extinguishers', 'nos', 78, 135],
  ['FE-ABC9', 'Extinguisher, ABC powder 9 kg', 'Extinguishers', 'nos', 105, 175],
  ['FE-CO2', 'Extinguisher, CO₂ 5 kg', 'Extinguishers', 'nos', 265, 420],
  ['FE-FOAM', 'Extinguisher, foam 9 L', 'Extinguishers', 'nos', 150, 240],
  ['FE-WC', 'Extinguisher, wet chemical 6 L', 'Extinguishers', 'nos', 190, 310],
  ['FE-BLK', 'Fire blanket, 1.2 x 1.8 m', 'Extinguishers', 'nos', 28, 55],
  ['FE-RF-ABC', 'Refill and service, ABC powder extinguisher', 'Extinguishers', 'nos', 18, 45, 'service'],
  ['FE-RF-CO2', 'Refill and test, CO₂ extinguisher', 'Extinguishers', 'nos', 55, 110, 'service'],
  ['EL-FIT', 'LED emergency light fitting, 3 hours', 'Emergency lighting', 'nos', 85, 155],
  ['EL-EXIT', 'LED exit sign, 3 hours', 'Emergency lighting', 'nos', 74, 138],
  ['KH-SYS', 'Kitchen hood wet chemical system, 2 nozzles', 'Suppression', 'nos', 5400, 8900],
  ['KH-RCH', 'Wet chemical recharge, per cylinder', 'Suppression', 'nos', 320, 640, 'service'],
  ['CA-RCH', 'Clean agent recharge, per kg', 'Suppression', 'kg', 95, 165, 'service'],
  ['VA-CTL', 'Voice alarm controller, 4 zones', 'Voice alarm', 'nos', 8500, 13000],
  ['VA-SPK', 'Ceiling loudspeaker, 6 W', 'Voice alarm', 'nos', 130, 240],
  ['SC-DMP', 'Motorised smoke damper', 'Smoke control', 'nos', 1650, 2700],
  ['LB-TECH', 'Technician, per hour', 'Labour and services', 'hour', 48, 95, 'service'],
  ['LB-ENG', 'Engineer, per hour', 'Labour and services', 'hour', 85, 160, 'service'],
  ['LB-CALL', 'Call-out charge, working hours', 'Labour and services', 'visit', 60, 180, 'service'],
  ['LB-CALLN', 'Call-out charge, night and holidays', 'Labour and services', 'visit', 120, 420, 'service'],
  ['LB-INST', 'Installation labour, per point', 'Labour and services', 'point', 55, 110, 'service'],
  ['LB-TEST', 'Testing and commissioning', 'Labour and services', 'lot', 1200, 2800, 'service'],
  ['DOC-DRW', 'Shop drawings and submittals', 'Documentation and approvals', 'lot', 2200, 4800, 'service'],
  ['DOC-CD', 'Civil Defence submission and follow-up', 'Documentation and approvals', 'lot', 600, 1800, 'service'],
  ['DOC-ASB', 'As-built drawings and manuals', 'Documentation and approvals', 'lot', 1400, 3200, 'service'],
  ['AMC-FA-BASE', 'Fire alarm panel and system checks, per panel per year', 'Maintenance rates', 'panel', 650, 1200, 'service'],
  ['AMC-FA-DET', 'Detector test, per detector per year', 'Maintenance rates', 'nos', 4, 9, 'service'],
  ['AMC-FA-MCP', 'Call point test, per call point per year', 'Maintenance rates', 'nos', 4.5, 10, 'service'],
  ['AMC-FA-SND', 'Sounder test, per sounder per year', 'Maintenance rates', 'nos', 4, 9, 'service'],
  ['AMC-SP-ZONE', 'Sprinkler zone inspection and test, per zone per year', 'Maintenance rates', 'zone', 140, 320, 'service'],
  ['AMC-SP-HEADS', 'Sprinkler head inspection, per 100 heads per year', 'Maintenance rates', 'per 100', 90, 210, 'service'],
  ['AMC-PUMP', 'Fire pump service and run tests, per pump per year', 'Maintenance rates', 'pump', 1150, 2400, 'service'],
  ['AMC-FE', 'Extinguisher inspection and service, per unit per year', 'Maintenance rates', 'nos', 14, 32, 'service'],
  ['AMC-EL', 'Emergency light test, per fitting per year', 'Maintenance rates', 'nos', 9, 20, 'service'],
  ['AMC-HOSE', 'Hose reel and landing valve check, per outlet per year', 'Maintenance rates', 'nos', 20, 46, 'service'],
  ['AMC-KH', 'Kitchen hood system service, per cylinder per year', 'Maintenance rates', 'nos', 350, 780, 'service'],
  ['AMC-CA', 'Clean-agent cylinder service, per cylinder per year', 'Maintenance rates', 'nos', 520, 1150, 'service'],
  ['AMC-FAN', 'Smoke or pressurisation fan test, per fan per year', 'Maintenance rates', 'nos', 160, 360, 'service'],
  ['AMC-VA', 'Voice alarm check, per 100 speakers per year', 'Maintenance rates', 'per 100', 300, 700, 'service'],
];

export const itemId = (code) => `item_${code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

export function buildItems() {
  return Object.fromEntries(
    RAW_ITEMS.map(([code, name, category, unit, cost, price, kind = 'material']) => [
      itemId(code),
      { id: itemId(code), code, name, category, unit, cost, price, kind, active: true },
    ]),
  );
}

export const DEFAULT_SETTINGS = {
  vatRate: 5,
  validityDays: 30,
  // Who must approve a quotation (sample limits; the owner can change them in
  // Settings). A level is 0 nobody, 1 operations manager, 2 owner.
  approvals: {
    salesLimit: 50000, managerLimit: 250000, salesDiscount: 5, managerDiscount: 10, marginFloor: 15,
    // Purchase orders: a purchase officer may commit up to poLimit alone; above it the
    // operations manager approves, and above poManagerLimit the owner (samples).
    poLimit: 10000, poManagerLimit: 100000,
    // Credit notes: the accountant may issue up to cnLimit alone (net value); above it the
    // operations manager approves, and above cnManagerLimit the owner (samples).
    cnLimit: 1000, cnManagerLimit: 10000,
  },
};

// ---- builders -----------------------------------------------------------------
export function buildSales(T, { items, systems, devices }) {
  const D = (n) => addDays(T, n);
  let seq = 0;
  const nid = (prefix) => `${prefix}_s${++seq}`;
  const byCode = Object.fromEntries(Object.values(items).map((i) => [i.code, i]));

  // A line from the catalogue: [code, quantity, { price, description }], or a
  // custom line: { text, unit, qty, cost, price }.
  const makeLine = (sectionId, row) => {
    if (!Array.isArray(row)) {
      return { id: nid('ln'), sectionId, itemId: '', description: row.text, unit: row.unit, qty: row.qty, cost: row.cost, price: row.price };
    }
    const [code, qty, o = {}] = row;
    const it = byCode[code];
    return {
      id: nid('ln'), sectionId, itemId: it.id, description: o.description ?? it.name, unit: it.unit, qty,
      cost: it.cost, price: o.price ?? it.price,
    };
  };
  // [[section title, [line rows]], ...]
  const fromSpec = (spec) => {
    const sections = [];
    const lines = [];
    for (const [title, rows] of spec) {
      const sectionId = nid('sec');
      sections.push({ id: sectionId, title });
      for (const row of rows) lines.push(makeLine(sectionId, row));
    }
    return { sections, lines };
  };
  const single = (title, rows) => fromSpec([[title, rows]]);
  const siteAmc = (siteId) =>
    amcSections(
      Object.values(systems).filter((s) => s.siteId === siteId),
      Object.values(devices),
      byCode,
      nid,
    );

  const quote = (o) => ({
    rev: 0, enquiryId: '', contactId: '', discountPct: 0, sent: null, answer: null, supersededBy: '', followUp: null,
    ...o,
    validUntil: o.validUntil ?? addDays(o.createdOn, 30),
    terms: { ...defaultTerms(o.kind), ...(o.terms ?? {}) },
    kindData: { ...defaultKindData(o.kind, o.createdOn), ...(o.kindData ?? {}) },
    approval: { ...emptyApproval(), ...(o.approval ?? {}) },
  });
  const enquiry = (o) => ({
    description: '', source: 'phone', contactId: '', siteId: '', dueOn: '', estValue: 0,
    survey: { needed: false, plannedOn: '', assigneeId: '', doneOn: '', notes: '' },
    lostReason: '', lostNote: '',
    ...o,
  });
  const accepted = (daysAgo, via, byContactId, reference = '') => ({
    result: 'accepted', on: D(-daysAgo), via, reference, byContactId, byName: '', reason: '', note: '',
  });

  // ---- enquiries ---------------------------------------------------------------
  const E = [
    enquiry({
      id: 'enq_28', number: 'ENQ-2026-0028', customerId: 'cus_zenith', siteId: 'site_creek', contactId: 'ct_21', kind: 'project',
      title: 'Fire fighting and fire alarm package, Tower B', source: 'tender', receivedOn: D(-128), dueOn: D(-118),
      ownerId: 'staff_layla', estValue: 1400000, status: 'won',
      description: 'Main contractor invited three subcontractors. Drawings and BOQ received by e-mail.',
      survey: { needed: true, plannedOn: D(-124), assigneeId: 'staff_nadia', doneOn: D(-124), notes: 'Reviewed the floor plans and the plant rooms with the contractor\'s engineer.' },
    }),
    enquiry({
      id: 'enq_29', number: 'ENQ-2026-0029', customerId: 'cus_wasl', siteId: 'site_wasl', contactId: 'ct_34', kind: 'supply',
      title: 'Extinguisher refills and two new units', source: 'walk_in', receivedOn: D(-44), dueOn: D(-40),
      ownerId: 'staff_sara', estValue: 900, status: 'won',
    }),
    enquiry({
      id: 'enq_30', number: 'ENQ-2026-0030', customerId: 'cus_falcon', siteId: 'site_falcon', contactId: 'ct_19', kind: 'project',
      title: 'Emergency lighting upgrade, levels 20 to 32', source: 'email', receivedOn: D(-88), dueOn: D(-78),
      ownerId: 'staff_sara', estValue: 96000, status: 'quoted',
      survey: { needed: true, plannedOn: D(-84), assigneeId: 'staff_imran', doneOn: D(-84), notes: 'Counted 300 fittings and 120 exit signs; batteries of the old fittings are at end of life.' },
    }),
    enquiry({
      id: 'enq_31', number: 'ENQ-2026-0031', customerId: 'cus_mall', siteId: 'site_mall', contactId: 'ct_30', kind: 'contract',
      title: 'Maintenance contract renewal 2026/27', source: 'renewal', receivedOn: D(-70), dueOn: D(-66),
      ownerId: 'staff_omar', estValue: 70000, status: 'won',
    }),
    enquiry({
      id: 'enq_32', number: 'ENQ-2026-0032', customerId: 'cus_khalid', siteId: 'site_khalid', contactId: 'ct_33', kind: 'supply',
      title: 'Two extinguishers and a fire blanket for the kitchen', source: 'whatsapp', receivedOn: D(-62), dueOn: D(-60),
      ownerId: 'staff_sara', estValue: 340, status: 'won',
    }),
    enquiry({
      id: 'enq_33', number: 'ENQ-2026-0033', customerId: 'cus_harbour', siteId: 'site_harbour', contactId: 'ct_6', kind: 'contract',
      title: 'Maintenance contract, lapsed: renew for 12 months', source: 'renewal', receivedOn: D(-26), dueOn: D(-14),
      ownerId: 'staff_sara', estValue: 26000, status: 'quoted',
      survey: { needed: true, plannedOn: D(-22), assigneeId: 'staff_imran', doneOn: D(-22), notes: 'Equipment list agrees with the register. Fire alarm panel shows two loop faults, to be reported.' },
    }),
    enquiry({
      id: 'enq_34', number: 'ENQ-2026-0034', customerId: 'cus_meridian', siteId: 'site_meridian', contactId: 'ct_8', kind: 'project',
      title: 'Fire alarm panel upgrade and voice alarm, Wing B', source: 'referral', receivedOn: D(-21), dueOn: D(3),
      ownerId: 'staff_layla', estValue: 300000, status: 'estimating',
      description: 'The hotel is opening Wing B in January. Panels must network with the main building.',
      survey: { needed: true, plannedOn: D(-16), assigneeId: 'staff_nadia', doneOn: D(-14), notes: 'Wing B has 6 floors; the cable routes are ready. Voice alarm covers the lobby and corridors.' },
    }),
    enquiry({
      id: 'enq_35', number: 'ENQ-2026-0035', customerId: 'cus_sahara', siteId: '', contactId: 'ct_15', kind: 'project',
      title: 'Phase 3, warehouses G to I: sprinklers and pump house', source: 'tender', receivedOn: D(-6), dueOn: D(25),
      ownerId: 'staff_sara', estValue: 2400000, status: 'survey',
      description: 'Tender documents include drawings for three new warehouses next to Phase 2.',
      survey: { needed: true, plannedOn: D(1), assigneeId: 'staff_nadia', doneOn: '', notes: '' },
    }),
    enquiry({
      id: 'enq_36', number: 'ENQ-2026-0036', customerId: 'cus_bright', siteId: 'site_bright', contactId: 'ct_29', kind: 'repair',
      title: 'Faulty smoke detectors in block C', source: 'phone', receivedOn: D(-45), dueOn: D(-40),
      ownerId: 'staff_sara', estValue: 6000, status: 'quoted',
    }),
    enquiry({
      id: 'enq_37', number: 'ENQ-2026-0037', customerId: 'cus_rose', siteId: '', contactId: 'ct_24', kind: 'project',
      title: 'New outlet, Dubai Hills: kitchen suppression and alarm', source: 'phone', receivedOn: D(-3), dueOn: D(10),
      ownerId: 'staff_sara', estValue: 38000, status: 'new',
      description: 'Opening in six weeks. The customer is on hold: any quotation needs the owner\'s approval.',
      survey: { needed: true, plannedOn: '', assigneeId: '', doneOn: '', notes: '' },
    }),
    enquiry({
      id: 'enq_38', number: 'ENQ-2026-0038', customerId: 'cus_oasis', siteId: 'site_oasis', contactId: 'ct_26', kind: 'repair',
      title: 'Corroded sprinkler heads in cold room 2', source: 'whatsapp', receivedOn: D(-1), dueOn: D(6),
      ownerId: 'staff_sara', estValue: 14000, status: 'new',
      survey: { needed: true, plannedOn: '', assigneeId: '', doneOn: '', notes: '' },
    }),
    enquiry({
      id: 'enq_39', number: 'ENQ-2026-0039', customerId: 'cus_nexus', siteId: 'site_nexus', contactId: 'ct_40', kind: 'contract',
      title: 'Maintenance contract: clean-agent halls 1 to 4 and fire alarm', source: 'email', receivedOn: D(-9), dueOn: D(5),
      ownerId: 'staff_layla', estValue: 25000, status: 'estimating',
    }),
    enquiry({
      id: 'enq_40', number: 'ENQ-2026-0040', customerId: 'cus_crescent', siteId: 'site_crescent', contactId: 'ct_39', kind: 'supply',
      title: 'Extinguishers for the second floor', source: 'walk_in', receivedOn: D(-52), dueOn: D(-48),
      ownerId: 'staff_sara', estValue: 1000, status: 'lost', lostReason: 'Chose a competitor', lostNote: 'Found a cheaper set at a hardware shop.',
    }),
    enquiry({
      id: 'enq_41', number: 'ENQ-2026-0041', customerId: 'cus_green', siteId: 'site_gv1', contactId: 'ct_35', kind: 'contract',
      title: 'Maintenance contract for the Al Warqa store', source: 'email', receivedOn: D(-11), dueOn: D(-4),
      ownerId: 'staff_sara', estValue: 3600, status: 'quoted',
    }),
  ];

  // ---- quotations ----------------------------------------------------------------
  const zenith = fromSpec([
    ['Fire alarm system', [
      ['FA-PNL-4L', 1], ['FA-RPT', 2], ['FA-SD', 528], ['FA-HD', 88], ['FA-MCP', 132], ['FA-SND', 176],
      ['FA-IOM', 132], ['FA-CBL', 24000], ['FA-BAT', 2], ['LB-INST', 1058],
    ]],
    ['Sprinkler and hydrant system', [
      ['SP-HEAD', 3100], ['SP-PIPE', 5200], ['SP-ZCV', 44], ['SP-FLOW', 44], ['HY-REEL', 44], ['HY-LV', 88],
    ]],
    ['Fire pump room', [['PU-EL', 1], ['PU-DI', 1], ['PU-JP', 1]]],
    ['Testing, documents and approvals', [['LB-TEST', 1], ['DOC-DRW', 1], ['DOC-CD', 1], ['DOC-ASB', 1]]],
  ]);
  const meridianB = fromSpec([
    ['Fire alarm, Wing B', [
      ['FA-PNL-4L', 2], ['FA-RPT', 2], ['FA-SD', 260], ['FA-HD', 24], ['FA-MCP', 40], ['FA-SND', 120],
      ['FA-IOM', 60], ['FA-CBL', 9000], ['LB-INST', 600],
    ]],
    ['Voice alarm, Wing B', [['VA-CTL', 1], ['VA-SPK', 180]]],
    ['Testing, documents and approvals', [['LB-TEST', 1], ['DOC-DRW', 1], ['DOC-CD', 1], ['DOC-ASB', 1]]],
  ]);
  const falcon = fromSpec([
    ['Emergency lighting, levels 20 to 32', [['EL-FIT', 300], ['EL-EXIT', 120], ['LB-INST', 420], ['LB-TEST', 1], ['DOC-ASB', 1]]],
  ]);

  const brightRev0 = single('Repairs, block C', [
    ['FA-SD', 24], ['FA-HD', 4], ['LB-TECH', 16], ['LB-CALL', 2],
    { text: 'Re-addressing and programming of the block C loop', unit: 'lot', qty: 1, cost: 400, price: 950 },
  ]);
  const brightRev1 = single('Repairs, block C', [
    ['FA-SD', 24], ['FA-HD', 4], ['LB-TECH', 16], ['LB-CALL', 2],
    { text: 'Re-addressing and programming of the block C loop', unit: 'lot', qty: 1, cost: 400, price: 950 },
  ]);

  const Q = [
    quote({
      id: 'qt_102', number: 'QT-2026-0102', enquiryId: 'enq_28', customerId: 'cus_zenith', siteId: 'site_creek', contactId: 'ct_21',
      kind: 'project', title: 'Fire fighting and fire alarm package, Tower B', status: 'accepted', createdOn: D(-118),
      preparedBy: 'staff_sara', discountPct: 3, ...zenith,
      kindData: { durationWeeks: 40, advancePct: 30, retentionPct: 10, cdApproval: 'contractor' },
      approval: { required: 'owner', reasons: ['Net value above AED 250,000'], requestedBy: 'staff_sara', requestedOn: D(-117), comment: 'Price agreed with the contractor\'s engineer. Please approve.', decision: 'approved', decidedBy: 'staff_layla', decidedOn: D(-115), decisionNote: 'Approved. Keep the 10% retention clause.' },
      sent: { on: D(-112), to: ['ct_21'], message: 'Please find our quotation for the fire fighting and fire alarm package of Tower B.' },
      answer: accepted(96, 'lpo', 'ct_21', 'ZC/LPO/4471'),
    }),
    quote({
      id: 'qt_119', number: 'QT-2026-0119', enquiryId: 'enq_31', customerId: 'cus_mall', siteId: 'site_mall', contactId: 'ct_30',
      kind: 'contract', title: 'Maintenance contract renewal 2026/27', status: 'accepted', createdOn: D(-68), preparedBy: 'staff_omar',
      ...siteAmc('site_mall'),
      kindData: { termMonths: 12, startOn: D(20), visitsPerYear: 4, billing: 'quarterly', responseHours: 4 },
      sent: { on: D(-64), to: ['ct_30'], message: 'Attached is the renewal of your maintenance contract.' },
      answer: accepted(52, 'signed', 'ct_30'),
    }),
    quote({
      id: 'qt_121', number: 'QT-2026-0121', enquiryId: 'enq_30', customerId: 'cus_falcon', siteId: 'site_falcon', contactId: 'ct_19',
      kind: 'project', title: 'Emergency lighting upgrade, levels 20 to 32', status: 'sent', createdOn: D(-80), validUntil: D(-45),
      preparedBy: 'staff_sara', ...falcon,
      kindData: { durationWeeks: 6, advancePct: 30, retentionPct: 5, cdApproval: 'contractor' },
      sent: { on: D(-75), to: ['ct_19', 'ct_18'], message: 'Our quotation for the emergency lighting upgrade.' },
    }),
    quote({
      id: 'qt_124', number: 'QT-2026-0124', enquiryId: 'enq_29', customerId: 'cus_wasl', siteId: 'site_wasl', contactId: 'ct_34',
      kind: 'supply', title: 'Extinguisher refills and two new units', status: 'accepted', createdOn: D(-43), preparedBy: 'staff_sara',
      ...single('Items', [['FE-RF-ABC', 12], ['FE-RF-CO2', 2], ['FE-FOAM', 2]]),
      sent: { on: D(-42), to: ['ct_34'], message: 'Our price for the refills and the two foam extinguishers.' },
      answer: accepted(38, 'phone', 'ct_34'),
    }),
    quote({
      id: 'qt_125', number: 'QT-2026-0125', enquiryId: 'enq_32', customerId: 'cus_khalid', siteId: 'site_khalid', contactId: 'ct_33',
      kind: 'supply', title: 'Two extinguishers and a fire blanket', status: 'accepted', createdOn: D(-62), preparedBy: 'staff_sara',
      ...single('Items', [['FE-ABC6', 2], ['FE-BLK', 1]]),
      sent: { on: D(-62), to: ['ct_33'], message: 'Here is the price we spoke about.' },
      answer: accepted(60, 'whatsapp', 'ct_33'),
    }),
    quote({
      id: 'qt_126', number: 'QT-2026-0126', enquiryId: 'enq_40', customerId: 'cus_crescent', siteId: 'site_crescent', contactId: 'ct_39',
      kind: 'supply', title: 'Extinguishers for the second floor', status: 'rejected', createdOn: D(-51), preparedBy: 'staff_sara',
      ...single('Items', [['FE-ABC6', 4], ['FE-CO2', 1]]),
      sent: { on: D(-50), to: ['ct_39'], message: 'Our price for the second floor.' },
      answer: { result: 'rejected', on: D(-40), via: 'phone', reference: '', byContactId: 'ct_39', byName: '', reason: 'Chose a competitor', note: 'Found a cheaper set at a hardware shop.' },
    }),
    quote({
      id: 'qt_127a', number: 'QT-2026-0127', rev: 0, enquiryId: 'enq_36', customerId: 'cus_bright', siteId: 'site_bright', contactId: 'ct_29',
      kind: 'repair', title: 'Replace faulty detectors, block C', status: 'superseded', createdOn: D(-44), preparedBy: 'staff_sara',
      ...brightRev0, supersededBy: 'qt_127b',
      kindData: { urgency: 'normal', deficiencyRef: 'DEF-2026-0203', warrantyMonths: 6, durationDays: 2 },
      sent: { on: D(-43), to: ['ct_29'], message: 'Our quotation for the detectors of block C.' },
      answer: { result: 'rejected', on: D(-30), via: 'email', reference: '', byContactId: 'ct_29', byName: '', reason: 'Price too high', note: 'The principal asked for a better price.' },
    }),
    quote({
      id: 'qt_127b', number: 'QT-2026-0127', rev: 1, enquiryId: 'enq_36', customerId: 'cus_bright', siteId: 'site_bright', contactId: 'ct_29',
      kind: 'repair', title: 'Replace faulty detectors, block C', status: 'sent', createdOn: D(-8), preparedBy: 'staff_sara',
      discountPct: 8, ...brightRev1,
      kindData: { urgency: 'normal', deficiencyRef: 'DEF-2026-0203', warrantyMonths: 6, durationDays: 2 },
      approval: { required: 'manager', reasons: ['Discount above 5%'], requestedBy: 'staff_sara', requestedOn: D(-7), comment: 'Second round; the school is a long-standing customer.', decision: 'approved', decidedBy: 'staff_omar', decidedOn: D(-6), decisionNote: 'Fine.' },
      sent: { on: D(-5), to: ['ct_29', 'ct_28'], message: 'Revised quotation with a better price.' },
    }),
    quote({
      id: 'qt_131', number: 'QT-2026-0131', enquiryId: 'enq_33', customerId: 'cus_harbour', siteId: 'site_harbour', contactId: 'ct_6',
      kind: 'contract', title: 'Maintenance contract, 12 months', status: 'sent', createdOn: D(-15), preparedBy: 'staff_sara',
      ...siteAmc('site_harbour'),
      kindData: { termMonths: 12, startOn: D(10), visitsPerYear: 4, billing: 'quarterly', responseHours: 4 },
      sent: { on: D(-12), to: ['ct_6', 'ct_7'], message: 'Attached is the maintenance contract for the next 12 months.' },
    }),
    quote({
      id: 'qt_136', number: 'QT-2026-0136', enquiryId: 'enq_34', customerId: 'cus_meridian', siteId: 'site_meridian', contactId: 'ct_8',
      kind: 'project', title: 'Fire alarm panel upgrade and voice alarm, Wing B', status: 'waiting_approval', createdOn: D(-5),
      preparedBy: 'staff_sara', discountPct: 4, ...meridianB,
      kindData: { durationWeeks: 10, advancePct: 30, retentionPct: 10, cdApproval: 'contractor' },
      approval: { required: 'owner', reasons: ['Net value above AED 250,000'], requestedBy: 'staff_sara', requestedOn: D(-2), comment: 'The customer wants the price by Thursday.' },
    }),
    quote({
      id: 'qt_138', number: 'QT-2026-0138', customerId: 'cus_alnoor', siteId: 'site_marina', contactId: 'ct_5',
      kind: 'repair', title: 'Fire alarm panel batteries: replace and load test', status: 'sent', createdOn: D(-4), preparedBy: 'staff_hassan',
      ...single('Repair', [
        ['FA-BAT', 1], ['LB-TECH', 3], ['LB-CALL', 1],
        { text: 'Battery load test and written report', unit: 'lot', qty: 1, cost: 120, price: 350 },
      ]),
      kindData: { urgency: 'urgent', deficiencyRef: 'DEF-2026-0207', warrantyMonths: 6, durationDays: 1 },
      sent: { on: D(-3), to: ['ct_5'], message: 'The batteries failed the load test. Our price to replace them is attached.' },
    }),
    quote({
      id: 'qt_140', number: 'QT-2026-0140', enquiryId: 'enq_41', customerId: 'cus_green', siteId: 'site_gv1', contactId: 'ct_35',
      kind: 'contract', title: 'Maintenance contract, Al Warqa store', status: 'sent', createdOn: D(-8), preparedBy: 'staff_sara',
      ...siteAmc('site_gv1'),
      kindData: { termMonths: 12, startOn: D(15), visitsPerYear: 2, billing: 'annual', responseHours: 8 },
      sent: { on: D(-6), to: ['ct_35', 'ct_36'], message: 'Our maintenance contract for the Al Warqa store.' },
    }),
    quote({
      id: 'qt_142', number: 'QT-2026-0142', enquiryId: 'enq_39', customerId: 'cus_nexus', siteId: 'site_nexus', contactId: 'ct_40',
      kind: 'contract', title: 'Maintenance contract: clean-agent halls and fire alarm', status: 'draft', createdOn: D(-7),
      preparedBy: 'staff_sara', ...siteAmc('site_nexus'),
      kindData: { termMonths: 12, startOn: D(30), visitsPerYear: 2, billing: 'quarterly', responseHours: 2 },
    }),
    quote({
      id: 'qt_143', number: 'QT-2026-0143', customerId: 'cus_mall', siteId: 'site_mall', contactId: 'ct_31',
      kind: 'supply', title: 'Replacement extinguishers for the food court', status: 'sent', createdOn: D(-5), preparedBy: 'staff_omar',
      discountPct: 5, ...single('Items', [['FE-ABC6', 60], ['FE-CO2', 12], ['FE-WC', 10]]),
      sent: { on: D(-4), to: ['ct_31'], message: 'Our price for the replacement extinguishers.' },
    }),
    quote({
      id: 'qt_145', number: 'QT-2026-0145', customerId: 'cus_sahara', siteId: 'site_sahara1', contactId: 'ct_16',
      kind: 'repair', title: 'Replace the jockey pump set, Phase 1', status: 'approved', createdOn: D(-3), preparedBy: 'staff_sara',
      discountPct: 8,
      ...single('Repair', [
        ['PU-JP', 1], ['LB-ENG', 8], ['LB-TECH', 16],
        { text: 'Flow test and commissioning with the client\'s operations team', unit: 'lot', qty: 1, cost: 700, price: 1800 },
      ]),
      kindData: { urgency: 'urgent', deficiencyRef: 'DEF-2026-0205', warrantyMonths: 12, durationDays: 3 },
      approval: { required: 'manager', reasons: ['Discount above 5%'], requestedBy: 'staff_sara', requestedOn: D(-2), comment: 'Repeat customer; the pump has failed twice.', decision: 'approved', decidedBy: 'staff_omar', decidedOn: D(-1), decisionNote: '8% is fine for this customer.' },
    }),
    quote({
      id: 'qt_146', number: 'QT-2026-0146', customerId: 'cus_meridian', siteId: 'site_meridian', contactId: 'ct_9',
      kind: 'repair', title: 'Kitchen hood: replace fusible links and recharge two cylinders', status: 'accepted', createdOn: D(-24),
      preparedBy: 'staff_hassan',
      ...single('Repair', [
        ['KH-RCH', 2],
        { text: 'Fusible link set (4 links) and detection line check', unit: 'set', qty: 2, cost: 180, price: 360 },
        ['LB-TECH', 6], ['LB-CALLN', 1],
      ]),
      kindData: { urgency: 'urgent', deficiencyRef: 'DEF-2026-0198', warrantyMonths: 6, durationDays: 1 },
      sent: { on: D(-23), to: ['ct_9'], message: 'The hood system needs new links and recharge. Our price is attached.' },
      answer: accepted(18, 'email', 'ct_9'),
    }),
    quote({
      id: 'qt_147', number: 'QT-2026-0147', customerId: 'cus_palm', siteId: 'site_palm', contactId: 'ct_13',
      kind: 'repair', title: 'Replace two water flow switches, levels 3 and 5', status: 'draft', createdOn: D(-1), preparedBy: 'staff_sara',
      ...single('Repair', [['SP-FLOW', 2], ['LB-TECH', 5], ['LB-CALL', 1]]),
      kindData: { urgency: 'normal', deficiencyRef: 'DEF-2026-0210', warrantyMonths: 6, durationDays: 1 },
    }),
  ];

  // ---- two earlier project quotations, accepted long ago ---------------------------------
  // They became PRJ-2026-001 (emergency lighting, Gulf Meridian Staff Accommodation)
  // and PRJ-2026-003 (a fire pump set, Sharjah Plastics Factory). Their lines are made
  // last, so the ids of the lines above do not change.
  const staffLighting = fromSpec([
    ['Emergency lighting and exit signs, blocks A to F', [['EL-FIT', 140], ['EL-EXIT', 48], ['LB-INST', 188]]],
    ['Testing, documents and approvals', [['LB-TEST', 1], ['DOC-DRW', 1], ['DOC-CD', 1], ['DOC-ASB', 1]]],
  ]);
  const sharjahPump = fromSpec([
    ['Fire pump set and controller', [['PU-EL', 1], ['PU-JP', 1], ['LB-INST', 40]]],
    ['Testing, documents and approvals', [['LB-TEST', 1], ['DOC-DRW', 1], ['DOC-CD', 1], ['DOC-ASB', 1]]],
  ]);
  E.push(
    enquiry({
      id: 'enq_19', number: 'ENQ-2026-0019', customerId: 'cus_meridian', siteId: 'site_meridian_staff', contactId: 'ct_8', kind: 'project',
      title: 'Emergency lighting and exit signs, staff accommodation', source: 'referral', receivedOn: D(-292), dueOn: D(-284),
      ownerId: 'staff_sara', estValue: 62000, status: 'won',
      description: 'The old blocks have no emergency lighting; the fire authority asked for it at the last inspection.',
      survey: { needed: true, plannedOn: D(-291), assigneeId: 'staff_nadia', doneOn: D(-291), notes: 'Six blocks; 140 fittings and 48 exit signs along corridors and stairs.' },
    }),
    enquiry({
      id: 'enq_26', number: 'ENQ-2026-0026', customerId: 'cus_sharjah', siteId: 'site_sharjah', contactId: 'ct_45', kind: 'project',
      title: 'Fire pump set for the sprinkler system', source: 'phone', receivedOn: D(-84), dueOn: D(-76),
      ownerId: 'staff_layla', estValue: 125000, status: 'won',
      description: 'The sprinklers run from the town main at low pressure; the insurer asks for a pump set.',
      survey: { needed: true, plannedOn: D(-83), assigneeId: 'staff_nadia', doneOn: D(-83), notes: 'Space in the valve room is enough for an electric pump and a jockey pump.' },
    }),
  );
  Q.push(
    quote({
      id: 'qt_088', number: 'QT-2026-0088', enquiryId: 'enq_19', customerId: 'cus_meridian', siteId: 'site_meridian_staff', contactId: 'ct_8',
      kind: 'project', title: 'Emergency lighting and exit signs, staff accommodation', status: 'accepted', createdOn: D(-290),
      preparedBy: 'staff_sara', ...staffLighting,
      kindData: { durationWeeks: 6, advancePct: 30, retentionPct: 5, cdApproval: 'contractor' },
      approval: { required: 'manager', reasons: ['Net value above AED 50,000'], requestedBy: 'staff_sara', requestedOn: D(-289), comment: '', decision: 'approved', decidedBy: 'staff_omar', decidedOn: D(-288), decisionNote: 'Approved.' },
      sent: { on: D(-286), to: ['ct_8'], message: 'Please find our quotation for the emergency lighting of the staff accommodation.' },
      answer: accepted(268, 'lpo', 'ct_8', 'GM/LPO/2209'),
    }),
    quote({
      id: 'qt_112', number: 'QT-2026-0112', enquiryId: 'enq_26', customerId: 'cus_sharjah', siteId: 'site_sharjah', contactId: 'ct_45',
      kind: 'project', title: 'Fire pump set for the sprinkler system', status: 'accepted', createdOn: D(-80),
      preparedBy: 'staff_layla', ...sharjahPump,
      kindData: { durationWeeks: 8, advancePct: 30, retentionPct: 5, cdApproval: 'contractor' },
      approval: { required: 'manager', reasons: ['Net value above AED 50,000'], requestedBy: 'staff_layla', requestedOn: D(-80), comment: '', decision: 'approved', decidedBy: 'staff_layla', decidedOn: D(-80), decisionNote: 'The owner prepared it and holds the authority.' },
      sent: { on: D(-76), to: ['ct_45'], message: 'Our quotation for the fire pump set.' },
      answer: accepted(60, 'signed', 'ct_45'),
    }),
  );

  // ---- older work that was lost ------------------------------------------------------------
  // Four losses, with their reasons, so the win rate is not 100% and the Sales report has something
  // to explain. They fill gaps in the numbering and are made after everything above, so no id shifts.
  E.push(
    enquiry({
      id: 'enq_21', number: 'ENQ-2026-0021', customerId: 'cus_palm', siteId: 'site_palm', contactId: 'ct_13', kind: 'project',
      title: 'Sprinkler extension, new outpatient wing', source: 'referral', receivedOn: D(-236), dueOn: D(-224),
      ownerId: 'staff_layla', estValue: 90000, status: 'lost', closedOn: D(-205),
      lostReason: 'Project cancelled or postponed', lostNote: 'The hospital board postponed the outpatient wing to next year.',
      survey: { needed: true, plannedOn: D(-232), assigneeId: 'staff_nadia', doneOn: D(-232), notes: 'The wing is still in design; the drawings are not final.' },
    }),
    enquiry({
      id: 'enq_23', number: 'ENQ-2026-0023', customerId: 'cus_khalid', siteId: 'site_khalid', contactId: 'ct_33', kind: 'repair',
      title: 'Kitchen hood: recharge and re-test the detection line', source: 'phone', receivedOn: D(-190), dueOn: D(-186),
      ownerId: 'staff_sara', estValue: 2500, status: 'lost', closedOn: D(-158),
      lostReason: 'Price too high', lostNote: 'The owner asked for a lower price, then used a cheaper technician.',
    }),
    enquiry({
      id: 'enq_24', number: 'ENQ-2026-0024', customerId: 'cus_mall', siteId: 'site_mall', contactId: 'ct_30', kind: 'supply',
      title: 'Fire blankets and CO₂ extinguishers for the tenants\' kitchens', source: 'email', receivedOn: D(-165), dueOn: D(-160),
      ownerId: 'staff_omar', estValue: 10000, status: 'lost', closedOn: D(-140),
      lostReason: 'Chose a competitor', lostNote: 'The mall management renewed with its usual supplier.',
    }),
    enquiry({
      id: 'enq_27', number: 'ENQ-2026-0027', customerId: 'cus_sahara', siteId: 'site_sahara1', contactId: 'ct_16', kind: 'project',
      title: 'Fire alarm for the warehouse annex', source: 'email', receivedOn: D(-104), dueOn: D(-96),
      ownerId: 'staff_sara', estValue: 75000, status: 'lost', closedOn: D(-72),
      lostReason: 'Scope changed', lostNote: 'The client redesigned the annex and will ask again.',
      survey: { needed: true, plannedOn: D(-100), assigneeId: 'staff_nadia', doneOn: D(-100), notes: 'A steel-frame annex of 1,200 m²; the layout is not final.' },
    }),
  );
  Q.push(
    quote({
      id: 'qt_095', number: 'QT-2026-0095', enquiryId: 'enq_23', customerId: 'cus_khalid', siteId: 'site_khalid', contactId: 'ct_33',
      kind: 'repair', title: 'Kitchen hood: recharge and re-test the detection line', status: 'rejected', createdOn: D(-188), preparedBy: 'staff_sara',
      ...single('Repair', [['KH-RCH', 2], ['LB-TECH', 8], ['LB-CALLN', 1]]),
      sent: { on: D(-187), to: ['ct_33'], message: 'Our price to recharge the hood cylinders and test the detection line.' },
      answer: { result: 'rejected', on: D(-158), via: 'phone', reference: '', byContactId: 'ct_33', byName: '', reason: 'Price too high', note: 'The owner asked for a lower price, then used a cheaper technician.' },
    }),
    quote({
      id: 'qt_098', number: 'QT-2026-0098', enquiryId: 'enq_24', customerId: 'cus_mall', siteId: 'site_mall', contactId: 'ct_30',
      kind: 'supply', title: 'Fire blankets and CO₂ extinguishers for the tenants\' kitchens', status: 'rejected', createdOn: D(-163), preparedBy: 'staff_omar',
      ...single('Items', [['FE-CO2', 20], ['FE-BLK', 30]]),
      sent: { on: D(-162), to: ['ct_30'], message: 'Our price for the kitchens of the tenants.' },
      answer: { result: 'rejected', on: D(-140), via: 'phone', reference: '', byContactId: 'ct_30', byName: '', reason: 'Chose a competitor', note: 'The mall management renewed with its usual supplier.' },
    }),
    quote({
      id: 'qt_109', number: 'QT-2026-0109', enquiryId: 'enq_27', customerId: 'cus_sahara', siteId: 'site_sahara1', contactId: 'ct_16',
      kind: 'project', title: 'Fire alarm for the warehouse annex', status: 'rejected', createdOn: D(-97), preparedBy: 'staff_sara',
      ...single('Fire alarm, warehouse annex', [
        ['FA-PNL-2L', 1], ['FA-SD', 90], ['FA-MCP', 12], ['FA-SND', 20], ['FA-CBL', 3200], ['LB-INST', 160],
        ['LB-TEST', 1], ['DOC-DRW', 1], ['DOC-CD', 1], ['DOC-ASB', 1],
      ]),
      kindData: { durationWeeks: 8, advancePct: 30, retentionPct: 5, cdApproval: 'contractor' },
      approval: { required: 'manager', reasons: ['Net value above AED 50,000'], requestedBy: 'staff_sara', requestedOn: D(-96), comment: '', decision: 'approved', decidedBy: 'staff_omar', decidedOn: D(-96), decisionNote: 'Approved.' },
      sent: { on: D(-95), to: ['ct_16'], message: 'Our quotation for the fire alarm of the warehouse annex.' },
      answer: { result: 'rejected', on: D(-72), via: 'email', reference: '', byContactId: 'ct_16', byName: '', reason: 'Scope changed', note: 'The client redesigned the annex and will ask again.' },
    }),
  );

  // ---- what happened, for the activity lists ------------------------------------------
  const ev = (entity, entityId, by, daysAgo, text) => ({ entity, entityId, by, daysAgo, text });
  const events = [
    ev('enquiry', 'enq_28', 'staff_sara', 128, 'Enquiry registered (tender invitation)'),
    ev('enquiry', 'enq_28', 'staff_nadia', 124, 'Site survey done'),
    ev('enquiry', 'enq_28', 'staff_layla', 96, 'Won: the customer\'s order was received'),
    ev('quotation', 'qt_102', 'staff_sara', 118, 'Quotation created (project)'),
    ev('quotation', 'qt_102', 'staff_sara', 117, 'Sent for approval to the owner'),
    ev('quotation', 'qt_102', 'staff_layla', 115, 'Approved'),
    ev('quotation', 'qt_102', 'staff_sara', 112, 'Sent to the customer'),
    ev('quotation', 'qt_102', 'staff_sara', 96, 'Accepted by the customer (customer order ZC/LPO/4471)'),
    ev('customer', 'cus_zenith', 'staff_sara', 96, 'Quotation QT-2026-0102 accepted'),
    ev('quotation', 'qt_119', 'staff_omar', 68, 'Quotation created (contract)'),
    ev('quotation', 'qt_119', 'staff_omar', 64, 'Sent to the customer'),
    ev('quotation', 'qt_119', 'staff_omar', 52, 'Accepted by the customer (signed quotation)'),
    ev('customer', 'cus_mall', 'staff_omar', 52, 'Quotation QT-2026-0119 accepted'),
    ev('quotation', 'qt_127a', 'staff_sara', 30, 'Rejected by the customer: price too high'),
    ev('quotation', 'qt_127b', 'staff_sara', 8, 'Revision 1 created from revision 0'),
    ev('quotation', 'qt_127b', 'staff_omar', 6, 'Approved (discount above 5%)'),
    ev('quotation', 'qt_127b', 'staff_sara', 5, 'Sent to the customer'),
    ev('quotation', 'qt_131', 'staff_sara', 12, 'Sent to the customer'),
    ev('quotation', 'qt_136', 'staff_sara', 5, 'Quotation created (project)'),
    ev('quotation', 'qt_136', 'staff_sara', 2, 'Sent for approval to the owner'),
    ev('enquiry', 'enq_34', 'staff_nadia', 14, 'Site survey done'),
    ev('enquiry', 'enq_35', 'staff_sara', 6, 'Enquiry registered (tender invitation)'),
    ev('enquiry', 'enq_35', 'staff_sara', 5, 'Site survey planned'),
    ev('quotation', 'qt_138', 'staff_hassan', 3, 'Sent to the customer'),
    ev('quotation', 'qt_145', 'staff_omar', 1, 'Approved (discount above 5%)'),
    ev('quotation', 'qt_146', 'staff_hassan', 18, 'Accepted by the customer (e-mail)'),
    ev('enquiry', 'enq_40', 'staff_sara', 40, 'Lost: chose a competitor'),
    ev('customer', 'cus_crescent', 'staff_sara', 40, 'Enquiry ENQ-2026-0040 lost: chose a competitor'),
    ev('enquiry', 'enq_19', 'staff_sara', 292, 'Enquiry registered (referral)'),
    ev('enquiry', 'enq_19', 'staff_layla', 268, 'Won: the customer\'s order was received'),
    ev('quotation', 'qt_088', 'staff_sara', 290, 'Quotation created (project)'),
    ev('quotation', 'qt_088', 'staff_omar', 288, 'Approved'),
    ev('quotation', 'qt_088', 'staff_sara', 268, 'Accepted by the customer (customer order GM/LPO/2209)'),
    ev('enquiry', 'enq_26', 'staff_layla', 84, 'Enquiry registered (phone)'),
    ev('enquiry', 'enq_26', 'staff_layla', 60, 'Won: the customer signed the quotation'),
    ev('quotation', 'qt_112', 'staff_layla', 80, 'Quotation created (project)'),
    ev('quotation', 'qt_112', 'staff_layla', 60, 'Accepted by the customer (signed quotation)'),
    ev('enquiry', 'enq_21', 'staff_layla', 205, 'Lost: project cancelled or postponed'),
    ev('customer', 'cus_palm', 'staff_layla', 205, 'Enquiry ENQ-2026-0021 lost: project cancelled or postponed'),
    ev('quotation', 'qt_095', 'staff_sara', 158, 'Rejected by the customer: price too high'),
    ev('enquiry', 'enq_23', 'staff_sara', 158, 'Lost: price too high'),
    ev('customer', 'cus_khalid', 'staff_sara', 158, 'Enquiry ENQ-2026-0023 lost: price too high'),
    ev('quotation', 'qt_098', 'staff_omar', 140, 'Rejected by the customer: chose a competitor'),
    ev('enquiry', 'enq_24', 'staff_omar', 140, 'Lost: chose a competitor'),
    ev('customer', 'cus_mall', 'staff_omar', 140, 'Enquiry ENQ-2026-0024 lost: chose a competitor'),
    ev('quotation', 'qt_109', 'staff_sara', 72, 'Rejected by the customer: scope changed'),
    ev('enquiry', 'enq_27', 'staff_sara', 72, 'Lost: scope changed'),
    ev('customer', 'cus_sahara', 'staff_sara', 72, 'Enquiry ENQ-2026-0027 lost: scope changed'),
  ];

  return {
    enquiries: Object.fromEntries(E.map((e) => [e.id, e])),
    quotations: Object.fromEntries(Q.map((q) => [q.id, q])),
    events,
    counters: { enquiry: 41, quotation: 147 },
  };
}
