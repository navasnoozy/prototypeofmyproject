import { Link } from 'react-router';
import { ArrowRightIcon, CheckIcon, CircleDashedIcon } from 'lucide-react';
import { AREAS, isBuilt } from '@/data/areas.js';
import { COMPANY } from '@/data/seed/staff.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { num } from '@/lib/format.js';
import { list, summariseDevices } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Kbd, modKey } from '@/ui/Badge.jsx';
import { Card, Page } from '@/ui/Page.jsx';
import { useAttention } from '@/shell/attention.js';
import { TechnicianToday } from './TechnicianToday.jsx';

const ABOUT = {
  purpose: 'Home is the first thing a person sees. In the product it shows what matters to that person today, by role. For now it explains this prototype and shows what is built.',
  why: [
    'The list of areas is the proposal of record 39. The sidebar is real, so you can judge the navigation now; the areas not built yet say what they will hold.',
    'Home by role (the owner\'s numbers, the coordinator\'s day, the technician\'s jobs) is built in the last step, when the data of every area exists.',
  ],
  assumed: ['Everything here is sample data of an invented company.'],
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const dateWords = () =>
  new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// A technician's home is the day's jobs (Today); every other role gets the general home.
export function Home() {
  const { roleKey } = useSession();
  return roleKey === 'technician' ? <TechnicianToday /> : <OfficeHome />;
}

function OfficeHome() {
  const s = useStore();
  const { user, role, access } = useSession();
  const { items } = useAttention();
  const sum = summariseDevices(list(s.devices));

  const tiles = [
    { label: 'Customers', value: list(s.customers).length, to: '/customers', area: 'customers' },
    { label: 'Sites', value: list(s.sites).length, to: '/customers/sites', area: 'customers' },
    { label: 'Systems', value: list(s.systems).length, to: '/customers/sites', area: 'customers' },
    { label: 'Overdue for service', value: sum.overdue, to: '/customers/sites?due=overdue', area: 'customers', tone: sum.overdue ? 'text-red-700' : '' },
  ].filter((t) => access(t.area));

  return (
    <Page title={`${greeting()}, ${user.name.split(' ')[0]}`} facts={`${dateWords()} · ${COMPANY.name}`} about={ABOUT}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {tiles.length > 0 && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tiles.map((t) => (
                <Link key={t.label} to={t.to} className="rounded-2xl border border-slate-200 px-4 py-3.5 transition-colors duration-150 hover:bg-slate-50">
                  <dt className="text-xs text-slate-500">{t.label}</dt>
                  <dd className={`mt-1 text-2xl font-semibold tabular-nums ${t.tone || 'text-slate-900'}`}>{num(t.value)}</dd>
                </Link>
              ))}
            </dl>
          )}

          <Card title="Needs your attention">
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing needs you right now.</p>
            ) : (
              <ul className="-my-1.5 divide-y divide-slate-100">
                {items.map((i) => (
                  <li key={i.id}>
                    <Link to={i.to} className="flex items-center gap-3 py-3 hover:opacity-80">
                      <span className={`size-2 shrink-0 rounded-full ${{ red: 'bg-red-500', orange: 'bg-orange-500', blue: 'bg-blue-500' }[i.tone]}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">{i.title}</span>
                        <span className="block text-xs text-slate-500">{i.text}</span>
                      </span>
                      <ArrowRightIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Try this">
            <ol className="space-y-3 text-sm text-slate-700">
              <li>
                Open <Link className="font-medium text-slate-900 underline underline-offset-2" to="/customers/cus_marina">Marina Crest Owners Association</Link>, then its site, then the
                Equipment tab. Every device has a next due date.
              </li>
              <li>Point at an area in the sidebar, for example <strong className="font-semibold text-slate-900">Customers</strong>. A popup shows its sub modules and quick actions.</li>
              <li className="flex flex-wrap items-center gap-1.5">
                Press <span className="flex gap-1"><Kbd>{modKey()}</Kbd><Kbd>K</Kbd></span> and type “marina”, “fire alarm” or a phone number.
              </li>
              <li>Use <strong className="font-semibold text-slate-900">View as</strong> in the top bar and choose Omar Haddad, Sara Malik or Rashid Ali. Watch the sidebar change.</li>
              <li>
                Put <Link className="font-medium text-slate-900 underline underline-offset-2" to="/customers/cus_khalid">a customer</Link> on hold from its “⋯” menu, then look at the bell.
              </li>
              <li>Add a new customer with a first contact, then add a site and a fire alarm system to it.</li>
              <li>
                Follow a maintenance contract: in <Link className="font-medium text-slate-900 underline underline-offset-2" to="/sales/quotations/qt_131">QT-2026-0131</Link> (Harbour View) record that the customer
                accepted, press <strong className="font-semibold text-slate-900">Start the contract</strong>, send it to the authority, record its approval, and look at the visits it released in
                <Link className="ml-1 font-medium text-slate-900 underline underline-offset-2" to="/service/jobs?status=upcoming">Jobs</Link>.
              </li>
              <li>
                Open the <Link className="font-medium text-slate-900 underline underline-offset-2" to="/service/jobs/jb_1">visit at Palm Grove</Link> that is under way: mark the rest as pass, complete it, get the
                customer's signature, issue the report and send it. Then look at the equipment of that site: the due dates moved.
              </li>
              <li>
                Plan the week: open <Link className="font-medium text-slate-900 underline underline-offset-2" to="/schedule">Schedule</Link> and drag <strong className="font-semibold text-slate-900">Planned visit 2 of 4</strong> from the list onto a person and a day.
                Drop work on a day of Rashid Ali's training next week and see the warning. Press <strong className="font-semibold text-slate-900">Phone view</strong> first, and watch the job arrive on a technician's phone.
              </li>
              <li>
                Follow a project: <Link className="font-medium text-slate-900 underline underline-offset-2" to="/projects/prj_2">PRJ-2026-002</Link> (Tower B). Look at the sprinkler package that is over its budget, make the progress claim, and record a certificate for less than was claimed.
              </li>
              <li>
                Hand over <Link className="font-medium text-slate-900 underline underline-offset-2" to="/projects/prj_3?tab=handover">PRJ-2026-003</Link>: record the Civil Defence certificate, close the snags, issue the documents, and press Hand over. The pump set appears in the equipment register and a maintenance contract is offered.
              </li>
              <li>
                Start a project: as the owner, approve <Link className="font-medium text-slate-900 underline underline-offset-2" to="/sales/quotations/qt_136">QT-2026-0136</Link>, send it, record the answer, and press Start the project.
              </li>
              <li>
                Follow a repair from the start: <Link className="font-medium text-slate-900 underline underline-offset-2" to="/service/deficiencies/def_209">DEF-2026-0209</Link> is not reported yet. Report it, make the repair quotation,
                and follow the deficiency until it is verified. <Link className="font-medium text-slate-900 underline underline-offset-2" to="/service/deficiencies/def_211">DEF-2026-0211</Link> is an impairment: its system is out of service.
              </li>
              <li>
                Restock: open <Link className="font-medium text-slate-900 underline underline-offset-2" to="/inventory/stock">Stock</Link>, see what is below its minimum, and make a draft order from the suggestions. Send it for approval, approve it as Omar Haddad, send it to the supplier, and receive the goods as Bilal Khan: the balance grows and the movement is in the ledger.
              </li>
              <li>
                Use a part on a job: as Imran Qureshi, open the <Link className="font-medium text-slate-900 underline underline-offset-2" to="/service/jobs/jb_1">visit at Palm Grove</Link> and add three smoke detectors. They come out of his van. Look at his van on <Link className="font-medium text-slate-900 underline underline-offset-2" to="/inventory/stock">Stock</Link>, then top it up from the store.
              </li>
              <li>
                Buy for a project: on <Link className="font-medium text-slate-900 underline underline-offset-2" to="/projects/prj_2?tab=materials">PRJ-2026-002, Materials</Link> one order is late and one arrived in part. Make a new order for the sprinkler package that takes it over its budget, and see who must approve it. Then look at the bills that are due in <Link className="font-medium text-slate-900 underline underline-offset-2" to="/purchases/bills">Purchases</Link>.
              </li>
              <li>
                Follow a quotation from start to end: open <Link className="font-medium text-slate-900 underline underline-offset-2" to="/sales/quotations">Quotations</Link>, take the draft
                of Nexus Data Centre, send it for approval or to the customer, then use View as to approve it, and record the customer's answer.
              </li>
            </ol>
          </Card>
        </div>

        <Card title="Built so far" action={<span className="text-xs text-slate-500">{role.label}</span>}>
          <ul className="divide-y divide-slate-100">
            {AREAS.filter((a) => a.id !== 'home' && access(a.id)).map((a) => {
              const built = isBuilt(a);
              return (
                <li key={a.id}>
                  <Link to={a.path} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <span className={`grid size-6 shrink-0 place-items-center rounded-full ${built ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                      {built ? <CheckIcon className="size-3.5" aria-hidden="true" /> : <CircleDashedIcon className="size-3.5" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{a.label}</span>
                      <span className="block text-xs text-slate-500">{built ? 'Ready to use' : `Step ${a.step} of the build`}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Data date: {fmtDate(todayISO())}. Everything is a sample.</p>
        </Card>
      </div>
    </Page>
  );
}
