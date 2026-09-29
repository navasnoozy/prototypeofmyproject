// Who sees what. The navigation is the same list for everyone; a person sees
// an area only when the person's permissions allow something inside it
// (record 39, point 10). "edit" can change things, "view" can only read.
// This table is the prototype's guess and is one of the things to test.

const ALL_EDIT = {
  home: 'edit', customers: 'edit', sales: 'edit', service: 'edit', projects: 'edit',
  schedule: 'edit', purchases: 'edit', inventory: 'edit', billing: 'edit', reports: 'edit',
};

export const ROLES = {
  owner: { label: 'Owner', access: ALL_EDIT },
  manager: { label: 'Operations manager', access: ALL_EDIT },
  sales: {
    label: 'Sales executive',
    access: { home: 'edit', customers: 'edit', sales: 'edit' },
  },
  coordinator: {
    label: 'Service coordinator',
    access: { home: 'edit', customers: 'edit', service: 'edit', schedule: 'edit' },
  },
  technician: {
    label: 'Technician',
    phoneFirst: true,
    access: { home: 'edit', customers: 'view', service: 'edit', schedule: 'view', inventory: 'view' },
  },
  engineer: {
    label: 'Project engineer',
    access: { home: 'edit', customers: 'view', projects: 'edit', schedule: 'edit', inventory: 'view' },
  },
  purchasing: {
    label: 'Purchase officer',
    access: { home: 'edit', purchases: 'edit', inventory: 'view', projects: 'view' },
  },
  storekeeper: {
    label: 'Storekeeper',
    access: { home: 'edit', inventory: 'edit', purchases: 'view' },
  },
  accountant: {
    label: 'Accountant',
    access: { home: 'edit', customers: 'view', billing: 'edit', purchases: 'view', reports: 'view' },
  },
};
