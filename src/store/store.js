import { useSyncExternalStore } from 'react';
import { buildSeed, SEED_VERSION } from '@/data/seed/index.js';
import { NUMBER_FORMATS } from '@/data/numbering.js';
import { newId } from '@/lib/ids.js';

// The prototype's "backend": one object of tables (customers, sites, ...)
// kept in memory, saved in the browser after every change, and put back to
// the seed by "Reset demo data". Screens read it with useStore() and change
// it only through the functions of actions.js, which use transact().

const KEY = 'fs-erp-prototype';
const DEFAULT_USER = 'staff_layla';

const fresh = (session) => ({
  version: SEED_VERSION,
  session: session ?? { userId: DEFAULT_USER },
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

let state = load() ?? fresh();
const listeners = new Set();
let saveTimer;

function commit(next) {
  state = next;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked: the demo keeps working in memory.
    }
  }, 120);
  listeners.forEach((listener) => listener());
}

export const getState = () => state;
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The whole state; it changes identity after every change. */
export const useStore = () => useSyncExternalStore(subscribe, getState);

export const setSession = (userId) =>
  commit({ ...state, session: { ...state.session, userId } });

export const resetDemo = () => commit(fresh(state.session));

/**
 * Runs `fn` with a small transaction object and commits the result once.
 *   tx.get(table, id)              a row
 *   tx.put(table, row)             insert or replace
 *   tx.patch(table, id, changes)   merge into a row
 *   tx.remove(table, id)           delete a row
 *   tx.number(kind)                the next document number, e.g. "CUS-0020"
 *   tx.log(entity, id, text)       one line in the activity list
 */
export function transact(fn) {
  const draft = { ...state };
  const tx = {
    id: newId,
    get: (table, id) => draft[table][id],
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
    number(kind) {
      const n = (draft.counters[kind] ?? 0) + 1;
      draft.counters = { ...draft.counters, [kind]: n };
      return NUMBER_FORMATS[kind](n);
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
  return result;
}
