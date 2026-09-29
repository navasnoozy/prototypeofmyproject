// Joins class names, skipping anything falsy.
export const cn = (...parts) => parts.filter(Boolean).join(' ');
