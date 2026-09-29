import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRightIcon, HardHatIcon, MapPinIcon, NavigationIcon, PhoneIcon, PlayIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { URGENCY } from '@/data/quotationKinds.js';
import { JOB_KINDS, WINDOWS } from '@/data/serviceKinds.js';
import { cn } from '@/lib/cn.js';
import { addDays, fmtDay, relDays, todayISO } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { boardItems } from '@/store/scheduleSelectors.js';
import { list } from '@/store/selectors.js';
import { startJob } from '@/store/serviceActions.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Badge } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { EmptyState, Page } from '@/ui/Page.jsx';
import { DeficiencyDrawer } from '@/pages/service/DeficiencyDialogs.jsx';
import { mapsUrl, telHref, whoToCall } from '@/pages/service/parts.jsx';

const ABOUT = {
  purpose: 'The technician\'s day on one screen: the job in hand or the next one, with the address, a button that opens the map, the person to call and how to get in; then the rest of today, what waits for a signature or a report, and what is coming.',
  why: [
    'A technician thinks in jobs, not in modules. The bar at the bottom of the phone has Today, Jobs and Sites; everything else is under More.',
    'The first card is always the job in hand or the next one, with one big button. Starting it from here goes straight into the job.',
    '"Waiting for you" lists work that is done but not closed. Without the signature and the report the company cannot invoice and the customer has no proof of the visit.',
    'In the product the screen keeps working without signal: the work stays on the phone and is sent later. The cloud chip at the top shows this; the account menu can simulate "no signal".',
  ],
  assumed: [
    'The order of the day (the job in progress, emergencies, then the earliest day and time window) is a rule of the prototype. The real order comes from the Schedule board (step 5).',
    'Whether a technician may record a deficiency away from a job is assumed.',
    'Navigate opens the phone\'s map application; Call dials the contact. Both are real links.',
  ],
};

const WINDOW_ORDER = { all_day: 0, morning: 1, afternoon: 2, night: 3 };
const URGENCY_ORDER = { emergency: 0, urgent: 1, normal: 2 };
const bySchedule = (a, b) =>
  Number(b.status === 'in_progress') - Number(a.status === 'in_progress') ||
  URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
  a.plannedOn.localeCompare(b.plannedOn) ||
  (WINDOW_ORDER[a.window] ?? 9) - (WINDOW_ORDER[b.window] ?? 9);

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};
const shortWindow = (w) => (w ? WINDOWS[w].split(' (')[0] : '');

// The next step a finished job still needs, in the words of the button.
const waitingStep = (j) => (!j.signature ? 'Get signature' : !j.report ? 'Issue report' : 'Send report');

function NowCard({ j }) {
  const s = useStore();
  const navigate = useNavigate();
  const today = todayISO();
  const site = s.sites[j.siteId];
  const customer = s.customers[j.customerId];
  const contact = whoToCall(s, j);
  const live = j.status === 'in_progress';
  const late = !live && j.plannedOn < today;
  const address = [site?.address, site?.area].filter(Boolean).join(', ');
  const emergency = j.urgency === 'emergency';

  const start = () => {
    startJob(j.id);
    toast('Job started: the clock is running');
    navigate(`/service/jobs/${j.id}`);
  };

  return (
    <section className={cn('rounded-3xl border bg-white p-5 shadow-sm', emergency ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={live ? 'violet' : 'blue'} dot>{live ? 'In progress' : 'Next up'}</Badge>
        {j.urgency !== 'normal' && <Badge tone={emergency ? 'red' : 'orange'}>{URGENCY[j.urgency]}</Badge>}
        {late && <Badge tone="orange">Was planned for {fmtDay(j.plannedOn)}</Badge>}
        {j.window && <span className="ml-auto text-xs font-medium text-slate-500">{shortWindow(j.window)}</span>}
      </div>
      <h2 className="mt-3 text-lg font-semibold leading-6 text-slate-900">{j.title}</h2>
      <p className="mt-0.5 text-sm text-slate-600">{site?.name}{customer && !customer.name.toLowerCase().startsWith(site?.name.toLowerCase() ?? '') ? ` · ${customer.name}` : ''}</p>
      <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500">
        <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {address}
      </p>
      {site?.access && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950">
          <span className="font-semibold">Getting in: </span>{site.access}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button href={mapsUrl(site)} target="_blank" rel="noreferrer" icon={NavigationIcon}>Navigate</Button>
        {contact?.phone ? <Button href={telHref(contact.phone)} icon={PhoneIcon}>Call {contact.name.split(' ')[0]}</Button> : <span />}
      </div>
      {live ? (
        <Button variant="primary" className="mt-3 w-full" iconEnd={ArrowRightIcon} to={`/service/jobs/${j.id}`}>Continue job</Button>
      ) : (
        <Button variant="primary" className="mt-3 w-full" icon={PlayIcon} onClick={start}>Start job</Button>
      )}
      {!live && <Link to={`/service/jobs/${j.id}`} className="mt-3 block text-center text-sm font-medium text-slate-700 underline underline-offset-2">Open the job first</Link>}
    </section>
  );
}

// One job as a row: when, what, where, and its state.
function JobRow({ j, note, action }) {
  const s = useStore();
  const site = s.sites[j.siteId];
  const K = JOB_KINDS[j.kind];
  return (
    <li>
      <Link to={`/service/jobs/${j.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors duration-150 hover:bg-slate-50">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
          <K.icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-medium text-slate-900">{j.title}</span>
          <span className="block truncate text-xs text-slate-500">{site?.name} · {note}</span>
        </span>
        {action ? (
          <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">{action}</span>
        ) : (
          <ArrowRightIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        )}
      </Link>
    </li>
  );
}

const Section = ({ title, count, children }) => (
  <section>
    <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-slate-900">
      {title}
      {count !== undefined && <span className="rounded-full bg-slate-100 px-1.5 text-xs font-medium tabular-nums text-slate-600">{count}</span>}
    </h2>
    {children}
  </section>
);

export function TechnicianToday() {
  const s = useStore();
  const { user } = useSession();
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const today = todayISO();

  const mine = list(s.jobs).filter((j) => j.assigneeIds.includes(user.id));
  const open = mine.filter((j) => ['planned', 'in_progress'].includes(j.status));
  const dueToday = open.filter((j) => j.plannedOn && j.plannedOn <= today).toSorted(bySchedule);
  const later = open.filter((j) => j.plannedOn > today).toSorted((a, b) => a.plannedOn.localeCompare(b.plannedOn) || (WINDOW_ORDER[a.window] ?? 9) - (WINDOW_ORDER[b.window] ?? 9)).slice(0, 5);
  const waiting = mine.filter((j) => j.status === 'completed').toSorted((a, b) => b.completedOn.localeCompare(a.completedOn));
  const doneToday = mine.filter((j) => ['completed', 'report_sent'].includes(j.status) && j.completedOn === today).length;
  const [first, ...rest] = dueToday;
  // The site work of projects that is planned for this person in the next days.
  // A piece of work that runs over several days is one line, with its days.
  const siteDays = boardItems(s, today, addDays(today, 7)).filter((i) => i.staffId === user.id && i.kind === 'task' && i.status !== 'done');
  const siteWork = [...siteDays.reduce((m, i) => m.set(i.id, m.has(i.id) ? { ...m.get(i.id), last: i.date } : { ...i, last: i.date }), new Map()).values()];
  const siteToday = siteDays.filter((i) => i.date === today);

  const when = (j) => `${j.plannedOn < today ? `was planned for ${fmtDay(j.plannedOn)}` : shortWindow(j.window) || 'today'}`;

  return (
    <Page
      title={`${greeting()}, ${user.name.split(' ')[0]}`}
      facts={`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${user.van ? ` · ${user.van}` : ''}`}
      about={ABOUT}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="px-1 text-sm text-slate-600">
          {dueToday.length === 0 && doneToday === 0
            ? 'No job is planned for today.'
            : `${plural(dueToday.length, 'job')} to do today${doneToday > 0 ? `, ${doneToday} done` : ''}.`}
        </p>

        {first ? <NowCard j={first} /> : siteToday.length === 0 && (
          <EmptyState icon={MapPinIcon} title="Nothing to do right now" action={<Button to="/customers/sites" icon={SearchIcon}>Look up a site</Button>}>
            When the coordinator plans a job for you it appears here.
          </EmptyState>
        )}

        {siteWork.length > 0 && (
          <Section title="Site work this week" count={siteWork.length}>
            <ul className="space-y-2">
              {siteWork.map((it) => (
                <li key={it.key}>
                  <Link to={it.sitePath} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors duration-150 hover:bg-slate-50">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><HardHatIcon className="size-5" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-medium text-slate-900">{it.title}</span>
                      <span className="block truncate text-xs text-slate-500">{it.date === today ? 'today' : fmtDay(it.date)}{it.last !== it.date ? ` to ${fmtDay(it.last)}` : ''}, {shortWindow(it.window).toLowerCase()} · {it.sub}</span>
                    </span>
                    <ArrowRightIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {rest.length > 0 && (
          <Section title="Then today" count={rest.length}>
            <ul className="space-y-2">{rest.map((j) => <JobRow key={j.id} j={j} note={when(j)} />)}</ul>
          </Section>
        )}

        {waiting.length > 0 && (
          <Section title="Waiting for you" count={waiting.length}>
            <ul className="space-y-2">
              {waiting.map((j) => <JobRow key={j.id} j={j} note={`done ${relDays(j.completedOn, today)}`} action={waitingStep(j)} />)}
            </ul>
          </Section>
        )}

        {later.length > 0 && (
          <Section title="Coming up" count={later.length}>
            <ul className="space-y-2">{later.map((j) => <JobRow key={j.id} j={j} note={`${fmtDay(j.plannedOn)}${j.window ? `, ${shortWindow(j.window).toLowerCase()}` : ''}`} />)}</ul>
          </Section>
        )}

        <Section title="On the way">
          <div className="grid grid-cols-2 gap-2">
            <Button icon={PlusIcon} onClick={() => setRecording(true)}>Record deficiency</Button>
            <Button icon={SearchIcon} to="/customers/sites">Look up a site</Button>
          </div>
          <p className="mt-2 px-1 text-xs text-slate-500">
            Found something wrong away from a job? Record it now with a photo: the office is told. To look at a site's equipment, its due dates and its contacts, open Sites.
          </p>
        </Section>

      </div>
      {recording && <DeficiencyDrawer onClose={() => setRecording(false)} onSaved={(id) => navigate(`/service/deficiencies/${id}`)} />}
    </Page>
  );
}
