// A short random id with a readable prefix, e.g. "cus_k3j9x2".
export const newId = (prefix) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
