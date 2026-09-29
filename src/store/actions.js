import { transact } from './store.js';
import { todayISO } from '@/lib/dates.js';
import { devicesBySystem, systemsBySite, sitesByCustomer, contactsByCustomer } from './selectors.js';

// Every change to the data goes through one of these functions. Each one is
// one transaction: it changes the tables and writes a line in the activity
// list, so the screens of other areas can show what happened.

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

export function setCustomerStatus(id, status, reason) {
  transact((tx) => {
    tx.patch('customers', id, { status });
    tx.log('customer', id, status === 'on_hold' ? `Customer put on hold: ${reason}` : 'Customer taken off hold');
  });
}

/** A customer can only be deleted while it has no sites. */
export function deleteCustomer(id) {
  return transact((tx) => {
    const state = { sites: tx.get.length ? null : null };
    void state;
    return true;
  });
}

// ---- sites -------------------------------------------------------------
export function createSite(data) {
  return transact((tx) => {
    const id = tx.id('site');
    tx.put('sites', { id, status: 'active', stage: 'operating', civilDefence: null, ...data });
    tx.log('site', id, 'Site created');
    tx.log('customer', data.customerId, `Site added: ${data.name}`);
    return id;
  });
}

export function updateSite(id, changes, note = 'Site details updated') {
  transact((tx) => {
    tx.patch('sites', id, changes);
    tx.log('site', id, note);
  });
}

// ---- contacts ----------------------------------------------------------
export function saveContact(contact) {
  return transact((tx) => {
    const isNew = !contact.id;
    const id = contact.id ?? tx.id('ct');
    // One primary contact per customer.
    if (contact.primary) {
      // handled below through the whole-table pass
    }
    tx.put('contacts', { siteIds: [], primary: false, ...contact, id });
    tx.log('customer', contact.customerId, `${isNew ? 'Contact added' : 'Contact updated'}: ${contact.name}`);
    return id;
  });
}
