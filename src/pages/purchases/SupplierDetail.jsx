import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PencilIcon, PlusIcon } from 'lucide-react';
import { orderTitle } from '@/data/purchaseRules.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { money } from '@/lib/format.js';
import { billRows, forWhat, orderView, ordersOfSupplier, supplierStats } from '@/store/purchaseSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Avatar, Badge, Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Card, DefinitionList, EmptyState, Page } from '@/ui/Page.jsx';
import { Stat } from '@/pages/projects/parts.jsx';
import { OrderBadge } from './parts.jsx';
import { SupplierDrawer } from './SupplierDrawer.jsx';

const ABOUT = {
  purpose: 'One supplier: who to call, the terms, what is open with them, what we owe, and the history of orders and bills.',
  why: [
    'The four figures on top answer what a buyer or an accountant asks first: how much have we bought, what is still to arrive, what do we owe, and is any of it late.',
    'Orders and bills are listed here as well as in their own pages, so the whole story of a supplier is one screen.',
  ],
  assumed: ['All the details of this supplier are invented.'],
};

export function SupplierDetail() {
  const { supplierId } = useParams();
  const s = useStore();
  const sup = s.suppliers[supplierId];
  const { may } = useSession();
  const [editing, setEditing] = useState(false);
  if (!sup) {
    return (
      <Page title="Supplier not found" back="/purchases/suppliers">
        <EmptyState title="This supplier does not exist" action={<Button variant="primary" to="/purchases/suppliers">All suppliers</Button>}>It may have been removed.</EmptyState>
      </Page>
    );
  }
  const today = todayISO();
  const stats = supplierStats(s, sup.id, today);
  const orders = ordersOfSupplier(s, sup.id).map((po) => orderView(s, po, today)).toSorted((a, b) => b.po.number.localeCompare(a.po.number));
  const bills = billRows(s, today).filter((r) => r.bill.supplierId === sup.id).toSorted((a, b) => b.bill.on.localeCompare(a.bill.on));
  const late = orders.filter((v) => v.late).length;

  return (
    <Page
      title={sup.name}
      badge={sup.active ? <Badge tone="green" dot>In use</Badge> : <Badge>Not used</Badge>}
      facts={`${sup.kind} · ${sup.area}`}
      back="/purchases/suppliers"
      about={ABOUT}
      menu={may('manage_suppliers') ? [{ label: 'Edit the supplier', icon: PencilIcon, onClick: () => setEditing(true) }] : undefined}
      actions={may('request_purchase') && sup.active && <Button variant="primary" icon={PlusIcon} to={`/purchases/new?supplier=${sup.id}`}>New purchase order</Button>}
    >
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Bought, before VAT" amount={stats.spent} sub={`${stats.orders} orders`} />
        <Stat label="Open orders" value={stats.open} sub={late > 0 ? `${late} late` : undefined} tone={late > 0 ? 'text-red-700' : undefined} />
        <Stat label="We owe" amount={stats.unpaid} />
        <Stat label="Overdue" amount={stats.overdue} tone={stats.overdue > 0 ? 'text-red-700' : undefined} />
      </dl>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card title="Purchase orders" bodyClassName="!px-2">
            {orders.length === 0 ? (
              <p className="px-3 text-sm text-slate-500">No order yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {orders.map((v) => (
                  <li key={v.po.id}>
                    <Link to={`/purchases/${v.po.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                      <span className="w-28 shrink-0 text-sm font-medium tabular-nums text-slate-900">{v.po.number}</span>
                      <span className="min-w-0 flex-1 basis-48">
                        <span className="block truncate text-sm text-slate-800">{orderTitle(v.po)}</span>
                        <span className="block truncate text-xs text-slate-500">{forWhat(s, v.po)} · {fmtDate(v.po.createdOn)}</span>
                      </span>
                      <span className="text-sm tabular-nums text-slate-900">{money(v.totals.total)}</span>
                      <OrderBadge v={v} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Bills">
            {bills.length === 0 ? (
              <p className="text-sm text-slate-500">No bill yet.</p>
            ) : (
              <ul className="-my-2 divide-y divide-slate-100">
                {bills.map((r) => (
                  <li key={r.bill.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block text-sm font-medium text-slate-900">{r.bill.supplierRef}</span>
                      <span className="block text-xs text-slate-500">
                        <Link className="underline-offset-2 hover:underline" to={`/purchases/${r.po.id}`}>{r.po.number}</Link> · {r.bill.paidOn ? `paid ${fmtDate(r.bill.paidOn)}` : `due ${fmtDate(r.bill.dueOn)} (${relDays(r.bill.dueOn, today)})`}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums text-slate-900">{money(r.totals.total)}</span>
                    <Status kind="bill" value={r.state} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Details">
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={sup.name} shape="square" size="lg" />
              <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{sup.contactName}</p><p className="text-xs text-slate-500">Person to call</p></div>
            </div>
            <DefinitionList
              cols={1}
              items={[
                { label: 'Phone', value: sup.phone },
                { label: 'E-mail', value: sup.email },
                { label: 'Address', value: sup.address },
                { label: 'TRN (sample)', value: sup.trn || 'None: imported supply' },
                { label: 'Payment terms', value: Number(sup.terms) === 0 ? 'Cash on delivery' : `Net ${sup.terms} days` },
                { label: 'VAT', value: sup.taxable ? 'Charges VAT' : 'No VAT on the invoice (imported)' },
                { label: 'Supplies', value: sup.categories.join(', ') },
                sup.notes && { label: 'Notes', value: sup.notes },
              ]}
            />
          </Card>
        </div>
      </div>
      <SupplierDrawer open={editing} onClose={() => setEditing(false)} supplier={sup} />
    </Page>
  );
}

