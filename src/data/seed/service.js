import { addDays, addMonths } from '../../lib/dates.js';
import { round2 } from '../../lib/format.js';
import { amcSections } from '../amc.js';
import { SYSTEM_TYPES } from '../catalog.js';
import { REQUIREMENT } from '../serviceKinds.js';
import { billingDates, contractEnd, dueGroups, visitDates } from '../serviceRules.js';

// Contracts, jobs, deficiencies, certificates and the monthly returns of the
// sample company. Dates are relative to today. Every visit that is "completed"
// here is applied to the equipment register with the same rule the application
// uses when a technician completes a visit, so the due dates of the register
// and the history of the jobs never contradict each other.

const netOf = (q) => {
  const sub = q.lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  return round2(sub - (sub * (q.discountPct || 0)) / 100);
};

export function buildService(T, { sites, systems: systemsIn, devices: devicesIn, items, quotations }) {
  const D = (n) => addDays(T, n);
  const systems = structuredClone(systemsIn);
  const devices = structuredClone(devicesIn);
  const byCode = Object.fromEntries(Object.values(items).map((i) => [i.code, i]));
  let seq = 0;
  const nid = (p) => `${p}_v${++seq}`;
  let invoiceSeq = 300; // invoice numbers of past billing periods; Billing (step 7) creates them
  const label = (d) => {
    const sys = systems[d.systemId];
    return `${SYSTEM_TYPES[sys.type].devices[d.type].label}${d.qty > 1 ? ` x ${d.qty}` : ''} (${d.tag})`;
  };
  const siteSystems = (siteId) => Object.values(systems).filter((s) => s.siteId === siteId);
  const feeFromRates = (siteId) => {
    const { lines } = amcSections(siteSystems(siteId), Object.values(devices), byCode, nid);
    return round2(lines.reduce((sum, l) => sum + l.qty * l.price, 0));
  };

  // ---- contracts -------------------------------------------------------------------
  const contract = (o) => {
    const startOn = D(o.start);
    const endOn = contractEnd(startOn, o.term ?? 12);
    const fee = o.quotationId ? netOf(quotations[o.quotationId]) : feeFromRates(o.siteId);
    const gaps = visitDates(startOn, o.term ?? 12, o.visits);
    const plan = gaps.map((dueOn, i) => ({ id: nid('vis'), n: i + 1, dueOn, jobId: '', state: '' }));
    const bill = billingDates(startOn, o.term ?? 12, o.billing, fee).map((b, i) => {
      const past = b.dueOn <= T && o.status !== 'awaiting_approval' && o.status !== 'draft';
      return { id: nid('bil'), n: i + 1, dueOn: b.dueOn, amount: b.amount, invoiceRef: past ? `INV-2026-${String(invoiceSeq++).padStart(4, '0')}` : '' };
    });
    return {
      id: o.id, number: o.number, customerId: o.customerId, siteId: o.siteId, contactId: o.contactId,
      quotationId: o.quotationId ?? '', title: `Maintenance contract, ${sites[o.siteId].name}`,
      status: o.status ?? 'active', startOn, termMonths: o.term ?? 12, endOn, visitsPerYear: o.visits,
      responseHours: o.response ?? 4, systemIds: siteSystems(o.siteId).map((s) => s.id),
      annualFee: fee, billing: o.billing, visitPlan: plan, billingPlan: bill,
      cdApproval: {
        required: true, status: 'approved', reference: `CD-AMC-${70000 + (seq % 900)}`,
        submittedOn: addDays(startOn, -20), decidedOn: addDays(startOn, -6), note: '', ...(o.cd ?? {}),
      },
      renewedFromId: o.renewedFrom ?? '', renewedToId: o.renewedTo ?? '', renewalQuotationId: o.renewalQuotationId ?? '',
      createdOn: addDays(startOn, -25), notes: o.notes ?? '',
    };
  };

  const C = [
    contract({ id: 'con_1', number: 'AMC-2026-0003', customerId: 'cus_marina', siteId: 'site_marina', contactId: 'ct_2', start: -206, visits: 4, billing: 'quarterly' }),
    contract({ id: 'con_2', number: 'AMC-2025-0011', customerId: 'cus_harbour', siteId: 'site_harbour', contactId: 'ct_6', start: -405, visits: 4, billing: 'quarterly', status: 'ended', renewalQuotationId: 'qt_131', notes: 'Not renewed on time; a renewal quotation was sent.' }),
    contract({ id: 'con_3', number: 'AMC-2026-0005', customerId: 'cus_meridian', siteId: 'site_meridian', contactId: 'ct_9', start: -216, visits: 4, response: 2, billing: 'quarterly' }),
    contract({ id: 'con_4', number: 'AMC-2026-0006', customerId: 'cus_meridian', siteId: 'site_meridian_staff', contactId: 'ct_11', start: -100, visits: 2, response: 8, billing: 'annual' }),
    contract({ id: 'con_5', number: 'AMC-2026-0001', customerId: 'cus_palm', siteId: 'site_palm', contactId: 'ct_13', start: -196, visits: 4, response: 2, billing: 'quarterly' }),
    contract({ id: 'con_6', number: 'AMC-2026-0007', customerId: 'cus_sahara', siteId: 'site_sahara1', contactId: 'ct_16', start: -103, visits: 4, billing: 'quarterly' }),
    contract({ id: 'con_7', number: 'AMC-2026-0008', customerId: 'cus_sahara', siteId: 'site_sahara2', contactId: 'ct_16', start: -90, visits: 4, billing: 'quarterly' }),
    contract({ id: 'con_8', number: 'AMC-2025-0012', customerId: 'cus_falcon', siteId: 'site_falcon', contactId: 'ct_19', start: -315, visits: 4, billing: 'quarterly' }),
    contract({ id: 'con_9', number: 'AMC-2025-0013', customerId: 'cus_mall', siteId: 'site_mall', contactId: 'ct_31', start: -345, visits: 6, response: 2, billing: 'quarterly', renewedTo: 'con_12' }),
    contract({ id: 'con_10', number: 'AMC-2026-0009', customerId: 'cus_oasis', siteId: 'site_oasis', contactId: 'ct_26', start: -198, visits: 2, response: 8, billing: 'annual' }),
    contract({ id: 'con_11', number: 'AMC-2026-0004', customerId: 'cus_bright', siteId: 'site_bright', contactId: 'ct_29', start: -180, visits: 2, response: 8, billing: 'quarterly', notes: 'Visits only in school holidays or after 15:30, never on a fire drill day.' }),
    contract({
      id: 'con_12', number: 'AMC-2026-0010', customerId: 'cus_mall', siteId: 'site_mall', contactId: 'ct_30', quotationId: 'qt_119', start: 20, visits: 4,
      response: 4, billing: 'quarterly', status: 'awaiting_approval', renewedFrom: 'con_9',
      cd: { status: 'submitted', reference: 'CD-AMC-77120', submittedOn: D(-30), decidedOn: '' },
    }),
    contract({ id: 'con_13', number: 'AMC-2026-0002', customerId: 'cus_mussafah', siteId: 'site_mussafah', contactId: 'ct_43', start: -170, visits: 4, response: 8, billing: 'quarterly', notes: 'Abu Dhabi: the contract goes with the compliance certificate (sample, to be confirmed).' }),
    contract({ id: 'con_14', number: 'AMC-2025-0014', customerId: 'cus_rose', siteId: 'site_rose_bb', contactId: 'ct_24', start: -330, visits: 2, response: 8, billing: 'quarterly', notes: 'The customer is on hold: renewal needs the owner.' }),
  ];
  const contracts = Object.fromEntries(C.map((c) => [c.id, c]));
  // The old rows with no job stand for visits made before this system: done,
  // except where the customer's hold stopped them.
  for (const c of C) {
    for (const row of c.visitPlan) if (row.dueOn < D(-30)) row.state = 'done';
  }
  contracts.con_14.visitPlan[1].state = 'missed';
  contracts.con_2.visitPlan.forEach((r) => { r.state = 'done'; });

  // ---- jobs --------------------------------------------------------------------------
  const staffName = { staff_rashid: 'Rashid Ali', staff_imran: 'Imran Qureshi', staff_joseph: 'Joseph Mathew' };
  const jobs = {};
  const job = (o) => {
    const j = {
      id: o.id, number: '', kind: o.kind, customerId: o.customerId, siteId: o.siteId, contractId: o.contractId ?? '',
      quotationId: o.quotationId ?? '', deficiencyIds: o.deficiencyIds ?? [], visitId: '', title: o.title,
      description: o.description ?? '', urgency: o.urgency ?? 'normal', requestedOn: o.requestedOn, dueOn: o.dueOn ?? o.requestedOn,
      status: o.status, plannedOn: o.plannedOn ?? '', window: o.window ?? '', assigneeIds: o.assigneeIds ?? [],
      startedOn: o.startedOn ?? '', completedOn: o.completedOn ?? '', systemIds: o.systemIds ?? [],
      checklist: [], findings: o.findings ?? '', parts: o.parts ?? [], labour: o.labour ?? [], signature: null, report: null,
      callInfo: o.callInfo ?? null, photos: [], startedAt: o.startedAt ?? '', completedAt: '',
    };
    jobs[j.id] = j;
    if (o.contractId && o.n) {
      const row = contracts[o.contractId].visitPlan[o.n - 1];
      row.jobId = j.id;
      j.visitId = row.id;
      j.dueOn = row.dueOn;
    }
    return j;
  };

  // A planned visit's checklist. The visit that is under way takes the device
  // groups that are due today (the rule of the application); a completed visit
  // of the history names the kinds of system it covered. `results` sets a
  // result for one kind of device ("system/device"); the others pass.
  const checklist = (j, onDate, results = {}, pending = 0, types = null) => {
    const c = contracts[j.contractId];
    const atSite = Object.values(devices).filter((d) => d.siteId === j.siteId && c.systemIds.includes(d.systemId));
    const rows = types ? atSite.filter((d) => types.includes(systems[d.systemId].type)) : dueGroups(atSite, c.systemIds, onDate);
    j.systemIds = [...new Set(rows.map((r) => r.systemId))];
    j.checklist = rows.map((d, i) => {
      const key = `${systems[d.systemId].type}/${d.type}`;
      const set = results[key];
      const isPending = i >= rows.length - pending;
      return { id: nid('chk'), deviceId: d.id, systemId: d.systemId, label: label(d), result: isPending && !set ? '' : set?.result ?? 'pass', note: set?.note ?? '' };
    });
  };
  // Applying a completed visit to the register: tested groups are serviced today.
  const apply = (j) => {
    for (const row of j.checklist) if (row.result === 'pass' || row.result === 'fail') devices[row.deviceId].lastServiced = j.completedOn;
  };
  const done = (j, o) => {
    j.status = o.sent ? 'report_sent' : 'completed';
    j.completedOn = o.on;
    j.signature = { name: o.signedBy, role: o.signedRole, on: o.on };
    if (o.report) j.report = { number: o.report, issuedOn: o.on, sentOn: o.sent ? addDays(o.on, 1) : '', sentTo: o.sent ? [o.sentTo] : [], certificateId: o.certificate ?? '' };
    apply(j);
  };
  const hoursOf = (staff, h) => staff.map((id) => ({ staffId: id, hours: h }));

  // -- history (completed), in date order so the register is updated in order --
  const j11 = job({ id: 'jb_11', kind: 'planned_visit', customerId: 'cus_bright', siteId: 'site_bright', contractId: 'con_11', n: 1, title: 'Planned visit 1 of 2', status: 'completed', requestedOn: D(-180), plannedOn: D(-166), window: 'afternoon', assigneeIds: ['staff_imran', 'staff_joseph'], startedOn: D(-166), labour: hoursOf(['staff_imran', 'staff_joseph'], 5) });
  checklist(j11, D(-166), {}, 0, ['fire_alarm', 'extinguishers', 'emergency_lighting']);
  done(j11, { on: D(-166), signedBy: 'Nasser Al Ketbi', signedRole: 'Facilities coordinator', report: 'SR-2026-0410', sent: true, sentTo: 'ct_29' });

  const j25 = job({ id: 'jb_25', kind: 'call_out', customerId: 'cus_bright', siteId: 'site_bright', contractId: 'con_11', title: 'Alarm faults in block C', status: 'completed', urgency: 'urgent', requestedOn: D(-51), plannedOn: D(-50), window: 'morning', assigneeIds: ['staff_imran'], startedOn: D(-50), completedOn: D(-50), systemIds: siteSystems('site_bright').filter((s) => s.type === 'fire_alarm').map((s) => s.id), callInfo: { reportedBy: 'Nasser Al Ketbi', via: 'phone', fault: 'The panel shows faults in the loop of block C.' }, findings: 'Twenty-four detectors of block C do not respond. Loop wiring is fine. Detectors are due for replacement.', labour: hoursOf(['staff_imran'], 3) });
  done(j25, { on: D(-50), signedBy: 'Nasser Al Ketbi', signedRole: 'Facilities coordinator', report: 'SR-2026-0430', sent: true, sentTo: 'ct_29' });

  const j22 = job({ id: 'jb_22', kind: 'call_out', customerId: 'cus_rose', siteId: 'site_rose_kitchen', title: 'Kitchen hood check requested', status: 'completed', requestedOn: D(-32), plannedOn: D(-31), window: 'morning', assigneeIds: ['staff_rashid'], startedOn: D(-31), completedOn: D(-31), systemIds: siteSystems('site_rose_kitchen').filter((s) => s.type === 'kitchen_hood').map((s) => s.id), callInfo: { reportedBy: 'Marco Bellini', via: 'phone', fault: 'The manager asked for a check before the fire inspection.' }, findings: 'Grease build-up blocks two hood nozzles. Cleaning needed before the system can be relied on.', labour: hoursOf(['staff_rashid'], 2) });
  done(j22, { on: D(-31), signedBy: 'Marco Bellini', signedRole: 'Operations manager', report: 'SR-2026-0459', sent: true, sentTo: 'ct_24' });

  const j16 = job({ id: 'jb_16', kind: 'planned_visit', customerId: 'cus_falcon', siteId: 'site_falcon', contractId: 'con_8', n: 4, title: 'Planned visit 4 of 4', status: 'completed', requestedOn: D(-60), plannedOn: D(-28), window: 'night', assigneeIds: ['staff_imran', 'staff_rashid'], startedOn: D(-28), labour: hoursOf(['staff_imran', 'staff_rashid'], 6) });
  checklist(j16, D(-28), {}, 0, ['fire_alarm', 'sprinkler', 'fire_pump']);
  done(j16, { on: D(-28), signedBy: 'Roberto Silva', signedRole: 'Building manager', report: 'SR-2026-0475', sent: true, sentTo: 'ct_19' });

  const j21 = job({ id: 'jb_21', kind: 'call_out', customerId: 'cus_wasl', siteId: 'site_wasl', title: 'Extinguisher check for the fire inspection', status: 'completed', requestedOn: D(-27), plannedOn: D(-26), window: 'afternoon', assigneeIds: ['staff_rashid'], startedOn: D(-26), completedOn: D(-26), systemIds: siteSystems('site_wasl').map((s) => s.id), callInfo: { reportedBy: 'Pradeep Kumar', via: 'phone', fault: 'An inspection is coming; please check the extinguishers.' }, findings: 'Three ABC extinguishers have low pressure and cannot be used. The owner was told on site.', labour: hoursOf(['staff_rashid'], 2) });
  done(j21, { on: D(-26), signedBy: 'Pradeep Kumar', signedRole: 'Owner and manager', report: 'SR-2026-0479', sent: true, sentTo: 'ct_34' });

  const j13 = job({ id: 'jb_13', kind: 'planned_visit', customerId: 'cus_mall', siteId: 'site_mall', contractId: 'con_9', n: 6, title: 'Planned visit 6 of 6', status: 'completed', requestedOn: D(-56), plannedOn: D(-26), window: 'night', assigneeIds: ['staff_imran', 'staff_joseph', 'staff_rashid'], startedOn: D(-26), labour: hoursOf(['staff_imran', 'staff_joseph', 'staff_rashid'], 7) });
  checklist(j13, D(-26), { 'emergency_lighting/exit': { result: 'fail', note: 'Six exit signs fail the battery test: they go dark within 30 minutes.' } }, 0, ['fire_alarm', 'voice_alarm', 'emergency_lighting', 'sprinkler']);
  done(j13, { on: D(-26), signedBy: 'Ernesto Cruz', signedRole: 'Chief engineer', report: 'SR-2026-0480', sent: true, sentTo: 'ct_31', certificate: 'cert_2' });

  const j10 = job({ id: 'jb_10', kind: 'planned_visit', customerId: 'cus_meridian', siteId: 'site_meridian', contractId: 'con_3', n: 3, title: 'Planned visit 3 of 4', status: 'completed', requestedOn: D(-50), plannedOn: D(-20), window: 'night', assigneeIds: ['staff_imran', 'staff_rashid'], startedOn: D(-20), labour: hoursOf(['staff_imran', 'staff_rashid'], 6) });
  checklist(j10, D(-20), { 'kitchen_hood/links': { result: 'fail', note: 'Fusible links are corroded and may not release.' } }, 0, ['fire_alarm', 'kitchen_hood', 'clean_agent']);
  done(j10, { on: D(-20), signedBy: 'Sunil Perera', signedRole: 'Chief engineer', report: 'SR-2026-0485', sent: true, sentTo: 'ct_9', certificate: 'cert_1' });

  const j12 = job({ id: 'jb_12', kind: 'call_out', customerId: 'cus_sahara', siteId: 'site_sahara1', contractId: 'con_6', title: 'Pump house low-pressure alarm', status: 'completed', urgency: 'urgent', requestedOn: D(-13), plannedOn: D(-12), window: 'morning', assigneeIds: ['staff_joseph'], startedOn: D(-12), completedOn: D(-12), systemIds: siteSystems('site_sahara1').filter((s) => s.type === 'fire_pump').map((s) => s.id), callInfo: { reportedBy: 'Peter Okafor', via: 'phone', fault: 'The pump house shows a low-pressure alarm several times a day.' }, findings: 'The jockey pump does not hold pressure: it starts every few minutes. Replacement is needed.', labour: hoursOf(['staff_joseph'], 4) });
  done(j12, { on: D(-12), signedBy: 'Peter Okafor', signedRole: 'Warehouse manager', report: 'SR-2026-0488', sent: true, sentTo: 'ct_16' });

  const j9 = job({ id: 'jb_9', kind: 'planned_visit', customerId: 'cus_marina', siteId: 'site_marina', contractId: 'con_1', n: 3, title: 'Planned visit 3 of 4', status: 'completed', requestedOn: D(-40), plannedOn: D(-10), window: 'morning', assigneeIds: ['staff_imran', 'staff_joseph'], startedOn: D(-10), labour: hoursOf(['staff_imran', 'staff_joseph'], 8) });
  checklist(j9, D(-10), { 'fire_alarm/battery': { result: 'fail', note: 'The batteries fail the load test: the voltage drops under load.' } }, 0, ['fire_alarm', 'fire_pump', 'sprinkler']);
  done(j9, { on: D(-10), signedBy: 'Mahmoud El-Sayed', signedRole: 'Property manager', report: 'SR-2026-0498', sent: true, sentTo: 'ct_5' });

  const j15 = job({ id: 'jb_15', kind: 'call_out', customerId: 'cus_nexus', siteId: 'site_nexus', title: 'Aspirating detection fault, hall 2', status: 'completed', urgency: 'urgent', requestedOn: D(-6), plannedOn: D(-5), window: 'all_day', assigneeIds: ['staff_imran'], startedOn: D(-5), completedOn: D(-5), systemIds: siteSystems('site_nexus').filter((s) => s.type === 'fire_alarm').map((s) => s.id), callInfo: { reportedBy: 'Yuki Tanaka', via: 'email', fault: 'The panel reports a sensitivity fault of the aspirating detector in hall 2.' }, findings: 'Sensitivity drifted outside the limit. Re-calibrated for now; the sampling pipes need a full check.', labour: hoursOf(['staff_imran'], 5) });
  done(j15, { on: D(-5), signedBy: 'Yuki Tanaka', signedRole: 'Facilities engineer', report: 'SR-2026-0494', sent: true, sentTo: 'ct_41' });

  // Yesterday: a call-out that is done and signed, the report is not issued yet.
  const j8 = job({ id: 'jb_8', kind: 'call_out', customerId: 'cus_harbour', siteId: 'site_harbour', title: 'Loop faults on the fire alarm panel', status: 'completed', urgency: 'emergency', requestedOn: D(-1), plannedOn: D(-1), window: 'morning', assigneeIds: ['staff_imran'], startedOn: D(-1), completedOn: D(-1), systemIds: siteSystems('site_harbour').filter((s) => s.type === 'fire_alarm').map((s) => s.id), callInfo: { reportedBy: 'Denise Fernandez', via: 'phone', fault: 'The panel shows two loop faults and the building manager fears the alarm does not work on levels 20 to 38.' }, findings: 'Two loops are open circuit: levels 20 to 38 are not monitored. The alarm cannot be relied on there. The customer has no contract now, so the visit is chargeable.', labour: hoursOf(['staff_imran'], 4) });
  j8.signature = { name: 'Denise Fernandez', role: 'Building manager', on: D(-1) };

  // Today: a planned visit under way, a call-out this afternoon.
  const j1 = job({ id: 'jb_1', kind: 'planned_visit', customerId: 'cus_palm', siteId: 'site_palm', contractId: 'con_5', n: 3, title: 'Planned visit 3 of 4', status: 'in_progress', requestedOn: D(-30), plannedOn: T, window: 'morning', assigneeIds: ['staff_imran', 'staff_joseph'], startedOn: T, startedAt: new Date(Date.now() - 95 * 60 * 1000).toISOString() });
  checklist(j1, T, { 'fire_alarm/smoke': { result: 'fail', note: 'Three detectors in the theatre corridor do not respond.' } }, 3);

  // This morning: done, not signed yet (it shows under "Waiting for you" on the technician's day).
  job({ id: 'jb_26', kind: 'call_out', customerId: 'cus_green', siteId: 'site_gv1', title: 'Smoke detector beeping in the cold room', status: 'completed', urgency: 'normal', requestedOn: D(-1), plannedOn: T, window: 'morning', assigneeIds: ['staff_rashid'], startedOn: T, completedOn: T, systemIds: siteSystems('site_gv1').filter((s) => s.type === 'fire_alarm').map((s) => s.id), callInfo: { reportedBy: 'Jomon Varghese', via: 'phone', fault: 'A detector in the cold room beeps every minute and the store staff cannot silence it.' }, findings: 'The detector battery was flat after the cold. Replaced the detector head with a low-temperature model and tested it from the panel.', labour: hoursOf(['staff_rashid'], 2) });

  job({ id: 'jb_2', kind: 'call_out', customerId: 'cus_meridian', siteId: 'site_meridian', contractId: 'con_3', title: 'False alarms in the lift lobby, Wing A', status: 'planned', urgency: 'urgent', requestedOn: T, plannedOn: T, window: 'afternoon', assigneeIds: ['staff_rashid'], systemIds: siteSystems('site_meridian').filter((s) => s.type === 'fire_alarm').map((s) => s.id), callInfo: { reportedBy: 'Sunil Perera', via: 'phone', fault: 'The alarm goes off in the Wing A lift lobby two or three times a night.' } });
  job({ id: 'jb_3', kind: 'repair', customerId: 'cus_meridian', siteId: 'site_meridian', contractId: 'con_3', quotationId: 'qt_146', deficiencyIds: ['def_198'], title: 'Kitchen hood: new fusible links, recharge two cylinders', status: 'planned', urgency: 'urgent', requestedOn: D(-17), dueOn: D(1), plannedOn: D(1), window: 'night', assigneeIds: ['staff_rashid', 'staff_joseph'], systemIds: siteSystems('site_meridian').filter((s) => s.type === 'kitchen_hood').map((s) => s.id), description: 'Accepted quotation QT-2026-0146. Kitchen and server room only between 23:00 and 05:00.' });
  job({ id: 'jb_4', kind: 'planned_visit', customerId: 'cus_sahara', siteId: 'site_sahara1', contractId: 'con_6', n: 2, title: 'Planned visit 2 of 4', status: 'planned', requestedOn: D(-30), plannedOn: D(2), window: 'morning', assigneeIds: ['staff_joseph'], description: 'Pump house needs a work permit from the operations office.' });
  job({ id: 'jb_14', kind: 'planned_visit', customerId: 'cus_oasis', siteId: 'site_oasis', contractId: 'con_10', n: 2, title: 'Planned visit 2 of 2', status: 'planned', requestedOn: D(-32), plannedOn: D(-2), window: 'morning', assigneeIds: ['staff_rashid'], description: 'Cold rooms: ask the shift supervisor to open.' });

  // Upcoming: released from the visit plans, not planned yet.
  job({ id: 'jb_6', kind: 'planned_visit', customerId: 'cus_sahara', siteId: 'site_sahara2', contractId: 'con_7', n: 2, title: 'Planned visit 2 of 4', status: 'upcoming', requestedOn: D(-5) });
  job({ id: 'jb_7', kind: 'planned_visit', customerId: 'cus_bright', siteId: 'site_bright', contractId: 'con_11', n: 2, title: 'Planned visit 2 of 2', status: 'upcoming', requestedOn: D(-5), description: 'Not on a fire drill day; after 15:30 or in the holidays.' });
  job({ id: 'jb_17', kind: 'planned_visit', customerId: 'cus_mussafah', siteId: 'site_mussafah', contractId: 'con_13', n: 3, title: 'Planned visit 3 of 4', status: 'upcoming', requestedOn: D(-4), description: 'HSE induction video before entering the plant.' });
  job({ id: 'jb_5', kind: 'planned_visit', customerId: 'cus_marina', siteId: 'site_marina', contractId: 'con_1', n: 4, title: 'Planned visit 4 of 4', status: 'upcoming', requestedOn: D(-2) });
  job({ id: 'jb_18', kind: 'planned_visit', customerId: 'cus_meridian', siteId: 'site_meridian', contractId: 'con_3', n: 4, title: 'Planned visit 4 of 4', status: 'upcoming', requestedOn: D(-2) });
  job({ id: 'jb_19', kind: 'planned_visit', customerId: 'cus_palm', siteId: 'site_palm', contractId: 'con_5', n: 4, title: 'Planned visit 4 of 4', status: 'upcoming', requestedOn: D(-2) });

  // Numbers follow the order of the requests.
  Object.values(jobs)
    .toSorted((a, b) => a.requestedOn.localeCompare(b.requestedOn) || a.id.localeCompare(b.id))
    .forEach((j, i) => { j.number = `JOB-2026-${String(570 + i).padStart(4, '0')}`; });
  // Report numbers were given above; keep the highest as the counter.

  // ---- deficiencies ---------------------------------------------------------------------
  const sysOf = (siteId, type) => siteSystems(siteId).find((s) => s.type === type);
  const devOf = (siteId, sysType, devType) => Object.values(devices).find((d) => d.siteId === siteId && systems[d.systemId].type === sysType && d.type === devType);
  const def = (o) => {
    const sys = sysOf(o.siteId, o.system);
    const dev = o.device ? devOf(o.siteId, o.system, o.device) : null;
    return {
      id: o.id, number: o.number, siteId: o.siteId, systemId: sys.id, deviceId: dev?.id ?? '', jobId: o.jobId ?? '',
      severity: o.severity, title: o.title, description: o.description, requirement: REQUIREMENT[o.system],
      foundOn: D(-o.foundAgo), foundBy: o.by, status: o.status, reportedOn: o.reportedAgo !== undefined ? D(-o.reportedAgo) : '',
      reportedTo: o.reportedTo ?? '', quotationId: o.quotationId ?? '', repairJobId: o.repairJobId ?? '', repairedOn: o.repairedAgo !== undefined ? D(-o.repairedAgo) : '',
      verifiedOn: o.verifiedAgo !== undefined ? D(-o.verifiedAgo) : '', verifiedBy: o.verifiedBy ?? '', note: o.note ?? '', photos: [],
    };
  };
  const DEFS = [
    def({ id: 'def_198', number: 'DEF-2026-0198', siteId: 'site_meridian', system: 'kitchen_hood', device: 'links', jobId: 'jb_10', severity: 'critical', title: 'Fusible links of the main kitchen hoods are corroded', description: 'The links may not release when a fire starts. They must be replaced and the two cylinders recharged.', foundAgo: 20, by: 'staff_imran', status: 'approved', reportedAgo: 19, reportedTo: 'ct_9', quotationId: 'qt_146', repairJobId: 'jb_3' }),
    def({ id: 'def_199', number: 'DEF-2026-0199', siteId: 'site_marina', system: 'fire_alarm', device: 'sounder', severity: 'noncritical', title: 'Two sounders on level 12 do not work', description: 'The sounders did not sound during the test. Replaced by the technician at the next visit.', foundAgo: 100, by: 'staff_imran', status: 'verified', reportedAgo: 99, reportedTo: 'ct_2', repairedAgo: 96, verifiedAgo: 94, verifiedBy: 'staff_hassan' }),
    def({ id: 'def_200', number: 'DEF-2026-0200', siteId: 'site_meridian', system: 'fire_alarm', device: 'heat', severity: 'noncritical', title: 'A heat detector in the pastry kitchen is dirty and unstable', description: 'Replaced with a new detector.', foundAgo: 110, by: 'staff_rashid', status: 'verified', reportedAgo: 108, reportedTo: 'ct_9', repairedAgo: 100, verifiedAgo: 99, verifiedBy: 'staff_hassan' }),
    def({ id: 'def_201', number: 'DEF-2026-0201', siteId: 'site_mall', system: 'voice_alarm', device: 'speaker', severity: 'noncritical', title: 'Loudspeakers in the east parking are weak', description: 'The announcement is hard to understand in zone P3. A new amplifier channel is proposed.', foundAgo: 70, by: 'staff_joseph', status: 'reported', reportedAgo: 68, reportedTo: 'ct_31' }),
    def({ id: 'def_202', number: 'DEF-2026-0202', siteId: 'site_gv1', system: 'extinguishers', device: 'abc6', severity: 'noncritical', title: 'Two extinguishers have no tag', description: 'The yearly service tag is missing on two ABC extinguishers near the bakery.', foundAgo: 35, by: 'staff_rashid', status: 'reported', reportedAgo: 33, reportedTo: 'ct_35' }),
    def({ id: 'def_203', number: 'DEF-2026-0203', siteId: 'site_bright', system: 'fire_alarm', device: 'smoke', jobId: 'jb_25', severity: 'critical', title: 'Twenty-four detectors of block C do not respond', description: 'The loop is fine; the detectors are at the end of their life and must be replaced.', foundAgo: 50, by: 'staff_imran', status: 'quoted', reportedAgo: 48, reportedTo: 'ct_29', quotationId: 'qt_127b' }),
    def({ id: 'def_204', number: 'DEF-2026-0204', siteId: 'site_mall', system: 'emergency_lighting', device: 'exit', jobId: 'jb_13', severity: 'noncritical', title: 'Six exit signs fail the battery test', description: 'The signs go dark within 30 minutes. New batteries or new signs are needed.', foundAgo: 26, by: 'staff_joseph', status: 'reported', reportedAgo: 25, reportedTo: 'ct_31' }),
    def({ id: 'def_205', number: 'DEF-2026-0205', siteId: 'site_sahara1', system: 'fire_pump', device: 'jockey', jobId: 'jb_12', severity: 'critical', title: 'The jockey pump does not hold pressure', description: 'It starts every few minutes and will wear out the main pump. Replacement is needed.', foundAgo: 12, by: 'staff_joseph', status: 'quoted', reportedAgo: 11, reportedTo: 'ct_16', quotationId: 'qt_145' }),
    def({ id: 'def_206', number: 'DEF-2026-0206', siteId: 'site_rose_kitchen', system: 'kitchen_hood', device: 'cylinder', jobId: 'jb_22', severity: 'critical', title: 'Grease blocks two nozzles of the hood system', description: 'The system cannot discharge properly. The hood must be cleaned before it can be relied on.', foundAgo: 31, by: 'staff_rashid', status: 'reported', reportedAgo: 30, reportedTo: 'ct_24', note: 'The customer is on hold; the owner must approve any work.' }),
    def({ id: 'def_207', number: 'DEF-2026-0207', siteId: 'site_marina', system: 'fire_alarm', device: 'battery', jobId: 'jb_9', severity: 'critical', title: 'The fire alarm batteries fail the load test', description: 'The voltage drops under load, so the panel may not run for the required standby time.', foundAgo: 10, by: 'staff_imran', status: 'quoted', reportedAgo: 9, reportedTo: 'ct_5', quotationId: 'qt_138' }),
    def({ id: 'def_208', number: 'DEF-2026-0208', siteId: 'site_nexus', system: 'fire_alarm', jobId: 'jb_15', severity: 'noncritical', title: 'Aspirating detection drifts in hall 2', description: 'Sensitivity was re-calibrated. A full check of the sampling pipes is proposed.', foundAgo: 5, by: 'staff_imran', status: 'found' }),
    def({ id: 'def_209', number: 'DEF-2026-0209', siteId: 'site_palm', system: 'fire_alarm', device: 'smoke', jobId: 'jb_1', severity: 'critical', title: 'Three detectors in the theatre corridor do not respond', description: 'Found during today\'s visit. The corridor is not covered until they are replaced.', foundAgo: 0, by: 'staff_imran', status: 'found' }),
    def({ id: 'def_210', number: 'DEF-2026-0210', siteId: 'site_palm', system: 'sprinkler', device: 'flow', severity: 'critical', title: 'Water flow switches of levels 3 and 5 give no signal', description: 'A sprinkler discharge on these levels would not raise the alarm.', foundAgo: 95, by: 'staff_joseph', status: 'quoted', reportedAgo: 93, reportedTo: 'ct_13', quotationId: 'qt_147' }),
    def({ id: 'def_211', number: 'DEF-2026-0211', siteId: 'site_harbour', system: 'fire_alarm', jobId: 'jb_8', severity: 'impairment', title: 'Two loops of the fire alarm are open circuit', description: 'Levels 20 to 38 are not monitored: the alarm cannot be relied on there. The owner must be told at once.', foundAgo: 1, by: 'staff_imran', status: 'found' }),
    def({ id: 'def_212', number: 'DEF-2026-0212', siteId: 'site_wasl', system: 'extinguishers', device: 'abc6', jobId: 'jb_21', severity: 'critical', title: 'Three extinguishers have low pressure', description: 'They cannot be used. The owner was told on site and has not answered.', foundAgo: 26, by: 'staff_rashid', status: 'reported', reportedAgo: 26, reportedTo: 'ct_34' }),
  ];
  const deficiencies = Object.fromEntries(DEFS.map((d) => [d.id, d]));
  // The impairment takes the alarm system of Harbour View out of service.
  systems[sysOf('site_harbour', 'fire_alarm').id].status = 'impaired';
  // A device that failed and is waiting for repair stays in service; only an impairment stops it.

  // ---- certificates and returns -----------------------------------------------------------
  const certificates = {
    cert_1: { id: 'cert_1', number: 'MC-2026-0011', kind: 'maintenance', siteId: 'site_meridian', jobId: 'jb_10', systemIds: jobs.jb_10.systemIds, issuedOn: D(-20), nextDue: D(71) },
    cert_2: { id: 'cert_2', number: 'MC-2026-0012', kind: 'maintenance', siteId: 'site_mall', jobId: 'jb_13', systemIds: jobs.jb_13.systemIds, issuedOn: D(-26), nextDue: D(19) },
  };
  // The return of a month is sent in the first days of the next one.
  const monthOf = (n) => addMonths(`${T.slice(0, 7)}-01`, n).slice(0, 7);
  const returns = {};
  [-6, -5, -4, -3, -2].forEach((n, i) => {
    const month = monthOf(n);
    returns[month] = { id: month, month, status: 'submitted', on: addMonths(`${month}-05`, 1), reference: `CDR-${month.replace('-', '')}-${100 + i}` };
  });

  // ---- what quotations started, and events for the activity lists ----------------------------
  const followUps = {
    qt_119: { type: 'contract', id: 'con_12', number: 'AMC-2026-0010' },
    qt_146: { type: 'job', id: 'jb_3', number: jobs.jb_3.number },
  };
  const ev = (entity, entityId, by, daysAgo, text) => ({ entity, entityId, by, daysAgo, text });
  const events = [
    ev('contract', 'con_12', 'staff_omar', 52, 'Contract created from the accepted quotation QT-2026-0119'),
    ev('contract', 'con_12', 'staff_hassan', 30, 'Submitted to the authority for approval (CD-AMC-77120)'),
    ev('contract', 'con_1', 'staff_hassan', 206, 'Contract activated'),
    ev('contract', 'con_2', 'staff_hassan', 40, 'Contract ended: not renewed'),
    ev('job', 'jb_9', 'staff_imran', 10, 'Visit completed: one failed item'),
    ev('job', 'jb_9', 'staff_hassan', 9, 'Service report SR-2026-0498 sent'),
    ev('job', 'jb_8', 'staff_imran', 1, 'Call-out completed: impairment found'),
    ev('job', 'jb_1', 'staff_imran', 0, 'Visit started'),
    ev('deficiency', 'def_207', 'staff_imran', 10, 'Found during the planned visit'),
    ev('deficiency', 'def_207', 'staff_hassan', 9, 'Reported to the customer'),
    ev('deficiency', 'def_207', 'staff_hassan', 4, 'Repair quotation QT-2026-0138 made'),
    ev('deficiency', 'def_198', 'staff_hassan', 18, 'Repair quotation accepted: QT-2026-0146'),
    ev('deficiency', 'def_211', 'staff_imran', 1, 'Found during the call-out: impairment'),
    ev('site', 'site_harbour', 'staff_imran', 1, 'Fire alarm system marked out of service (impaired)'),
    ev('customer', 'cus_harbour', 'staff_imran', 1, 'Impairment found at Harbour View Residences'),
  ];

  return {
    contracts, jobs, deficiencies, certificates, returns, systems, devices, followUps, events,
    counters: { contract: 12, job: 570 + Object.keys(jobs).length - 1, deficiency: 212, report: 498, certificate: 12 },
  };
}
