import { useState } from 'react';
import { Link } from 'react-router';
import { PackageCheckIcon, PlusIcon, Undo2Icon } from 'lucide-react';
import { orderTitle } from '@/data/purchaseRules.js';
import { cn } from '@/lib/cn.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { money, plural, round2 } from '@/lib/format.js';
import { issueToProject, returnToStock } from '@/store/inventoryActions.js';
import { balanceOf } from '@/store/inventorySelectors.js';
import { issuesOfProject, orderView, ordersOfProject } from '@/store/purchaseSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Badge } from '@/ui/Badge.jsx';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer } from '@/ui/Overlay.jsx';
import { Card } from '@/ui/Page.jsx';
import { OrderBadge } from '@/pages/purchases/parts.jsx';
import { ReceiveDialog } from '@/pages/purchases/PurchaseOrderDialogs.jsx';
import { Stat } from './parts.jsx';

const STORE = 'loc_store';

// Issues stock to the project: the store is the source and the cost is the
// average cost of the item on the day.
function IssueDrawer({ p, onClose }) {
  const s = useStore();
  const form = useForm(
    { itemId: '', qty: '', packageId: p.packages[0]?.id ?? '', note: '' },
    (v) => ({
      ...(v.itemId ? {} : { itemId: 'Choose the item.' }),
      ...(Number(v.qty) > 0 ? {} : { qty: 'Write the quantity.' }),
      ...(v.itemId && Number(v.qty) > balanceOf(s, v.itemId, STORE) ? { qty: `Only ${balanceOf(s, v.itemId, STORE)} in the store.` } : {}),
    }),
  );
  const options = list(s.items)
    .filter((i) => i.stocked && i.active)
    .map((i) => ({ value: i.id, label: i.name, sub: `${i.code} · ${balanceOf(s, i.id, STORE)} in the store`, badge: balanceOf(s, i.id, STORE) <= 0 ? { tone: 'red', text: 'None' } : undefined }));
  const item = s.items[form.values.itemId];
  const save = form.submit((v) => {
    issueToProject(p.id, { packageId: v.packageId, itemId: v.itemId, qty: Number(v.qty), note: v.note.trim() });
    toast('Issued from stock: the cost is on the project');
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Issue from stock" subtitle={p.number}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Issue</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Item" required error={form.error('itemId')}>
          <Combobox options={options} noun="items" placeholder="Choose an item from stock" searchPlaceholder="Search stock items" {...form.bind('itemId')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" required error={form.error('qty')} hint={item ? `In the store: ${balanceOf(s, item.id, STORE)} ${item.unit}` : undefined}>
            <TextInput {...form.bind('qty')} inputMode="decimal" suffix={item?.unit} />
          </Field>
          <Field label="Charged to"><Select {...form.bind('packageId')} options={p.packages.map((x) => ({ value: x.id, label: x.title }))} /></Field>
        </div>
        <Field label="Note" hint="Optional. What it is used for."><TextInput {...form.bind('note')} autoComplete="off" /></Field>
        {item && Number(form.values.qty) > 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Cost to the project: <strong className="font-semibold tabular-nums text-slate-900">AED {money(Number(form.values.qty) * (item.avgCost ?? item.cost))}</strong> at the average cost of AED {money(item.avgCost ?? item.cost)}.
          </p>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

export function ProjectMaterials({ p }) {
  const s = useStore();
  const { may } = useSession();
  const today = todayISO();
  const [issuing, setIssuing] = useState(false);
  const [receiving, setReceiving] = useState(null);
  const orders = ordersOfProject(s, p.id).map((po) => orderView(s, po, today)).toSorted((a, b) => b.po.number.localeCompare(a.po.number));
  const issues = issuesOfProject(s, p.id).filter((m) => m.kind === 'issue_project').toSorted((a, b) => b.on.localeCompare(a.on) || b.id.localeCompare(a.id, undefined, { numeric: true }));
  const placed = orders.filter((v) => ['sent', 'partly_received', 'received', 'closed'].includes(v.status));
  const committed = orders.filter((v) => ['approved', 'sent', 'partly_received', 'received', 'closed'].includes(v.status));
  const issuedValue = round2(issues.reduce((n, m) => n - (m.returned ? 0 : m.qty * m.unitCost), 0));
  const open = p.phase !== 'complete';
  const canOrder = may('request_purchase') && open;
  const canIssue = may('issue_stock') && open;
  const pkg = (id) => p.packages.find((x) => x.id === id)?.title;

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ordered" amount={round2(committed.reduce((n, v) => n + v.totals.net, 0))} sub={plural(committed.length, 'order')} />
        <Stat label="Arrived" amount={round2(placed.reduce((n, v) => n + v.progress.receivedNet, 0))} />
        <Stat label="Still to arrive" amount={round2(placed.reduce((n, v) => n + v.progress.outstandingNet, 0))} tone={orders.some((v) => v.late) ? 'text-red-700' : undefined} sub={orders.some((v) => v.late) ? 'Something is late' : undefined} />
        <Stat label="Issued from stock" amount={issuedValue} sub={plural(issues.filter((m) => !m.returned).length, 'issue')} />
      </dl>

      <Card title="Purchase orders" action={canOrder && <Button size="xs" icon={PlusIcon} to={`/purchases/new?project=${p.id}`}>Order materials</Button>}>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing has been ordered for this project yet.</p>
        ) : (
          <ul className="-my-2 divide-y divide-slate-100">
            {orders.map((v) => {
              const packages = [...new Set(v.po.lines.map((l) => pkg(l.packageId)).filter(Boolean))];
              const canConfirm = v.po.status === 'sent' && !v.progress.allReceived && v.po.deliverTo === 'site' && may('receive_site');
              return (
                <li key={v.po.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link to={`/purchases/${v.po.id}`} className="w-28 shrink-0 text-sm font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline">{v.po.number}</Link>
                    <span className="min-w-0 flex-1 basis-52">
                      <span className="block truncate text-sm text-slate-800">{orderTitle(v.po)}</span>
                      <span className="block truncate text-xs text-slate-500">{v.supplier?.name}{packages.length ? ` · ${packages.join(', ')}` : ''}</span>
                    </span>
                    <span className="text-sm font-medium tabular-nums text-slate-900">{money(v.totals.net)}</span>
                    <OrderBadge v={v} />
                  </div>
                  {(v.po.expectedOn || canConfirm) && (
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 pl-0 sm:pl-[7.75rem]">
                      <span className={cn('text-xs', v.late ? 'font-medium text-red-700' : 'text-slate-500')}>
                        {v.po.expectedOn && !v.progress.allReceived ? `Expected ${fmtDate(v.po.expectedOn)} (${relDays(v.po.expectedOn, today)})` : v.progress.someReceived ? `${plural(v.receipts.length, 'delivery', 'deliveries')} received` : ''}
                      </span>
                      {canConfirm && <Button size="xs" icon={PackageCheckIcon} onClick={() => setReceiving(v)}>Confirm delivery</Button>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">An approved or sent order counts against the budget of its package (ordered), and a supplier bill turns it into billed cost. Goods bought for a project do not pass through the stock.</p>
      </Card>

      <Card title="Issued from stock" action={canIssue && <Button size="xs" icon={PlusIcon} onClick={() => setIssuing(true)}>Issue from stock</Button>}>
        {issues.length === 0 ? (
          <p className="text-sm text-slate-500">No item was taken from stock for this project.</p>
        ) : (
          <ul className="-my-2 divide-y divide-slate-100">
            {issues.map((m) => {
              const item = s.items[m.itemId];
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span className="w-20 shrink-0 text-xs tabular-nums text-slate-500">{fmtDate(m.on)}</span>
                  <span className="min-w-0 flex-1 basis-52">
                    <span className="block text-sm text-slate-900">{Math.abs(m.qty)} {item?.unit} · {item?.name}</span>
                    <span className="block truncate text-xs text-slate-500">{pkg(m.ref.packageId) ?? ''}{m.note ? ` · ${m.note}` : ''}</span>
                  </span>
                  <span className="text-sm font-medium tabular-nums text-slate-900">{money(-m.qty * m.unitCost)}</span>
                  {m.returned ? <Badge>Returned</Badge> : <Badge tone="green" dot>Charged</Badge>}
                  {canIssue && !m.returned && <IconButton icon={Undo2Icon} label={`Return ${item?.name} to the store`} size="xs" onClick={() => { returnToStock(m.id); toast('Returned to the store: the cost is taken off the project'); }} />}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">Stock is issued from the main store and valued at the average cost of the item on the day.</p>
      </Card>

      {issuing && <IssueDrawer p={p} onClose={() => setIssuing(false)} />}
      {receiving && <ReceiveDialog v={orderView(s, s.purchaseOrders[receiving.po.id], today)} onClose={() => setReceiving(null)} />}
    </div>
  );
}
