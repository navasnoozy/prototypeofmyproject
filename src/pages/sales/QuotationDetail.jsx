import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BanIcon, CheckIcon, CopyIcon, GitBranchIcon, MessageSquareIcon, PencilIcon, PlusIcon, PrinterIcon, SendIcon, ShieldCheckIcon, Trash2Icon, Undo2Icon } from 'lucide-react';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { useParam } from '@/lib/useParam.js';
import {
  deleteQuotation, duplicateQuotation, extendValidity, returnToDraft, reviseQuotation,
} from '@/store/salesActions.js';
import {
  approvalNeeds, canApprove, effectiveStatus, quotationLabel, quotationSteps, quoteTotals, revisionsOf,
} from '@/store/salesSelectors.js';
import { activityFor } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { ActivityList } from '@/ui/Activity.jsx';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { LifeCycle } from '@/ui/LifeCycle.jsx';
import { ConfirmDialog } from '@/ui/Overlay.jsx';
import { Card, EmptyState, Page, Tabs } from '@/ui/Page.jsx';
import { LinesEditor } from './LinesEditor.jsx';
import { AnswerDialog, DecisionDialog, RequestApprovalDialog, SendDialog } from './QuotationDialogs.jsx';
import { CoverageDrawer, DetailsDrawer } from './QuotationDrawers.jsx';
import { ApprovalCard, KindCard, NextStepCard, PartiesCard, SummaryCard, TermsCard } from './QuotationPanels.jsx';
import { QuotationPreview } from './QuotationPreview.jsx';
import { KindTag } from './parts.jsx';

const ABOUT = {
  purpose: 'The working screen of a quotation: the items with their prices, the terms of its kind, the approval inside the company, sending, and the customer\'s answer.',
  why: [
    'The strip under the title shows where the quotation stands, and the one main button is always the next step: send for approval, approve, send, record the answer, revise.',
    'The estimate is part of the quotation, as the study proposes: every line carries a cost, so the margin is known; cost and margin are only shown to those who work in Sales.',
    'Approval follows authority (record 39 keeps this in the settings): value, discount, margin below the floor, or a customer on hold. The one who prepared it never approves it, unless the owner.',
    'A sent quotation cannot be edited. A change is a new revision; the old one stays in the history. This is how quoting goes in practice: the customer negotiates, the numbers change, and nobody may lose the earlier offer.',
    'A contract quotation takes its covered systems from the site\'s equipment register and prices them with yearly rates: Customers, Service and Sales meet here.',
  ],
  assumed: [
    'The approval limits (AED 50,000, AED 250,000, discount 5% and 10%, margin floor 15%) are samples; the owner can change them in Settings.',
    'Accepting records the customer\'s answer by hand (signed copy, order, e-mail). The customer portal that could do it online is a later decision.',
    'What an accepted quotation starts (project, contract, repair job, delivery) is built in the steps of those areas.',
  ],
};

export function QuotationDetail() {
  const { quotationId } = useParams();
  const s = useStore();
  const q = s.quotations[quotationId];
  if (!q) {
    return (
      <Page title="Quotation not found" back="/sales/quotations">
        <EmptyState title="This quotation does not exist" action={<Button variant="primary" to="/sales/quotations">All quotations</Button>}>It may have been deleted.</EmptyState>
      </Page>
    );
  }
  return <Body key={q.id} q={q} />;
}

function Body({ q }) {
  const s = useStore();
  const navigate = useNavigate();
  const { canEdit, user } = useSession();
  const [tab, setTab] = useParam('tab', 'quotation');
  const [dialog, setDialog] = useState(null); // request | approve | refuse | send | answer | delete
  const [drawer, setDrawer] = useState(null); // details | coverage
  const [showCost, setShowCost] = useState(false);

  const today = todayISO();
  const status = effectiveStatus(q, today);
  const editable = canEdit('sales');
  const isDraft = q.status === 'draft';
  const customer = s.customers[q.customerId];
  const totals = quoteTotals(q, s.settings.vatRate);
  const needs = approvalNeeds(q, s);
  const decide = canApprove(q, s, user.id);
  const revisions = revisionsOf(s, q);
  const activity = activityFor(s, 'quotation', q.id);
  const replacedBy = q.supersededBy ? s.quotations[q.supersededBy] : null;
  const empty = q.lines.length === 0 || totals.total <= 0;

  const revise = () => {
    const id = reviseQuotation(q.id);
    toast('New revision created as a draft');
    navigate(`/sales/quotations/${id}`);
  };
  const duplicate = () => {
    const id = duplicateQuotation(q.id);
    toast('Copied as a new draft');
    navigate(`/sales/quotations/${id}`);
  };

  // The one main step follows the life of the quotation.
  let cta = null;
  if (status === 'draft' && editable) {
    cta = needs.needed
      ? { label: 'Send for approval', icon: ShieldCheckIcon, run: () => setDialog('request') }
      : { label: 'Send to customer', icon: SendIcon, run: () => setDialog('send') };
    cta.disabled = empty;
  } else if (status === 'waiting_approval' && decide) {
    cta = { label: 'Approve', icon: CheckIcon, run: () => setDialog('approve') };
  } else if (status === 'approved' && editable) {
    cta = { label: 'Send to customer', icon: SendIcon, run: () => setDialog('send') };
  } else if (status === 'sent' && editable) {
    cta = { label: 'Record answer', icon: MessageSquareIcon, run: () => setDialog('answer') };
  } else if (status === 'expired' && editable) {
    cta = { label: 'Extend validity', icon: PlusIcon, run: () => { extendValidity(q.id, 30); toast('Validity extended by 30 days'); } };
  } else if (status === 'rejected' && editable) {
    cta = { label: 'Revise', icon: GitBranchIcon, run: revise };
  }

  const menu = [
    editable && isDraft && { label: 'Edit details and terms', icon: PencilIcon, onClick: () => setDrawer('details') },
    { label: 'Preview and print', icon: PrinterIcon, onClick: () => setTab('preview') },
    editable && ['sent', 'expired'].includes(status) && { label: 'Record the customer\'s answer', icon: MessageSquareIcon, onClick: () => setDialog('answer') },
    editable && ['sent', 'expired'].includes(status) && { label: 'Extend validity by 30 days', icon: PlusIcon, onClick: () => { extendValidity(q.id, 30); toast('Validity extended by 30 days'); } },
    editable && ['approved', 'sent', 'rejected', 'expired'].includes(status) && { label: 'Revise (new revision)', icon: GitBranchIcon, onClick: revise },
    editable && q.status === 'approved' && { label: 'Return to draft to edit', icon: Undo2Icon, onClick: () => { returnToDraft(q.id, 'Returned to draft after approval'); toast('Back in draft: it needs approval again'); } },
    editable && q.status === 'waiting_approval' && q.approval.requestedBy === user.id && { label: 'Withdraw the approval request', icon: Undo2Icon, onClick: () => { returnToDraft(q.id, 'Approval request withdrawn'); toast('Request withdrawn'); } },
    decide && { label: 'Refuse approval', icon: BanIcon, onClick: () => setDialog('refuse') },
    editable && { label: 'Duplicate as a new quotation', icon: CopyIcon, onClick: duplicate },
    editable && { separator: true },
    editable && {
      label: 'Delete draft', icon: Trash2Icon, tone: 'danger', onClick: () => setDialog('delete'),
      disabled: !(isDraft && q.rev === 0), sub: !(isDraft && q.rev === 0) ? 'Only a draft that is not a revision' : undefined,
    },
  ].filter(Boolean);

  return (
    <Page
      title={quotationLabel(q)}
      badge={<Status kind="quotation" value={status} />}
      facts={`${q.title} · ${customer?.name}`}
      back="/sales/quotations"
      about={ABOUT}
      menu={menu}
      actions={cta && <Button variant="primary" icon={cta.icon} onClick={cta.run} disabled={cta.disabled} title={cta.disabled ? 'Add items first' : undefined}>{cta.label}</Button>}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'quotation', label: 'Quotation' },
            { value: 'preview', label: 'Preview' },
            { value: 'history', label: 'History', count: revisions.length > 1 ? revisions.length : undefined },
          ]}
        />
      }
    >
      {tab !== 'preview' && <LifeCycle steps={quotationSteps(q, s, today)} className="mb-5" />}

      {q.status === 'superseded' && replacedBy && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <strong className="font-semibold">Replaced.</strong> This revision was replaced by{' '}
          <Link className="font-medium underline underline-offset-2" to={`/sales/quotations/${replacedBy.id}`}>{quotationLabel(replacedBy)}</Link>. It stays here for the record.
        </div>
      )}
      {status === 'expired' && (
        <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
          <strong className="font-semibold">Expired on {fmtDate(q.validUntil)}.</strong> Extend the validity, revise the prices, or record the customer's answer if it came.
        </div>
      )}
      {q.status === 'accepted' && tab !== 'preview' && <div className="mb-5"><NextStepCard q={q} /></div>}

      {tab === 'quotation' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <KindCard q={q} editable={editable && isDraft} onEdit={() => setDrawer('details')} />
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  {{ project: 'Bill of quantities', contract: 'Covered systems and yearly fee', repair: 'Parts and labour', supply: 'Items' }[q.kind]}
                </h2>
                {editable && (
                  <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={showCost} onChange={(e) => setShowCost(e.target.checked)} className="size-3.5 accent-slate-900" />
                    Cost and margin
                  </label>
                )}
                {!isDraft && (
                  <span className="text-xs text-slate-500">
                    {q.status === 'waiting_approval'
                      ? 'Read-only while it waits for approval.'
                      : q.status === 'approved'
                        ? 'Read-only. Return it to draft to change it.'
                        : q.status === 'superseded'
                          ? 'Read-only: this revision was replaced.'
                          : 'Read-only. To change it, revise the quotation.'}
                  </span>
                )}
              </div>
              <LinesEditor q={q} editable={editable && isDraft} seeCost={editable && showCost} onCoverage={() => setDrawer('coverage')} />
            </div>
          </div>
          <div className="space-y-5">
            <SummaryCard q={q} editable={editable && isDraft} seeCost={editable} />
            <ApprovalCard q={q} needs={needs} canDecide={decide} onApprove={() => setDialog('approve')} onRefuse={() => setDialog('refuse')} />
            <TermsCard q={q} editable={editable && isDraft} onEdit={() => setDrawer('details')} />
            <PartiesCard q={q} />
          </div>
        </div>
      )}

      {tab === 'preview' && <QuotationPreview q={q} />}

      {tab === 'history' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card title="What happened" className="lg:col-span-2"><ActivityList entries={activity} limit={60} /></Card>
          <Card title="Revisions">
            <ul className="space-y-1">
              {revisions.map((r) => (
                <li key={r.id}>
                  <Link to={`/sales/quotations/${r.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{quotationLabel(r)}{r.id === q.id ? ' (this one)' : ''}</span>
                      <span className="block text-xs text-slate-500">{fmtDate(r.createdOn)} · <KindTag kind={r.kind} className="text-xs" /></span>
                    </span>
                    <Status kind="quotation" value={effectiveStatus(r, today)} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {drawer === 'details' && <DetailsDrawer q={q} onClose={() => setDrawer(null)} />}
      {drawer === 'coverage' && <CoverageDrawer q={q} onClose={() => setDrawer(null)} />}
      {dialog === 'request' && <RequestApprovalDialog q={q} needs={needs} onClose={() => setDialog(null)} />}
      {dialog === 'approve' && <DecisionDialog q={q} approve onClose={() => setDialog(null)} />}
      {dialog === 'refuse' && <DecisionDialog q={q} approve={false} onClose={() => setDialog(null)} />}
      {dialog === 'send' && <SendDialog q={q} onClose={() => setDialog(null)} />}
      {dialog === 'answer' && <AnswerDialog q={q} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Delete this draft?"
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          deleteQuotation(q.id);
          toast('Draft deleted');
          navigate('/sales/quotations', { replace: true });
        }}
      >
        {q.number} will be removed. This cannot be undone.
      </ConfirmDialog>
    </Page>
  );
}
