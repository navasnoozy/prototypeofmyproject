import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

// A value kept in the address (?name=value): filters and tabs live there, so
// the Back button and a copied link bring the same view back.
export function useParam(name, fallback = '') {
  const [params, setParams] = useSearchParams();
  const value = params.get(name) ?? fallback;
  const set = useCallback(
    (next) =>
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          if (next === '' || next === null || next === fallback) copy.delete(name);
          else copy.set(name, next);
          return copy;
        },
        { replace: true },
      ),
    [name, fallback, setParams],
  );
  return [value, set];
}
