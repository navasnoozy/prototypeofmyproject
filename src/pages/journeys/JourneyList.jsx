import { Link } from 'react-router';
import { ArrowRightIcon, CompassIcon } from 'lucide-react';
import { JOURNEYS, journeyProgress } from '@/data/journeys.js';
import { COMPANY } from '@/data/seed/staff.js';
import { setActiveJourney } from '@/store/journeyState.js';
import { useStore } from '@/store/store.js';
import { Avatar, Badge, Kbd, modKey } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Card, Page } from '@/ui/Page.jsx';
import { ProgressBar } from '@/pages/projects/parts.jsx';

const ABOUT = {
  purpose: 'Five stories that cross several areas, from the first step to the last, each with the person who does every step. It is the fastest way to judge whether the areas fit together.',
  why: [
    'An ERP is judged by its journeys, not by its screens. A quotation, a project, a claim and an invoice are four screens; "win a project and get paid" is the thing the company actually does.',
    'Each step names the person, the place and what to press. "Open as" turns this window into that person and goes to the right page, so nothing has to be looked for.',
    'The ticks follow the data, not the clicks: a step is done when the records say it is, whichever window did it. Reset demo data (account menu) starts every journey again.',
    'The journeys use the records of the sample data (for example QT-2026-0136). If you already changed them, a step may be done already.',
  ],
  assumed: ['This page belongs to the prototype, not to the product. It has no place in the ten areas of record 39.'],
};

const KIND_LABEL = { none: 'Not started', some: 'Under way', all: 'Finished' };

// The small things that are not a journey: quick ways to feel how the prototype works.
const LOOK = [
  <>Open <Link className="font-medium text-slate-900 underline underline-offset-2" to="/customers/cus_marina">Marina Crest Owners Association</Link>, then its site, then the Equipment tab. Every device has a next due date.</>,
  <>Point at an area in the sidebar, for example <strong className="font-semibold text-slate-900">Customers</strong>. A popup shows its sub modules and quick actions.</>,
  <>Press <span className="mx-1 inline-flex gap-1 align-middle"><Kbd>{modKey()}</Kbd><Kbd>K</Kbd></span> and type “marina”, “fire alarm” or a phone number.</>,
  <>Use <strong className="font-semibold text-slate-900">View as</strong> (top bar) and choose another person. Watch the sidebar and the Home change with the role.</>,
  <>Put <Link className="font-medium text-slate-900 underline underline-offset-2" to="/customers/cus_khalid">a customer</Link> on hold from its “⋯” menu, then look at the bell.</>,
  <>Add a new customer with a first contact, then add a site and a fire alarm system to it.</>,
  <>Open the <Link className="font-medium text-slate-900 underline underline-offset-2" to="/service/jobs/jb_1">visit at Palm Grove</Link> that is under way: mark the rest as pass, complete it, get the customer&apos;s signature, issue the report and send it. Then look at the equipment of that site: the due dates moved.</>,
  <>Plan the week: open <Link className="font-medium text-slate-900 underline underline-offset-2" to="/schedule">Schedule</Link> and drag <strong className="font-semibold text-slate-900">Planned visit 2 of 4</strong> onto a person and a day. Drop work on a day of Rashid Ali&apos;s training next week and see the warning. Press <strong className="font-semibold text-slate-900">Phone view</strong> first, and watch the job arrive on a technician&apos;s phone.</>,
  <>Look at the project that is over budget: <Link className="font-medium text-slate-900 underline underline-offset-2" to="/projects/prj_2">PRJ-2026-002</Link>. Make its progress claim and record a certificate for less than was claimed.</>,
  <>Follow a quotation from start to end: open <Link className="font-medium text-slate-900 underline underline-offset-2" to="/sales/quotations">Quotations</Link>, take the draft of Nexus Data Centre, send it for approval or to the customer, use View as to approve it, and record the customer&apos;s answer.</>,
];

export function JourneyList() {
  const s = useStore();
  return (
    <Page
      title="Journeys"
      badge={<Badge tone="orange">Prototype guide</Badge>}
      facts={`Five stories of ${COMPANY.name}, from the first step to the last`}
      about={ABOUT}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {JOURNEYS.map((journey) => {
          const p = journeyProgress(journey, s);
          const state = p.done === 0 ? 'none' : p.finished ? 'all' : 'some';
          const people = [...new Set(p.steps.map((x) => x.person))].map((id) => s.staff[id]).filter(Boolean);
          return (
            <Card key={journey.id} className="flex flex-col" bodyClassName="flex flex-1 flex-col">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 text-base font-semibold text-slate-900">{journey.title}</h2>
                <Badge tone={state === 'all' ? 'green' : state === 'some' ? 'blue' : 'neutral'}>{KIND_LABEL[state]}</Badge>
              </div>
              <p className="mt-1.5 text-sm text-slate-600">{journey.blurb}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                {journey.areas.map((a, i) => (
                  <span key={a} className="inline-flex items-center gap-1.5">
                    {i > 0 && <ArrowRightIcon className="size-3 text-slate-300" aria-hidden="true" />}
                    {a}
                  </span>
                ))}
              </p>
              <div className="mt-4">
                <ProgressBar value={(p.done / p.total) * 100} tone="green" label={`${p.done} of ${p.total} steps done`} />
                <p className="mt-1 text-xs text-slate-500">{p.done} of {p.total} steps done</p>
              </div>
              <div className="mt-4 flex flex-1 items-end justify-between gap-3">
                <ul className="flex -space-x-1.5" aria-label="People in this journey">
                  {people.map((person) => (
                    <li key={person.id} title={person.name}><Avatar name={person.name} size="xs" className="ring-2 ring-white" /><span className="sr-only">{person.name}</span></li>
                  ))}
                </ul>
                <Button variant={state === 'all' ? 'secondary' : 'primary'} size="sm" to={`/journeys/${journey.id}`} onClick={() => setActiveJourney(journey.id)}>
                  {state === 'none' ? 'Start' : state === 'all' ? 'Open' : 'Continue'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Small things to try" className="mt-5">
        <p className="mb-3 flex items-center gap-2 text-sm text-slate-600">
          <CompassIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          Not journeys, only ways to feel how the prototype works.
        </p>
        <ol className="list-decimal space-y-2.5 pl-5 text-sm text-slate-700">
          {LOOK.map((item, i) => <li key={i}>{item}</li>)}
        </ol>
      </Card>
    </Page>
  );
}
