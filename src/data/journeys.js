import { todayISO } from '../lib/dates.js';
import { balanceOf, settlements } from './billingRules.js';

// The guided journeys of the prototype: five stories that cross several areas,
// each one a list of steps done by different people. A step says who does it
// (`as`), where (`to`), what to press (`text`) and why it is done that way
// (`why`); `done(state)` tells from the data whether the step is finished, so
// the ticks follow the work, whatever window or area it was done in.
//
// They follow records of the sample data by their ids (QT-2026-0136 is
// `qt_136`, and so on). `as` and `to` may be functions of the state, for steps
// whose person or page depends on what an earlier step created. A step with
// `look: true` is only something to look at: it has no tick and does not count.
//
// This file is a control of the prototype, not of the product.

const rows = (table) => Object.values(table);
const issued = (s, invoiceId) => s.invoices[invoiceId]?.status === 'issued';
const paid = (s, invoiceId) => {
  const inv = s.invoices[invoiceId];
  if (!inv || inv.status !== 'issued') return false;
  return balanceOf(inv, settlements(rows(s.payments), rows(s.creditNotes))[inv.id]) <= 0.004;
};
const after = (list, status) => list.includes(status);

// ---- 1. a project, from approval to cash ------------------------------------------------------------------------------
const quote136 = (s) => s.quotations.qt_136;
const project136 = (s) => s.projects[quote136(s)?.followUp?.id];
const advance136 = (s) => project136(s)?.claims.find((c) => c.kind === 'advance');
const projectPath = (s, tab) => (project136(s) ? `/projects/${project136(s).id}?tab=${tab}` : '/sales/quotations/qt_136');

const PROJECT = {
  id: 'project',
  title: 'Win a project and get paid',
  blurb: 'A quotation of AED 295,000 is approved, sent, accepted and becomes a project; its advance is claimed, certified, invoiced and paid.',
  areas: ['Sales', 'Projects', 'Billing'],
  steps: [
    {
      id: 'approve', as: 'staff_layla', to: '/sales/quotations/qt_136', title: 'Approve the quotation',
      text: 'QT-2026-0136 is the Wing B upgrade of the Gulf Meridian hotel, about AED 295,000. It is above what the operations manager may approve, so it waits for the owner. Open it and press Approve.',
      why: 'Approval follows authority: the value decides who signs, and nobody approves their own work.',
      done: (s) => !['draft', 'waiting_approval'].includes(quote136(s)?.status),
    },
    {
      id: 'send', as: 'staff_sara', to: '/sales/quotations/qt_136', title: 'Send it to the customer',
      text: 'The sales executive sends the approved quotation. Press Send to customer, choose who receives it and send it (nothing really leaves the prototype).',
      why: 'A quotation the customer never received cannot be accepted. The sending is recorded with who received it.',
      done: (s) => Boolean(quote136(s)?.sent),
    },
    {
      id: 'accept', as: 'staff_sara', to: '/sales/quotations/qt_136', title: 'Record the customer\'s answer',
      text: 'The customer accepts with an LPO. Press Record answer, choose Accepted and write the LPO number.',
      why: 'The answer, the day and the customer\'s reference are the proof if there is a dispute later.',
      done: (s) => quote136(s)?.status === 'accepted',
    },
    {
      id: 'start', as: 'staff_nadia', to: '/sales/quotations/qt_136', title: 'Start the project',
      text: 'On the accepted quotation the green card "What happens next" offers Start the project. The packages and their budgets come from the quotation, and the advance claim is made.',
      why: 'A project is never typed from nothing: it starts from what the customer accepted.',
      done: (s) => Boolean(project136(s)),
    },
    {
      id: 'submit', as: 'staff_nadia', to: (s) => projectPath(s, 'claims'), title: 'Submit the advance claim',
      text: 'Open the project, tab Claims. The advance is 30% of the contract value. Press Submit to the customer: from then its figures are fixed.',
      why: 'A claim that was sent cannot change, so both sides talk about the same numbers.',
      done: (s) => Boolean(advance136(s)) && advance136(s).status !== 'draft',
    },
    {
      id: 'certify', as: 'staff_nadia', to: (s) => projectPath(s, 'claims'), title: 'Record the customer\'s certificate',
      text: 'The customer\'s engineer confirms the amount. Press Record the certificate.',
      why: 'A progress claim may be certified for less than claimed. The invoice follows the certificate, not the claim.',
      done: (s) => after(['certified', 'invoiced', 'paid'], advance136(s)?.status),
    },
    {
      id: 'invoice', as: 'staff_priya', to: '/billing', title: 'Make the invoice and issue it',
      text: 'In Billing, the panel "Ready to invoice" now shows the certified claim. Press Make invoice, check the lines, then Issue invoice.',
      why: 'The invoice takes its lines and its amount from the claim, so nothing is typed twice.',
      done: (s) => after(['invoiced', 'paid'], advance136(s)?.status),
    },
    {
      id: 'pay', as: 'staff_priya', to: (s) => (advance136(s)?.invoiceId ? `/billing/${advance136(s).invoiceId}` : '/billing'), title: 'Record the payment',
      text: 'Open the invoice and press Record payment. When it is paid in full the claim turns to Paid in the project.',
      why: 'Billing and Projects change together, so the two never disagree about what was paid.',
      done: (s) => advance136(s)?.status === 'paid',
    },
    {
      id: 'look', look: true, as: 'staff_layla', to: '/reports/projects', title: 'See it in the reports',
      text: 'The new project stands next to the others, with its value, its budget and what was claimed and paid.',
      why: 'Reports read the same tables as the areas, so the figures are never typed twice.',
    },
  ],
};

// ---- 2. a fault, from the finding to the paid repair ---------------------------------------------------------------------
const def209 = (s) => s.deficiencies.def_209;
const quote209 = (s) => s.quotations[def209(s)?.quotationId];
const job209 = (s) => s.jobs[def209(s)?.repairJobId];

const REPAIR = {
  id: 'repair',
  title: 'A fault found, repaired and invoiced',
  blurb: 'Three detectors at Palm Grove do not respond. The customer is told, the repair is quoted, done, checked, invoiced and paid.',
  areas: ['Service', 'Sales', 'Schedule', 'Billing'],
  steps: [
    {
      id: 'report', as: 'staff_hassan', to: '/service/deficiencies/def_209', title: 'Tell the customer in writing',
      text: 'On the last visit at Palm Grove, three detectors in the theatre corridor did not respond (DEF-2026-0209, critical). Open it and press Report to the customer, then Record as reported.',
      why: 'A critical deficiency must be told to the building owner in writing, with the day. It protects the company.',
      done: (s) => def209(s)?.status !== 'found',
    },
    {
      id: 'quote', as: 'staff_sara', to: '/service/deficiencies/def_209', title: 'Make the repair quotation',
      text: 'Sales prices the repair. On the deficiency press Make repair quotation, then Create draft, and add the parts and the labour on the quotation.',
      why: 'The deficiency stays linked to its quotation, so the customer\'s answer moves the deficiency on.',
      done: (s) => Boolean(def209(s)?.quotationId),
    },
    {
      id: 'answer', as: 'staff_sara', to: (s) => (quote209(s) ? `/sales/quotations/${quote209(s).id}` : '/service/deficiencies/def_209'), title: 'Send it and record the answer',
      text: 'Open the quotation and press Send to customer, then Send quotation. Then press Record answer, choose Accepted and press Mark as accepted.',
      why: 'Accepting the quotation approves the repair on the deficiency.',
      done: (s) => quote209(s)?.status === 'accepted',
    },
    {
      id: 'plan', as: 'staff_hassan', to: (s) => (job209(s) ? `/service/jobs/${job209(s).id}` : '/service/deficiencies/def_209'), title: 'Create the repair job and plan it',
      text: 'On the accepted quotation (or on the deficiency) press Create repair job. Then, in the job, press Plan job and choose a day and the technician.',
      why: 'The board and the technician\'s phone show a job only when it has a day and a person.',
      done: (s) => Boolean(job209(s)?.plannedOn),
    },
    {
      id: 'do', as: (s) => job209(s)?.assigneeIds[0] ?? 'staff_rashid', to: (s) => (job209(s) ? `/service/jobs/${job209(s).id}` : '/service/jobs'), title: 'Do the repair',
      text: 'Start the job, write what was found and done, press Complete job, get the customer\'s signature (a few strokes on the screen) and press Issue service report.',
      why: 'The signed report is the proof of the work, and the invoice is based on it.',
      done: (s) => Boolean(job209(s)?.report),
    },
    {
      id: 'verify', as: 'staff_hassan', to: '/service/deficiencies/def_209', title: 'Verify the repair',
      text: 'Somebody checks the repair. On the deficiency press Verify the repair, then Verify and close.',
      why: 'A deficiency is closed only after a check, never because the job was completed.',
      done: (s) => def209(s)?.status === 'verified',
    },
    {
      id: 'invoice', as: 'staff_priya', to: '/billing', title: 'Invoice the repair',
      text: 'In Billing the repair job is in "Ready to invoice". Make the invoice and issue it. A repair is invoiced as it was quoted.',
      why: 'The invoice comes from the job and its quotation, so the customer sees the price it agreed.',
      done: (s) => issued(s, job209(s)?.invoiceId),
    },
    {
      id: 'pay', as: 'staff_priya', to: (s) => (job209(s)?.invoiceId ? `/billing/${job209(s).invoiceId}` : '/billing'), title: 'Record the payment',
      text: 'Open the invoice and press Record payment.',
      why: 'The story ends with the money, not with the report.',
      done: (s) => paid(s, job209(s)?.invoiceId),
    },
  ],
};

// ---- 3. a maintenance contract, from the answer to the first invoice -----------------------------------------------------
const quote131 = (s) => s.quotations.qt_131;
const contract131 = (s) => s.contracts[quote131(s)?.followUp?.id];

const CONTRACT = {
  id: 'contract',
  title: 'A maintenance contract, from yes to the first invoice',
  blurb: 'The Harbour View owners accept the contract quotation. It becomes a contract, is approved by the authority, releases its visits and is billed in advance.',
  areas: ['Sales', 'Service', 'Schedule', 'Billing', 'Reports'],
  steps: [
    {
      id: 'accept', as: 'staff_sara', to: '/sales/quotations/qt_131', title: 'Record that the customer accepted',
      text: 'QT-2026-0131 is the yearly contract for Harbour View Residences. Press Record answer, keep Accepted and press Mark as accepted.',
      why: 'Accepting is the moment work is promised: the next step starts from it.',
      done: (s) => quote131(s)?.status === 'accepted',
    },
    {
      id: 'start', as: 'staff_hassan', to: '/sales/quotations/qt_131', title: 'Start the contract',
      text: 'On the accepted quotation press Start the contract. Its visit plan and its billing plan are made from the terms.',
      why: 'A contract is three linked parts, the terms, the visits and the billing, each kept apart, as the mature products keep them.',
      done: (s) => Boolean(contract131(s)),
    },
    {
      id: 'authority', as: 'staff_hassan', to: (s) => (contract131(s) ? `/service/${contract131(s).id}` : '/sales/quotations/qt_131'), title: 'Get the authority\'s approval',
      text: 'Press Submit to the authority and confirm with Submit. Then press Record the authority\'s answer and choose Approved: activate. Approval makes the contract active and releases its visits as jobs (the Civil Defence step is a sample of the UAE process).',
      why: 'Nobody visits before the authority approved, so the step is part of the life of the contract.',
      done: (s) => contract131(s)?.status === 'active',
    },
    {
      id: 'plan', as: 'staff_hassan', to: '/service/jobs?status=unplanned', title: 'Plan the first visit',
      text: 'The visits are in Jobs, under Needs planning. Open "Planned visit 1 of 4" of Harbour View Residences (due in about three weeks), press Plan job, choose a day and the technicians.',
      why: 'Visits are released in advance and turn into work to plan 30 days before their date.',
      done: (s) => rows(s.jobs).some((j) => j.contractId === contract131(s)?.id && j.kind === 'planned_visit' && j.plannedOn),
    },
    {
      id: 'invoice', as: 'staff_priya', to: '/billing', title: 'Invoice the first instalment',
      text: 'The contract is billed in advance. The first instalment falls due in ten days, so it is in "Ready to invoice". Make the invoice and issue it.',
      why: 'The billing plan of the contract says what is invoiced and when, so nothing depends on somebody remembering.',
      done: (s) => issued(s, contract131(s)?.billingPlan[0]?.invoiceId),
    },
    {
      id: 'look', look: true, as: 'staff_layla', to: '/reports/service', title: 'Look at the Service report',
      text: 'The active contracts and their yearly value went up by one, and the renewals of the next 90 days are listed.',
      why: 'The steady income of a service company is the number of contracts and what a year of them is worth.',
    },
  ],
};

// ---- 4. a claim, the handover and the retention ---------------------------------------------------------------------------
const prj3 = (s) => s.projects.prj_3;
const claim3 = (s) => prj3(s)?.claims.filter((c) => c.kind === 'progress').at(-1);
const prj1 = (s) => s.projects.prj_1;
const retention1 = (s) => prj1(s)?.claims.find((c) => c.kind === 'retention');

const RETENTION = {
  id: 'retention',
  title: 'From a progress claim to the retention',
  blurb: 'A claim waiting for its certificate is paid, a finished project is handed over, and another project has its retention released.',
  areas: ['Projects', 'Billing'],
  steps: [
    {
      id: 'certify', as: 'staff_nadia', to: '/projects/prj_3?tab=claims', title: 'Record the certificate of the claim',
      text: 'PRJ-2026-003 (the fire pump set) has a progress claim waiting for the customer\'s engineer. Press Record the certificate.',
      why: 'The customer pays what the engineer certifies, which may be less than what was claimed.',
      done: (s) => after(['certified', 'invoiced', 'paid'], claim3(s)?.status),
    },
    {
      id: 'invoice', as: 'staff_priya', to: '/billing', title: 'Make the invoice and issue it',
      text: 'The certified claim is in "Ready to invoice" (press Show all if it is not among the first rows). Press Make invoice on the row of PRJ-2026-003, then Issue invoice. The invoice shows the working of the claim: the work done to date, less the retention, less the advance paid back, less the earlier claims.',
      why: 'A progress claim is cumulative, so the customer\'s engineer can check every line against his certificate.',
      done: (s) => after(['invoiced', 'paid'], claim3(s)?.status),
    },
    {
      id: 'pay', as: 'staff_priya', to: (s) => (claim3(s)?.invoiceId ? `/billing/${claim3(s).invoiceId}` : '/billing'), title: 'Record the payment',
      text: 'On the invoice open the "⋯" menu, choose Record a payment and press Record payment. The claim turns to Paid in the project.',
      why: 'Money is a receipt that says which invoices it pays, so one transfer can pay several.',
      done: (s) => claim3(s)?.status === 'paid',
    },
    {
      id: 'handover', as: 'staff_nadia', to: '/projects/prj_3?tab=handover', title: 'Hand the project over',
      text: 'Do what is still missing, in the tab Testing and handover: close the two snags and record the Civil Defence certificate. In the tab Documents mark the four handover documents (test reports, as-builts, manuals, warranties) as Issued to the customer. Then press Hand over. The pump set enters the equipment register and a maintenance contract is offered.',
      why: 'Handover is the moment a project becomes a service customer: the register grows and the liability period starts.',
      done: (s) => after(['retention', 'complete'], prj3(s)?.phase),
    },
    {
      id: 'release', as: 'staff_layla', to: '/projects/prj_1?tab=claims', title: 'Release the retention early',
      text: 'PRJ-2026-001 (emergency lighting) is in its liability period and the customer holds AED 3,290.20. The owner or the manager may release it early by agreement: press Release early, then Submit to the customer.',
      why: 'The retention is the customer\'s security for defects, so releasing it before the end needs authority.',
      done: (s) => Boolean(retention1(s)) && retention1(s).status !== 'draft',
    },
    {
      id: 'certify2', as: 'staff_nadia', to: '/projects/prj_1?tab=claims', title: 'Record the certificate of the release',
      text: 'The customer\'s engineer confirms the release like any other claim. On the retention release press Record the certificate.',
      why: 'The retention is a claim like the others: nothing is invoiced before the customer has confirmed the amount.',
      done: (s) => after(['certified', 'invoiced', 'paid'], retention1(s)?.status),
    },
    {
      id: 'invoice2', as: 'staff_priya', to: '/billing', title: 'Invoice the retention',
      text: 'The certified release is in "Ready to invoice". Press Make invoice on its row, then Issue invoice.',
      why: 'VAT on the retention is charged when it is released (a sample rule).',
      done: (s) => after(['invoiced', 'paid'], retention1(s)?.status),
    },
    {
      id: 'pay2', as: 'staff_priya', to: (s) => (retention1(s)?.invoiceId ? `/billing/${retention1(s).invoiceId}` : '/billing'), title: 'Record the payment',
      text: 'On the invoice open the "⋯" menu, choose Record a payment and press Record payment. When the retention is paid the project is complete.',
      why: 'The last payment closes the project by itself: nobody has to remember to close it.',
      done: (s) => prj1(s)?.phase === 'complete',
    },
  ],
};

// ---- 5. purchases, stock and a job --------------------------------------------------------------------------------------------
const stockVan = 'loc_staff_imran';

const STOCK = {
  id: 'stock',
  title: 'Buy stock, receive it, use it on a job',
  blurb: 'Two orders are sent and approved, a delivery arrives, its bill is recorded, and a technician uses parts from his van, which the store then tops up.',
  areas: ['Purchases', 'Inventory', 'Service', 'Reports'],
  steps: [
    {
      id: 'send', as: 'staff_faisal', to: '/purchases/po_26', title: 'Send the draft order to the supplier',
      text: 'PO-2026-0026 (60 extinguishers, AED 6,300 before VAT) is a draft. It is within the limit of the purchase officer, so it needs no approval: press Send to supplier, then Send order.',
      why: 'Approval depends on the value: small orders are not held up.',
      done: (s) => s.purchaseOrders.po_26?.status !== 'draft',
    },
    {
      id: 'approve', as: 'staff_omar', to: '/purchases/po_25', title: 'Approve the big order',
      text: 'PO-2026-0025 (200 smoke detectors, AED 12,800 before VAT) is above the limit of the purchase officer, so it waits for the operations manager. Open it and press Approve, then Approve again in the box.',
      why: 'The person who asked never approves, unless the owner.',
      done: (s) => !['draft', 'waiting_approval'].includes(s.purchaseOrders.po_25?.status),
    },
    {
      id: 'send2', as: 'staff_faisal', to: '/purchases/po_25', title: 'Send the approved order',
      text: 'Now the order can go to the supplier: press Send to supplier, then Send order. Nothing really leaves the prototype.',
      why: 'An order that was not approved cannot be sent: the system holds it.',
      done: (s) => s.purchaseOrders.po_25?.status === 'sent',
    },
    {
      id: 'receive', as: 'staff_bilal', to: '/purchases/po_24', title: 'Receive the goods',
      text: 'PO-2026-0024 (three items for the store) is due on 3 October. When the goods arrive the storekeeper presses Receive goods, checks what came (the box starts with everything that is outstanding) and presses Receive goods.',
      why: 'A delivery adds to the stock balance and moves the average cost, in one step.',
      done: (s) => rows(s.receipts).some((r) => r.poId === 'po_24'),
    },
    {
      id: 'bill', as: 'staff_priya', to: '/purchases/po_24', title: 'Record the supplier\'s bill',
      text: 'The accountant presses Record bill, types the supplier\'s invoice number (any text) and presses Record bill again. The lines start with what was received. Change a quantity or a price and an orange box says the bill does not match the order and the delivery (the three-way check); it may still be recorded.',
      why: 'A bill is checked against what was ordered and what arrived before it is paid.',
      done: (s) => rows(s.bills).some((b) => b.poId === 'po_24'),
    },
    {
      id: 'use', as: 'staff_imran', to: '/service/jobs/jb_1', title: 'Use parts on a job',
      text: 'Imran is at Palm Grove (JOB-2026-0578). Scroll down to "Parts used and time", choose the addressable smoke detector, write 3 and press Add. They come out of his van.',
      why: 'The parts of a job come from the technician\'s own van, so the van is counted, not guessed.',
      done: (s) => (s.jobs.jb_1?.parts.length ?? 0) > 0,
    },
    {
      id: 'topup', as: 'staff_bilal', to: '/inventory/stock', title: 'Top up the van',
      text: 'On Stock choose the Van 2 tab. The blue line says what the van lacks against its usual level: press Top up from the store, then Transfer.',
      why: 'A van has a usual stock; the store fills the difference, and the ledger shows every move.',
      done: (s) => rows(s.movements).some((m) => m.kind === 'transfer_in' && m.locationId === stockVan && m.on === todayISO()),
    },
    {
      id: 'look', look: true, as: 'staff_layla', to: '/reports/stock', title: 'See the value of the stock',
      text: 'The Stock report shows what the stock is worth, what is still low, and what moved in the period.',
      why: 'The balance is worked out from the ledger, so the report agrees with the store to the last unit.',
    },
  ],
};

export const JOURNEYS = [PROJECT, REPAIR, CONTRACT, RETENTION, STOCK];
export const JOURNEY_BY_ID = Object.fromEntries(JOURNEYS.map((j) => [j.id, j]));

/**
 * Where a journey stands: every step with its person and page worked out from the state, whether it is done,
 * and the first step still to do (`next`, or -1 when every counted step is done). Steps with `look` are not counted.
 */
export function journeyProgress(journey, s) {
  const steps = journey.steps.map((step) => ({
    ...step,
    person: typeof step.as === 'function' ? step.as(s) : step.as,
    path: typeof step.to === 'function' ? step.to(s) : step.to,
    done: step.look ? false : Boolean(step.done(s)),
  }));
  const counted = steps.filter((x) => !x.look);
  const done = counted.filter((x) => x.done).length;
  return { steps, done, total: counted.length, next: steps.findIndex((x) => !x.look && !x.done), finished: done === counted.length };
}
