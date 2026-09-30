import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { CheckIcon, EyeIcon, RotateCcwIcon } from 'lucide-react';
import { JOURNEY_BY_ID, journeyProgress } from '@/data/journeys.js';
import { ROLES } from '@/data/roles.js';
import { cn } from '@/lib/cn.js';
import { setActiveJourney } from '@/store/journeyState.js';
import { useSession } from '@/store/session.js';
import { resetDemo, useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Avatar, Badge } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { ConfirmDialog } from '@/ui/Overlay.jsx';
import { EmptyState, Page } from '@/ui/Page.jsx';
import { ProgressBar } from '@/pages/projects/parts.jsx';
import { openLabel, useOpenStep } from './useOpenStep.js';

const ABOUT = {
  purpose: 'One story, step by step. Every step says who does it, where, what to press and why the product works that way. The tick of a step follows the data.',
  why: [
    'The step that is next is the dark one. "Open as" turns this window into the right person and opens the right page; the amber button in the top bar brings you back to the next step from anywhere.',
    'A step is done when the records say so: a quotation that is accepted, a claim that is paid. It does not matter which window did it, or whether you followed the order.',
    'A step that only shows an eye has nothing to do: it is something to look at.',
  ],
  assumed: ['The steps follow the records of the sample data. If you changed those records before, some steps may already be done, or cannot be done any more: use Reset demo data to start again.'],
};

export function JourneyDetail() {
  const { journeyId } = useParams();
  const journey = JOURNEY_BY_ID[journeyId];
  if (!journey) {
    return (
      <Page title="Journey not found" back="/journeys">
        <EmptyState title="This journey does not exist" action={<Button variant="primary" to="/journeys">All journeys</Button>}>Choose one of the five journeys.</EmptyState>
      </Page>
    );
  }
  return <Body key={journey.id} journey={journey} />;
}

function Body({ journey }) {
  const s = useStore();
  const { user } = useSession();
  const open = useOpenStep();
  const [confirm, setConfirm] = useState(false);
  const p = journeyProgress(journey, s);

  // Opening a journey is choosing to follow it: the pill in the top bar then offers its next step everywhere.
  useEffect(() => setActiveJourney(journey.id), [journey.id]);

  return (
    <Page
      title={journey.title}
      badge={<Badge tone="orange">Prototype guide</Badge>}
      facts={journey.blurb}
      back="/journeys"
      about={ABOUT}
      menu={[{ label: 'Start every journey again (reset demo data)', icon: RotateCcwIcon, onClick: () => setConfirm(true) }]}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">{p.finished ? 'Every step is done' : `${p.done} of ${p.total} steps done`}</p>
            <span className="text-xs text-slate-500">{journey.areas.join(' → ')}</span>
          </div>
          <ProgressBar className="mt-2" value={(p.done / p.total) * 100} tone="green" label={`${p.done} of ${p.total} steps done`} />
        </div>

        <ol className="space-y-3">
          {p.steps.map((step, i) => {
            const person = s.staff[step.person];
            const isNext = i === p.next;
            const isLook = Boolean(step.look);
            const you = person?.id === user.id;
            return (
              <li key={step.id} className={cn('rounded-2xl border p-4 sm:p-5', isNext ? 'border-slate-900 shadow-float' : 'border-slate-200', step.done && 'bg-slate-50')}>
                <div className="flex gap-4">
                  <span
                    className={cn(
                      'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold',
                      step.done ? 'bg-green-100 text-green-700' : isNext ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500',
                    )}
                    aria-hidden="true"
                  >
                    {step.done ? <CheckIcon className="size-4" /> : isLook ? <EyeIcon className="size-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <h2 className="text-sm font-semibold text-slate-900">
                        <span className="sr-only">Step {i + 1}: </span>{step.title}
                      </h2>
                      {step.done && <Badge tone="green">Done</Badge>}
                      {isNext && <Badge tone="dark">Next</Badge>}
                      {isLook && <Badge>Look</Badge>}
                    </div>
                    {person && (
                      <p className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
                        <Avatar name={person.name} size="xs" />
                        <span>{person.name}, {ROLES[person.roleKey].label.toLowerCase()}{you && <span className="text-slate-400"> (you are viewing as this person)</span>}</span>
                      </p>
                    )}
                    <p className="mt-2 text-sm text-slate-700">{step.text}</p>
                    <p className="mt-1.5 text-xs text-slate-500"><span className="font-medium text-slate-600">Why: </span>{step.why}</p>
                    <div className="mt-3">
                      <Button size="sm" variant={isNext ? 'primary' : 'secondary'} onClick={() => open(step)}>{openLabel(s, user.id, step)}</Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Start every journey again?"
        confirmLabel="Reset demo data"
        tone="danger"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          resetDemo();
          toast('Demo data restored to the first sample');
        }}
      >
        This puts back the first sample data and removes every change you made in this browser. All five journeys start from their first step again.
      </ConfirmDialog>
    </Page>
  );
}
