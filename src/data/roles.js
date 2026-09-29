// Who sees what. The navigation is the same list for everyone; a person sees
// an area only when the person's permissions allow something inside it
// (record 39, point 10). "edit" works there, "view" only reads. The table
// follows the study behind record 39 (section "What the navigation must
// support": works in / reads); it is one of the things the prototype tests.

const ALL_EDIT = {
  home: 'edit', customers: 'edit', sales: 'edit', service: 'edit', projects: 'edit',
  schedule: 'edit', purchases: 'edit', inventory: 'edit', billing: 'edit', reports: 'edit',
};

// What a person may DO inside an area, one step finer than "edit". The screens
// ask `may(action)`; the list of each role is `can`. The owner and the
// operations manager may do everything.
export const ACTIONS = {
  request_purchase: 'Raise purchase orders and send them for approval',
  approve_orders: 'Approve purchase orders (within the authority level)',
  manage_suppliers: 'Add and change suppliers',
  receive_goods: 'Receive goods into the store or a van',
  receive_site: 'Confirm deliveries made straight to a site',
  stock_control: 'Transfer stock between places and count stock',
  issue_stock: 'Issue stock to a project',
  record_bills: 'Record supplier bills',
  pay_bills: 'Mark supplier bills as paid',
  edit_items: 'Add and change items and prices',
  see_cost: 'See what items cost the company',
  stock_alerts: 'See what is low in stock',
  use_van: 'Use a van (see its stock and top-up needs)',
};
const EVERY = Object.keys(ACTIONS);

// `authority` is the level of approval a person may give (quotations and
// purchase orders now, credit notes later): 0 none, 1 manager, 2 owner.
export const ROLES = {
  owner: { label: 'Owner', authority: 2, access: ALL_EDIT, can: EVERY },
  manager: { label: 'Operations manager', authority: 1, access: ALL_EDIT, can: EVERY },
  sales: {
    label: 'Sales executive',
    authority: 0,
    access: { home: 'edit', customers: 'edit', sales: 'edit', service: 'view', projects: 'view', inventory: 'view' },
    can: ['edit_items', 'see_cost'],
  },
  coordinator: {
    label: 'Service coordinator',
    authority: 0,
    access: { home: 'edit', customers: 'edit', service: 'edit', schedule: 'edit', sales: 'view', inventory: 'view', billing: 'view' },
    can: ['receive_site'],
  },
  technician: {
    label: 'Technician',
    authority: 0,
    phoneFirst: true,
    access: { home: 'edit', customers: 'view', service: 'edit', schedule: 'view', inventory: 'view' },
    can: ['use_van'],
  },
  engineer: {
    label: 'Project engineer',
    authority: 0,
    access: { home: 'edit', projects: 'edit', schedule: 'edit', customers: 'view', sales: 'view', purchases: 'view', inventory: 'view' },
    can: ['request_purchase', 'receive_site', 'issue_stock', 'see_cost'],
  },
  purchasing: {
    label: 'Purchase officer',
    authority: 0,
    access: { home: 'edit', purchases: 'edit', inventory: 'view', projects: 'view' },
    can: ['request_purchase', 'manage_suppliers', 'record_bills', 'see_cost', 'stock_alerts'],
  },
  storekeeper: {
    label: 'Storekeeper',
    authority: 0,
    access: { home: 'edit', inventory: 'edit', purchases: 'view' },
    can: ['receive_goods', 'stock_control', 'issue_stock', 'edit_items', 'see_cost', 'stock_alerts'],
  },
  accountant: {
    label: 'Accountant',
    authority: 0,
    access: { home: 'edit', billing: 'edit', customers: 'view', purchases: 'view', reports: 'view' },
    can: ['record_bills', 'pay_bills', 'see_cost'],
  },
};

export const APPROVER_LABEL = { 1: 'operations manager', 2: 'owner' };
