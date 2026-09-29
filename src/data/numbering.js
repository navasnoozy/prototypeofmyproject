// Document numbers. One counter per kind; the year is the current year.
// The formats are samples: the real ones are a setting of each tenant.
const pad = (n, w) => String(n).padStart(w, '0');
const yr = () => new Date().getFullYear();

export const NUMBER_FORMATS = {
  customer: (n) => `CUS-${pad(n, 4)}`,
  enquiry: (n) => `ENQ-${yr()}-${pad(n, 4)}`,
  quotation: (n) => `QT-${yr()}-${pad(n, 4)}`,
  contract: (n) => `AMC-${yr()}-${pad(n, 4)}`,
  job: (n) => `JOB-${yr()}-${pad(n, 4)}`,
  deficiency: (n) => `DEF-${yr()}-${pad(n, 4)}`,
  report: (n) => `SR-${yr()}-${pad(n, 4)}`,
  project: (n) => `PRJ-${yr()}-${pad(n, 3)}`,
  po: (n) => `PO-${yr()}-${pad(n, 4)}`,
  grn: (n) => `GRN-${yr()}-${pad(n, 4)}`,
  invoice: (n) => `INV-${yr()}-${pad(n, 4)}`,
  creditNote: (n) => `CN-${yr()}-${pad(n, 4)}`,
  receipt: (n) => `RCT-${yr()}-${pad(n, 4)}`,
  certificate: (n) => `MC-${yr()}-${pad(n, 4)}`,
};
