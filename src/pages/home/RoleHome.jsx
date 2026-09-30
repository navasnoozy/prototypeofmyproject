import { Link } from 'react-router';
import { ArrowRightIcon, CompassIcon } from 'lucide-react';
import { AREAS } from '@/data/areas.js';
import { COMPANY } from '@/data/seed/staff.js';
import { cn } from '@/lib/cn.js';
import { todayISO } from '@/lib/dates.js';
import { money } from '@/lib/format.js';
import { roleHome } from '@/store/homeSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Button } from '@/ui/Button.jsx';
import { Card, Page } from '@/ui/Page.jsx';
import { ProgressBar } from '@/pages/projects/parts.jsx';
import { useAttention } from '@/shell/attention.js';

const ABOUT = {
  purpose: 'Home is what matters to one person today: four figures, the things that wait for them, and the lists of their own work. It follows the role, so every person of the company sees a different Home.',
  why: [
    'The four figures at the top are the ones this role acts on every day, taken from the areas the role works in. Each one opens the place where the work is done.',
    '"Needs your attention" is the list of the bell, with the most urgent at the top. The lists under it are the person\'s own work: the owner\'s decisions and the customers to watch, the accountant\'s overdue invoices, the storekeeper\'s deliveries.',
    'The buttons on the right start the things this person starts most often, so the first click of the day is not a search.',
    'Use "View as" (top bar) to see the Home of every role. The amber card is the guide of the prototype: it is not part of the product.',
  ],
  assumed: ['Which figures and lists each role needs is a first guess from the study of the roles. It is one of the things the prototype is for: tell us what is missing.'],
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};
const dateWords = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// What each role starts most often, in the order it should appear (paths of the quick actions of the areas).
const PREFERRED = {
  owner: ['/sales/quotations/new', '/billing/new', '/purchases/new', '/customers/new'],
  manager: ['/sales/quotations/new', '/service/jobs/new', '/purchases/new', '/customers/new'],
  sales: ['/sales/new', '/sales/quotations/new', '/customers/new', '/customers/sites/new'],
  coordinator: ['/service/jobs/new', '/customers/sites/new', '/customers/contacts?new=1'],
  purchasing: ['/purchases/new', '/purchases/suppliers?new=1', '/inventory?new=1'],
  storekeeper: ['/inventory?new=1'],
  accountant: ['/billing/new', '/billing/receipts?new=1'],
};

const TONE_ORDER = { red: 0, orange: 1, blue: 2 };
const DOT = { red: 'bg-red-500', orange: 'bg-orange-500', blue: 'bg-blue-500' };

function Tile({ tile }) {
  const body = (
    <>
      <dt className="text-xs text-slate-500">{tile.label}</dt>
      <dd className={cn('mt-1 flex flex-wrap items-baseline gap-x-1 text-2xl font-semibold tabular-nums', tile.tone ?? 'text-slate-900')}>
        {tile.amount !== undefined ? (
          <>
            <span className="text-xs font-medium text-slate-500">AED</span>
            <span className="whitespace-nowrap">{money(tile.amount)}</span>
          </>
        ) : tile.value}
      </dd>
      {tile.sub && <dd className="mt-0.5 text-xs text-slate-500">{tile.sub}</dd>}
    </>
  );
  const box = 'block min-w-0 rounded-2xl border border-slate-200 px-4 py-3.5';
  return tile.to ? <Link to={tile.to} className={cn(box, 'transition-colors duration-150 hover:bg-slate-50')}>{body}</Link> : <div className={box}>{body}</div>;
}

// `stacked` is for the narrow column: the amount goes under the title instead of beside it.
function Row({ row, stacked }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{row.title}</span>
        {row.sub && <span className="block truncate text-xs text-slate-500">{row.sub}</span>}
        {stacked && row.right && <span className={cn('mt-0.5 block text-xs font-medium tabular-nums', row.tone ?? 'text-slate-700')}>{row.right}</span>}
        {row.progress !== undefined && <ProgressBar value={row.progress} className="mt-1.5 max-w-xs" tone={row.tone ? 'orange' : 'dark'} />}
      </span>
      {!stacked && row.right && <span className={cn('max-w-[45%] shrink-0 text-right text-xs tabular-nums', row.tone ?? 'text-slate-600')}>{row.right}</span>}
      {row.to && <ArrowRightIcon className="size-4 shrink-0 text-slate-300" aria-hidden="true" />}
    </>
  );
  const cls = 'flex items-center gap-3 rounded-xl px-3 py-2.5';
  return row.to ? <Link to={row.to} className={cn(cls, 'hover:bg-slate-50')}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function ListCard({ list, stacked = false }) {
  return (
    <Card
      title={list.title}
      bodyClassName="!px-2"
      action={list.action && <Link to={list.action.to} className="text-xs font-medium text-slate-700 underline underline-offset-2">{list.action.label}</Link>}
    >
      {list.rows.length === 0 ? (
        <p className="px-3 pb-1 text-sm text-slate-500">{list.empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">{list.rows.map((row) => <li key={row.key}><Row row={row} stacked={stacked} /></li>)}</ul>
      )}
    </Card>
  );
}

function NeedsYou({ items }) {
  const sorted = items.toSorted((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
  const shown = sorted.slice(0, 6);
  return (
    <Card title="Needs your attention" bodyClassName="!px-2" action={items.length > 6 ? <span className="text-xs text-slate-500">{shown.length} of {items.length}, the bell has all</span> : undefined}>
      {shown.length === 0 ? (
        <p className="px-3 pb-1 text-sm text-slate-500">Nothing needs you right now.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((i) => (
            <li key={i.id}>
              <Link to={i.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                <span className={cn('size-2 shrink-0 rounded-full', DOT[i.tone])} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">{i.title}</span>
                  <span className="block text-xs text-slate-500">{i.text}</span>
                </span>
                <ArrowRightIcon className="size-4 shrink-0 text-slate-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function QuickActions({ roleKey, canEdit }) {
  const order = PREFERRED[roleKey] ?? [];
  const actions = AREAS.flatMap((a) => (canEdit(a.id) ? a.actions ?? [] : []))
    .toSorted((a, b) => (order.indexOf(a.path) === -1 ? 99 : order.indexOf(a.path)) - (order.indexOf(b.path) === -1 ? 99 : order.indexOf(b.path)))
    .slice(0, 4);
  if (actions.length === 0) return null;
  return (
    <Card title="Start something">
      <ul className="-my-1 divide-y divide-slate-100">
        {actions.map((a) => (
          <li key={a.path}>
            <Link to={a.path} className="flex items-center gap-3 py-2.5 hover:opacity-80">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">{a.label}</span>
                <span className="block truncate text-xs text-slate-500">{a.sub}</span>
              </span>
              <ArrowRightIcon className="size-4 shrink-0 text-slate-300" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// The guide of the prototype: amber, like the other controls that belong to the prototype and not to the product.
function GuideCard() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-950">
        <CompassIcon className="size-4 text-amber-700" aria-hidden="true" />
        Guided journeys
      </h2>
      <p className="mt-1.5 text-sm text-amber-950/90">
        Follow one whole story from the first step to the last, one person after another: a project won and paid, a fault found and repaired, a contract renewed, stock bought and used.
      </p>
      <Button className="mt-3" size="sm" to="/journeys">Open the journeys</Button>
      <p className="mt-3 text-xs text-amber-900/80">Everything here is sample data of an invented company; the dates follow today.</p>
    </section>
  );
}

export function RoleHome() {
  const s = useStore();
  const { user, role, roleKey, canEdit } = useSession();
  const { items } = useAttention();
  const home = roleHome(s, user, todayISO());
  const main = home.lists.filter((l) => !l.side);
  const side = home.lists.filter((l) => l.side);

  return (
    <Page title={`${greeting()}, ${user.name.split(' ')[0]}`} facts={`${dateWords()} · ${role.label} · ${COMPANY.name}`} about={ABOUT}>
      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {home.tiles.map((t) => <Tile key={t.key} tile={t} />)}
      </dl>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <NeedsYou items={items} />
          {main.map((l) => <ListCard key={l.key} list={l} />)}
        </div>
        <div className="min-w-0 space-y-5">
          <QuickActions roleKey={roleKey} canEdit={canEdit} />
          {side.map((l) => <ListCard key={l.key} list={l} stacked />)}
          <GuideCard />
        </div>
      </div>
    </Page>
  );
}
