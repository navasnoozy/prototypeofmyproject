import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  BellRingIcon, CircleCheckIcon, FilePlusIcon, PencilIcon, PrinterIcon, SendIcon, Trash2Icon, TriangleAlertIcon, UsersRoundIcon, WalletIcon,
} from 'lucide-react';
import { PAYMENT_METHODS, termsDays } from '@/data/billingKinds.js';
import { cn } from '@/lib/cn.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { money, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { deleteInvoiceDraft } from '@/store/billingActions.js';
import { creditLabel, creditNotesOf, invoiceLabel, invoiceSteps, invoiceView, isOwed, settlementsOf, sourceOf } from '@/store/billingSelectors.js';
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
import { IssueDialog, PaymentDialog, ReminderDialog, SendDialog } from './InvoiceDialogs.jsx';
import { DocumentPreview } from './InvoicePreview.jsx';
import { InvoiceBadge, LinesTable } from './parts.jsx';

const ABOUT = {
  purpose: 'One invoice: its lines and totals, where it comes from, when it is due, what has been paid or credited, and what happened to it.',
  why: [
    'The strip under the title shows where the invoice stands, and the one main button is always the next step: issue it, send it, record the payment.',
    'A draft can be changed until it is issued. Then it has its number, its date and its due day, and it is fixed. A mistake is corrected with a credit note, which keeps the record honest (sample rule).',
    'The invoice says where it comes from and links back: the instalment of a contract, the claim of a project, the job, or the accepted quotation. The invoice made from a claim keeps the working of the claim, so the customer\'s engineer can check it.',
    'Payments and credits are listed here, each with its own document. An overdue invoice shows how many days it is late and how many reminders were sent.',
  ],
  assumed: [
    'The payment terms of the customer decide the due day. "Net 45" is 45 days from the day of the invoice; "Cash" is the same day.',
    'Sending is simulated: nothing leaves the prototype. A reminder is only written into the history.',
  ],
};

export function InvoiceDetail() {
  const { invoiceId } = useParams();
  const s = useStore();
  const inv = s.invoices[invoiceId];
  if (!inv) {
    return (
      <Page title="Invoice not found" back="/billing">
        <EmptyState title="This invoice does not exist" action={<Button variant="primary" to="/billing">All invoices</Button>}>A draft may have been deleted.</EmptyState>
      </Page>
    );
  }
  return <Body key={inv.id} inv={inv} />;
}

function Body({ inv }) {
  const s = useStore();
  const navigate = useNavigate();
  const { may, access } = useSession();
  const [tab, setTab] = useParam('tab', 'invoice');
  const [dialog, setDialog] = useState(null); // issue | send | pay | remind | delete
  const today = todayISO();
  const v = invoiceView(s, inv, today);
  const { totals, state, balance, settled } = v;
  const issuer = may('issue_invoices');
  const collector = may('receive_payments');
  const draft = inv.status === 'draft';
  const owed = isOwed(v);
  const src = sourceOf(s, inv);
  const credits = creditNotesOf(s, inv.id);
  const settlementsList = settlementsOf(s, inv.id);
  const activity = activityFor(s, 'invoice', inv.id);
  const site = s.sites[inv.siteId];
  const customer = s.customers[inv.customerId];
  const contact = s.contacts[inv.contactId];
  const empty = inv.lines.length === 0 || totals.total <= 0;

  let cta = null;
  if (draft && issuer) cta = { label: 'Issue invoice', icon: CircleCheckIcon, run: () => setDialog('issue'), disabled: empty };
  else if (!draft && !inv.sent && issuer && !['paid', 'credited'].includes(state)) cta = { label: 'Send to customer', icon: SendIcon, run: () => setDialog('send') };
  else if (owed && collector) cta = { label: 'Record payment', icon: WalletIcon, run: () => setDialog('pay') };

  const menu = [
    draft && issuer && { label: 'Edit the draft', icon: PencilIcon, onClick: () => navigate(`/billing/${inv.id}/edit`) },
    { label: 'Preview and print', icon: PrinterIcon, onClick: () => setTab('preview') },
    !draft && issuer && { label: inv.sent ? 'Send again' : 'Send to the customer', icon: SendIcon, onClick: () => setDialog('send') },
    owed && collector && { label: 'Record a payment', icon: WalletIcon, onClick: () => setDialog('pay') },
    owed && state === 'overdue' && collector && { label: 'Send a reminder', icon: BellRingIcon, onClick: () => setDialog('remind') },
    !draft && may('raise_credit_notes') && { label: 'Make a credit note', icon: FilePlusIcon, onClick: () => navigate(`/billing/credit-notes/new?invoice=${inv.id}`) },
    { label: 'Open the customer\'s statement', icon: UsersRoundIcon, onClick: () => navigate(`/billing/statements/${inv.customerId}`) },
    draft && issuer && { separator: true },
    draft && issuer && { label: 'Delete the draft', icon: Trash2Icon, tone: 'danger', onClick: () => setDialog('delete') },
  ].filter(Boolean);

  return (
    <Page
      title={invoiceLabel(inv)}
      badge={<InvoiceBadge v={v} />}
      facts={`${inv.title} · ${customer?.name}`}
      back="/billing"
      about={ABOUT}
      menu={menu}
      actions={cta && <Button variant="primary" icon={cta.icon} onClick={cta.run} disabled={cta.disabled} title={cta.disabled ? 'Add items first' : undefined}>{cta.label}</Button>}
      tabs={<Tabs value={tab} onChange={setTab} items={[{ value: 'invoice', label: 'Invoice' }, { value: 'preview', label: 'Preview' }]} />}
    >
      {tab === 'preview' ? (
        <DocumentPreview doc={inv} kind="invoice" />
      ) : (
        <>
          <LifeCycle steps={invoiceSteps(v)} className="mb-5" />
          {draft && (
            <p className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <strong className="font-semibold">A draft.</strong> It has no number yet and can be changed. {inv.locked ? 'Its lines come from the record it was made from and cannot be edited here.' : 'Check the lines, then issue it.'}
            </p>
          )}
          {state === 'overdue' && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
              <TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <strong className="font-semibold">{plural(v.overdueDays, 'day')} overdue.</strong> AED {money(balance)} was due on {fmtDate(inv.dueOn)}.{' '}
                {inv.reminders.length > 0 ? `${plural(inv.reminders.length, 'reminder')} sent, the last on ${fmtDate(inv.reminders.at(-1).on)}.` : 'No reminder was sent yet.'}
              </span>
              {collector && <Button size="xs" onClick={() => setDialog('remind')}>Send reminder</Button>}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
              <Card title="Items" bodyClassName="!px-2">
                <LinesTable lines={inv.lines} empty="No items yet. Edit the draft to add some." />
              </Card>

              <Card title="Payments and credits">
                {settlementsList.length === 0 && credits.length === 0 ? (
                  <p className="text-sm text-slate-500">{draft ? 'Nothing yet: the invoice is not issued.' : 'Nothing has been paid or credited yet.'}</p>
                ) : (
                  <ul className="-my-2 divide-y divide-slate-100">
                    {settlementsList.map((x, i) => (
                      <li key={`${x.doc.id}${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                        <span className="min-w-0 flex-1 basis-48">
                          {x.kind === 'payment' ? (
                            <Link to={access('billing') ? `/billing/receipts?open=${x.doc.id}` : '#'} className="text-sm font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline">{x.doc.number}</Link>
                          ) : (
                            <Link to={`/billing/credit-notes/${x.doc.id}`} className="text-sm font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline">{creditLabel(x.doc)}</Link>
                          )}
                          <span className="block text-xs text-slate-500">{x.kind === 'payment' ? `Payment · ${x.doc.reference || PAYMENT_METHODS[x.doc.method]}` : `Credit note · ${x.doc.reason}`} · {fmtDate(x.on)}</span>
                        </span>
                        <span className="text-sm font-medium tabular-nums text-slate-900">{x.kind === 'credit' ? '− ' : ''}{money(x.amount)}</span>
                      </li>
                    ))}
                    {credits.filter((c) => c.status !== 'issued').map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                        <Link to={`/billing/credit-notes/${c.id}`} className="min-w-0 flex-1 basis-48 text-sm font-medium text-slate-900 underline-offset-2 hover:underline">{creditLabel(c)}</Link>
                        <Status kind="creditNote" value={c.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {inv.reminders.length > 0 && (
                <Card title="Reminders sent">
                  <ul className="-my-1.5 divide-y divide-slate-100">
                    {inv.reminders.map((r) => (
                      <li key={r.level} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                        <span className="text-slate-900">Reminder {r.level}</span>
                        <span className="text-xs text-slate-500">{fmtDate(r.on)} · {r.to.map((id) => s.contacts[id]?.name).filter(Boolean).join(', ') || 'the customer'}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            <div className="space-y-5">
              <Card title="Summary">
                <dl className="space-y-2.5 text-sm">
                  <Row label="Subtotal" value={money(totals.subtotal)} />
                  {totals.discount > 0 && <Row label={`Discount (${inv.discountPct}%)`} value={`− ${money(totals.discount)}`} />}
                  <Row label="Taxable amount" value={money(totals.net)} />
                  <Row label={`VAT ${inv.vatRate}%`} value={money(totals.vat)} />
                  <div className="border-t border-slate-200 pt-3"><Row label="Total (AED)" value={money(totals.total)} strong /></div>
                </dl>
                {!draft && (
                  <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
                    <Row label="Paid" value={money(settled.paid)} />
                    {settled.credited > 0 && <Row label="Credited" value={money(settled.credited)} />}
                    <Row label="Still owed" value={money(Math.max(0, balance))} strong tone={state === 'overdue' ? 'text-red-700' : undefined} />
                  </div>
                )}
              </Card>
              <Card title="Details">
                <DefinitionList
                  cols={1}
                  items={[
                    { label: 'Customer', value: customer && (access('customers') ? <Link to={`/customers/${customer.id}`} className="font-medium underline-offset-2 hover:underline">{customer.name}</Link> : customer.name) },
                    { label: 'Site', value: site && (access('customers') ? <Link to={`/customers/sites/${site.id}`} className="font-medium underline-offset-2 hover:underline">{site.name}</Link> : site.name) },
                    { label: 'Comes from', value: src.to && access(src.area) ? <Link to={src.to} className="font-medium underline-offset-2 hover:underline">{src.label}</Link> : src.label },
                    { label: 'Customer\'s reference', value: inv.reference },
                    { label: 'Date of supply', value: fmtDate(inv.supplyOn) },
                    { label: 'Issued', value: inv.issuedOn ? `${fmtDate(inv.issuedOn)} by ${staffName(s, inv.createdBy)}` : '' },
                    { label: 'Payment terms', value: `${inv.terms} (${termsDays(inv.terms) === 0 ? 'the same day' : `${termsDays(inv.terms)} days`})` },
                    { label: 'Due', value: inv.dueOn ? `${fmtDate(inv.dueOn)} (${relDays(inv.dueOn, today)})` : '' },
                    { label: 'Sent', value: inv.sent ? `${fmtDate(inv.sent.on)} to ${inv.sent.to.map((id) => s.contacts[id]?.name).filter(Boolean).join(', ') || 'the customer'}${inv.sent.attached?.length ? `, with ${inv.sent.attached.join(', ')}` : ''}` : draft ? '' : 'Not sent yet' },
                    contact && { label: 'Contact', value: `${contact.name}, ${contact.title}` },
                    inv.notes && { label: 'Notes', value: inv.notes },
                  ]}
                />
              </Card>
              <Card title="What happened"><ActivityList entries={activity} limit={12} /></Card>
            </div>
          </div>
        </>
      )}

      {dialog === 'issue' && <IssueDialog v={v} onClose={() => setDialog(null)} />}
      {dialog === 'send' && <SendDialog v={v} onClose={() => setDialog(null)} />}
      {dialog === 'pay' && <PaymentDialog v={v} onClose={() => setDialog(null)} />}
      {dialog === 'remind' && <ReminderDialog v={v} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Delete this draft?"
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          deleteInvoiceDraft(inv.id);
          toast('Draft deleted');
          navigate('/billing', { replace: true });
        }}
      >
        The draft will be removed{inv.source.kind !== 'manual' ? `, and ${src.label} can be invoiced again` : ''}. This cannot be undone.
      </ConfirmDialog>
    </Page>
  );
}

const Row = ({ label, value, strong, tone }) => (
  <div className={cn('flex items-baseline justify-between gap-3', strong && 'text-base font-semibold text-slate-900')}>
    <dt className={cn(!strong && 'text-slate-600')}>{label}</dt>
    <dd className={cn('tabular-nums', tone)}>{value}</dd>
  </div>
);
