import { list } from './selectors.js';

// The threads that run between areas, kept in one place so Sales and Service
// use the same rules. All of them run inside a transaction.

/** A deficiency is found by its number ("DEF-2026-0207"). */
export const deficiencyByNumber = (s, number) => list(s.deficiencies).find((d) => d.number === number);

/** A repair quotation made for a deficiency: the deficiency is now "quoted". */
export function linkQuotationToDeficiency(tx, quotation) {
  const ref = quotation.kindData?.deficiencyRef;
  const d = ref && deficiencyByNumber(tx.state(), ref);
  if (!d || ['repaired', 'verified'].includes(d.status)) return;
  tx.patch('deficiencies', d.id, { status: 'quoted', quotationId: quotation.id });
  tx.log('deficiency', d.id, `Repair quotation ${quotation.number}${quotation.rev ? ` Rev ${quotation.rev}` : ''} made`);
}

/** The customer answered the repair quotation: approved, or declined. */
export function answerDeficiencyQuotation(tx, quotation, accepted) {
  const ref = quotation.kindData?.deficiencyRef;
  const d = ref && deficiencyByNumber(tx.state(), ref);
  if (!d) return;
  tx.patch('deficiencies', d.id, { status: accepted ? 'approved' : 'declined' });
  tx.log('deficiency', d.id, accepted ? `Repair quotation ${quotation.number} accepted by the customer` : `Repair quotation ${quotation.number} declined by the customer`);
}
