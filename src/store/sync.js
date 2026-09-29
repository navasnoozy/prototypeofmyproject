import { useSyncExternalStore } from 'react';
import { toast } from './toast.js';

// The "no signal" simulation of the phone view. The prototype has no server,
// so this only shows how the product would feel: work stays on the phone,
// a counter says how many changes wait, and they are sent when the signal is
// back. It never holds data back.
let snap = { online: true, pending: 0, syncing: false };
const listeners = new Set();
const set = (next) => {
  snap = { ...snap, ...next };
  listeners.forEach((listener) => listener());
};

export const useSync = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snap,
  );

/** Called after every change: while there is no signal it counts one more waiting change. */
export const notePending = () => {
  if (!snap.online) set({ pending: snap.pending + 1 });
};

export const goOffline = () => set({ online: false });

export function goOnline() {
  if (snap.online) return;
  const waiting = snap.pending;
  set({ online: true, syncing: waiting > 0 });
  if (waiting > 0) {
    setTimeout(() => {
      set({ syncing: false, pending: 0 });
      toast(`${waiting} change${waiting === 1 ? '' : 's'} sent to the office`);
    }, 1400);
  }
}
