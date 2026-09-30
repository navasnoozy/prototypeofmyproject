import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CompassIcon } from 'lucide-react';
import { JOURNEY_BY_ID, journeyProgress } from '@/data/journeys.js';
import { ROLES } from '@/data/roles.js';
import { EMBEDDED } from '@/lib/embed.js';
import { setActiveJourney, useActiveJourney } from '@/store/journeyState.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Avatar } from '@/ui/Badge.jsx';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Floating } from '@/ui/Floating.jsx';
import { ProgressBar } from '@/pages/projects/parts.jsx';
import { openLabel, useOpenStep } from '@/pages/journeys/useOpenStep.js';

// A control of the prototype (amber, like "View as" and "Phone view"): it shows
// the journey this window follows and its next step, and opens that step as
// the right person. It appears only while a journey is being followed.
export function JourneyPill() {
  const s = useStore();
  const { user } = useSession();
  const activeId = useActiveJourney();
  const open = useOpenStep();
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  const close = useCallback(() => setShown(false), []);
  const journey = JOURNEY_BY_ID[activeId];
  if (!journey || EMBEDDED) return null;

  const p = journeyProgress(journey, s);
  const step = p.steps[p.next] ?? p.steps.find((x) => x.look);
  const person = step && s.staff[step.person];

  return (
    <>
      <span ref={ref} className="inline-flex">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={shown}
          onClick={() => setShown((o) => !o)}
          className="hidden h-9 items-center gap-2 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 text-sm text-amber-950 transition-colors duration-150 hover:bg-amber-100 md:inline-flex"
        >
          <CompassIcon className="size-4 text-amber-700" aria-hidden="true" />
          <span className="hidden xl:inline">Journey</span>
          <span className="tabular-nums font-semibold">{p.done}/{p.total}</span>
        </button>
        <IconButton icon={CompassIcon} label={`Journey: ${journey.title}`} onClick={() => setShown((o) => !o)} className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 md:hidden" />
      </span>
      <Floating anchorRef={ref} open={shown} onClose={close} align="end" className="w-[360px] max-w-[calc(100vw-16px)]">
        <div className="space-y-3 p-4">
          <div>
            <p className="text-xs font-medium text-amber-800">You are following a journey</p>
            <h2 className="text-sm font-semibold text-slate-900">{journey.title}</h2>
          </div>
          <div>
            <ProgressBar value={p.total > 0 ? (p.done / p.total) * 100 : 0} tone="green" label={`${p.done} of ${p.total} steps done`} />
            <p className="mt-1 text-xs text-slate-500">{p.done} of {p.total} steps done</p>
          </div>
          {p.finished ? (
            <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900">Every step is done. {step ? 'The last one is only something to look at.' : ''}</p>
          ) : null}
          {step && (
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500">{p.finished ? 'To look at' : 'Next step'}</p>
              <p className="text-sm font-semibold text-slate-900">{step.title}</p>
              {person && (
                <p className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                  <Avatar name={person.name} size="xs" />
                  {person.name}, {ROLES[person.roleKey].label.toLowerCase()}
                  {person.id === user.id && <span className="text-slate-400">(you)</span>}
                </p>
              )}
              <p className="mt-2 text-sm text-slate-700">{step.text}</p>
              <Button className="mt-3" size="sm" variant="primary" onClick={() => { close(); open(step); }}>{openLabel(s, user.id, step)}</Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <Link to={`/journeys/${journey.id}`} onClick={close} className="text-sm font-medium text-slate-900 underline underline-offset-2">All steps</Link>
            <button type="button" onClick={() => { setActiveJourney(''); close(); }} className="text-sm text-slate-600 underline underline-offset-2">Stop guiding</button>
          </div>
        </div>
      </Floating>
    </>
  );
}
