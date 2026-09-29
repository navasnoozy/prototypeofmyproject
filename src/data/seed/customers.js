import { addDays } from '../../lib/dates.js';

// Sample customers, sites and contacts. Names are invented; addresses use
// real Dubai areas only so the demo feels right. Numbers are samples.

const cus = (id, name, o) => ({
  id,
  name,
  type: 'company',
  group: '',
  trn: '',
  phone: '',
  email: '',
  address: '',
  area: '',
  emirate: 'Dubai',
  terms: 'Net 30',
  creditLimit: 0,
  salesOwner: 'staff_sara',
  status: 'active',
  notes: '',
  ...o,
});

export function buildCustomers(T) {
  const D = (n) => addDays(T, n);
  const list = [
    cus('cus_marina', 'Marina Crest Owners Association', {
      segment: 'Residential', phone: '+971 4 555 0111', email: 'board@marinacrest.example',
      address: 'Marina Crest Towers, Al Marsa Street', area: 'Dubai Marina',
      terms: 'Net 30', creditLimit: 50000, since: D(-1400),
      notes: 'The board meets monthly. Repair quotations above AED 10,000 need the board\'s approval. The bills are paid by Al Noor Facilities Management (bill-to).',
    }),
    cus('cus_alnoor', 'Al Noor Facilities Management LLC', {
      segment: 'Facilities management', group: 'Al Noor Group', trn: '100234567800003',
      phone: '+971 4 555 0122', email: 'accounts@alnoorfm.example',
      address: 'Office 1207, Bayview Business Tower', area: 'Business Bay',
      terms: 'Net 45', creditLimit: 250000, since: D(-1500),
      notes: 'Manages many buildings and pays for the ones we serve. Wants one statement a month, split by building.',
    }),
    cus('cus_harbour', 'Harbour View Residences Owners Association', {
      segment: 'Residential', phone: '+971 4 555 0133', email: 'board@harbourview.example',
      address: 'Cluster T, Jumeirah Lake Towers', area: 'Jumeirah Lake Towers',
      terms: 'Net 30', creditLimit: 40000, since: D(-1100),
    }),
    cus('cus_meridian', 'Gulf Meridian Hotel LLC', {
      segment: 'Hospitality', group: 'Meridian Hospitality', trn: '100345678900003',
      phone: '+971 4 555 0144', email: 'engineering@gulfmeridian.example',
      address: 'Beach Road', area: 'Jumeirah 1',
      terms: 'Net 45', creditLimit: 400000, salesOwner: 'staff_layla', since: D(-1800),
      notes: 'The chief engineer approves all work. The kitchen and the server room can only be worked on at night. Guests must never be disturbed.',
    }),
    cus('cus_palm', 'Palm Grove Medical Centre LLC', {
      segment: 'Healthcare', trn: '100456789000003', phone: '+971 4 555 0155',
      email: 'facilities@palmgrove.example', address: 'Building 7', area: 'Al Barsha 1',
      terms: 'Net 30', creditLimit: 150000, since: D(-900),
      notes: 'No work on the fire alarm during theatre hours (07:00 to 15:00). Two weeks\' notice for any shutdown.',
    }),
    cus('cus_sahara', 'Sahara Logistics Park LLC', {
      segment: 'Industrial', trn: '100567890100003', phone: '+971 4 555 0166',
      email: 'operations@saharalogistics.example', address: 'Plot 597-1450, Dubai Investments Park 2',
      area: 'Dubai Investments Park', terms: 'Net 60', creditLimit: 600000, since: D(-1300),
      notes: 'Large sprinkler and pump installations. The pump room needs a work permit. 48 hours\' notice for pump tests.',
    }),
    cus('cus_falcon', 'Falcon Ridge Real Estate PJSC', {
      segment: 'Office', group: 'Falcon Ridge Group', trn: '100678901200003',
      phone: '+971 4 555 0177', email: 'assetmanagement@falconridge.example',
      address: 'Falcon Ridge Tower', area: 'Business Bay',
      terms: 'Net 45', creditLimit: 500000, since: D(-1000),
    }),
    cus('cus_zenith', 'Zenith Contracting LLC', {
      segment: 'Contractor', trn: '100789012300003', phone: '+971 4 555 0188',
      email: 'procurement@zenithcontracting.example', address: 'Zenith House, Al Quoz Industrial Area 1',
      area: 'Al Quoz', terms: 'Net 60', creditLimit: 1000000, salesOwner: 'staff_layla', since: D(-600),
      notes: 'Main contractor. We work for them as the fire fighting and fire alarm subcontractor. 10% retention is held until handover.',
    }),
    cus('cus_rose', 'Desert Rose Restaurants Group LLC', {
      segment: 'Food and beverage', trn: '100890123400003', phone: '+971 4 555 0199',
      email: 'finance@desertrose.example', address: 'Unit 3, Ras Al Khor Industrial Area 2',
      area: 'Ras Al Khor', terms: 'Net 30', creditLimit: 60000, status: 'on_hold', since: D(-700),
      notes: 'ON HOLD: two invoices are more than 60 days overdue. Release after payment, or a written promise from the finance manager.',
    }),
    cus('cus_oasis', 'Oasis Cold Storage LLC', {
      segment: 'Industrial', trn: '100901234500003', phone: '+971 4 555 0210',
      email: 'ops@oasiscold.example', address: 'Warehouse 12, Al Quoz Industrial Area 3',
      area: 'Al Quoz', terms: 'Net 30', creditLimit: 120000, since: D(-800),
    }),
    cus('cus_bright', 'Bright Minds International School', {
      segment: 'Education', trn: '100012345600003', phone: '+971 4 555 0221',
      email: 'admin@brightminds.example', address: 'Street 14', area: 'Al Barsha South',
      terms: 'Net 30', creditLimit: 100000, since: D(-1200),
      notes: 'Work in school holidays or after 15:30 only. Fire drills are held in March and October: no visit on a drill day.',
    }),
    cus('cus_mall', 'Al Barsha Central Mall Management LLC', {
      segment: 'Retail', trn: '100123456700003', phone: '+971 4 555 0232',
      email: 'mallops@albarshacentral.example', address: 'Al Barsha Central Mall, Sheikh Mohammed bin Zayed Road',
      area: 'Al Barsha 1', terms: 'Net 45', creditLimit: 350000, salesOwner: 'staff_omar', since: D(-1600),
    }),
    cus('cus_khalid', 'Khalid Al Mansoori', {
      type: 'individual', segment: 'Residential', phone: '+971 50 555 0243',
      email: 'khalid.mansoori@example.com', address: 'Villa 21, Street 8B', area: 'Al Safa',
      terms: 'Cash', creditLimit: 0, since: D(-300),
    }),
    cus('cus_wasl', 'Al Wasl Auto Service Centre', {
      segment: 'Industrial', phone: '+971 4 555 0254', email: 'service@alwaslauto.example',
      address: 'Shop 4, Street 9', area: 'Ras Al Khor', terms: 'Cash', creditLimit: 0, since: D(-500),
      notes: 'Refills and yearly checks of their extinguishers. Pays on collection.',
    }),
    cus('cus_green', 'Green Valley Supermarkets LLC', {
      segment: 'Retail', trn: '100234501200003', phone: '+971 4 555 0265',
      email: 'accounts@greenvalley.example', address: 'Head office, Al Warqa 1', area: 'Al Warqa',
      terms: 'Net 30', creditLimit: 90000, since: D(-450),
    }),
    cus('cus_crescent', 'Crescent Bay Dental Clinic', {
      segment: 'Healthcare', phone: '+971 4 555 0276', email: 'reception@crescentbay.example',
      address: 'Villa 12, Al Wasl Road', area: 'Jumeirah 3', terms: 'Net 15', creditLimit: 15000, since: D(-200),
    }),
    cus('cus_nexus', 'Nexus Data Centre FZ-LLC', {
      segment: 'Data centre', trn: '100345601200003', phone: '+971 4 555 0287',
      email: 'facilities@nexusdc.example', address: 'Building A2, Dubai Silicon Oasis',
      area: 'Dubai Silicon Oasis', terms: 'Net 30', creditLimit: 300000, salesOwner: 'staff_layla', since: D(-950),
      notes: 'Clean-agent rooms: never test a discharge without written approval from the data centre manager.',
    }),
    cus('cus_mussafah', 'Mussafah Steel Works LLC', {
      segment: 'Industrial', trn: '100456712300003', phone: '+971 2 555 0298',
      email: 'plant@mussafahsteel.example', address: 'Plot M-17, Mussafah Industrial Area',
      area: 'Mussafah', emirate: 'Abu Dhabi', terms: 'Net 45', creditLimit: 200000, since: D(-400),
      notes: 'Abu Dhabi: the contractor class and the compliance rules differ from Dubai (sample, to be confirmed).',
    }),
    cus('cus_sharjah', 'Sharjah Plastics Factory LLC', {
      segment: 'Industrial', trn: '100567823400003', phone: '+971 6 555 0309',
      email: 'factory@sharjahplastics.example', address: 'Sharjah Industrial Area 13',
      area: 'Sharjah Industrial Area', emirate: 'Sharjah', terms: 'Net 30', creditLimit: 100000, since: D(-350),
    }),
  ];
  return Object.fromEntries(list.map((c) => [c.id, c]));
}

const site = (id, customerId, name, o) => ({
  id,
  customerId,
  billToId: customerId,
  name,
  emirate: 'Dubai',
  stage: 'operating',
  status: 'active',
  floors: 1,
  builtUp: 0,
  access: '',
  civilDefence: null,
  ...o,
});

// Sample Civil Defence file data. Kept as data of the site; the real owner is
// the service module (record 39, point 8).
const cd = (fileNo, inspectedDaysAgo, validDays, T) => ({
  fileNo,
  lastInspection: addDays(T, -inspectedDaysAgo),
  certificateExpiry: addDays(T, validDays),
});

export function buildSites(T) {
  const list = [
    site('site_marina', 'cus_marina', 'Marina Crest Towers', {
      billToId: 'cus_alnoor', address: 'Al Marsa Street', area: 'Dubai Marina', type: 'Residential tower',
      floors: 46, builtUp: 120000, civilDefence: cd('DCD-M-20418', 140, 225, T),
      access: 'Report to the security desk at the podium entrance. The fire command centre key is with the building manager.',
    }),
    site('site_harbour', 'cus_harbour', 'Harbour View Residences', {
      billToId: 'cus_alnoor', address: 'Cluster T', area: 'Jumeirah Lake Towers', type: 'Residential tower',
      floors: 38, builtUp: 84000, civilDefence: cd('DCD-J-31877', 210, 150, T),
      access: 'Security desk at the ground floor lobby. Parking P1 for the van (30 minutes).',
    }),
    site('site_meridian', 'cus_meridian', 'Gulf Meridian Hotel', {
      address: 'Beach Road', area: 'Jumeirah 1', type: 'Hotel', floors: 28, builtUp: 96000,
      civilDefence: cd('DCD-J-10233', 95, 270, T),
      access: 'Staff entrance at the back of house. Kitchen and server room only between 23:00 and 05:00.',
    }),
    site('site_meridian_staff', 'cus_meridian', 'Gulf Meridian Staff Accommodation', {
      address: 'Street 17, Al Quoz Industrial Area 4', area: 'Al Quoz', type: 'Staff accommodation',
      floors: 8, builtUp: 14000, civilDefence: cd('DCD-Q-44120', 300, 65, T),
      access: 'Camp boss holds the keys. Visits after 10:00 (night-shift staff sleep).',
    }),
    site('site_palm', 'cus_palm', 'Palm Grove Medical Centre', {
      address: 'Building 7', area: 'Al Barsha 1', type: 'Hospital / clinic', floors: 6, builtUp: 18000,
      civilDefence: cd('DCD-B-27764', 120, 245, T),
      access: 'Main reception. Theatre floor: sign in and wear shoe covers.',
    }),
    site('site_sahara1', 'cus_sahara', 'Sahara Logistics Park, Phase 1', {
      address: 'Plot 597-1450, Dubai Investments Park 2', area: 'Dubai Investments Park', type: 'Warehouse',
      floors: 1, builtUp: 42000, civilDefence: cd('DCD-D-58201', 70, 295, T),
      access: 'Gate 2. Pump room needs a work permit from the operations office.',
    }),
    site('site_sahara2', 'cus_sahara', 'Sahara Logistics Park, Phase 2', {
      address: 'Plot 597-1450, Dubai Investments Park 2', area: 'Dubai Investments Park', type: 'Warehouse',
      floors: 1, builtUp: 36000, civilDefence: cd('DCD-D-58202', 70, 295, T),
      access: 'Gate 3. Same permit as Phase 1.',
    }),
    site('site_falcon', 'cus_falcon', 'Falcon Ridge Business Tower', {
      address: 'Falcon Ridge Tower', area: 'Business Bay', type: 'Office tower', floors: 32, builtUp: 78000,
      civilDefence: cd('DCD-BB-19045', 180, 185, T),
      access: 'Loading bay B2 for equipment. Building manager on level 1.',
    }),
    site('site_creek', 'cus_zenith', 'Creek Harbour Tower B (under construction)', {
      address: 'Plot 24, Dubai Creek Harbour', area: 'Dubai Creek Harbour', type: 'Under construction',
      stage: 'construction', floors: 44, builtUp: 96000,
      access: 'Site induction and safety boots every visit. Working hours 07:00 to 17:00.',
    }),
    site('site_rose_bb', 'cus_rose', 'Desert Rose, Business Bay', {
      address: 'Ground floor, Bayview Business Tower', area: 'Business Bay', type: 'Restaurant / kitchen',
      floors: 1, builtUp: 420, civilDefence: cd('DCD-BB-70211', 200, 165, T),
    }),
    site('site_rose_jlt', 'cus_rose', 'Desert Rose, JLT', {
      address: 'Cluster D', area: 'Jumeirah Lake Towers', type: 'Restaurant / kitchen',
      floors: 1, builtUp: 380, civilDefence: cd('DCD-J-70344', 250, 115, T),
    }),
    site('site_rose_kitchen', 'cus_rose', 'Desert Rose Central Kitchen', {
      address: 'Unit 3', area: 'Ras Al Khor', type: 'Restaurant / kitchen', floors: 2, builtUp: 1900,
      civilDefence: cd('DCD-R-33018', 160, 205, T),
    }),
    site('site_oasis', 'cus_oasis', 'Oasis Cold Storage', {
      address: 'Warehouse 12', area: 'Al Quoz', type: 'Warehouse', floors: 1, builtUp: 9500,
      civilDefence: cd('DCD-Q-51772', 110, 255, T),
      access: 'Loading dock office. Cold rooms: ask the shift supervisor to open.',
    }),
    site('site_bright', 'cus_bright', 'Bright Minds International School', {
      address: 'Street 14', area: 'Al Barsha South', type: 'School', floors: 4, builtUp: 21000,
      civilDefence: cd('DCD-B-40518', 60, 305, T),
      access: 'Front office. Visitor badge. No work in classrooms during lessons.',
    }),
    site('site_mall', 'cus_mall', 'Al Barsha Central Mall', {
      address: 'Sheikh Mohammed bin Zayed Road', area: 'Al Barsha 1', type: 'Shopping mall',
      floors: 3, builtUp: 64000, civilDefence: cd('DCD-B-12660', 90, 275, T),
      access: 'Service entrance at the loading bay. Work in shops after closing (23:00).',
    }),
    site('site_khalid', 'cus_khalid', 'Al Mansoori Villa', {
      address: 'Villa 21, Street 8B', area: 'Al Safa', type: 'Villa', floors: 2, builtUp: 640,
      access: 'Call Mr Al Mansoori 30 minutes before arrival.',
    }),
    site('site_wasl', 'cus_wasl', 'Al Wasl Auto Service Centre', {
      address: 'Shop 4, Street 9', area: 'Ras Al Khor', type: 'Workshop', floors: 1, builtUp: 1100,
      civilDefence: cd('DCD-R-33590', 230, 135, T),
    }),
    site('site_gv1', 'cus_green', 'Green Valley, Al Warqa', {
      address: 'Al Warqa 1, Street 22', area: 'Al Warqa', type: 'Supermarket / shop', floors: 1, builtUp: 2600,
      civilDefence: cd('DCD-W-60112', 150, 215, T),
    }),
    site('site_gv2', 'cus_green', 'Green Valley, Mirdif', {
      address: 'Mirdif, Street 47', area: 'Mirdif', type: 'Supermarket / shop', floors: 1, builtUp: 2100,
      civilDefence: cd('DCD-W-60113', 150, 215, T),
    }),
    site('site_crescent', 'cus_crescent', 'Crescent Bay Dental Clinic', {
      address: 'Villa 12, Al Wasl Road', area: 'Jumeirah 3', type: 'Hospital / clinic', floors: 2, builtUp: 210,
    }),
    site('site_nexus', 'cus_nexus', 'Nexus Data Centre DSO-1', {
      address: 'Building A2', area: 'Dubai Silicon Oasis', type: 'Data centre', floors: 2, builtUp: 8800,
      civilDefence: cd('DCD-S-29001', 100, 265, T),
      access: 'Badge and escort required. No phones in the data halls.',
    }),
    site('site_mussafah', 'cus_mussafah', 'Mussafah Steel Works', {
      emirate: 'Abu Dhabi', address: 'Plot M-17', area: 'Mussafah', type: 'Factory', floors: 1, builtUp: 15000,
      civilDefence: cd('ADCD-M-8842', 190, 175, T),
      access: 'HSE induction video before entering the plant.',
    }),
    site('site_sharjah', 'cus_sharjah', 'Sharjah Plastics Factory', {
      emirate: 'Sharjah', address: 'Industrial Area 13', area: 'Sharjah Industrial Area', type: 'Factory',
      floors: 1, builtUp: 12000, civilDefence: cd('SCD-13-5521', 210, 155, T),
    }),
  ];
  return Object.fromEntries(list.map((s) => [s.id, s]));
}

const ct = (id, customerId, name, title, role, phone, email, o = {}) => ({
  id, customerId, name, title, role, phone, email, primary: false, siteIds: [], ...o,
});

export function buildContacts() {
  const list = [
    ct('ct_1', 'cus_marina', 'Fatima Al Hosani', 'Board chair', 'decision', '+971 50 555 0311', 'fatima.hosani@marinacrest.example', { primary: true }),
    ct('ct_2', 'cus_marina', 'Mahmoud El-Sayed', 'Property manager', 'building', '+971 50 555 0312', 'mahmoud@marinacrest.example', { siteIds: ['site_marina'] }),
    ct('ct_3', 'cus_alnoor', 'Anil Varghese', 'Facilities director', 'decision', '+971 50 555 0313', 'anil.varghese@alnoorfm.example', { primary: true }),
    ct('ct_4', 'cus_alnoor', 'Rekha Pillai', 'Accounts payable', 'accounts', '+971 4 555 0314', 'rekha.pillai@alnoorfm.example'),
    ct('ct_5', 'cus_alnoor', 'Tariq Mahmood', 'Building manager, Marina Crest', 'building', '+971 50 555 0315', 'tariq.mahmood@alnoorfm.example', { siteIds: ['site_marina'] }),
    ct('ct_6', 'cus_harbour', 'Hamad Al Suwaidi', 'Board secretary', 'decision', '+971 50 555 0316', 'hamad@harbourview.example', { primary: true }),
    ct('ct_7', 'cus_harbour', 'Denise Fernandez', 'Building manager', 'building', '+971 50 555 0317', 'denise@harbourview.example', { siteIds: ['site_harbour'] }),
    ct('ct_8', 'cus_meridian', 'Marcus Weber', 'Director of engineering', 'decision', '+971 50 555 0318', 'marcus.weber@gulfmeridian.example', { primary: true }),
    ct('ct_9', 'cus_meridian', 'Sunil Perera', 'Chief engineer', 'technical', '+971 50 555 0319', 'sunil.perera@gulfmeridian.example', { siteIds: ['site_meridian'] }),
    ct('ct_10', 'cus_meridian', 'Aisha Rahman', 'Financial controller', 'accounts', '+971 4 555 0320', 'aisha.rahman@gulfmeridian.example'),
    ct('ct_11', 'cus_meridian', 'Bashir Ahmed', 'Camp boss', 'site', '+971 50 555 0321', 'bashir@gulfmeridian.example', { siteIds: ['site_meridian_staff'] }),
    ct('ct_12', 'cus_palm', 'Dr Ibrahim Yousef', 'Medical director', 'decision', '+971 50 555 0322', 'ibrahim.yousef@palmgrove.example', { primary: true }),
    ct('ct_13', 'cus_palm', 'Grace Mwangi', 'Facilities manager', 'building', '+971 50 555 0323', 'grace.mwangi@palmgrove.example', { siteIds: ['site_palm'] }),
    ct('ct_14', 'cus_palm', 'Ali Reza', 'Accounts officer', 'accounts', '+971 4 555 0324', 'ali.reza@palmgrove.example'),
    ct('ct_15', 'cus_sahara', 'Vikram Chandran', 'Operations director', 'decision', '+971 50 555 0325', 'vikram.chandran@saharalogistics.example', { primary: true }),
    ct('ct_16', 'cus_sahara', 'Peter Okafor', 'Warehouse manager', 'site', '+971 50 555 0326', 'peter.okafor@saharalogistics.example', { siteIds: ['site_sahara1', 'site_sahara2'] }),
    ct('ct_17', 'cus_sahara', 'Meera Joshi', 'Finance manager', 'accounts', '+971 4 555 0327', 'meera.joshi@saharalogistics.example'),
    ct('ct_18', 'cus_falcon', 'Salma Al Kaabi', 'Asset manager', 'decision', '+971 50 555 0328', 'salma.kaabi@falconridge.example', { primary: true }),
    ct('ct_19', 'cus_falcon', 'Roberto Silva', 'Building manager', 'building', '+971 50 555 0329', 'roberto.silva@falconridge.example', { siteIds: ['site_falcon'] }),
    ct('ct_20', 'cus_falcon', 'Nadeem Akhtar', 'Accounts', 'accounts', '+971 4 555 0330', 'nadeem.akhtar@falconridge.example'),
    ct('ct_21', 'cus_zenith', 'Eng. Khaled Nabil', 'Project manager', 'decision', '+971 50 555 0331', 'khaled.nabil@zenithcontracting.example', { primary: true, siteIds: ['site_creek'] }),
    ct('ct_22', 'cus_zenith', 'Suresh Menon', 'Procurement manager', 'technical', '+971 50 555 0332', 'suresh.menon@zenithcontracting.example'),
    ct('ct_23', 'cus_zenith', 'Lina Haddad', 'Document controller', 'accounts', '+971 4 555 0333', 'lina.haddad@zenithcontracting.example'),
    ct('ct_24', 'cus_rose', 'Marco Bellini', 'Operations manager', 'decision', '+971 50 555 0334', 'marco.bellini@desertrose.example', { primary: true }),
    ct('ct_25', 'cus_rose', 'Zainab Ali', 'Finance manager', 'accounts', '+971 4 555 0335', 'zainab.ali@desertrose.example'),
    ct('ct_26', 'cus_oasis', 'Ravi Shankar', 'Plant manager', 'decision', '+971 50 555 0336', 'ravi.shankar@oasiscold.example', { primary: true, siteIds: ['site_oasis'] }),
    ct('ct_27', 'cus_oasis', 'Lakshmi Iyer', 'Accounts', 'accounts', '+971 4 555 0337', 'lakshmi.iyer@oasiscold.example'),
    ct('ct_28', 'cus_bright', 'Eleanor Whitfield', 'Principal', 'decision', '+971 50 555 0338', 'principal@brightminds.example', { primary: true }),
    ct('ct_29', 'cus_bright', 'Nasser Al Ketbi', 'Facilities coordinator', 'building', '+971 50 555 0339', 'nasser.ketbi@brightminds.example', { siteIds: ['site_bright'] }),
    ct('ct_30', 'cus_mall', 'Jasper Lim', 'Mall operations manager', 'decision', '+971 50 555 0340', 'jasper.lim@albarshacentral.example', { primary: true }),
    ct('ct_31', 'cus_mall', 'Ernesto Cruz', 'Chief engineer', 'technical', '+971 50 555 0341', 'ernesto.cruz@albarshacentral.example', { siteIds: ['site_mall'] }),
    ct('ct_32', 'cus_mall', 'Mona Sheikh', 'Finance manager', 'accounts', '+971 4 555 0342', 'mona.sheikh@albarshacentral.example'),
    ct('ct_33', 'cus_khalid', 'Khalid Al Mansoori', 'Owner', 'decision', '+971 50 555 0243', 'khalid.mansoori@example.com', { primary: true, siteIds: ['site_khalid'] }),
    ct('ct_34', 'cus_wasl', 'Pradeep Kumar', 'Owner and manager', 'decision', '+971 50 555 0343', 'pradeep@alwaslauto.example', { primary: true, siteIds: ['site_wasl'] }),
    ct('ct_35', 'cus_green', 'Abdul Karim', 'Operations manager', 'decision', '+971 50 555 0344', 'abdul.karim@greenvalley.example', { primary: true }),
    ct('ct_36', 'cus_green', 'Sheeba Thomas', 'Accounts', 'accounts', '+971 4 555 0345', 'sheeba.thomas@greenvalley.example'),
    ct('ct_37', 'cus_green', 'Jomon Varghese', 'Store manager, Al Warqa', 'site', '+971 50 555 0346', 'jomon@greenvalley.example', { siteIds: ['site_gv1'] }),
    ct('ct_38', 'cus_green', 'Faris Nabeel', 'Store manager, Mirdif', 'site', '+971 50 555 0347', 'faris@greenvalley.example', { siteIds: ['site_gv2'] }),
    ct('ct_39', 'cus_crescent', 'Dr Camila Torres', 'Owner dentist', 'decision', '+971 50 555 0348', 'camila.torres@crescentbay.example', { primary: true, siteIds: ['site_crescent'] }),
    ct('ct_40', 'cus_nexus', 'Daniel Okoye', 'Data centre manager', 'decision', '+971 50 555 0349', 'daniel.okoye@nexusdc.example', { primary: true, siteIds: ['site_nexus'] }),
    ct('ct_41', 'cus_nexus', 'Yuki Tanaka', 'Facilities engineer', 'technical', '+971 50 555 0350', 'yuki.tanaka@nexusdc.example', { siteIds: ['site_nexus'] }),
    ct('ct_42', 'cus_nexus', 'Hind Al Nuaimi', 'Procurement officer', 'accounts', '+971 4 555 0351', 'hind.nuaimi@nexusdc.example'),
    ct('ct_43', 'cus_mussafah', 'Rashed Al Dhaheri', 'Plant manager', 'decision', '+971 2 555 0352', 'rashed.dhaheri@mussafahsteel.example', { primary: true, siteIds: ['site_mussafah'] }),
    ct('ct_44', 'cus_mussafah', 'Mohan Das', 'HSE manager', 'technical', '+971 2 555 0353', 'mohan.das@mussafahsteel.example', { siteIds: ['site_mussafah'] }),
    ct('ct_45', 'cus_sharjah', 'Imtiaz Hussain', 'Factory manager', 'decision', '+971 6 555 0354', 'imtiaz.hussain@sharjahplastics.example', { primary: true, siteIds: ['site_sharjah'] }),
    ct('ct_46', 'cus_sharjah', 'Sana Baig', 'Accounts', 'accounts', '+971 6 555 0355', 'sana.baig@sharjahplastics.example'),
  ];
  return Object.fromEntries(list.map((c) => [c.id, c]));
}
