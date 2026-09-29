import { useSyncExternalStore } from 'react';

// A tiny notification store: toast('Saved') shows a message for a few
// seconds; an optional action (for example "Undo") is a button inside it.

let items = [];
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function dismiss(id) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(message, { tone = 'default', action, duration = action ? 8000 : 4500 } = {}) {
  const id = Math.random().toString(36).slice(2);
  items = [...items.slice(-3), { id, message, tone, action }];
  emit();
  setTimeout(() => dismiss(id), duration);
  return id;
}

export const useToasts = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
