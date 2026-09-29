// The words and states of Purchases and Inventory, in one place so that a state
// looks and reads the same on every screen. No imports: the seed, the rules and
// the screens all use this file.

// A purchase order. `draft`, `waiting_approval`, `approved`, `sent` and
// `cancelled` are stored; the rest is worked out from the deliveries and the
// supplier bills (see purchaseRules.orderStatus).
export const PO_STATUS = {
  draft: ['neutral', 'Draft'],
  waiting_approval: ['orange', 'Waiting approval'],
  approved: ['violet', 'Approved'],
  sent: ['blue', 'Sent'],
  partly_received: ['orange', 'Partly received'],
  received: ['green', 'Received'],
  closed: ['neutral', 'Closed'],
  cancelled: ['neutral', 'Cancelled'],
};

// What an order is bought for. Stock goes into the store or a van and is used
// later; a project or a job is charged with the order at once (the goods do
// not pass through the stock balances).
export const PO_PURPOSE = {
  stock: 'For stock',
  project: 'For a project',
  job: 'For a job',
};

export const PO_PURPOSE_HINT = {
  stock: 'Goods for the store or a van. They are used later on jobs and projects.',
  project: 'Goods bought for one project. The cost goes to the project at once.',
  job: 'A part for one job, such as a repair. The cost goes to the job.',
};

// A supplier bill against an order.
export const BILL_STATUS = {
  due: ['blue', 'To pay'],
  overdue: ['red', 'Overdue'],
  paid: ['green', 'Paid'],
};

export const SUPPLIER_KINDS = ['Distributor', 'Manufacturer', 'Importer', 'Contractor'];
export const PAYMENT_TERMS = [
  { value: '0', label: 'Cash on delivery' },
  { value: '30', label: 'Net 30 days' },
  { value: '45', label: 'Net 45 days' },
  { value: '60', label: 'Net 60 days' },
  { value: '90', label: 'Net 90 days' },
];

// Every change of a stock balance is one row of the movements table, with a
// sign (plus adds, minus takes away) and the cost of the item at that time.
export const MOVEMENT_KINDS = {
  opening: 'Opening balance',
  receipt: 'Received from a supplier',
  issue_job: 'Used on a job',
  return_job: 'Taken off a job',
  issue_project: 'Issued to a project',
  return_project: 'Returned from a project',
  transfer_out: 'Transferred out',
  transfer_in: 'Transferred in',
  count: 'Stock count',
};

export const MOVEMENT_TONE = {
  opening: 'neutral', receipt: 'green', issue_job: 'blue', return_job: 'blue', issue_project: 'violet',
  return_project: 'violet', transfer_out: 'orange', transfer_in: 'orange', count: 'neutral',
};

// The reasons offered when a count differs from the books.
export const COUNT_REASONS = ['Counted differently', 'Damaged or expired', 'Lost or not recorded', 'Found and not recorded'];

// The places where stock is kept. The main store is fixed; each technician who
// has a van gets a place named after the van.
export const STORE_ID = 'loc_store';
export const vanLocationId = (staffId) => `loc_${staffId}`;

// The stock state of an item, for the badge next to it.
export const STOCK_STATE = {
  ok: ['green', 'In stock'],
  ordered: ['blue', 'Ordered'],
  low: ['orange', 'Below minimum'],
  out: ['red', 'Out of stock'],
};

// The approval of an order is kept in the order, like the approval of a quotation.
export const emptyPOApproval = () => ({
  required: null, reasons: [], requestedBy: '', requestedOn: '', comment: '',
  decision: '', decidedBy: '', decidedOn: '', decisionNote: '',
});
