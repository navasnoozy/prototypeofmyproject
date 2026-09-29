import { Link } from 'react-router';
import { ArrowRightIcon, CheckIcon, CircleDashedIcon } from 'lucide-react';
import { AREAS } from '@/data/areas.js';
import { COMPANY } from '@/data/seed/staff.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { num } from '@/lib/format.js';
import { list, summariseDevices } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Kbd, modKey } from '@/ui/Badge.jsx';
import { Card, Page } from '@/ui/Page.jsx';
import { useAttention } from '@/shell/attention.js';

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

export function Home() {
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
      <div className="grid gap-5 lg:grid-cols-3">
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
              <li className="flex flex-wrap items-center gap-1.5">
                Press <span className="flex gap-1"><Kbd>{modKey()}</Kbd><Kbd>K</Kbd></span> and type “marina”, “fire alarm” or a phone number.
              </li>
              <li>Use <strong className="font-semibold text-slate-900">View as</strong> in the top bar and choose Omar Haddad, Sara Malik or Rashid Ali. Watch the sidebar change.</li>
              <li>
                Put <Link className="font-medium text-slate-900 underline underline-offset-2" to="/customers/cus_khalid">a customer</Link> on hold from its “⋯” menu, then look at the bell.
              </li>
              <li>Add a new customer with a first contact, then add a site and a fire alarm system to it.</li>
            </ol>
          </Card>
        </div>

        <Card title="Built so far" action={<span className="text-xs text-slate-500">{role.label}</span>}>
          <ul className="divide-y divide-slate-100">
            {AREAS.filter((a) => a.id !== 'home' && access(a.id)).map((a) => {
              const built = a.step <= 1;
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
