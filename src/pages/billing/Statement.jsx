import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { BellRingIcon, PlusIcon, PrinterIcon, SendIcon, UserRoundIcon, WalletIcon } from 'lucide-react';
import { AGE_BUCKETS } from '@/data/billingKinds.js';
import { documentTotals, statementOf } from '@/data/billingRules.js';
import { COMPANY } from '@/data/seed/staff.js';
import { cn } from '@/lib/cn.js';
import { addMonths, fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { money, plural, round2 } from '@/lib/format.js';
import { accountOf, onAccountOf } from '@/store/billingSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Button } from '@/ui/Button.jsx';
import { Field, Segmented, TextInput } from '@/ui/Form.jsx';
import { Card, EmptyState, Page } from '@/ui/Page.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { RemindAllDialog, SendStatementDialog } from './StatementDialogs.jsx';
import { AGE_TONE, AgeBar } from './parts.jsx';

const ABOUT = {
  purpose: 'The account of one customer: what it owes now and how old it is, its open invoices (also by building), the money it has on account, and the full statement of invoices, credit notes and receipts with a running balance.',
  why: [
    'This is the page to have open when the customer calls, and the document that goes to the customer when it asks "what do we owe you?". The statement lists every invoice as a debit and every receipt and credit note as a credit, and the balance runs down the last column.',
    'A customer that owns several buildings often pays one transfer for several invoices, and its accounts department wants to know what belongs to which building. "By building" splits the open invoices that way.',
    'The statement opens with the balance carried from before the period, so a statement of one year still agrees with the account.',
    'Print makes the statement a PDF without the buttons. "Send" and the reminder are simulated: they only write into the history of the customer.',
  ],
  assumed: [
    'The balance at the end of the statement is the open invoices less the money on account, because a receipt counts on the day it came, even before it is allocated.',
    'Interest on late payment is not charged.',
  ],
};

const PERIODS = [
  { value: 'year', label: 'This year' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Choose dates' },
];

export function Statement() {
  const { customerId } = useParams();
  const s = useStore();
  const customer = s.customers[customerId];
  if (!customer) {
    return (
      <Page title="Customer not found" back="/billing/statements">
        <EmptyState title="This customer does not exist" action={<Button variant="primary" to="/billing/statements">All statements</Button>}>It may have been removed.</EmptyState>
      </Page>
    );
  }
  return <Body key={customer.id} customer={customer} />;
}

const DOC = {
  invoice: { label: 'Invoice', to: (r) => `/billing/${r.id}` },
  credit: { label: 'Credit note', to: (r) => `/billing/credit-notes/${r.id}` },
  receipt: { label: 'Receipt', to: (r) => `/billing/receipts?open=${r.id}` },
};

function Body({ customer }) {
  const s = useStore();
  const navigate = useNavigate();
  const { may, access } = useSession();
  const [params, setParams] = useSearchParams();
  const setMany = (changes) =>
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value) copy.set(key, value);
        else copy.delete(key);
      }
      return copy;
    }, { replace: true });
  const period = params.get('p') ?? 'year';
  const by = params.get('by') ?? 'list';
  const [dialog, setDialog] = useState(null); // send | remind
  const today = todayISO();
  const yearStart = `${today.slice(0, 4)}-01-01`;

  const account = accountOf(s, customer.id, today);
  const onAccount = onAccountOf(s, customer.id);
  const overdue = account.open.filter((v) => v.state === 'overdue');
  const collector = may('receive_payments');

  const range = {
    year: { from: yearStart, to: today },
    '12m': { from: addMonths(today, -12), to: today },
    all: { from: '2000-01-01', to: today },
    custom: { from: params.get('from') || yearStart, to: params.get('to') || today },
  }[period] ?? { from: yearStart, to: today };
  const statement = useMemo(
    () => statementOf({ customerId: customer.id, invoices: list(s.invoices), receipts: list(s.payments), creditNotes: list(s.creditNotes), totalOf: (d) => documentTotals(d).total, from: range.from, to: range.to }),
    [s.invoices, s.payments, s.creditNotes, customer.id, range.from, range.to],
  );

  // Open invoices, together or by building.
  const openRows = account.open.toSorted((a, b) => a.inv.dueOn.localeCompare(b.inv.dueOn));
  const groups = useMemo(() => {
    const map = new Map();
    for (const v of openRows) {
      const key = v.inv.siteId || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(v);
    }
    return [...map.entries()]
      .map(([siteId, rows]) => ({ siteId, name: s.sites[siteId]?.name ?? 'No building named', rows, owed: round2(rows.reduce((n, v) => n + v.balance, 0)) }))
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [openRows, s.sites]);
  const manySites = groups.length > 1;

  const menu = [
    { label: 'Print the statement', icon: PrinterIcon, onClick: () => window.print() },
    collector && { label: 'Send the statement', icon: SendIcon, onClick: () => setDialog('send') },
    collector && overdue.length > 0 && { label: `Send a reminder for ${plural(overdue.length, 'overdue invoice')}`, icon: BellRingIcon, onClick: () => setDialog('remind') },
    may('issue_invoices') && { label: 'Make an invoice for this customer', icon: PlusIcon, onClick: () => navigate(`/billing/new?customer=${customer.id}`) },
    access('customers') && { label: 'Open the customer', icon: UserRoundIcon, onClick: () => navigate(`/customers/${customer.id}`) },
  ].filter(Boolean);

  const dueText = (v) => (v.state === 'overdue' ? <span className="font-medium text-red-700">{plural(v.overdueDays, 'day')} late</span> : <span className="text-slate-500">due {relDays(v.inv.dueOn, today)}</span>);

  return (
    <Page
      title={`Statement: ${customer.name}`}
      facts={account.balance > 0.004 ? `Owes AED ${money(account.balance)}${account.overdue > 0.004 ? `, AED ${money(account.overdue)} of it overdue` : ''} · ${customer.terms}` : `Owes nothing · ${customer.terms}`}
      back="/billing/statements"
      about={ABOUT}
      menu={menu}
      actions={collector && <Button variant="primary" icon={WalletIcon} to={`/billing/receipts?new=1&payer=${customer.id}`}>Record a payment</Button>}
    >
      {/* What the printed statement starts with. */}
      <div className="mb-6 hidden print:block">
        <p className="text-lg font-bold">{COMPANY.name}</p>
        <p className="text-sm text-slate-600">{COMPANY.address} · TRN {COMPANY.trn}</p>
        <p className="mt-4 text-xl font-bold uppercase tracking-wide">Statement of account</p>
        <p className="font-semibold">{customer.name}</p>
        <p className="text-sm text-slate-600">{[customer.address, customer.area, customer.emirate].filter(Boolean).join(', ')}{customer.trn ? ` · TRN ${customer.trn}` : ''}</p>
        <p className="text-sm text-slate-600">From {fmtDate(range.from)} to {fmtDate(range.to)}</p>
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
        <Stat label="Owes on invoices" amount={account.balance} sub={plural(account.open.length, 'open invoice')} />
        <Stat label="Overdue" amount={account.overdue} tone={account.overdue > 0.004 ? 'text-red-700' : undefined} sub={account.overdue > 0.004 ? `the oldest ${plural(account.oldest, 'day')} late` : 'nothing late'} />
        {account.limit > 0
          ? <Stat label="Credit limit" amount={account.limit} tone={account.over ? 'text-orange-700' : undefined} sub={account.over ? `over by AED ${money(round2(account.balance - account.limit))}` : `${Math.round(account.used)}% used`} />
          : <Stat label="Credit limit" value="No limit" sub="set on the customer" />}
        <Stat label="Money on account" amount={onAccount.total} tone={onAccount.total > 0.004 ? 'text-orange-700' : undefined} sub={onAccount.items.length > 0 ? plural(onAccount.items.length, 'document') : 'none'} />
      </dl>

      {account.balance > 0.004 && (
        <Card title="Age of the debt" className="mb-5">
          <AgeBar buckets={account.buckets} thick />
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
            {AGE_BUCKETS.map((b) => (
              <li key={b.key} className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className={cn('size-2.5 rounded-full', AGE_TONE[b.key])} aria-hidden="true" />{b.label}</span>
                <span className="block tabular-nums text-slate-900">{money(account.buckets[b.key])}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title={`Open invoices (${account.open.length})`}
        className="mb-5 print:hidden"
        bodyClassName="!px-2"
        action={manySites && <Segmented size="sm" label="Arrange the open invoices" value={by} onChange={(v) => setMany({ by: v === 'list' ? '' : v })} options={[{ value: 'list', label: 'One list' }, { value: 'site', label: 'By building' }]} />}
      >
        {account.open.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">Nothing is owed on any invoice.</p>
        ) : by === 'site' && manySites ? (
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.siteId || 'none'}>
                <header className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900">{g.name}</h3>
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">AED {money(g.owed)}</span>
                </header>
                <OpenList rows={g.rows} dueText={dueText} showSite={false} />
              </section>
            ))}
            <p className="flex justify-between gap-3 border-t border-slate-200 px-3 pt-3 text-sm font-semibold text-slate-900"><span>Total owed</span><span className="tabular-nums">AED {money(account.balance)}</span></p>
          </div>
        ) : (
          <OpenList rows={openRows} dueText={dueText} showSite={manySites} />
        )}
      </Card>

      {onAccount.items.length > 0 && (
        <Card title="Money on account" className="mb-5 print:hidden" bodyClassName="!px-2">
          <ul className="divide-y divide-slate-100">
            {onAccount.items.map((x) => (
              <li key={x.doc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5">
                <span className="min-w-0 flex-1 basis-48">
                  <span className="block text-sm font-medium tabular-nums text-slate-900">{x.doc.number}</span>
                  <span className="block truncate text-xs text-slate-500">{x.kind === 'payment' ? `Receipt of ${fmtDate(x.doc.on)}` : `Credit note · ${x.doc.reason}`}</span>
                </span>
                <span className="text-sm font-medium tabular-nums text-orange-800">{money(x.amount)}</span>
                {collector && (
                  <Button size="xs" to={x.kind === 'payment' ? `/billing/receipts?allocate=${x.doc.id}` : `/billing/credit-notes/${x.doc.id}`}>
                    {x.kind === 'payment' ? 'Allocate' : 'Open'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Statement of account" bodyClassName="!px-2">
        <div className="mb-4 flex flex-wrap items-end gap-3 px-3 print:hidden">
          <Segmented
            size="sm"
            label="Period"
            value={period}
            onChange={(v) => setMany({ p: v === 'year' ? '' : v, from: v === 'custom' ? range.from : '', to: v === 'custom' ? range.to : '' })}
            options={PERIODS}
          />
          {period === 'custom' && (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="From" className="w-40"><TextInput type="date" value={range.from} max={range.to} onChange={(v) => setMany({ from: v })} /></Field>
              <Field label="To" className="w-40"><TextInput type="date" value={range.to} min={range.from} max={today} onChange={(v) => setMany({ to: v })} /></Field>
            </div>
          )}
        </div>
        <p className="mb-3 px-3 text-xs text-slate-500">From {fmtDate(range.from)} to {fmtDate(range.to)}. Invoices are debits; receipts and credit notes are credits.</p>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs font-medium text-slate-500">
                <th scope="col" className="border-b border-slate-200 px-3 py-2">Date</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2">Document</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2">Details</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Debit</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Credit</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-slate-50 text-slate-600">
                <td className="px-3 py-2" colSpan={5}>Balance brought forward from before {fmtDate(range.from)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(statement.opening)}</td>
              </tr>
              {statement.rows.map((r) => (
                <tr key={`${r.kind}${r.id}`} className="align-top">
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5 text-slate-600">{fmtDate(r.date)}</td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5">
                    <Link to={DOC[r.kind].to(r)} className="font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline print:no-underline">{r.number}</Link>
                    <span className="block text-xs text-slate-500">{DOC[r.kind].label}</span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-slate-700">
                    <span className="block max-w-[38ch] truncate">{r.text}</span>
                    {r.siteId && <span className="block text-xs text-slate-500">{s.sites[r.siteId]?.name}</span>}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums">{r.debit > 0 ? money(r.debit) : ''}</td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums">{r.credit > 0 ? money(r.credit) : ''}</td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-900">{money(r.running)}</td>
                </tr>
              ))}
              {statement.rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Nothing happened on this account in this period.</td></tr>}
              <tr className="font-semibold text-slate-900">
                <td className="px-3 py-3" colSpan={5}>Balance at {fmtDate(range.to)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(statement.closing)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-slate-100 px-3 md:hidden">
          <li className="flex justify-between gap-3 py-2.5 text-sm text-slate-600"><span>Brought forward</span><span className="tabular-nums">{money(statement.opening)}</span></li>
          {statement.rows.map((r) => (
            <li key={`${r.kind}${r.id}`} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <Link to={DOC[r.kind].to(r)} className="text-sm font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline">{r.number}</Link>
                <span className="text-sm tabular-nums text-slate-900">{r.debit > 0 ? `+ ${money(r.debit)}` : `− ${money(r.credit)}`}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-xs text-slate-500">
                <span className="min-w-0 truncate">{fmtDate(r.date)} · {DOC[r.kind].label} · {r.text}</span>
                <span className="tabular-nums">balance {money(r.running)}</span>
              </div>
            </li>
          ))}
          <li className="flex justify-between gap-3 py-3 text-sm font-semibold text-slate-900"><span>Balance at {fmtDate(range.to)}</span><span className="tabular-nums">{money(statement.closing)}</span></li>
        </ul>

        {range.to === today && onAccount.total > 0.004 && (
          <p className="mt-3 px-3 text-xs text-slate-500">
            The balance is AED {money(account.balance)} owed on invoices, less AED {money(onAccount.total)} on account (money and credit that no invoice has taken yet): AED {money(round2(account.balance - onAccount.total))}.
          </p>
        )}
      </Card>

      {dialog === 'send' && <SendStatementDialog customer={customer} owed={account.balance} from={range.from} until={range.to} onClose={() => setDialog(null)} />}
      {dialog === 'remind' && <RemindAllDialog customer={customer} overdue={overdue} onClose={() => setDialog(null)} />}
    </Page>
  );
}

function OpenList({ rows, dueText, showSite }) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((v) => (
        <li key={v.inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5">
          <span className="min-w-0 flex-1 basis-56">
            <Link to={`/billing/${v.inv.id}`} className="text-sm font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline">{v.inv.number}</Link>
            <span className="block truncate text-xs text-slate-500">{v.inv.title}{showSite && v.site ? ` · ${v.site.name}` : ''}</span>
          </span>
          <span className="text-xs">{dueText(v)}</span>
          <span className={cn('w-28 text-right text-sm tabular-nums', v.state === 'overdue' ? 'font-medium text-red-700' : 'text-slate-900')}>{money(v.balance)}</span>
        </li>
      ))}
    </ul>
  );
}
