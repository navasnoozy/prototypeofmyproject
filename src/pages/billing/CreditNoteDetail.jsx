import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BanIcon, CheckIcon, CircleCheckIcon, FileTextIcon, PrinterIcon, ShieldCheckIcon, Trash2Icon, TriangleAlertIcon, Undo2Icon, UsersRoundIcon, WalletIcon } from 'lucide-react';
import { documentTotals, unappliedOf } from '@/data/billingRules.js';
import { cn } from '@/lib/cn.js';
import { fmtDate } from '@/lib/dates.js';
import { money, num } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { deleteCreditNoteDraft, returnCreditToDraft } from '@/store/billingActions.js';
import { canApproveCredit, creditApprovalNeeds, creditLabel, creditSteps } from '@/store/billingSelectors.js';
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
import { openInvoicesOf } from './Allocation.jsx';
import { ApplyCreditDrawer, CreditApprovalRequestDialog, CreditDecisionDialog, IssueCreditDialog } from './CreditNoteDialogs.jsx';
import { DocumentPreview } from './InvoicePreview.jsx';
import { LinesTable } from './parts.jsx';

const ABOUT = {
  purpose: 'One credit note: what it takes back, from which invoice, why, who approved it, and where the credit went.',
  why: [
    'The strip under the title shows where the credit note stands, and the one main button is the next step: issue it, send it for approval, approve it, or apply the credit that is left.',
    'A credit note is the correction of an invoice that was issued, so it names the invoice and keeps its tax figures. The invoice itself never changes.',
    'When a credit note is issued, the credit goes to its invoice as far as the invoice still owes money. What the invoice cannot take stays on account for the customer, and "Apply the credit" gives it to another invoice.',
    'The value decides who approves it, by the limits in Settings. The person who asked never approves it, unless the owner.',
  ],
  assumed: ['The limits are samples. Money paid back to the customer is not modelled.'],
};

export function CreditNoteDetail() {
  const { creditId } = useParams();
  const s = useStore();
  const cn = s.creditNotes[creditId];
  if (!cn) {
    return (
      <Page title="Credit note not found" back="/billing/credit-notes">
        <EmptyState title="This credit note does not exist" action={<Button variant="primary" to="/billing/credit-notes">All credit notes</Button>}>A draft may have been deleted.</EmptyState>
      </Page>
    );
  }
  return <Body key={cn.id} cn={cn} />;
}

function Body({ cn }) {
  const s = useStore();
  const navigate = useNavigate();
  const { may, user, access } = useSession();
  const [tab, setTab] = useParam('tab', 'credit');
  const [dialog, setDialog] = useState(null); // issue | request | approve | refuse | apply | delete
  const totals = documentTotals(cn);
  const inv = s.invoices[cn.invoiceId];
  const customer = s.customers[cn.customerId];
  const site = s.sites[cn.siteId];
  const needs = creditApprovalNeeds(cn, s);
  const decide = canApproveCredit(cn, s, user.id);
  const maker = may('raise_credit_notes');
  const left = cn.status === 'issued' ? unappliedOf(cn, totals.total) : 0;
  const canApply = maker && left > 0.004 && openInvoicesOf(s, cn.customerId).length > 0;
  const withdrawable = maker && cn.status === 'waiting_approval' && cn.approval.requestedBy === user.id;
  const activity = activityFor(s, 'creditNote', cn.id);

  let cta = null;
  if (cn.status === 'draft' && maker) cta = needs.needed ? { label: 'Send for approval', icon: ShieldCheckIcon, run: () => setDialog('request') } : { label: 'Issue credit note', icon: CircleCheckIcon, run: () => setDialog('issue') };
  else if (cn.status === 'waiting_approval' && decide) cta = { label: 'Approve', icon: CheckIcon, run: () => setDialog('approve') };
  else if (canApply) cta = { label: 'Apply the credit', icon: WalletIcon, run: () => setDialog('apply') };

  const menu = [
    { label: 'Preview and print', icon: PrinterIcon, onClick: () => setTab('preview') },
    canApply && cta?.label !== 'Apply the credit' && { label: 'Apply the credit', icon: WalletIcon, onClick: () => setDialog('apply') },
    withdrawable && { label: 'Withdraw the approval request', icon: Undo2Icon, onClick: () => { returnCreditToDraft(cn.id); toast('Back in draft'); } },
    decide && { label: 'Refuse approval', icon: BanIcon, onClick: () => setDialog('refuse') },
    inv && { label: 'Open the invoice', icon: FileTextIcon, onClick: () => navigate(`/billing/${inv.id}`) },
    { label: 'Open the customer\'s statement', icon: UsersRoundIcon, onClick: () => navigate(`/billing/statements/${cn.customerId}`) },
    cn.status === 'draft' && maker && { separator: true },
    cn.status === 'draft' && maker && { label: 'Delete the draft', icon: Trash2Icon, tone: 'danger', onClick: () => setDialog('delete') },
  ].filter(Boolean);

  return (
    <Page
      title={creditLabel(cn)}
      badge={<Status kind="creditNote" value={cn.status} />}
      facts={`${cn.reason} · ${customer?.name}`}
      back="/billing/credit-notes"
      about={ABOUT}
      menu={menu}
      actions={cta && <Button variant="primary" icon={cta.icon} onClick={cta.run}>{cta.label}</Button>}
      tabs={<Tabs value={tab} onChange={setTab} items={[{ value: 'credit', label: 'Credit note' }, { value: 'preview', label: 'Preview' }]} />}
    >
      {tab === 'preview' ? (
        <DocumentPreview doc={cn} kind="credit" against={inv} />
      ) : (
        <>
          <LifeCycle steps={creditSteps(cn)} className="mb-5" />
          {cn.status === 'draft' && (
            <p className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <strong className="font-semibold">A draft.</strong> It has no number yet.{' '}
              {needs.needed ? `Its value needs the approval of the ${needs.roleLabel} before it is issued.` : 'Check it, then issue it.'} To change it, delete it and make it again.
            </p>
          )}
          {left > 0.004 && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
              <TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1"><strong className="font-semibold">AED {money(left)} of this credit is on account.</strong> No invoice has taken it yet.</span>
              {canApply && <Button size="xs" onClick={() => setDialog('apply')}>Apply the credit</Button>}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
              <Card title="Credited items" bodyClassName="!px-2">
                <LinesTable lines={cn.lines} />
              </Card>
              {cn.status === 'issued' && (
                <Card title="Where the credit went">
                  {(cn.applied ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">No invoice has taken this credit yet: all of it is on account.</p>
                  ) : (
                    <ul className="-my-2 divide-y divide-slate-100">
                      {cn.applied.map((a, i) => {
                        const target = s.invoices[a.invoiceId];
                        return (
                          <li key={`${a.invoiceId}${i}`} className="flex flex-wrap items-center justify-between gap-x-3 py-2.5 text-sm">
                            <span className="min-w-0">
                              <Link to={`/billing/${a.invoiceId}`} className="font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline">{target?.number}</Link>
                              <span className="block text-xs text-slate-500">{fmtDate(a.on)}</span>
                            </span>
                            <span className="tabular-nums text-slate-900">− {money(a.amount)}</span>
                          </li>
                        );
                      })}
                      {left > 0.004 && (
                        <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <span className="text-orange-800">Still on account</span>
                          <span className="font-medium tabular-nums text-orange-800">{money(left)}</span>
                        </li>
                      )}
                    </ul>
                  )}
                </Card>
              )}
            </div>

            <div className="space-y-5">
              <Card title="Summary">
                <dl className="space-y-2.5 text-sm">
                  <Row label="Subtotal" value={money(totals.subtotal)} />
                  {totals.discount > 0 && <Row label={`Discount (${num(cn.discountPct)}%)`} value={`− ${money(totals.discount)}`} />}
                  <Row label="Taxable amount" value={money(totals.net)} />
                  <Row label={`VAT ${cn.vatRate}%`} value={money(totals.vat)} />
                  <div className="border-t border-slate-200 pt-3"><Row label="Credit (AED)" value={money(totals.total)} strong /></div>
                </dl>
              </Card>
              <ApprovalCard cn={cn} needs={needs} canDecide={decide} onApprove={() => setDialog('approve')} onRefuse={() => setDialog('refuse')} />
              <Card title="Details">
                <DefinitionList
                  cols={1}
                  items={[
                    { label: 'Customer', value: customer && (access('customers') ? <Link to={`/customers/${customer.id}`} className="font-medium underline-offset-2 hover:underline">{customer.name}</Link> : customer.name) },
                    { label: 'Site', value: site?.name },
                    { label: 'Corrects invoice', value: inv && <Link to={`/billing/${inv.id}`} className="font-medium tabular-nums underline-offset-2 hover:underline">{inv.number}</Link> },
                    { label: 'Reason', value: cn.reason },
                    cn.note && { label: 'Note', value: cn.note },
                    { label: 'Made by', value: `${staffName(s, cn.createdBy)} on ${fmtDate(cn.createdOn)}` },
                    { label: 'Issued', value: cn.issuedOn ? fmtDate(cn.issuedOn) : '' },
                  ]}
                />
              </Card>
              <Card title="What happened"><ActivityList entries={activity} limit={12} /></Card>
            </div>
          </div>
        </>
      )}

      {dialog === 'issue' && <IssueCreditDialog cn={cn} onClose={() => setDialog(null)} />}
      {dialog === 'request' && <CreditApprovalRequestDialog cn={cn} needs={needs} onClose={() => setDialog(null)} />}
      {dialog === 'approve' && <CreditDecisionDialog cn={cn} approve onClose={() => setDialog(null)} />}
      {dialog === 'refuse' && <CreditDecisionDialog cn={cn} approve={false} onClose={() => setDialog(null)} />}
      {dialog === 'apply' && <ApplyCreditDrawer cn={cn} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Delete this draft?"
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          deleteCreditNoteDraft(cn.id);
          toast('Draft deleted');
          navigate('/billing/credit-notes', { replace: true });
        }}
      >
        The draft credit note will be removed. The invoice is not changed. This cannot be undone.
      </ConfirmDialog>
    </Page>
  );
}

function ApprovalCard({ cn, needs, canDecide, onApprove, onRefuse }) {
  const s = useStore();
  const a = cn.approval;
  const who = (id) => staffName(s, id);
  let body;
  if (cn.status === 'waiting_approval') {
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
        {cn.status === 'draft' && needs.needed ? (
          <>
            <p className="flex items-start gap-2 text-sm text-slate-900">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-orange-600" aria-hidden="true" />
              <span><strong className="font-semibold">Needs approval by the {needs.roleLabel}</strong> before it can be issued.</span>
            </p>
            <Reasons list={needs.reasons} />
          </>
        ) : (
          <p className="text-sm text-slate-600">
            {needs.reasons.length > 0
              ? `Within the maker's own authority, so no one else ${cn.status === 'draft' ? 'has' : 'had'} to approve. (${needs.reasons[0]}.)`
              : `No approval ${cn.status === 'draft' ? 'is' : 'was'} needed: the value is within the limit of the accountant.`}
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

const Row = ({ label, value, strong }) => (
  <div className={cn('flex items-baseline justify-between gap-3', strong && 'text-base font-semibold text-slate-900')}>
    <dt className={cn(!strong && 'text-slate-600')}>{label}</dt>
    <dd className="tabular-nums">{value}</dd>
  </div>
);
