import { Link, useNavigate } from 'react-router';
import { BanIcon, CheckIcon, CircleCheckIcon, PencilIcon, ShieldCheckIcon, TriangleAlertIcon } from 'lucide-react';
import { ANSWER_VIA, KINDS, URGENCY } from '@/data/quotationKinds.js';
import { cn } from '@/lib/cn.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { money } from '@/lib/format.js';
import { createInvoiceFromSource } from '@/store/billingActions.js';
import { updateQuotation } from '@/store/salesActions.js';
import { startProjectFromQuotation } from '@/store/projectActions.js';
import { startContractFromQuotation, startRepairJob } from '@/store/serviceActions.js';
import { canPlanJobs } from '@/store/serviceSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { toast } from '@/store/toast.js';
import { quoteTotals } from '@/store/salesSelectors.js';
import { useStore } from '@/store/store.js';
import { Button } from '@/ui/Button.jsx';
import { Card, DefinitionList } from '@/ui/Page.jsx';
import { NumberCell } from './LinesEditor.jsx';
import { staffName } from './parts.jsx';

const Row = ({ label, value, strong, tone }) => (
  <div className={cn('flex items-baseline justify-between gap-3', strong && 'text-base font-semibold text-slate-900')}>
    <dt className={cn(!strong && 'text-slate-600')}>{label}</dt>
    <dd className={cn('tabular-nums', tone)}>{value}</dd>
  </div>
);

// Subtotal, discount, VAT and total, worked out from the lines; and, for the
// people who may see it, the cost and the margin.
export function SummaryCard({ q, editable, seeCost }) {
  const s = useStore();
  const t = quoteTotals(q, s.settings.vatRate);
  const floor = s.settings.approvals.marginFloor;
  return (
    <Card title="Summary">
      <dl className="space-y-2.5 text-sm">
        <Row label="Subtotal" value={money(t.subtotal)} />
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 text-slate-600">
            Discount
            {editable ? (
              <NumberCell value={q.discountPct} onChange={(n) => updateQuotation(q.id, { discountPct: Math.min(100, n) })} className="!h-8 !w-16" suffix="%" label="Discount in percent" />
            ) : (
              <span className="text-slate-500">({q.discountPct}%)</span>
            )}
          </dt>
          <dd className="tabular-nums">{t.discount > 0 ? `− ${money(t.discount)}` : money(0)}</dd>
        </div>
        <Row label="Net" value={money(t.net)} />
        <Row label={`VAT ${s.settings.vatRate}%`} value={money(t.vat)} />
        <div className="border-t border-slate-200 pt-3">
          <Row label="Total (AED)" value={money(t.total)} strong />
        </div>
      </dl>
      {seeCost && (
        <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="text-xs font-medium text-slate-500">Inside the company only</p>
          <Row label="Cost" value={money(t.cost)} />
          <Row
            label="Margin"
            value={`${t.margin.toFixed(1)}% · AED ${money(t.profit)}`}
            tone={t.net > 0 && t.margin < floor ? 'font-semibold text-red-700' : 'text-slate-900'}
          />
          {t.net > 0 && t.margin < floor && <p className="text-xs text-red-700">Below the floor of {floor}%: needs approval.</p>}
        </div>
      )}
    </Card>
  );
}

// Who must approve, why, and what was decided.
export function ApprovalCard({ q, needs, canDecide, onApprove, onRefuse }) {
  const s = useStore();
  const a = q.approval;
  const who = (id) => staffName(s, id);
  let body;
  if (q.status === 'waiting_approval') {
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
        {needs.needed ? (
          <>
            <p className="flex items-start gap-2 text-sm text-slate-900">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-orange-600" aria-hidden="true" />
              <span><strong className="font-semibold">Needs approval by the {needs.roleLabel}</strong> before it can be sent.</span>
            </p>
            <Reasons list={needs.reasons} />
          </>
        ) : (
          <p className="text-sm text-slate-600">
            {needs.reasons.length > 0
              ? `Within the preparer's own authority, so no one else has to approve. (${needs.reasons[0]}.)`
              : 'No approval is needed: the value, the discount and the margin are within the limits.'}
          </p>
        )}
      </>
    );
  }
  return (
    <Card title="Approval">
      <div className="space-y-3">{body}</div>
    </Card>
  );
}

const Reasons = ({ list }) =>
  list?.length > 0 ? (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
      {list.map((r) => <li key={r}>{r}</li>)}
    </ul>
  ) : null;

const BILLING = { annual: 'Once a year, in advance', quarterly: 'Every quarter, in advance', monthly: 'Every month, in advance' };
const DELIVERY = { delivered: 'Delivered to the site', collection: 'Collected by the customer', installed: 'Delivered and installed' };

// The terms that belong to the kind of quotation.
export function KindCard({ q, editable, onEdit }) {
  const k = q.kindData;
  const items = {
    project: [
      { label: 'Time to complete', value: `${k.durationWeeks} weeks` },
      { label: 'Advance', value: `${k.advancePct}% with the order` },
      { label: 'Retention', value: `${k.retentionPct}% until after handover` },
      { label: 'Civil Defence approval', value: k.cdApproval === 'contractor' ? 'We handle it' : 'The customer handles it' },
    ],
    contract: [
      { label: 'Term', value: `${k.termMonths} months from ${fmtDate(k.startOn)}` },
      { label: 'Planned visits', value: `${k.visitsPerYear} a year` },
      { label: 'Billing', value: BILLING[k.billing] },
      { label: 'Emergency response', value: `Within ${k.responseHours} hours` },
    ],
    repair: [
      { label: 'Urgency', value: URGENCY[k.urgency] },
      { label: 'Deficiency', value: k.deficiencyRef || 'Not linked' },
      { label: 'Time to complete', value: `${k.durationDays} day${k.durationDays === 1 ? '' : 's'}` },
      { label: 'Warranty', value: `${k.warrantyMonths} months` },
    ],
    supply: [
      { label: 'Delivery', value: `Within ${k.deliveryDays} days` },
      { label: 'Delivery terms', value: DELIVERY[k.deliveryTerms] },
    ],
  }[q.kind];
  return (
    <Card
      title={`${KINDS[q.kind].label} terms`}
      action={editable && <Button variant="ghost" size="xs" icon={PencilIcon} onClick={onEdit}>Edit</Button>}
    >
      <DefinitionList items={items} />
    </Card>
  );
}

export function TermsCard({ q, editable, onEdit }) {
  const today = todayISO();
  return (
    <Card title="Terms" action={editable && <Button variant="ghost" size="xs" icon={PencilIcon} onClick={onEdit}>Edit</Button>}>
      <DefinitionList
        cols={1}
        items={[
          { label: 'Valid until', value: `${fmtDate(q.validUntil)} (${relDays(q.validUntil, today)})` },
          { label: 'Payment', value: q.terms.payment },
          { label: 'Delivery and time', value: q.terms.delivery },
          q.terms.warranty && { label: 'Warranty', value: q.terms.warranty },
          { label: 'Not included', value: q.terms.exclusions },
          q.terms.notes && { label: 'Notes', value: q.terms.notes },
        ]}
      />
    </Card>
  );
}

// Who, where, and the dates.
export function PartiesCard({ q }) {
  const s = useStore();
  const customer = s.customers[q.customerId];
  const site = s.sites[q.siteId];
  const contact = s.contacts[q.contactId];
  const payer = site && site.billToId !== q.customerId ? s.customers[site.billToId] : null;
  const enquiry = s.enquiries[q.enquiryId];
  return (
    <Card title="Customer and site">
      <DefinitionList
        cols={1}
        items={[
          { label: 'Quotation to', value: customer && <Link className="font-medium hover:underline" to={`/customers/${customer.id}`}>{customer.name}</Link> },
          contact && { label: 'Attention of', value: `${contact.name}, ${contact.title}` },
          { label: 'Site', value: site ? <Link className="font-medium hover:underline" to={`/customers/sites/${site.id}`}>{site.name}</Link> : 'No site' },
          payer && { label: 'Invoices go to', value: <Link className="font-medium hover:underline" to={`/customers/${payer.id}`}>{payer.name}</Link> },
          enquiry && { label: 'Enquiry', value: <Link className="font-medium hover:underline" to={`/sales/${enquiry.id}`}>{enquiry.number}</Link> },
          { label: 'Prepared by', value: staffName(s, q.preparedBy) },
          { label: 'Created', value: fmtDate(q.createdOn) },
          q.sent && { label: 'Sent', value: `${fmtDate(q.sent.on)} to ${q.sent.to.map((id) => s.contacts[id]?.name).filter(Boolean).join(', ')}` },
          q.answer && {
            label: q.answer.result === 'accepted' ? 'Accepted' : 'Rejected',
            value: `${fmtDate(q.answer.on)} · ${ANSWER_VIA[q.answer.via] ?? ''}${q.answer.reference ? ` · ${q.answer.reference}` : ''}${q.answer.result === 'rejected' ? ` · ${q.answer.reason}` : ''}`,
          },
        ]}
      />
    </Card>
  );
}

const NEXT = {
  project: 'The project starts in Projects: its packages and their budgets are taken from the sections and costs of this quotation, and the advance claim is made.',
  contract: 'The contract is created in Service with its visit plan and its billing plan, and goes to the authority for approval before the first visit.',
  repair: 'A repair job is created in Service from this quotation and planned in Schedule. The deficiency it answers is updated.',
  supply: 'The goods are delivered to the customer and one invoice follows in Billing. The stock items leave the main store when the invoice is issued.',
};

// After the customer said yes: what starts, and where. For a contract and a
// repair the work starts from here, in Service; the card then links to it.
export function NextStepCard({ q }) {
  const navigate = useNavigate();
  const s = useStore();
  const { canEdit, roleKey, may, access } = useSession();
  const f = q.followUp;
  const service = canEdit('service') && canPlanJobs(roleKey);
  const projects = canEdit('projects');
  let text = NEXT[q.kind];
  let action = null;
  let note = '';

  if (q.kind === 'contract' || q.kind === 'repair') {
    const isContract = q.kind === 'contract';
    if (f?.type === (isContract ? 'contract' : 'job')) {
      text = isContract ? `Contract ${f.number} was started from this quotation.` : `Repair job ${f.number} was created from this quotation.`;
      action = <Button size="sm" variant="primary" to={isContract ? `/service/${f.id}` : `/service/jobs/${f.id}`}>{isContract ? 'Open contract' : 'Open job'}</Button>;
    } else if (!isContract && !q.siteId) {
      note = 'Choose the site of this quotation first: the repair job is made for a site.';
    } else if (service) {
      action = (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            if (isContract) {
              const id = startContractFromQuotation(q.id);
              toast('Contract created as a draft');
              navigate(`/service/${id}`);
            } else {
              const id = startRepairJob({ quotationId: q.id });
              toast('Repair job created: it needs planning');
              navigate(`/service/jobs/${id}`);
            }
          }}
        >
          {isContract ? 'Start the contract' : 'Create repair job'}
        </Button>
      );
    } else {
      note = 'The service coordinator starts it from here or from Service.';
    }
  } else if (q.kind === 'project') {
    if (f?.type === 'project' && f.id) {
      text = `Project ${f.number} was started from this quotation.`;
      action = <Button size="sm" variant="primary" to={`/projects/${f.id}`}>Open project</Button>;
    } else if (projects) {
      action = (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            const id = startProjectFromQuotation(q.id);
            toast('Project started: design and approvals');
            navigate(`/projects/${id}`);
          }}
        >
          Start the project
        </Button>
      );
    } else {
      note = 'The project engineer starts it from here or from Projects.';
    }
  } else if (q.kind === 'supply') {
    const draft = list(s.invoices).find((i) => i.source.kind === 'supply' && i.source.quotationId === q.id && i.status === 'draft');
    if (f?.type === 'invoice') {
      text = `The goods were delivered and invoice ${f.number} was issued.`;
      if (access('billing')) action = <Button size="sm" variant="primary" to={`/billing/${f.id}`}>Open the invoice</Button>;
    } else if (may('issue_invoices')) {
      action = (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            const id = createInvoiceFromSource({ kind: 'supply', quotationId: q.id });
            if (!draft) toast('Draft invoice made: check it and issue it');
            navigate(`/billing/${id}`);
          }}
        >
          {draft ? 'Open the invoice draft' : 'Deliver and invoice'}
        </Button>
      );
    } else {
      note = 'Accounts makes the invoice: the supply shows in Billing under "Ready to invoice".';
    }
  } else if (f?.number) {
    text = `${NEXT[q.kind]} It is ${f.number}.`;
  }

  return (
    <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-green-100 text-green-700"><CircleCheckIcon className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-green-900">Accepted: what happens next</h2>
          <p className="mt-1 text-sm text-green-900/90">{text}</p>
          {action && <div className="mt-3">{action}</div>}
          {note && <p className="mt-3 text-xs text-green-900/80">{note}</p>}
        </div>
      </div>
    </div>
  );
}
