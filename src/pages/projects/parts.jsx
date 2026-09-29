import { cn } from '@/lib/cn.js';
import { aed, money } from '@/lib/format.js';

// Small pieces shared by the screens of the Projects area.

/** A slim bar with the percent beside it. */
export function ProgressBar({ value, tone = 'dark', className, label }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('flex items-center gap-2', className)} role="img" aria-label={label ?? `${Math.round(pct)} percent`}>
      <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className={cn('h-full rounded-full', tone === 'orange' ? 'bg-orange-500' : tone === 'green' ? 'bg-green-600' : 'bg-slate-900')} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-slate-600">{Math.round(pct)}%</span>
    </div>
  );
}

/** A number with a label above it, for a row of figures. Give `amount` for money: "AED" is written small and the number never breaks. */
export const Stat = ({ label, value, amount, sub, tone, className }) => (
  <div className={cn('min-w-0 rounded-xl bg-slate-50 px-4 py-3', className)}>
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className={cn('mt-0.5 flex flex-wrap items-baseline gap-x-1 text-lg font-semibold tabular-nums', tone ?? 'text-slate-900')}>
      {amount !== undefined ? (
        <>
          <span className="text-xs font-medium text-slate-500">AED</span>
          <span className="whitespace-nowrap">{money(amount)}</span>
        </>
      ) : value}
    </dd>
    {sub && <dd className="text-xs text-slate-500">{sub}</dd>}
  </div>
);

/** "+ AED 38,500" or "- AED 4,000". */
export const signed = (n) => `${n < 0 ? '−' : '+'} ${aed(Math.abs(n))}`;
