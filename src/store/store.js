import { useSyncExternalStore } from 'react';
import { buildSeed, SEED_VERSION } from '@/data/seed/index.js';
import { NUMBER_FORMATS } from '@/data/numbering.js';
import { newId } from '@/lib/ids.js';
import { EMBEDDED, EMBED_USER } from '@/lib/embed.js';
import { notePending } from './sync.js';

// The prototype's "backend": one object of tables (customers, sites, ...)
// kept in memory, saved in the browser after every change, and put back to
// the seed by "Reset demo data". Screens read it with useStore() and change
// it only through the functions of actions.js, which use transact().
//
// Two windows of the same browser (the office and the phone frame) share the
// saved tables and follow each other's changes at once. Who is "signed in" is
// NOT shared: each window keeps its own person, so the office can be the
// coordinator while the phone is a technician.

const KEY = 'fs-erp-prototype';
const SESSION_KEY = 'fs-erp-session';
const DEFAULT_USER = 'staff_layla';

// The person of this window: in memory for a phone frame, in the tab's own
// storage otherwise (so a reload keeps the choice and a new tab starts fresh).
function ownSession() {
  if (EMBEDDED) return { userId: EMBED_USER || 'staff_rashid' };
  try {
    return { userId: sessionStorage.getItem(SESSION_KEY) || DEFAULT_USER };
  } catch {
    return { userId: DEFAULT_USER };
  }
}

const fresh = (session) => ({
  version: SEED_VERSION,
  session: session ?? ownSession(),
  ...buildSeed(),
});

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved && saved.version === SEED_VERSION ? saved : null;
  } catch {
    return null;
  }
}

const saved = load();
let state = saved ? { ...saved, session: ownSession() } : fresh();
const listeners = new Set();
let saveTimer;

const notify = () => listeners.forEach((listener) => listener());

function commit(next) {
  state = next;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const { session, ...shared } = state; // the person is not shared
      localStorage.setItem(KEY, JSON.stringify(shared));
    } catch {
      // Storage full or blocked: the demo keeps working in memory.
    }
  }, 120);
  notify();
}

// Another window saved something: take its tables, keep this window's person.
// Nothing is saved back, so two windows never echo each other.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY || !event.newValue) return;
    const remote = load();
    if (!remote) return;
    state = { ...remote, session: state.session };
    notify();
  });
}

export const getState = () => state;
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The whole state; it changes identity after every change. */
export const useStore = () => useSyncExternalStore(subscribe, getState);

export const setSession = (userId) => {
  if (!EMBEDDED) {
    try {
      sessionStorage.setItem(SESSION_KEY, userId);
    } catch {
      // Not saved: the choice lasts until the page is reloaded.
    }
  }
  state = { ...state, session: { ...state.session, userId } };
  notify();
};

export const resetDemo = () => commit(fresh(state.session));

/**
 * Runs `fn` with a small transaction object and commits the result once.
 *   tx.get(table, id)              a row
 *   tx.all(table)                  every row of a table, as a list
 *   tx.state()                     the state as it is inside this transaction
 *   tx.set(key, value)             replace a plain value (for example the settings)
 *   tx.put(table, row)             insert or replace
 *   tx.patch(table, id, changes)   merge into a row
 *   tx.remove(table, id)           delete a row
 *   tx.number(kind)                the next document number, e.g. "CUS-0020"
 *   tx.next(kind)                  the next whole number of a counter (ledger rows)
 *   tx.log(entity, id, text)       one line in the activity list
 */
export function transact(fn) {
  const draft = { ...state };
  const tx = {
    id: newId,
    get: (table, id) => draft[table][id],
    all: (table) => Object.values(draft[table]),
    state: () => draft,
    set(key, value) {
      draft[key] = value;
    },
    put(table, row) {
      draft[table] = { ...draft[table], [row.id]: row };
      return row;
    },
    patch(table, id, changes) {
      return tx.put(table, { ...draft[table][id], ...changes });
    },
    remove(table, id) {
      const copy = { ...draft[table] };
      delete copy[id];
      draft[table] = copy;
    },
    // The next whole number of a counter (documents and ledger rows).
    next(kind) {
      const n = (draft.counters[kind] ?? 0) + 1;
      draft.counters = { ...draft.counters, [kind]: n };
      return n;
    },
    number(kind) {
      return NUMBER_FORMATS[kind](tx.next(kind));
    },
    log(entity, entityId, text) {
      const n = (draft.counters.activity ?? 0) + 1;
      draft.counters = { ...draft.counters, activity: n };
      tx.put('activity', {
        id: `act_${n}`,
        entity,
        entityId,
        by: draft.session.userId,
        at: new Date().toISOString(),
        text,
      });
    },
  };
  const result = fn(tx);
  commit(draft);
  notePending();
  return result;
}
