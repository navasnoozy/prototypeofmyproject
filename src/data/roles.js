// Who sees what. The navigation is the same list for everyone; a person sees
// an area only when the person's permissions allow something inside it
// (record 39, point 10). "edit" works there, "view" only reads. The table
// follows the study behind record 39 (section "What the navigation must
// support": works in / reads); it is one of the things the prototype tests.

const ALL_EDIT = {
  home: 'edit', customers: 'edit', sales: 'edit', service: 'edit', projects: 'edit',
  schedule: 'edit', purchases: 'edit', inventory: 'edit', billing: 'edit', reports: 'edit',
};

// `authority` is the level of approval a person may give (quotations now,
// purchase orders and credit notes later): 0 none, 1 manager, 2 owner.
export const ROLES = {
  owner: { label: 'Owner', authority: 2, access: ALL_EDIT },
  manager: { label: 'Operations manager', authority: 1, access: ALL_EDIT },
  sales: {
    label: 'Sales executive',
    authority: 0,
    access: { home: 'edit', customers: 'edit', sales: 'edit', service: 'view', projects: 'view' },
  },
  coordinator: {
    label: 'Service coordinator',
    authority: 0,
    access: { home: 'edit', customers: 'edit', service: 'edit', schedule: 'edit', sales: 'view', inventory: 'view', billing: 'view' },
  },
  technician: {
    label: 'Technician',
    authority: 0,
    phoneFirst: true,
    access: { home: 'edit', customers: 'view', service: 'edit', schedule: 'view', inventory: 'view' },
  },
  engineer: {
    label: 'Project engineer',
    authority: 0,
    access: { home: 'edit', projects: 'edit', schedule: 'edit', customers: 'view', sales: 'view', purchases: 'view', inventory: 'view' },
  },
  purchasing: {
    label: 'Purchase officer',
    authority: 0,
    access: { home: 'edit', purchases: 'edit', inventory: 'view', projects: 'view' },
  },
  storekeeper: {
    label: 'Storekeeper',
    authority: 0,
    access: { home: 'edit', inventory: 'edit', purchases: 'view' },
  },
  accountant: {
    label: 'Accountant',
    authority: 0,
    access: { home: 'edit', billing: 'edit', customers: 'view', purchases: 'view', reports: 'view' },
  },
};

export const APPROVER_LABEL = { 1: 'operations manager', 2: 'owner' };
