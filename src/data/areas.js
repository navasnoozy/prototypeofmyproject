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
// chain. Pages are working names (the owner calls them sub modules). `tagline`
// is the short line of the sidebar popup, `actions` its quick "Create" entries
// (they also appear in the global search).
export const AREAS = [
  {
    id: 'home',
    label: 'Home',
    icon: HouseIcon,
    path: '/',
    purpose: 'What matters to me today.',
    tagline: 'What matters to me today',
    pages: [],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: UsersIcon,
    path: '/customers',
    purpose: 'Who we work for and where: customers, their sites, their contacts.',
    tagline: 'Who we work for and where',
    pages: [
      { id: 'customers', label: 'Customers', path: '/customers', blurb: 'Every company or person we work for, with terms and credit.' },
      { id: 'sites', label: 'Sites', path: '/customers/sites', blurb: 'Buildings and places, with their systems and equipment.' },
      { id: 'contacts', label: 'Contacts', path: '/customers/contacts', blurb: 'The people to call, by customer and by site.' },
    ],
    actions: [
      { label: 'New customer', sub: 'Add a company or a person we work for', path: '/customers/new' },
      { label: 'New site', sub: 'Add a building or a place', path: '/customers/sites/new' },
      { label: 'New contact', sub: 'Add a person to call', path: '/customers/contacts?new=1' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: FileTextIcon,
    path: '/sales',
    purpose: 'Winning work: enquiries and quotations of every kind.',
    tagline: 'Winning work',
    pages: [
      { id: 'enquiries', label: 'Enquiries', path: '/sales', blurb: 'Requests that come in, from first call to a quotation.' },
      { id: 'quotations', label: 'Quotations', path: '/sales/quotations', blurb: 'One quotation with four kinds: project, contract, repair, supply.' },
    ],
    actions: [
      { label: 'New enquiry', sub: 'Register a request from a customer', path: '/sales/new' },
      { label: 'New quotation', sub: 'Project, contract, repair or supply', path: '/sales/quotations/new' },
    ],
  },
  {
    id: 'service',
    label: 'Service',
    icon: WrenchIcon,
    path: '/service',
    purpose: 'Keeping installed systems working: contracts, visits, call-outs, deficiencies, repairs, equipment, certificates.',
    tagline: 'Keeping systems working',
    pages: [
      { id: 'contracts', label: 'Contracts', path: '/service', blurb: 'Annual maintenance contracts: terms, visit plan, billing plan.' },
      { id: 'jobs', label: 'Jobs', path: '/service/jobs', blurb: 'Planned visits, call-outs and repairs, from request to report.' },
      { id: 'deficiencies', label: 'Deficiencies', path: '/service/deficiencies', blurb: 'What was found wrong, how serious, and how it was resolved.' },
      { id: 'equipment', label: 'Equipment', path: '/service/equipment', blurb: 'All devices across all sites, with their due dates.' },
      { id: 'compliance', label: 'Compliance', path: '/service/compliance', blurb: 'Certificates and Civil Defence approvals (to be confirmed by research).' },
    ],
    actions: [
      { label: 'New call-out', sub: 'A customer reports a fault', path: '/service/jobs/new' },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: HardHatIcon,
    path: '/projects',
    purpose: 'Installing systems: the project from award to handover.',
    tagline: 'Installing systems',
    pages: [
      { id: 'projects', label: 'Projects', path: '/projects', blurb: 'Awarded installation work with budget, stages, variations and claims.' },
    ],
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: CalendarDaysIcon,
    path: '/schedule',
    purpose: 'Who goes where and when: planning all field work.',
    tagline: 'Who goes where and when',
    pages: [
      { id: 'board', label: 'Planning board', path: '/schedule', blurb: 'People by day, with work dragged onto them.' },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    icon: ShoppingCartIcon,
    path: '/purchases',
    purpose: 'Buying: suppliers, purchase orders, receipts, supplier bills.',
    tagline: 'Buying what we need',
    actions: [
      { label: 'New purchase order', sub: 'Order goods from a supplier', path: '/purchases/new' },
      { label: 'New supplier', sub: 'Add a company we buy from', path: '/purchases/suppliers?new=1' },
    ],
    pages: [
      { id: 'orders', label: 'Purchase orders', path: '/purchases', blurb: 'What we ordered, from whom, and what has arrived.' },
      { id: 'bills', label: 'Supplier bills', path: '/purchases/bills', blurb: 'What suppliers billed, what is due, what is paid.' },
      { id: 'suppliers', label: 'Suppliers', path: '/purchases/suppliers', blurb: 'Who we buy from, with terms and history.' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: PackageIcon,
    path: '/inventory',
    purpose: 'What we have and where: items, stock, movements.',
    tagline: 'What we have and where',
    actions: [
      { label: 'New item', sub: 'Add a product or a service to the catalogue', path: '/inventory?new=1' },
    ],
    pages: [
      { id: 'items', label: 'Items', path: '/inventory', blurb: 'Products and services we sell and use, with prices and stock levels.' },
      { id: 'stock', label: 'Stock', path: '/inventory/stock', blurb: 'What is in the store and in each van.' },
      { id: 'movements', label: 'Movements', path: '/inventory/movements', blurb: 'Every receipt, issue and transfer.' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: ReceiptIcon,
    path: '/billing',
    purpose: 'Invoices, credit notes, receipts, statements.',
    tagline: 'Invoices and money in',
    actions: [
      { label: 'New invoice', sub: 'Invoice something that has no other record', path: '/billing/new' },
      { label: 'New receipt', sub: 'Record money a customer paid', path: '/billing/receipts?new=1' },
    ],
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
    purpose: 'Figures across areas: money, sales, service, projects and stock.',
    tagline: 'Figures across areas',
    pages: [
      { id: 'money', label: 'Money', path: '/reports', blurb: 'Invoiced, received, owed and paid out, month by month.' },
      { id: 'sales', label: 'Sales', path: '/reports/sales', blurb: 'Quoted, won and lost, by kind of work and by person.' },
      { id: 'service', label: 'Service', path: '/reports/service', blurb: 'Contracts, visits, call-outs and open deficiencies.' },
      { id: 'projects', label: 'Projects', path: '/reports/projects', blurb: 'Value, cost against budget, claims and retention.' },
      { id: 'stock', label: 'Stock', path: '/reports/stock', blurb: 'What the stock is worth, what is low, what moved.' },
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

// The page of an area that a path belongs to: the page with the longest path
// that starts the address ("/customers/sites/x" belongs to "/customers/sites",
// not to "/customers").
export const currentPage = (area, pathname) => {
  let best = null;
  for (const page of area.pages) {
    const inside = pathname === page.path || pathname.startsWith(`${page.path}/`);
    if (inside && (!best || page.path.length > best.path.length)) best = page;
  }
  return best ?? area.pages[0] ?? null;
};
