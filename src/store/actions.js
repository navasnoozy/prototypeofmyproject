import { transact } from './store.js';
import { todayISO } from '@/lib/dates.js';

// Every change to the data goes through one of these functions. Each one is
// one transaction: it changes the tables and writes a line in the activity
// list, so screens of other areas can show what happened.

// ---- customers ---------------------------------------------------------
export function createCustomer(data) {
  return transact((tx) => {
    const id = tx.id('cus');
    tx.put('customers', {
      id, code: tx.number('customer'), status: 'active', since: todayISO(), ...data,
    });
    tx.log('customer', id, 'Customer created');
    return id;
  });
}

export function updateCustomer(id, changes, note = 'Customer details updated') {
  transact((tx) => {
    tx.patch('customers', id, changes);
    tx.log('customer', id, note);
  });
}

export function setCustomerStatus(id, status, reason = '') {
  transact((tx) => {
    tx.patch('customers', id, { status });
    tx.log('customer', id, status === 'on_hold' ? `Customer put on hold: ${reason}` : 'Customer taken off hold');
  });
}

/** Only a customer without sites can be deleted; returns false otherwise. */
export function deleteCustomer(id) {
  return transact((tx) => {
    if (tx.all('sites').some((s) => s.customerId === id || s.billToId === id)) return false;
    tx.all('contacts').filter((p) => p.customerId === id).forEach((p) => tx.remove('contacts', p.id));
    tx.remove('customers', id);
    return true;
  });
}

// ---- sites -------------------------------------------------------------
export function createSite(data) {
  return transact((tx) => {
    const id = tx.id('site');
    tx.put('sites', {
      id, status: 'active', stage: 'operating', civilDefence: null, ...data,
      billToId: data.billToId || data.customerId,
    });
    tx.log('site', id, 'Site created');
    tx.log('customer', data.customerId, `Site added: ${data.name}`);
    return id;
  });
}

export function updateSite(id, changes, note = 'Site details updated') {
  transact((tx) => {
    tx.patch('sites', id, { ...changes, billToId: changes.billToId || changes.customerId || tx.get('sites', id).billToId });
    tx.log('site', id, note);
  });
}

/** Only a site without systems can be deleted; returns false otherwise. */
export function deleteSite(id) {
  return transact((tx) => {
    if (tx.all('systems').some((s) => s.siteId === id)) return false;
    tx.remove('sites', id);
    return true;
  });
}

// ---- contacts ----------------------------------------------------------
export function saveContact(contact) {
  return transact((tx) => {
    const isNew = !contact.id;
    const id = contact.id ?? tx.id('ct');
    // A customer has one primary contact.
    if (contact.primary) {
      tx.all('contacts')
        .filter((p) => p.customerId === contact.customerId && p.id !== id && p.primary)
        .forEach((p) => tx.patch('contacts', p.id, { primary: false }));
    }
    tx.put('contacts', { primary: false, siteIds: [], ...contact, id });
    tx.log('customer', contact.customerId, `${isNew ? 'Contact added' : 'Contact updated'}: ${contact.name}`);
    return id;
  });
}

export function deleteContact(id) {
  transact((tx) => {
    const c = tx.get('contacts', id);
    tx.remove('contacts', id);
    tx.log('customer', c.customerId, `Contact removed: ${c.name}`);
  });
}

// ---- systems and devices (owned by Service, shown at the site) ------------
export function saveSystem(system) {
  return transact((tx) => {
    const isNew = !system.id;
    const id = system.id ?? tx.id('sys');
    tx.put('systems', { status: 'in_service', notes: '', ...system, id });
    tx.log('site', system.siteId, `${isNew ? 'System added' : 'System updated'}: ${system.name}`);
    return id;
  });
}

export function setSystemStatus(id, status) {
  transact((tx) => {
    const sys = tx.patch('systems', id, { status });
    tx.log('site', sys.siteId, `${sys.name} ${status === 'impaired' ? 'marked out of service (impaired)' : 'back in service'}`);
  });
}

export function deleteSystem(id) {
  transact((tx) => {
    const sys = tx.get('systems', id);
    tx.all('devices').filter((d) => d.systemId === id).forEach((d) => tx.remove('devices', d.id));
    tx.remove('systems', id);
    tx.log('site', sys.siteId, `System removed: ${sys.name}`);
  });
}

export function saveDevice(device) {
  return transact((tx) => {
    const isNew = !device.id;
    const id = device.id ?? tx.id('dev');
    tx.put('devices', { qty: 1, condition: 'ok', ...device, id });
    tx.log('site', device.siteId, `${isNew ? 'Equipment added' : 'Equipment updated'}: ${device.tag}`);
    return id;
  });
}

export function deleteDevice(id) {
  transact((tx) => {
    const d = tx.get('devices', id);
    tx.remove('devices', id);
    tx.log('site', d.siteId, `Equipment removed: ${d.tag}`);
  });
}

export function setDeviceCondition(id, condition) {
  transact((tx) => {
    const d = tx.patch('devices', id, { condition });
    tx.log('site', d.siteId, `${d.tag} ${condition === 'out_of_service' ? 'taken out of service' : 'back in service'}`);
  });
}
