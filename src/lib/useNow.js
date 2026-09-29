import { useEffect, useState } from 'react';

/** The current time, refreshed every `every` milliseconds (for a timer on the screen). */
export function useNow(every = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

/** "1 h 05 min" for a number of milliseconds. */
export function durationWords(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** Hours rounded to the nearest half hour, at least half an hour: what goes on a time sheet. */
export const billableHours = (ms) => Math.max(0.5, Math.round(ms / 3600000 * 2) / 2);

export const clockTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
