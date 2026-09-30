import { useMemo, useState } from 'react';
import { allocateOldestFirst } from '@/data/billingRules.js';
import { cn } from '@/lib/cn.js';
import { fmtDate } from '@/lib/dates.js';
import { money, plural, round2 } from '@/lib/format.js';
import { accountOf } from '@/store/billingSelectors.js';
import { NumberCell } from '@/pages/sales/LinesEditor.jsx';

// Money or credit that goes to invoices: the receipt (or the credit note) says which
// invoices it pays and how much of each. Used by a new receipt, by "allocate" on a
// receipt that has money on account, and by "apply" on a credit note.

/** The invoices of a customer that still owe something, the one due first at the top. */
export const openInvoicesOf = (s, customerId) => accountOf(s, customerId).open.toSorted((a, b) => a.inv.dueOn.localeCompare(b.inv.dueOn));

/**
 * The amount each open invoice takes. It starts as "oldest first" and follows the amount
 * typed above it, until the person types in a row: from then on the rows are theirs.
 */
export function useAllocation(open, amount) {
  const [manual, setManual] = useState(null); // { invoiceId: number } once the person types
  const auto = useMemo(
    () => Object.fromEntries(allocateOldestFirst(open.map((v) => ({ invoiceId: v.inv.id, balance: v.balance, dueOn: v.inv.dueOn })), amount).map((a) => [a.invoiceId, a.amount])),
    [open, amount],
  );
  const take = manual ?? auto;
  const allocated = round2(open.reduce((n, v) => n + (take[v.inv.id] ?? 0), 0));
  return {
    take, allocated, left: round2(amount - allocated), manual: manual !== null,
    set: (v, n) => setManual({ ...take, [v.inv.id]: Math.min(n, v.balance) }),
    reset: () => setManual(null),
    rows: open.map((v) => ({ invoiceId: v.inv.id, amount: take[v.inv.id] ?? 0 })).filter((r) => r.amount > 0.004),
  };
}

/** `noun` is what is being allocated: "money", "credit". */
export function AllocationEditor({ open, amount, alloc, noun = 'money' }) {
  if (open.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        This customer has no invoice that is still owed. All the {noun} stays on account, and can be allocated later when there is an invoice.
      </p>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-700">Which invoices does it pay?</p>
        {alloc.manual && (
          <button type="button" onClick={alloc.reset} className="text-xs font-medium text-slate-700 underline underline-offset-2">Fill oldest first</button>
        )}
      </div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {open.map((v) => (
          <li key={v.inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
            <span className="min-w-0 flex-1 basis-40">
              <span className="block truncate text-sm font-medium tabular-nums text-slate-900">{v.inv.number}</span>
              <span className={cn('block truncate text-xs', v.state === 'overdue' ? 'text-red-700' : 'text-slate-500')}>
                {v.state === 'overdue' ? `${plural(v.overdueDays, 'day')} late` : `due ${fmtDate(v.inv.dueOn)}`} · owes {money(v.balance)}
              </span>
            </span>
            <NumberCell value={alloc.take[v.inv.id] ?? 0} onChange={(n) => alloc.set(v, n)} label={`Amount for ${v.inv.number}`} className="w-28" />
          </li>
        ))}
      </ul>
      <p
        role={alloc.left < -0.004 ? 'alert' : undefined}
        className={cn('mt-2 text-xs', alloc.left < -0.004 ? 'font-medium text-red-700' : 'text-slate-600')}
      >
        {alloc.left < -0.004
          ? `You allocated AED ${money(-alloc.left)} more than the ${amount > 0 ? `AED ${money(amount)}` : noun} available.`
          : alloc.left > 0.004
            ? `AED ${money(alloc.allocated)} allocated. AED ${money(alloc.left)} stays on account.`
            : amount > 0 ? 'All of it is allocated.' : 'Write the amount above.'}
      </p>
    </div>
  );
}
