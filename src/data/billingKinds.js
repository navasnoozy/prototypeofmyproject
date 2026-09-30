// The words and states of Billing, in one place so that a state looks and reads
// the same on every screen. No imports: the seed, the rules and the screens all
// use this file.

// The state of an invoice as people see it. `draft` is stored; the rest is worked
// out from what has been received and credited and from the due day (see
// billingRules.invoiceState). A paid, an overdue and an unpaid invoice are all
// "issued" in the stored data.
export const INVOICE_STATE = {
  draft: ['neutral', 'Draft'],
  due: ['blue', 'Unpaid'],
  overdue: ['red', 'Overdue'],
  partly_paid: ['orange', 'Partly paid'],
  paid: ['green', 'Paid'],
  credited: ['neutral', 'Credited'],
};

export const CREDIT_NOTE_STATUS = {
  draft: ['neutral', 'Draft'],
  waiting_approval: ['orange', 'Waiting approval'],
  issued: ['green', 'Issued'],
};

// Where an invoice comes from. Every source but "manual" is filled in from a
// record of another area, so nothing is typed twice.
export const INVOICE_SOURCE = {
  contract: 'Maintenance contract',
  claim: 'Project claim',
  job: 'Job',
  supply: 'Supply of goods',
  manual: 'Other',
};

export const PAYMENT_METHODS = {
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  cash: 'Cash',
  card: 'Card',
};

export const CREDIT_REASONS = [
  'Wrong quantity or price',
  'Service not done or not needed',
  'Goods returned',
  'Scope of the contract changed',
  'Dispute settled with the customer',
  'Other',
];

// The ageing of what customers owe, counted from the due day.
export const AGE_BUCKETS = [
  { key: 'current', label: 'Not due yet' },
  { key: 'd30', label: '1 to 30 days' },
  { key: 'd60', label: '31 to 60 days' },
  { key: 'd90', label: '61 to 90 days' },
  { key: 'd90p', label: 'Over 90 days' },
];

// The approval of a credit note is kept in the credit note, like the approval of a
// quotation or a purchase order.
export const emptyCreditApproval = () => ({
  required: null, reasons: [], requestedBy: '', requestedOn: '', comment: '',
  decision: '', decidedBy: '', decidedOn: '', decisionNote: '',
});

/** "Net 45" is 45 days, "Cash" is 0. An unreadable text counts as 30. */
export const termsDays = (terms) => {
  if (/cash/i.test(terms ?? '')) return 0;
  const n = Number(/(\d+)/.exec(terms ?? '')?.[1]);
  return Number.isFinite(n) ? n : 30;
};
