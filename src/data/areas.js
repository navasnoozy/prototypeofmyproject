import {
  CalendarDaysIcon,
  ChartColumnIcon,
  FileTextIcon,
  HardHatIcon,
  HouseIcon,
  PackageIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  UsersIcon,
  WrenchIcon,
} from 'lucide-react';

// The ten areas of record 39 (still Proposed), in the order of the business
// chain. Pages are working names. `step` says in which step of the prototype
// the area is built; until then its page explains what will be there.
export const AREAS = [
  {
    id: 'home',
    label: 'Home',
    icon: HouseIcon,
    path: '/',
    step: 1,
    purpose: 'What matters to me today.',
    pages: [],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: UsersIcon,
    path: '/customers',
    step: 1,
    purpose: 'Who we work for and where: customers, their sites, their contacts.',
    pages: [
      { id: 'customers', label: 'Customers', path: '/customers', blurb: 'Every company or person we work for, with terms and credit.' },
      { id: 'sites', label: 'Sites', path: '/customers/sites', blurb: 'Buildings and places, with their systems and equipment.' },
      { id: 'contacts', label: 'Contacts', path: '/customers/contacts', blurb: 'The people to call, by customer and by site.' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: FileTextIcon,
    path: '/sales',
    step: 2,
    purpose: 'Winning work: enquiries and quotations of every kind.',
    pages: [
      { id: 'enquiries', label: 'Enquiries', path: '/sales', blurb: 'Requests that come in, from first call to a quotation.' },
      { id: 'quotations', label: 'Quotations', path: '/sales/quotations', blurb: 'One quotation with four kinds: project, contract, repair, supply.' },
    ],
  },
  {
    id: 'service',
    label: 'Service',
    icon: WrenchIcon,
    path: '/service',
    step: 3,
    purpose: 'Keeping installed systems working: contracts, visits, call-outs, deficiencies, repairs, equipment, certificates.',
    pages: [
      { id: 'contracts', label: 'Contracts', path: '/service', blurb: 'Annual maintenance contracts: terms, visit plan, billing plan.' },
      { id: 'jobs', label: 'Jobs', path: '/service/jobs', blurb: 'Planned visits, call-outs and repairs, from request to report.' },
      { id: 'deficiencies', label: 'Deficiencies', path: '/service/deficiencies', blurb: 'What was found wrong, how serious, and how it was resolved.' },
      { id: 'equipment', label: 'Equipment', path: '/service/equipment', blurb: 'All devices across all sites, with their due dates.' },
      { id: 'compliance', label: 'Compliance', path: '/service/compliance', blurb: 'Certificates and Civil Defence approvals (to be confirmed by research).' },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: HardHatIcon,
    path: '/projects',
    step: 5,
    purpose: 'Installing systems: the project from award to handover.',
    pages: [
      { id: 'projects', label: 'Projects', path: '/projects', blurb: 'Awarded installation work with budget, stages, variations and claims.' },
    ],
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: CalendarDaysIcon,
    path: '/schedule',
    step: 5,
    purpose: 'Who goes where and when: planning all field work.',
    pages: [
      { id: 'board', label: 'Planning board', path: '/schedule', blurb: 'People by day, with work dragged onto them.' },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    icon: ShoppingCartIcon,
    path: '/purchases',
    step: 6,
    purpose: 'Buying: suppliers, purchase orders, receipts, supplier bills.',
    pages: [
      { id: 'orders', label: 'Purchase orders', path: '/purchases', blurb: 'What we ordered, from whom, and what has arrived.' },
      { id: 'suppliers', label: 'Suppliers', path: '/purchases/suppliers', blurb: 'Who we buy from, with terms and history.' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: PackageIcon,
    path: '/inventory',
    step: 6,
    purpose: 'What we have and where: items, stock, movements.',
    pages: [
      { id: 'items', label: 'Items', path: '/inventory', blurb: 'The catalogue of products and services we sell and use.' },
      { id: 'stock', label: 'Stock', path: '/inventory/stock', blurb: 'What is in the store and in each van.' },
      { id: 'movements', label: 'Movements', path: '/inventory/movements', blurb: 'Every receipt, issue and transfer.' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: ReceiptIcon,
    path: '/billing',
    step: 7,
    purpose: 'Invoices, credit notes, receipts, statements.',
    pages: [
      { id: 'invoices', label: 'Invoices', path: '/billing', blurb: 'Tax invoices, from draft to paid.' },
      { id: 'receipts', label: 'Receipts', path: '/billing/receipts', blurb: 'Money received and which invoices it settles.' },
      { id: 'credit-notes', label: 'Credit notes', path: '/billing/credit-notes', blurb: 'Corrections to issued invoices.' },
      { id: 'statements', label: 'Statements', path: '/billing/statements', blurb: 'What each customer owes, with ageing.' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: ChartColumnIcon,
    path: '/reports',
    step: 8,
    purpose: 'Figures across areas.',
    pages: [
      { id: 'reports', label: 'Reports', path: '/reports', blurb: 'Sales, service, projects, stock and money in one place.' },
    ],
  },
];

export const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));

// The area a path belongs to: "/customers/sites/x" belongs to "customers".
export const areaOfPath = (pathname) => {
  if (pathname === '/') return AREA_BY_ID.home;
  const first = pathname.split('/')[1];
  return AREAS.find((a) => a.id === first) ?? null;
};
