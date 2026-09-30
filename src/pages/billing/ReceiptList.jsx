import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { PlusIcon, WalletIcon } from 'lucide-react';
import { PAYMENT_METHODS } from '@/data/billingKinds.js';
import { unallocatedOf } from '@/data/billingRules.js';
import { addDays, fmtDate, todayISO } from '@/lib/dates.js';
import { money, plural, round2 } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Button } from '@/ui/Button.jsx';
import { Segmented } from '@/ui/Form.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { staffName } from '@/pages/sales/parts.jsx';
import { AllocateDrawer, NewReceiptDrawer, ReceiptViewDrawer } from './ReceiptDrawer.jsx';
import { BillingTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'Every payment that customers made, with the invoices each one paid, and the money that has not been given to an invoice yet.',
  why: [
    'A payment is a document of its own, a receipt. It is not a button on an invoice, because real money does not arrive that way: one transfer often pays several invoices, and a customer sometimes pays a round amount that fits no invoice.',
    'When a receipt is recorded, the invoices are filled oldest first, and the person can change any row. What no invoice takes stays on the receipt as money on account. It counts against what the customer owes, and it is allocated when the customer says what it was for.',
    'A receipt shows the invoices it paid, and each of those invoices shows the receipt, so the question "was this paid?" is answered from both sides.',
  ],
  assumed: [
    'Only the receipt is recorded. The bank, the deposit and the accounts are not part of the prototype (the study places them with the accounting system).',
    'A refund to a customer is not modelled: an overpayment stays as money on account.',
  ],
};

const SEGMENTS = [
  { value: 'all', label: 'All' },
  { value: 'account', label: 'Money on account' },
];

export function ReceiptList() {
  const s = useStore();
  const { may } = useSession();
  const collector = may('receive_payments');
  const [q, setQ] = useParam('q');
  const [seg, setSeg] = useParam('seg', 'all');
  const [customer, setCustomer] = useParam('customer');
  const [method, setMethod] = useParam('method');
  // The three drawers (new, view, allocate) live in the address; changes to several
  // of them at once go in one update.
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
  const isNew = params.get('new');
  const openId = params.get('open') ?? '';
  const allocateId = params.get('allocate') ?? '';
  const today = todayISO();

  const all = useMemo(() => list(s.payments), [s.payments]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (p) =>
        (seg === 'all' || unallocatedOf(p) > 0.004) &&
        (!customer || p.customerId === customer) &&
        (!method || p.method === method) &&
        (!needle || `${p.number} ${p.reference} ${s.customers[p.customerId]?.name ?? ''}`.toLowerCase().includes(needle)),
    );
  }, [all, s.customers, q, seg, customer, method]);

  const onAccount = round2(all.reduce((n, p) => n + Math.max(0, unallocatedOf(p)), 0));
  const withMoneyOnAccount = all.filter((p) => unallocatedOf(p) > 0.004).length;
  const last30 = all.filter((p) => p.on >= addDays(today, -30));
  const thisYear = all.filter((p) => p.on >= `${today.slice(0, 4)}-01-01`);
  const sum = (rowsOf) => round2(rowsOf.reduce((n, p) => n + p.amount, 0));

  const columns = useMemo(
    () => [
      {
        key: 'number', header: 'Receipt', sortValue: (p) => p.number,
        cell: (p) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap font-medium tabular-nums text-slate-900">{p.number}</p>
            <p className="max-w-[24ch] truncate text-xs text-slate-500">{p.reference || PAYMENT_METHODS[p.method]}</p>
          </div>
        ),
      },
      { key: 'customer', header: 'Customer', sortValue: (p) => s.customers[p.customerId]?.name ?? '', cell: (p) => <span className="block max-w-[30ch] truncate text-slate-800">{s.customers[p.customerId]?.name}</span> },
      { key: 'on', header: 'Received', sortValue: (p) => p.on, cell: (p) => <span className="whitespace-nowrap text-slate-600">{fmtDate(p.on)}</span> },
      { key: 'method', header: 'How', hideBelow: 'xl', sortValue: (p) => p.method, cell: (p) => <span className="whitespace-nowrap text-slate-600">{PAYMENT_METHODS[p.method]}</span> },
      { key: 'paid', header: 'Paid', hideBelow: 'lg', sortValue: (p) => p.allocations.length, cell: (p) => <span className="whitespace-nowrap text-xs text-slate-600">{p.allocations.length === 0 ? 'no invoice yet' : plural(p.allocations.length, 'invoice')}</span> },
      { key: 'amount', header: 'Amount (AED)', align: 'right', sortValue: (p) => p.amount, cell: (p) => money(p.amount) },
      {
        key: 'free', header: 'On account (AED)', align: 'right', hideBelow: 'md', sortValue: (p) => unallocatedOf(p),
        cell: (p) => (unallocatedOf(p) > 0.004 ? <span className="font-medium text-orange-700">{money(unallocatedOf(p))}</span> : <span className="text-slate-400">—</span>),
      },
      { key: 'by', header: 'Recorded by', hideBelow: 'xl', sortValue: (p) => staffName(s, p.byId), cell: (p) => <span className="whitespace-nowrap text-slate-600">{staffName(s, p.byId)}</span> },
    ],
    [s],
  );
  const table = useTable(rows, columns, { pageSize: 12, initialSort: { key: 'on', dir: 'desc' } });

  const viewing = openId ? s.payments[openId] : null;
  const allocating = allocateId ? s.payments[allocateId] : null;

  return (
    <Page
      title="Receipts"
      facts={`${plural(all.length, 'receipt')} · AED ${money(sum(last30))} received in the last 30 days${onAccount > 0 ? ` · AED ${money(onAccount)} on account` : ''}`}
      tabs={<BillingTabs />}
      about={ABOUT}
      actions={collector && <Button variant="primary" icon={PlusIcon} onClick={() => setMany({ new: '1' })}>New receipt</Button>}
      footer={<Pagination table={table} noun="receipts" />}
    >
      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Received, last 30 days" amount={sum(last30)} sub={plural(last30.length, 'receipt')} />
        <Stat label="Received this year" amount={sum(thisYear)} sub={plural(thisYear.length, 'receipt')} />
        <Stat label="Money on account" amount={onAccount} tone={onAccount > 0 ? 'text-orange-700' : undefined} sub={onAccount > 0 ? `${plural(withMoneyOnAccount, 'receipt')} to allocate` : 'everything is allocated'} />
        <Stat label="Customers that paid" value={new Set(thisYear.map((p) => p.customerId)).size} sub="this year" />
      </dl>
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search receipt, customer, reference" />
        <FilterSelect label="Customer" value={customer} onChange={setCustomer} options={list(s.customers).filter((c) => all.some((p) => p.customerId === c.id)).map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect label="How" value={method} onChange={setMethod} options={Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))} />
        <Segmented size="sm" label="Show" value={seg} onChange={setSeg} options={SEGMENTS.map((x) => ({ ...x, count: x.value === 'account' ? withMoneyOnAccount : undefined }))} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        rowKey={(p) => p.id}
        sort={table.sort}
        onSort={table.toggleSort}
        onRowClick={(p) => setMany({ open: p.id })}
        empty={<EmptyState icon={WalletIcon} title="No receipt here" action={<Button onClick={() => { setQ(''); setCustomer(''); setMethod(''); setSeg('all'); }}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(p) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{s.customers[p.customerId]?.name}</span>
              <span className="text-sm tabular-nums text-slate-900">{money(p.amount)}</span>
            </div>
            <p className="text-xs text-slate-500">
              {p.number} · {fmtDate(p.on)} · {p.reference || PAYMENT_METHODS[p.method]}
              {unallocatedOf(p) > 0.004 && <span className="font-medium text-orange-700"> · AED {money(unallocatedOf(p))} on account</span>}
            </p>
          </div>
        )}
      />

      {isNew && collector && <NewReceiptDrawer presetCustomer={params.get('payer') ?? ''} onClose={() => setMany({ new: '', payer: '' })} onSaved={(id) => setMany({ new: '', payer: '', open: id })} />}
      {viewing && !allocating && <ReceiptViewDrawer payment={viewing} onClose={() => setMany({ open: '' })} onAllocate={() => setMany({ allocate: viewing.id })} />}
      {allocating && collector && <AllocateDrawer payment={allocating} onClose={() => setMany({ allocate: '' })} />}
    </Page>
  );
}
