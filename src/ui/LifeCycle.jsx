import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';

// The life of a document as a row of steps: what is done, where it stands now,
// what comes next. `bad` marks a step that ended badly (lost, rejected, expired).
//   steps: [{ key, label, state: 'done' | 'current' | 'todo' | 'bad' }]
export function LifeCycle({ steps, className }) {
  return (
    <ol className={cn('no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 text-sm', className)} aria-label="Progress">
      {steps.map((step, i) => (
        <li key={step.key} className="flex shrink-0 items-center gap-2" aria-current={step.state === 'current' ? 'step' : undefined}>
          {i > 0 && (
            <span
              className={cn('h-px w-5 sm:w-10', steps[i - 1].state === 'done' ? 'bg-slate-400' : 'bg-slate-200')}
              aria-hidden="true"
            />
          )}
          <span
            className={cn(
              'grid size-5 place-items-center rounded-full text-[11px] font-semibold',
              step.state === 'done' && 'bg-slate-900 text-white',
              step.state === 'current' && 'bg-white text-slate-900 ring-2 ring-slate-900',
              step.state === 'bad' && 'bg-red-600 text-white',
              step.state === 'todo' && 'bg-slate-100 text-slate-400',
            )}
          >
            {step.state === 'done' ? <CheckIcon className="size-3" aria-hidden="true" /> : step.state === 'bad' ? '!' : i + 1}
          </span>
          <span
            className={cn(
              'whitespace-nowrap',
              step.state === 'current' && 'font-semibold text-slate-900',
              step.state === 'done' && 'text-slate-600',
              step.state === 'bad' && 'font-semibold text-red-700',
              step.state === 'todo' && 'text-slate-400',
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
