import { useSyncExternalStore } from 'react';

// Which journey this window is following (the amber pill in the top bar shows
// its next step). It lives in the tab's own storage, like the person of a
// window, so a reload keeps it and another tab starts without one.

const KEY = 'fs-erp-journey';
const listeners = new Set();

function read() {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

let current = read();

export function setActiveJourney(id) {
  if (id === current) return;
  current = id;
  try {
    if (id) sessionStorage.setItem(KEY, id);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Not saved: the choice lasts until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The id of the journey being followed, or "". */
export const useActiveJourney = () => useSyncExternalStore(subscribe, () => current);
