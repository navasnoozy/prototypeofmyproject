import { addDays } from '../../lib/dates.js';
import { advanceTotal, certifiedFigures, claimFigures, dlpEnd, emptyHandover, lastNet, originalValue, packagesFromQuotation, testsFromPackages } from '../projectRules.js';

// Three projects of the sample company, in three different states, and the
// days people are not available. Dates are relative to today.
//   PRJ-2026-001  emergency lighting, Gulf Meridian Staff Accommodation: handed
//                 over 112 days ago, in its defects liability period (the
//                 retention is still held; the maintenance contract AMC-2026-0006
//                 followed the handover)
//   PRJ-2026-002  the fire fighting and fire alarm package of Zenith's Tower B:
//                 in installation, 35% done, with claims, variations, an
//                 over-budget package, and site work on the planning board
//   PRJ-2026-003  a fire pump set for Sharjah Plastics: tested, waiting for the
//                 Civil Defence certificate and two snags before the handover
//                 (the handover creates the pump set in the equipment register)
// Past claims carry invoice numbers INV-2026-0401 and up: Billing (step 7) must
// create those documents. The materials of a project are not written here: they
// come from its purchase orders and from the stock issued to it (data/seed/
// purchasing.js); only labour, subcontracts and other costs are written by hand.

export function buildProjects(T, { quotations, items, systems }) {
  const D = (n) => addDays(T, n);
  let seq = 0;
  const nid = (prefix) => `${prefix}_p${++seq}`;
  const pkgProgress = (p, list) => Object.fromEntries(p.packages.map((x, i) => [x.id, list[i] ?? 0]));

  const base = (o) => ({
    onHold: false, holdReason: '', supervisorId: '', dlpMonths: 12, cdApproval: 'contractor',
    variations: [], claims: [], costs: [], tasks: [], documents: [], tests: [], snags: [], handover: emptyHandover(), notes: '',
    ...o,
  });
  const cost = (pkg, o) => ({ id: nid('cst'), packageId: pkg.id, kind: o.kind, description: o.text, ref: o.ref ?? '', amount: o.amount, state: o.state ?? 'incurred', on: o.on });
  const task = (pkg, o) => ({ id: nid('tsk'), packageId: pkg.id, title: o.title, status: o.status ?? 'todo', plannedOn: o.on ?? '', days: o.days ?? 1, window: o.window ?? 'all_day', assigneeIds: o.by ?? [] });
  const doc = (kind, title, o = {}) => ({ id: nid('doc'), kind, title, ref: '', rev: '', status: 'planned', on: '', ...o });
  const test = (pkg, type, title, o = {}) => ({ id: nid('tst'), packageId: pkg.id, systemType: type, title, result: '', on: '', by: '', note: '', ...o });

  // A claim, worked out with the rules of the application. `value` is the
  // contract value the claim was worked out against; `certified` is the gross
  // that the customer's engineer certified (default: what was claimed).
  const claim = (p, o) => {
    const isProgress = o.kind === 'progress';
    const previous = isProgress ? lastNet(p) : 0;
    const f = isProgress ? claimFigures(p, o.progress, previous, o.value) : { gross: 0, retention: 0, advance: 0, net: 0, amount: o.amount, value: o.value };
    const c = {
      id: nid('clm'), n: p.claims.length + 1, kind: o.kind, status: o.status, periodEnd: o.periodEnd ?? '', progress: o.progress ?? {},
      ...f, submittedOn: o.submittedOn ?? '', certifiedOn: o.certifiedOn ?? '', invoiceRef: o.invoiceRef ?? '', paidOn: o.paidOn ?? '', note: o.note ?? '',
    };
    if (isProgress && ['certified', 'invoiced', 'paid'].includes(o.status)) {
      c.certifiedGross = o.certified ?? f.gross;
      const cf = certifiedFigures(p, c, previous);
      Object.assign(c, { certRetention: cf.retention, certNet: cf.net, certAmount: cf.amount });
    } else if (!isProgress && ['certified', 'invoiced', 'paid'].includes(o.status)) {
      c.certAmount = o.amount;
    }
    p.claims.push(c);
    return c;
  };

  // =====================================================================================
  // PRJ-2026-002: Zenith, Creek Harbour Tower B (installation, 35% done)
  // =====================================================================================
  const q2 = quotations.qt_102;
  const p2 = base({
    id: 'prj_2', number: 'PRJ-2026-002', title: 'Fire fighting and fire alarm package, Tower B', customerId: 'cus_zenith', siteId: 'site_creek',
    contactId: 'ct_21', quotationId: 'qt_102', engineerId: 'staff_nadia', supervisorId: 'staff_rashid', lpo: 'ZC/LPO/4471',
    awardedOn: D(-96), startOn: D(-85), endOn: D(-85 + 40 * 7 + 5), durationWeeks: 40, advancePct: 30, retentionPct: 10,
    phase: 'installation', createdOn: D(-96),
    packages: packagesFromQuotation(q2, items, nid),
  });
  const [fa2, sp2, pu2, td2] = p2.packages;
  [35, 40, 20, 30].forEach((pct, i) => { p2.packages[i].progress = pct; });
  const vo1 = { id: 'var_p1', number: 'VO-001', title: 'Smoke control interface modules, levels 30 to 44', reason: 'The consultant added the smoke control dampers of levels 30 to 44 to the fire alarm interface (instruction CI-118).', value: 38500, cost: 22600, days: 5, status: 'approved', raisedOn: D(-55), submittedOn: D(-53), decidedOn: D(-42), ref: 'ZC/VO/0041' };
  const vo2 = { id: 'var_p2', number: 'VO-002', title: 'Move two hose reel cabinets, levels 12 and 13', reason: 'The architect moved two walls; the cabinets must be re-piped and moved.', value: 12400, cost: 7800, days: 2, status: 'submitted', raisedOn: D(-8), submittedOn: D(-6), decidedOn: '', ref: '' };
  const vo3 = { id: 'var_p3', number: 'VO-003', title: 'Extra detectors in the basement car park', reason: 'The consultant asked for extra detectors that the customer could add to the scope.', value: 15200, cost: 9100, days: 3, status: 'rejected', raisedOn: D(-32), submittedOn: D(-30), decidedOn: D(-18), ref: 'ZC/VO/0044', note: 'The customer says the detectors are part of the original scope.' };
  p2.variations = [vo1, vo2, vo3];
  const voPkg = { id: nid('pkg'), kind: 'variation', variationId: vo1.id, title: 'VO-001: Smoke control interface modules, levels 30 to 44', docs: false, value: vo1.value, cost: vo1.cost, progress: 25, types: [] };
  p2.packages.push(voPkg);

  const ORIG2 = originalValue(p2);
  claim(p2, { kind: 'advance', status: 'paid', amount: advanceTotal(p2), value: ORIG2, submittedOn: D(-94), certifiedOn: D(-93), invoiceRef: 'INV-2026-0401', paidOn: D(-80) });
  claim(p2, { kind: 'progress', status: 'paid', periodEnd: D(-62), progress: pkgProgress(p2, [10, 10, 0, 25, 0]), value: ORIG2, submittedOn: D(-60), certifiedOn: D(-52), invoiceRef: 'INV-2026-0410', paidOn: D(-38) });
  claim(p2, { kind: 'progress', status: 'invoiced', periodEnd: D(-32), progress: pkgProgress(p2, [22, 25, 5, 30, 0]), value: ORIG2 + vo1.value, submittedOn: D(-30), certifiedOn: D(-20), certified: 285000, invoiceRef: 'INV-2026-0416', note: 'The engineer certified less: the cable pulling of levels 19 to 22 was not accepted yet.' });
  // The claim of this month is a draft: it follows the progress of the packages.
  p2.claims.push({ id: nid('clm'), n: p2.claims.length + 1, kind: 'progress', status: 'draft', periodEnd: D(1), progress: {}, submittedOn: '', certifiedOn: '', invoiceRef: '', paidOn: '', note: '' });

  p2.costs = [
    cost(fa2, { kind: 'labour', text: 'Installation labour, time sheets to date', amount: 27400, on: D(-3) }),
    cost(sp2, { kind: 'subcontract', text: 'Off-site pipe fabrication', ref: 'SUB-014', amount: 62000, on: D(-35) }),
    cost(sp2, { kind: 'labour', text: 'Installation labour, time sheets to date', amount: 46200, on: D(-3) }),
    cost(pu2, { kind: 'labour', text: 'Pump base works', amount: 6400, on: D(-24) }),
    cost(pu2, { kind: 'other', text: 'Crane hire for the pump bases', amount: 3500, on: D(-27) }),
    cost(td2, { kind: 'labour', text: 'Drawings and approvals, engineer time', amount: 3900, on: D(-45) }),
    cost(td2, { kind: 'other', text: 'Printing and approval fees', amount: 700, on: D(-58) }),
    cost(voPkg, { kind: 'labour', text: 'Engineering of the interface', amount: 2200, on: D(-28) }),
  ];

  p2.tasks = [
    task(fa2, { title: 'Cable trays and conduits, levels 1 to 22', status: 'done', on: D(-62), days: 12, by: ['staff_imran', 'staff_rashid'] }),
    task(fa2, { title: 'Cable pulling, levels 1 to 22', status: 'in_progress', on: D(-1), days: 5, window: 'afternoon', by: ['staff_imran'] }),
    task(fa2, { title: 'Detectors and devices, levels 1 to 15', status: 'planned', on: D(6), days: 5, by: ['staff_imran', 'staff_rashid'] }),
    task(fa2, { title: 'Panel installation in the control room' }),
    task(fa2, { title: 'Loop tests, levels 1 to 15' }),
    task(sp2, { title: 'Risers and main headers', status: 'done', on: D(-70), days: 10, by: ['staff_joseph', 'staff_rashid'] }),
    task(sp2, { title: 'Pipework, levels 1 to 18', status: 'planned', on: D(3), days: 8, by: ['staff_joseph'] }),
    task(sp2, { title: 'Pipework, levels 19 to 44' }),
    task(sp2, { title: 'Sprinkler heads, levels 1 to 18', status: 'planned', on: D(15), days: 8, by: ['staff_joseph', 'staff_imran'] }),
    task(pu2, { title: 'Pump bases and foundations', status: 'done', on: D(-30), days: 6, by: ['staff_rashid'] }),
    task(pu2, { title: 'Pump delivery and positioning', status: 'planned', on: D(20), days: 3, by: ['staff_rashid', 'staff_joseph'] }),
    task(pu2, { title: 'Pump piping and controller' }),
    task(td2, { title: 'As-built drawings' }),
    task(voPkg, { title: 'Smoke control interface modules, levels 30 to 44' }),
  ];

  p2.documents = [
    doc('method', 'Method statement and risk assessment', { rev: 'A', status: 'approved', on: D(-88) }),
    doc('drawings', 'Fire alarm shop drawings', { rev: 'B', status: 'approved', on: D(-70) }),
    doc('drawings', 'Sprinkler and hydrant shop drawings', { rev: 'C', status: 'approved', on: D(-64) }),
    doc('calcs', 'Sprinkler hydraulic calculations', { rev: 'A', status: 'approved', on: D(-64) }),
    doc('cd_drawings', 'Civil Defence approval of the fire fighting drawings', { ref: 'CD-DR-22841', status: 'approved', on: D(-58) }),
    doc('submittal', 'Fire pump set submittal', { rev: 'A', status: 'approved', on: D(-50) }),
    doc('submittal', 'Sprinkler heads and valves data sheets', { rev: 'A', status: 'rejected', on: D(-20) }),
    doc('submittal', 'Fire alarm devices data sheets', { rev: 'A', status: 'submitted', on: D(-8) }),
    doc('test_report', 'Test reports', {}),
    doc('asbuilt', 'As-built drawings', {}),
    doc('om', 'Operation and maintenance manuals', {}),
    doc('warranty', 'Warranty certificates', {}),
  ];
  p2.tests = testsFromPackages(p2.packages, nid);

  // =====================================================================================
  // PRJ-2026-001: Gulf Meridian Staff Accommodation, emergency lighting (defects liability)
  // =====================================================================================
  const q1 = quotations.qt_088;
  const p1 = base({
    id: 'prj_1', number: 'PRJ-2026-001', title: 'Emergency lighting and exit signs, staff accommodation', customerId: 'cus_meridian', siteId: 'site_meridian_staff',
    contactId: 'ct_8', quotationId: 'qt_088', engineerId: 'staff_nadia', supervisorId: 'staff_imran', lpo: 'GM/LPO/2209',
    awardedOn: D(-268), startOn: D(-250), endOn: D(-205), durationWeeks: 6, advancePct: 30, retentionPct: 5, dlpMonths: 12,
    phase: 'retention', createdOn: D(-268), packages: packagesFromQuotation(q1, items, nid),
  });
  const [el1, td1] = p1.packages;
  p1.packages.forEach((x) => { x.progress = 100; });
  const voA = { id: 'var_p4', number: 'VO-001', title: 'Extra exit signs in the laundry block', reason: 'The customer added a laundry block to the walk-through of the first inspection.', value: 4200, cost: 2300, days: 3, status: 'approved', raisedOn: D(-215), submittedOn: D(-214), decidedOn: D(-208), ref: 'GM/VO/017' };
  p1.variations = [voA];
  const voAPkg = { id: nid('pkg'), kind: 'variation', variationId: voA.id, title: 'VO-001: Extra exit signs in the laundry block', docs: false, value: voA.value, cost: voA.cost, progress: 100, types: [] };
  p1.packages.push(voAPkg);
  const ORIG1 = originalValue(p1);
  claim(p1, { kind: 'advance', status: 'paid', amount: advanceTotal(p1), value: ORIG1, submittedOn: D(-266), certifiedOn: D(-265), invoiceRef: 'INV-2026-0402', paidOn: D(-250) });
  claim(p1, { kind: 'progress', status: 'paid', periodEnd: D(-215), progress: pkgProgress(p1, [55, 0, 0]), value: ORIG1, submittedOn: D(-213), certifiedOn: D(-205), invoiceRef: 'INV-2026-0403', paidOn: D(-190) });
  claim(p1, { kind: 'progress', status: 'paid', periodEnd: D(-112), progress: pkgProgress(p1, [100, 100, 100]), value: ORIG1 + voA.value, submittedOn: D(-111), certifiedOn: D(-104), invoiceRef: 'INV-2026-0404', paidOn: D(-88) });
  p1.costs = [
    cost(el1, { kind: 'labour', text: 'Installation labour', amount: 9800, on: D(-150) }),
    cost(td1, { kind: 'labour', text: 'Drawings, tests and documents', amount: 4900, on: D(-118) }),
    cost(voAPkg, { kind: 'labour', text: 'Installation labour', amount: 600, on: D(-205) }),
  ];
  p1.tasks = [
    task(el1, { title: 'Corridors and stairs, blocks A to C', status: 'done', on: D(-238), days: 15, by: ['staff_imran', 'staff_joseph'] }),
    task(el1, { title: 'Corridors and stairs, blocks D to F', status: 'done', on: D(-215), days: 15, by: ['staff_imran', 'staff_joseph'] }),
    task(voAPkg, { title: 'Exit signs of the laundry block', status: 'done', on: D(-207), days: 2, by: ['staff_imran'] }),
  ];
  p1.documents = [
    doc('method', 'Method statement and risk assessment', { rev: 'A', status: 'approved', on: D(-262) }),
    doc('drawings', 'Emergency lighting shop drawings', { rev: 'A', status: 'approved', on: D(-255) }),
    doc('calcs', 'Design calculations', { rev: 'A', status: 'approved', on: D(-255) }),
    doc('cd_drawings', 'Civil Defence approval of the drawings', { ref: 'CD-DR-19804', status: 'approved', on: D(-246) }),
    doc('submittal', 'Fittings and exit signs data sheets', { rev: 'A', status: 'approved', on: D(-252) }),
    doc('test_report', 'Test reports', { status: 'issued', on: D(-118) }),
    doc('asbuilt', 'As-built drawings', { rev: 'A', status: 'issued', on: D(-113) }),
    doc('om', 'Operation and maintenance manuals', { status: 'issued', on: D(-113) }),
    doc('warranty', 'Warranty certificates', { status: 'issued', on: D(-112) }),
  ];
  p1.tests = testsFromPackages(p1.packages, nid).map((t) => ({ ...t, result: 'pass', on: D(-122), by: 'staff_nadia' }));
  p1.snags = [
    { id: nid('snag'), title: 'Two fittings in block B stair do not light on mains failure', location: 'Block B, stair 2', status: 'closed', raisedOn: D(-124), closedOn: D(-121) },
    { id: nid('snag'), title: 'Exit sign above the kitchen door faces the wrong way', location: 'Block D, ground floor', status: 'closed', raisedOn: D(-124), closedOn: D(-120) },
    { id: nid('snag'), title: 'Label of the test key switch missing', location: 'Block A, electrical room', status: 'closed', raisedOn: D(-123), closedOn: D(-119) },
  ];
  const elSystem = Object.values(systems).find((x) => x.siteId === 'site_meridian_staff' && x.type === 'emergency_lighting');
  p1.handover = {
    ...emptyHandover(), cdRequestedOn: D(-125), cdCertificate: { ref: 'CD-COC-31872', on: D(-114) }, handedOverOn: D(-112),
    receivedBy: 'Bashir Ahmed', receivedRole: 'Camp boss', systemIds: elSystem ? [elSystem.id] : [], dlpEnd: dlpEnd(D(-112), 12),
    contractId: 'con_4',
  };

  // =====================================================================================
  // PRJ-2026-003: Sharjah Plastics, fire pump set (handover, waiting for the authority)
  // =====================================================================================
  const q3 = quotations.qt_112;
  const p3 = base({
    id: 'prj_3', number: 'PRJ-2026-003', title: 'Fire pump set for the sprinkler system', customerId: 'cus_sharjah', siteId: 'site_sharjah',
    contactId: 'ct_45', quotationId: 'qt_112', engineerId: 'staff_nadia', supervisorId: 'staff_joseph', lpo: 'SPF/PO/7710',
    awardedOn: D(-60), startOn: D(-52), endOn: D(4), durationWeeks: 8, advancePct: 30, retentionPct: 5, dlpMonths: 12,
    phase: 'handover', createdOn: D(-60), packages: packagesFromQuotation(q3, items, nid),
  });
  const [pp3, td3] = p3.packages;
  pp3.progress = 100;
  td3.progress = 80;
  const ORIG3 = originalValue(p3);
  claim(p3, { kind: 'advance', status: 'paid', amount: advanceTotal(p3), value: ORIG3, submittedOn: D(-58), certifiedOn: D(-57), invoiceRef: 'INV-2026-0405', paidOn: D(-44) });
  claim(p3, { kind: 'progress', status: 'paid', periodEnd: D(-20), progress: pkgProgress(p3, [70, 40]), value: ORIG3, submittedOn: D(-18), certifiedOn: D(-11), invoiceRef: 'INV-2026-0406', paidOn: D(-3) });
  claim(p3, { kind: 'progress', status: 'submitted', periodEnd: D(-3), progress: pkgProgress(p3, [100, 80]), value: ORIG3, submittedOn: D(-3) });
  p3.costs = [
    cost(pp3, { kind: 'labour', text: 'Installation labour', amount: 5200, on: D(-14) }),
    cost(pp3, { kind: 'other', text: 'Crane and rigging', amount: 1800, on: D(-30) }),
    cost(td3, { kind: 'labour', text: 'Drawings, tests and documents', amount: 4900, on: D(-8) }),
  ];
  p3.tasks = [
    task(pp3, { title: 'Pump base and valve room preparation', status: 'done', on: D(-46), days: 4, by: ['staff_joseph', 'staff_rashid'] }),
    task(pp3, { title: 'Pump set delivery and positioning', status: 'done', on: D(-30), days: 2, by: ['staff_joseph', 'staff_rashid'] }),
    task(pp3, { title: 'Pump piping, controller and tests', status: 'done', on: D(-24), days: 8, by: ['staff_joseph', 'staff_imran'] }),
  ];
  p3.documents = [
    doc('method', 'Method statement and risk assessment', { rev: 'A', status: 'approved', on: D(-56) }),
    doc('drawings', 'Pump room shop drawings', { rev: 'B', status: 'approved', on: D(-50) }),
    doc('calcs', 'Pump and pipe calculations', { rev: 'A', status: 'approved', on: D(-50) }),
    doc('cd_drawings', 'Civil Defence approval of the drawings', { ref: 'SCD-DR-8873', status: 'approved', on: D(-47) }),
    doc('submittal', 'Fire pump set submittal', { rev: 'A', status: 'approved', on: D(-49) }),
    doc('test_report', 'Test reports', { status: 'draft', on: D(-8) }),
    doc('asbuilt', 'As-built drawings', { rev: 'A', status: 'draft', on: D(-5) }),
    doc('om', 'Operation and maintenance manuals', { status: 'draft', on: D(-5) }),
    doc('warranty', 'Warranty certificates', {}),
  ];
  p3.tests = testsFromPackages(p3.packages, nid).map((t) => ({ ...t, result: 'pass', on: D(-9), by: 'staff_nadia' }));
  p3.snags = [
    { id: nid('snag'), title: 'Label of the pump controller isolator is missing', location: 'Valve room', status: 'open', raisedOn: D(-8), closedOn: '' },
    { id: nid('snag'), title: 'Valve room door does not close on the new pipe support', location: 'Valve room', status: 'open', raisedOn: D(-7), closedOn: '' },
    { id: nid('snag'), title: 'Drain of the test header leaks', location: 'Valve room', status: 'closed', raisedOn: D(-9), closedOn: D(-6) },
  ];
  p3.handover = { ...emptyHandover(), cdRequestedOn: D(-4) };

  // =====================================================================================
  const projects = { prj_1: p1, prj_2: p2, prj_3: p3 };
  const absences = {
    abs_1: { id: 'abs_1', staffId: 'staff_rashid', from: D(8), to: D(8), kind: 'training', note: 'NFPA 25 refresher course' },
    abs_2: { id: 'abs_2', staffId: 'staff_joseph', from: D(16), to: D(17), kind: 'leave', note: '' },
    abs_3: { id: 'abs_3', staffId: 'staff_nadia', from: D(-3), to: D(-2), kind: 'leave', note: '' },
  };
  const followUps = {
    qt_088: { type: 'project', id: 'prj_1', number: 'PRJ-2026-001' },
    qt_102: { type: 'project', id: 'prj_2', number: 'PRJ-2026-002' },
    qt_112: { type: 'project', id: 'prj_3', number: 'PRJ-2026-003' },
  };
  const ev = (entity, entityId, by, daysAgo, text) => ({ entity, entityId, by, daysAgo, text });
  const events = [
    ev('project', 'prj_2', 'staff_nadia', 96, 'Project created from the accepted quotation QT-2026-0102'),
    ev('project', 'prj_2', 'staff_priya', 80, 'Advance claim paid'),
    ev('project', 'prj_2', 'staff_nadia', 58, 'Civil Defence approved the fire fighting drawings (CD-DR-22841)'),
    ev('project', 'prj_2', 'staff_nadia', 55, 'Installation started'),
    ev('project', 'prj_2', 'staff_nadia', 42, 'VO-001 approved by the customer: +AED 38,500'),
    ev('project', 'prj_2', 'staff_nadia', 18, 'VO-003 rejected by the customer'),
    ev('project', 'prj_2', 'staff_nadia', 6, 'VO-002 submitted to the customer'),
    ev('customer', 'cus_zenith', 'staff_nadia', 96, 'Project PRJ-2026-002 started'),
    ev('site', 'site_creek', 'staff_nadia', 96, 'Project PRJ-2026-002 started'),
    ev('project', 'prj_1', 'staff_nadia', 268, 'Project created from the accepted quotation QT-2026-0088'),
    ev('project', 'prj_1', 'staff_nadia', 114, 'Civil Defence completion certificate CD-COC-31872 recorded'),
    ev('project', 'prj_1', 'staff_nadia', 112, 'Handed over to the customer: 1 system added to the register, defects liability period started'),
    ev('site', 'site_meridian_staff', 'staff_nadia', 112, 'Emergency lighting added to the register at handover of PRJ-2026-001'),
    ev('customer', 'cus_meridian', 'staff_nadia', 268, 'Project PRJ-2026-001 started'),
    ev('project', 'prj_3', 'staff_layla', 60, 'Project created from the accepted quotation QT-2026-0112'),
    ev('project', 'prj_3', 'staff_nadia', 9, 'Testing completed: all tests passed'),
    ev('project', 'prj_3', 'staff_nadia', 4, 'Civil Defence inspection requested'),
    ev('customer', 'cus_sharjah', 'staff_layla', 60, 'Project PRJ-2026-003 started'),
  ];
  return { projects, absences, followUps, events, counters: { project: 3, absence: 3 } };
}
