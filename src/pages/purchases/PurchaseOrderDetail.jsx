import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  BanIcon, CalendarClockIcon, CheckIcon, CircleCheckIcon, CopyIcon, PackageCheckIcon, PencilIcon, PlusIcon, PrinterIcon, ReceiptTextIcon,
  SendIcon, ShieldCheckIcon, Trash2Icon, TriangleAlertIcon, Undo2Icon, WalletIcon,
} from 'lucide-react';
import { billState, billTotals, orderTitle } from '@/data/purchaseRules.js';
import { cn } from '@/lib/cn.js';
import { diffDays, fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { money, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { deletePurchaseOrder, duplicatePurchaseOrder, returnOrderToDraft } from '@/store/purchaseActions.js';
import { canApprovePO, deliverLabel, orderSteps, orderView, poApprovalNeeds } from '@/store/purchaseSelectors.js';
import { activityFor } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { ActivityList } from '@/ui/Activity.jsx';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { LifeCycle } from '@/ui/LifeCycle.jsx';
import { ConfirmDialog } from '@/ui/Overlay.jsx';
import { Card, DefinitionList, EmptyState, Page, Tabs } from '@/ui/Page.jsx';
import { staffName } from '@/pages/sales/parts.jsx';
import {
  BillDialog, CancelDialog, CloseShortDialog, DecisionDialog, DeliveryDateDialog, PaidDialog, ReceiveDialog, RequestApprovalDialog, SendDialog,
} from './PurchaseOrderDialogs.jsx';
import { PurchaseOrderPreview } from './PurchaseOrderPreview.jsx';
import { ForCell, OrderBadge } from './parts.jsx';

const ABOUT = {
  purpose: 'The working screen of one purchase order: the lines with what was ordered, what has arrived and what the supplier has billed, the approval inside the company, the deliveries, and the bills.',
  why: [
    'The strip under the title shows where the order stands, and the one main button is always the next step: send for approval, approve, send to the supplier, receive the goods, record the bill, mark it paid.',
    'The three columns of the lines (ordered, received, billed) are the three-way check that every purchasing system keeps: a bill is only right if it matches what was ordered and what really arrived.',
    'Approval follows authority, like quotations: by value, and for a project order also when it takes a package over its budget. The person who asked never approves it, unless the owner.',
    'A delivery can come in parts; each part is a receipt with its own number. An order for stock adds to the stock balance when it is received; a project or job order is charged to it at once.',
  ],
  assumed: [
    'The limits, the suppliers, the prices and the payment terms are samples.',
    'Sending to the supplier is simulated: no e-mail leaves this prototype. Paying is only recorded; the bank and the accounts are not part of it.',
  ],
};

export function PurchaseOrderDetail() {
  const { poId } = useParams();
  const s = useStore();
  const po = s.purchaseOrders[poId];
  if (!po) {
    return (
      <Page title="Order not found" back="/purchases">
        <EmptyState title="This purchase order does not exist" action={<Button variant="primary" to="/purchases">All orders</Button>}>It may have been deleted.</EmptyState>
      </Page>
    );
  }
  return <Body key={po.id} po={po} />;
}

function Body({ po }) {
  const s = useStore();
  const navigate = useNavigate();
  const { may, user } = useSession();
  const [tab, setTab] = useParam('tab', 'order');
  const [dialog, setDialog] = useState(null); // request | approve | refuse | send | receive | bill | cancel | short | date | delete
  const [paying, setPaying] = useState(null);

  const today = todayISO();
  const v = orderView(s, po, today);
  const { status, progress, supplier } = v;
  const needs = poApprovalNeeds(po, s);
  const decide = canApprovePO(po, s, user.id);
  const writer = may('request_purchase');
  const placed = ['sent', 'partly_received', 'received', 'closed'].includes(status);
  const canReceive = po.status === 'sent' && !progress.allReceived && (po.deliverTo === 'site' ? may('receive_site') : may('receive_goods'));
  const billable = po.status === 'sent' && progress.rows.some((r) => r.expected - r.billedQty > 0) && progress.someReceived;
  const canBill = billable && may('record_bills');
  const unpaid = v.bills.filter((b) => !b.paidOn).toSorted((a, b) => a.dueOn.localeCompare(b.dueOn));
  const activity = activityFor(s, 'po', po.id);
  const late = v.late ? diffDays(po.expectedOn, today) : 0;

  // The one main step follows the life of the order.
  let cta = null;
  if (status === 'draft' && writer) cta = needs.needed ? { label: 'Send for approval', icon: ShieldCheckIcon, run: () => setDialog('request') } : { label: 'Send to supplier', icon: SendIcon, run: () => setDialog('send') };
  else if (status === 'waiting_approval' && decide) cta = { label: 'Approve', icon: CheckIcon, run: () => setDialog('approve') };
  else if (status === 'approved' && writer) cta = { label: 'Send to supplier', icon: SendIcon, run: () => setDialog('send') };
  else if (canReceive) cta = { label: 'Receive goods', icon: PackageCheckIcon, run: () => setDialog('receive') };
  else if (canBill && progress.toBillNet > 0) cta = { label: 'Record bill', icon: ReceiptTextIcon, run: () => setDialog('bill') };
  else if (unpaid.length > 0 && may('pay_bills')) cta = { label: 'Mark bill as paid', icon: WalletIcon, run: () => setPaying(unpaid[0]) };
  if (status === 'draft' && cta && po.lines.length === 0) cta = { ...cta, disabled: true };

  const menu = [
    writer && status === 'draft' && { label: 'Edit the order', icon: PencilIcon, onClick: () => navigate(`/purchases/${po.id}/edit`) },
    { label: 'Preview and print', icon: PrinterIcon, onClick: () => setTab('preview') },
    canReceive && { label: 'Receive goods', icon: PackageCheckIcon, onClick: () => setDialog('receive') },
    canBill && { label: 'Record a supplier bill', icon: ReceiptTextIcon, onClick: () => setDialog('bill') },
    writer && ['approved', 'sent', 'partly_received'].includes(status) && { label: 'Change the delivery day', icon: CalendarClockIcon, onClick: () => setDialog('date') },
    writer && ['waiting_approval', 'approved'].includes(status) && (status === 'approved' || po.approval.requestedBy === user.id) && { label: status === 'approved' ? 'Return to draft to edit' : 'Withdraw the approval request', icon: Undo2Icon, onClick: () => { returnOrderToDraft(po.id, status === 'approved' ? 'Returned to draft after approval' : 'Approval request withdrawn'); toast('Back in draft'); } },
    decide && { label: 'Refuse approval', icon: BanIcon, onClick: () => setDialog('refuse') },
    writer && status === 'partly_received' && { label: 'Close short (the rest will not come)', icon: CircleCheckIcon, onClick: () => setDialog('short') },
    writer && ['waiting_approval', 'approved', 'sent'].includes(status) && !progress.someReceived && { label: 'Cancel the order', icon: BanIcon, tone: 'danger', onClick: () => setDialog('cancel') },
    writer && { label: 'Copy as a new order', icon: CopyIcon, onClick: () => { const id = duplicatePurchaseOrder(po.id); toast('Copied as a new draft'); navigate(`/purchases/${id}`); } },
    writer && status === 'draft' && { separator: true },
    writer && status === 'draft' && { label: 'Delete draft', icon: Trash2Icon, tone: 'danger', onClick: () => setDialog('delete') },
  ].filter(Boolean);

  return (
    <Page
      title={po.number}
      badge={<OrderBadge v={v} />}
      facts={`${orderTitle(po)} · ${supplier?.name}`}
      back="/purchases"
      about={ABOUT}
      menu={menu}
      actions={cta && <Button variant="primary" icon={cta.icon} onClick={cta.run} disabled={cta.disabled} title={cta.disabled ? 'Add items first' : undefined}>{cta.label}</Button>}
      tabs={<Tabs value={tab} onChange={setTab} items={[{ value: 'order', label: 'Order' }, { value: 'preview', label: 'Preview' }]} />}
    >
      {tab === 'preview' ? (
        <PurchaseOrderPreview v={v} />
      ) : (
        <>
          <LifeCycle steps={orderSteps(v)} className="mb-5" />
          {status === 'cancelled' && (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <strong className="font-semibold">Cancelled on {fmtDate(po.cancelled?.on)}.</strong> {po.cancelled?.reason} The order stays here for the record.
            </div>
          )}
          {v.late && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
              <TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1"><strong className="font-semibold">{plural(late, 'day')} late.</strong> {supplier?.name} promised {fmtDate(po.expectedOn)}. Call {supplier?.contactName} on {supplier?.phone}.</span>
              {writer && <Button size="xs" onClick={() => setDialog('date')}>New day</Button>}
            </div>
          )}
          {po.closedShort && (
            <p className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <strong className="font-semibold">Closed short on {fmtDate(po.closedShort.on)}.</strong> {po.closedShort.note}
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
              <LinesCard v={v} placed={placed} />
              {placed && <DeliveriesCard v={v} canReceive={canReceive} onReceive={() => setDialog('receive')} />}
              {(placed || v.bills.length > 0) && <BillsCard v={v} canBill={canBill} onBill={() => setDialog('bill')} onPay={setPaying} canPay={may('pay_bills')} today={today} />}
            </div>
            <div className="space-y-5">
              <SummaryCard v={v} placed={placed} />
              <ApprovalCard po={po} needs={needs} canDecide={decide} onApprove={() => setDialog('approve')} onRefuse={() => setDialog('refuse')} />
              <DetailsCard v={v} />
              <Card title="What happened"><ActivityList entries={activity} limit={12} /></Card>
            </div>
          </div>
        </>
      )}

      {dialog === 'request' && <RequestApprovalDialog po={po} needs={needs} onClose={() => setDialog(null)} />}
      {dialog === 'approve' && <DecisionDialog po={po} approve onClose={() => setDialog(null)} />}
      {dialog === 'refuse' && <DecisionDialog po={po} approve={false} onClose={() => setDialog(null)} />}
      {dialog === 'send' && <SendDialog v={v} onClose={() => setDialog(null)} />}
      {dialog === 'receive' && <ReceiveDialog v={v} onClose={() => setDialog(null)} />}
      {dialog === 'bill' && <BillDialog v={v} onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && <CancelDialog po={po} onClose={() => setDialog(null)} />}
      {dialog === 'short' && <CloseShortDialog po={po} onClose={() => setDialog(null)} />}
      {dialog === 'date' && <DeliveryDateDialog po={po} onClose={() => setDialog(null)} />}
      {paying && <PaidDialog bill={paying} po={po} onClose={() => setPaying(null)} />}
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Delete this draft?"
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          deletePurchaseOrder(po.id);
          toast('Draft deleted');
          navigate('/purchases', { replace: true });
        }}
      >
        {po.number} will be removed. This cannot be undone.
      </ConfirmDialog>
    </Page>
  );
}

// ---- the lines: ordered, received, billed --------------------------------------------------------------------------------
function LinesCard({ v, placed }) {
  const s = useStore();
  const { po, progress } = v;
  const project = s.projects[po.projectId];
  const pkg = (id) => project?.packages.find((x) => x.id === id)?.title;
  return (
    <Card title="Items" bodyClassName="!px-2">
      {po.lines.length === 0 ? (
        <p className="px-3 text-sm text-slate-500">No items yet. Edit the order to add some.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs font-medium text-slate-500">
                  <th scope="col" className="border-b border-slate-200 px-3 py-2">Item</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Ordered</th>
                  {placed && <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Received</th>}
                  {placed && <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Billed</th>}
                  <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Cost each</th>
                  <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {progress.rows.map((r) => (
                  <tr key={r.line.id} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-2.5">
                      <p className="text-slate-900">{r.line.description}</p>
                      {po.purpose === 'project' && pkg(r.line.packageId) && <p className="text-xs text-slate-500">{pkg(r.line.packageId)}</p>}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5 text-right tabular-nums">{r.ordered} <span className="text-xs text-slate-500">{r.line.unit}</span></td>
                    {placed && (
                      <td className={cn('whitespace-nowrap border-b border-slate-100 px-3 py-2.5 text-right tabular-nums', r.outstanding > 0 && r.received > 0 && 'font-medium text-orange-700', r.outstanding === 0 && r.received > 0 && 'text-green-700')}>
                        {r.received}
                      </td>
                    )}
                    {placed && (
                      <td className={cn('whitespace-nowrap border-b border-slate-100 px-3 py-2.5 text-right tabular-nums', r.billedQty > r.received && 'font-medium text-red-700')}>
                        {r.billedQty}
                      </td>
                    )}
                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-600">{money(r.line.cost)}</td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-900">{money(r.line.qty * r.line.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 px-3 md:hidden">
            {progress.rows.map((r) => (
              <li key={r.line.id} className="py-2.5">
                <p className="text-sm text-slate-900">{r.line.description}</p>
                <p className="text-xs tabular-nums text-slate-500">
                  {r.ordered} {r.line.unit} at {money(r.line.cost)}{placed ? ` · received ${r.received} · billed ${r.billedQty}` : ''}
                </p>
                <p className="text-right text-sm tabular-nums text-slate-900">{money(r.line.qty * r.line.cost)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function DeliveriesCard({ v, canReceive, onReceive }) {
  const s = useStore();
  const { po, receipts } = v;
  const rows = receipts.toSorted((a, b) => b.on.localeCompare(a.on));
  return (
    <Card title="Deliveries" action={canReceive && <Button size="xs" icon={PlusIcon} onClick={onReceive}>Receive goods</Button>}>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing has arrived yet.{po.expectedOn ? ` Expected ${fmtDate(po.expectedOn)} (${relDays(po.expectedOn)}).` : ''}</p>
      ) : (
        <ul className="-my-2 divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium tabular-nums text-slate-900">{r.number}</p>
                <p className="text-xs text-slate-500">{fmtDate(r.on)} · {staffName(s, r.byId)}</p>
              </div>
              <p className="text-xs text-slate-500">{r.deliveryNote ? `Delivery note ${r.deliveryNote} · ` : ''}{r.to === 'site' ? 'To the site' : s.locations[r.to]?.name}</p>
              <ul className="mt-1 text-sm text-slate-700">
                {r.lines.map((l) => {
                  const line = po.lines.find((x) => x.id === l.lineId);
                  return <li key={l.lineId} className="flex justify-between gap-3"><span className="min-w-0 truncate">{line?.description}</span><span className="tabular-nums text-slate-600">{l.qty} {line?.unit}</span></li>;
                })}
              </ul>
              {r.note && <p className="mt-1 text-xs italic text-slate-500">“{r.note}”</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BillsCard({ v, canBill, onBill, onPay, canPay, today }) {
  const { po, bills, progress } = v;
  return (
    <Card title="Supplier bills" action={canBill && <Button size="xs" icon={PlusIcon} onClick={onBill}>Record bill</Button>}>
      {bills.length === 0 ? (
        <p className="text-sm text-slate-500">
          No bill yet. {progress.toBillNet > 0 ? `Goods worth AED ${money(progress.toBillNet)} have arrived and are not billed.` : 'It is recorded when the supplier sends it.'}
        </p>
      ) : (
        <ul className="-my-2 divide-y divide-slate-100">
          {bills.toSorted((a, b) => b.on.localeCompare(a.on)).map((b) => {
            const t = billTotals(b, po);
            const state = billState(b, today);
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="text-sm font-medium text-slate-900">{b.supplierRef} <span className="font-normal tabular-nums text-slate-500">· {b.number}</span></p>
                  <p className="text-xs text-slate-500">
                    Billed {fmtDate(b.on)} · {b.paidOn ? `paid ${fmtDate(b.paidOn)}${b.paidRef ? ` (${b.paidRef})` : ''}` : `due ${fmtDate(b.dueOn)} (${relDays(b.dueOn, today)})`}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums text-slate-900">{money(t.total)}</span>
                <Status kind="bill" value={state} />
                {canPay && !b.paidOn && <Button size="xs" onClick={() => onPay(b)}>Mark as paid</Button>}
              </li>
            );
          })}
        </ul>
      )}
      {progress.someReceived && (
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs">
          <div><dt className="text-slate-500">Ordered</dt><dd className="tabular-nums text-slate-800">{money(v.totals.net)}</dd></div>
          <div><dt className="text-slate-500">Received</dt><dd className="tabular-nums text-slate-800">{money(progress.receivedNet)}</dd></div>
          <div><dt className="text-slate-500">Billed</dt><dd className={cn('tabular-nums', progress.billedNet > progress.receivedNet ? 'font-semibold text-red-700' : 'text-slate-800')}>{money(progress.billedNet)}</dd></div>
        </dl>
      )}
    </Card>
  );
}

// ---- the right column ------------------------------------------------------------------------------------------------------------
const Row = ({ label, value, strong }) => (
  <div className={cn('flex items-baseline justify-between gap-3', strong && 'text-base font-semibold text-slate-900')}>
    <dt className={cn(!strong && 'text-slate-600')}>{label}</dt>
    <dd className="tabular-nums">{value}</dd>
  </div>
);

function SummaryCard({ v, placed }) {
  const { po, totals, progress } = v;
  return (
    <Card title="Summary">
      <dl className="space-y-2.5 text-sm">
        <Row label="Net" value={money(totals.net)} />
        <Row label={`VAT ${po.vatRate}%`} value={money(totals.vat)} />
        <div className="border-t border-slate-200 pt-3"><Row label="Total (AED)" value={money(totals.total)} strong /></div>
      </dl>
      {placed && (
        <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
          <Row label="Still to arrive" value={money(progress.outstandingNet)} />
          <Row label="Arrived, not billed" value={money(progress.toBillNet)} />
        </div>
      )}
    </Card>
  );
}

function ApprovalCard({ po, needs, canDecide, onApprove, onRefuse }) {
  const s = useStore();
  const a = po.approval;
  const who = (id) => staffName(s, id);
  let body;
  if (po.status === 'waiting_approval') {
    body = (
      <>
        <p className="flex items-start gap-2 text-sm text-slate-900">
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-orange-600" aria-hidden="true" />
          <span><strong className="font-semibold">Waiting for the {a.required === 'owner' ? 'owner' : 'operations manager'}.</strong> Asked by {who(a.requestedBy)} on {fmtDate(a.requestedOn)}.</span>
        </p>
        {a.comment && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">“{a.comment}”</p>}
        <Reasons list={a.reasons} />
        {canDecide && (
          <div className="flex gap-2 pt-1">
            <Button variant="primary" size="sm" icon={CheckIcon} onClick={onApprove}>Approve</Button>
            <Button size="sm" icon={BanIcon} onClick={onRefuse}>Refuse</Button>
          </div>
        )}
      </>
    );
  } else if (a.decision === 'approved') {
    body = (
      <>
        <p className="flex items-start gap-2 text-sm text-slate-900">
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
          <span><strong className="font-semibold">Approved by {who(a.decidedBy)}</strong> on {fmtDate(a.decidedOn)}.</span>
        </p>
        {a.decisionNote && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">“{a.decisionNote}”</p>}
        <Reasons list={a.reasons} />
      </>
    );
  } else {
    body = (
      <>
        {a.decision === 'rejected' && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span><strong className="font-semibold">Refused by {who(a.decidedBy)}:</strong> {a.decisionNote}</span>
          </p>
        )}
        {po.status === 'draft' && needs.needed ? (
          <>
            <p className="flex items-start gap-2 text-sm text-slate-900">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-orange-600" aria-hidden="true" />
              <span><strong className="font-semibold">Needs approval by the {needs.roleLabel}</strong> before it can be sent.</span>
            </p>
            <Reasons list={needs.reasons} />
          </>
        ) : (
          <p className="text-sm text-slate-600">
            {needs.reasons.length > 0 ? `Within the maker's own authority, so no one else had to approve. (${needs.reasons[0]}.)` : 'No approval was needed: the value is within the limit of the purchase officer.'}
          </p>
        )}
      </>
    );
  }
  return <Card title="Approval"><div className="space-y-3">{body}</div></Card>;
}

const Reasons = ({ list }) =>
  list?.length > 0 ? (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">{list.map((r) => <li key={r}>{r}</li>)}</ul>
  ) : null;

function DetailsCard({ v }) {
  const s = useStore();
  const { po, supplier } = v;
  return (
    <Card title="Details">
      <DefinitionList
        cols={1}
        items={[
          { label: 'Supplier', value: supplier && <Link to={`/purchases/suppliers/${supplier.id}`} className="font-medium underline-offset-2 hover:underline">{supplier.name}</Link> },
          { label: 'Bought for', value: <ForCell po={po} /> },
          { label: 'Deliver to', value: deliverLabel(s, po) },
          { label: 'Expected', value: po.expectedOn ? `${fmtDate(po.expectedOn)} (${relDays(po.expectedOn)})` : '' },
          { label: 'Made by', value: `${staffName(s, po.createdBy)} on ${fmtDate(po.createdOn)}` },
          { label: 'Sent', value: po.sent ? `${fmtDate(po.sent.on)} to ${po.sent.to}` : '' },
          { label: 'Supplier\'s reference', value: po.supplierRef },
          { label: 'Payment terms', value: supplier && (Number(supplier.terms) === 0 ? 'Cash on delivery' : `Net ${supplier.terms} days`) },
          po.notes && { label: 'Notes', value: po.notes },
        ]}
      />
    </Card>
  );
}
