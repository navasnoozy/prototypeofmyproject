// The people of the demo company. Every e-mail uses the reserved ".example"
// domain and every phone number the 555 range, so nothing here can reach a
// real person.
export const COMPANY = {
  name: 'Desert Sentinel Fire & Safety LLC',
  short: 'Desert Sentinel',
  trn: '100987654300003',
  address: 'Warehouse 8, Al Quoz Industrial Area 2, Dubai',
  phone: '+971 4 555 0100',
  email: 'office@desertsentinel.example',
  // Sample: the class of contractor licence and its number are assumptions.
  licence: 'Dubai Civil Defence contractor licence (sample number CD-2291)',
};

const P = (id, name, roleKey, title, phone, extra = {}) => ({
  id,
  name,
  roleKey,
  title,
  phone,
  email: `${name.toLowerCase().replace(/[^a-z ]/g, '').replace(/ +/g, '.')}@desertsentinel.example`,
  ...extra,
});

export const STAFF = [
  P('staff_layla', 'Layla Nasser', 'owner', 'Managing director', '+971 50 555 0101'),
  P('staff_omar', 'Omar Haddad', 'manager', 'Operations manager', '+971 50 555 0102'),
  P('staff_sara', 'Sara Malik', 'sales', 'Sales executive and estimator', '+971 50 555 0103'),
  P('staff_hassan', 'Hassan Iqbal', 'coordinator', 'Service coordinator', '+971 50 555 0104'),
  P('staff_rashid', 'Rashid Ali', 'technician', 'Senior technician', '+971 50 555 0105', { van: 'Van 1 (Toyota Hiace)' }),
  P('staff_imran', 'Imran Qureshi', 'technician', 'Fire alarm technician', '+971 50 555 0106', { van: 'Van 2 (Nissan Urvan)' }),
  P('staff_joseph', 'Joseph Mathew', 'technician', 'Sprinkler technician', '+971 50 555 0107', { van: 'Van 3 (Toyota Hiace)' }),
  P('staff_nadia', 'Nadia Farouk', 'engineer', 'Project engineer', '+971 50 555 0108'),
  P('staff_faisal', 'Faisal Rahman', 'purchasing', 'Purchase officer', '+971 50 555 0109'),
  P('staff_bilal', 'Bilal Khan', 'storekeeper', 'Storekeeper', '+971 50 555 0110'),
  P('staff_priya', 'Priya Nair', 'accountant', 'Accountant', '+971 50 555 0111'),
];
