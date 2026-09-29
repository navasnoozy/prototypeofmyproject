import { HardHatIcon, FileSignatureIcon, PackageIcon, WrenchIcon } from 'lucide-react';

// The four kinds of quotation (record 39, point 4): one quotation, four kinds.
export const KINDS = {
  project: {
    label: 'Project',
    icon: HardHatIcon,
    blurb: 'Install or upgrade a system: a bill of quantities, stages and payments.',
    listNoun: 'projects',
  },
  contract: {
    label: 'Contract',
    icon: FileSignatureIcon,
    blurb: 'Annual maintenance: the systems covered, the visits and a yearly fee.',
    listNoun: 'contracts',
  },
  repair: {
    label: 'Repair',
    icon: WrenchIcon,
    blurb: 'Fix a fault or a deficiency: parts, labour and a call-out.',
    listNoun: 'repairs',
  },
  supply: {
    label: 'Supply',
    icon: PackageIcon,
    blurb: 'Sell equipment or refills: items and a delivery.',
    listNoun: 'supplies',
  },
};

export const KIND_OPTIONS = Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label, sub: k.blurb, icon: k.icon }));

export const ENQUIRY_SOURCES = {
  phone: 'Phone call',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  tender: 'Tender invitation',
  referral: 'Referral',
  walk_in: 'Walk-in',
  website: 'Website',
  renewal: 'Renewal of a contract',
};

export const LOST_REASONS = [
  'Price too high',
  'Chose a competitor',
  'Project cancelled or postponed',
  'Scope changed',
  'No answer from the customer',
  'We declined to quote',
  'Other',
];

export const ANSWER_VIA = {
  signed: 'Signed quotation',
  lpo: 'Customer order (LPO)',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  phone: 'Phone call',
};

export const URGENCY = { normal: 'Normal', urgent: 'Urgent', emergency: 'Emergency' };

// What a new quotation of each kind starts with. These are samples; the real
// terms come from the company's templates (record 39: "quotation templates
// and terms" belong to Sales).
export const defaultTerms = (kind) => ({
  project: {
    payment: '30% advance with the order, progress payments against certified claims, 10% retention released after handover.',
    delivery: 'Completion within the period stated, from the date of the advance payment and site access.',
    warranty: '12 months from handover for materials and workmanship.',
    exclusions: 'Civil, electrical supply and cutting or making good work; permits and fees of the authorities unless listed; work outside normal working hours.',
    notes: '',
  },
  contract: {
    payment: 'Billed in advance for each period, payable within the customer\'s credit terms.',
    delivery: 'Visits are planned with the customer\'s contact at least one week ahead.',
    warranty: '',
    exclusions: 'Spare parts, batteries and consumables are charged separately unless listed. Repairs found during visits are quoted separately.',
    notes: 'The contract is submitted for the authority\'s approval before the first visit (sample: to be confirmed for each emirate).',
  },
  repair: {
    payment: '50% with the order for parts, the balance on completion.',
    delivery: 'Work starts within the days stated, after approval and access to the site.',
    warranty: '6 months on parts and workmanship.',
    exclusions: 'Faults not listed in this quotation. Any further fault found is reported and quoted separately.',
    notes: '',
  },
  supply: {
    payment: 'Cash on delivery, or as per the customer\'s credit terms.',
    delivery: 'Delivery to the address stated, within the days stated after the order.',
    warranty: 'Manufacturer\'s warranty.',
    exclusions: 'Installation, unless a line says so.',
    notes: '',
  },
}[kind]);

export const defaultKindData = (kind, today) => ({
  project: { durationWeeks: 8, advancePct: 30, retentionPct: 10, cdApproval: 'contractor' },
  contract: { termMonths: 12, startOn: today, visitsPerYear: 4, billing: 'quarterly', responseHours: 4 },
  repair: { urgency: 'normal', deficiencyRef: '', warrantyMonths: 6, durationDays: 3 },
  supply: { deliveryDays: 7, deliveryTerms: 'delivered' },
}[kind]);

export const emptyApproval = () => ({
  required: null, reasons: [], requestedBy: '', requestedOn: '', comment: '',
  decision: '', decidedBy: '', decidedOn: '', decisionNote: '',
});

export const ITEM_CATEGORIES = [
  'Fire alarm', 'Sprinkler and hydrant', 'Pumps and tanks', 'Extinguishers', 'Emergency lighting', 'Suppression',
  'Voice alarm', 'Smoke control', 'Labour and services', 'Documentation and approvals', 'Maintenance rates',
];
export const ITEM_UNITS = ['nos', 'm', 'set', 'lot', 'hour', 'visit', 'point', 'kg', 'panel', 'zone', 'pump', 'per 100'];
