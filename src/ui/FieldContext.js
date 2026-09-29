import { createContext } from 'react';

// Shared by <Field> and the controls inside it: the id that links a label to
// its control, and whether the field currently shows an error.
export const FieldContext = createContext({ id: undefined, invalid: false });
