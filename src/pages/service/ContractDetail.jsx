import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { FilePlusIcon, PencilIcon, PlayIcon, SendIcon, ShieldCheckIcon, XIcon } from 'lucide-react';
import { SYSTEM_TYPES } from '@/data/catalog.js';
import { addDays, fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { aed, money, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { createInvoiceFromSource } from '@/store/billingActions.js';
import { invoiceView } from '@/store/billingSelectors.js';
import { activateContract, createRenewalQuotation, releaseContractVisits } from '@/store/serviceActions.js';
import { canPlanJobs, contractStatus, contractSteps, visitState } from '@/store/serviceSelectors.js';
import { activityFor, devicesBySystem, summariseDevices } from '@/store/selectors.js';
import { quotationLabel } from '@/store/salesSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { ActivityList } from '@/ui/Activity.jsx';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { LifeCycle } from '@/ui/LifeCycle.jsx';
import { Card, DefinitionList, EmptyState, Page, Tabs } from '@/ui/Page.jsx';
import { DataTable } from '@/ui/Table.jsx';
import { InvoiceBadge } from '@/pages/billing/parts.jsx';
import { DecisionDialog, EndDialog, SubmitDialog, TermsDrawer } from './ContractDialogs.jsx';
import { staffNames } from './parts.jsx';

const ABOUT = {
  purpose: 'One maintenance contract with its three linked parts: the terms (who, where, how long, what price, which systems, the authority\'s approval), the visit plan (which visits fall when) and the billing plan (what is invoiced when).',
  why: [
    'The three parts are separate tabs because the mature products keep them as separate records: the visits come from the schedule, and the invoices from the billing schedule, not from the terms (study, section E).',
    'The main button follows the life of the contract: submit to the authority, record its answer (which activates the contract and releases its visits), and at the end, renew.',
    'Visits are released as jobs that are "upcoming" and turn into "needs planning" 30 days before their date, so the coordinator sees work coming without a scheduler.',
    'Renewal is made from the contract: the renewal quotation starts with the same systems, priced again from the equipment register.',
  ],
  assumed: [
    'The visit dates are spread evenly from two weeks after the start; a real plan follows the standard for each system and the customer\'s calendar.',
    'The authority\'s approval is a sample of the UAE process; the billing plan lists what will be invoiced, and each instalment becomes an invoice in Billing.',
  ],
};

export function ContractDetail() {
  const { contractId } = useParams();
  const s = useStore();
  const c = s.contracts[contractId];
  if (!c) {
    return (
      <Page title="Contract not found" back="/service">
        <EmptyState title="This contract does not exist" action={<Button variant="primary" to="/service">All contracts</Button>}>It may have been removed.</EmptyState>
      </Page>
    );
  }
  return <Body key={c.id} c={c} />;
}

function Body({ c }) {
  const s = useStore();
  const navigate = useNavigate();
  const { canEdit, roleKey, may, access } = useSession();
  const [tab, setTab] = useParam('tab', 'terms');
  const [dialog, setDialog] = useState(null); // submit | decide | end
  const [drawer, setDrawer] = useState(false);
  const today = todayISO();
  const status = contractStatus(c, today);
  const manage = canEdit('service') && canPlanJobs(roleKey);
  const customer = s.customers[c.customerId];
  const site = s.sites[c.siteId];
  const contact = s.contacts[c.contactId];
  const payer = site && site.billToId !== c.customerId ? s.customers[site.billToId] : null;
  const quotation = s.quotations[c.quotationId];
  const renewalQuote = s.quotations[c.renewalQuotationId];
  const from = s.contracts[c.renewedFromId];
  const to = s.contracts[c.renewedToId];
  const activity = activityFor(s, 'contract', c.id);
  const waitingRows = c.visitPlan.filter((r) => !r.jobId && r.dueOn >= today).length;

  const renew = () => {
    const id = createRenewalQuotation(c.id);
    toast('Renewal quotation created as a draft');
    navigate(`/sales/quotations/${id}`);
  };

  let cta = null;
  if (manage) {
    if (c.status === 'draft') {
      cta = c.cdApproval.required
        ? { label: 'Submit to the authority', icon: SendIcon, run: () => setDialog('submit') }
        : { label: 'Activate', icon: PlayIcon, run: () => { activateContract(c.id); toast('Contract activated'); } };
    } else if (c.status === 'awaiting_approval') {
      cta = { label: 'Record the authority\'s answer', icon: ShieldCheckIcon, run: () => setDialog('decide') };
    } else if (['expiring', 'ended'].includes(status) && !to) {
      cta = renewalQuote
        ? { label: 'Open renewal quotation', icon: FilePlusIcon, run: () => navigate(`/sales/quotations/${renewalQuote.id}`) }
        : { label: 'Make renewal quotation', icon: FilePlusIcon, run: renew };
    }
  }

  const menu = manage
    ? [
        c.status === 'draft' && { label: 'Edit the terms', icon: PencilIcon, onClick: () => setDrawer(true) },
        c.status === 'draft' && c.cdApproval.required && { label: 'Activate without the authority\'s approval', icon: PlayIcon, onClick: () => { activateContract(c.id); toast('Contract activated'); } },
        c.status === 'active' && waitingRows > 0 && { label: `Release ${plural(waitingRows, 'more visit')}`, icon: PlayIcon, onClick: () => { releaseContractVisits(c.id); toast('Visits released as jobs'); } },
        ['active', 'awaiting_approval'].includes(c.status) && !renewalQuote && !to && { label: 'Make renewal quotation', icon: FilePlusIcon, onClick: renew },
        c.status !== 'ended' && { separator: true },
        c.status !== 'ended' && { label: 'End contract', icon: XIcon, tone: 'danger', onClick: () => setDialog('end') },
      ].filter(Boolean)
    : undefined;

  const visitRows = c.visitPlan.map((row) => ({ ...row, job: s.jobs[row.jobId], state: visitState(row, s.jobs[row.jobId], today) }));
  const visitColumns = [
    { key: 'n', header: 'Visit', cell: (r) => <span className="font-medium tabular-nums text-slate-900">{r.n} of {c.visitPlan.length}</span> },
    { key: 'due', header: 'Due', cell: (r) => (<div><p className="tabular-nums text-slate-900">{fmtDate(r.dueOn)}</p><p className="text-xs text-slate-500">{relDays(r.dueOn, today)}</p></div>) },
    { key: 'state', header: 'State', cell: (r) => <Status kind="visit" value={r.state} /> },
    { key: 'job', header: 'Job', hideBelow: 'md', cell: (r) => r.job ? <Link className="font-medium text-slate-900 hover:underline" to={`/service/jobs/${r.job.id}`} onClick={(e) => e.stopPropagation()}>{r.job.number}</Link> : <span className="text-slate-400">{r.state === 'done' ? 'Done before this system' : 'Not released yet'}</span> },
    { key: 'who', header: 'People', hideBelow: 'lg', cell: (r) => <span className="text-slate-700">{r.job ? staffNames(s, r.job.assigneeIds) : '—'}</span> },
  ];
  const billColumns = [
    { key: 'n', header: 'Instalment', cell: (b) => <span className="font-medium tabular-nums text-slate-900">{b.n} of {c.billingPlan.length}</span> },
    { key: 'due', header: 'To invoice on', cell: (b) => <span className="tabular-nums text-slate-900">{fmtDate(b.dueOn)}</span> },
    { key: 'amount', header: 'Amount (AED)', align: 'right', cell: (b) => money(b.amount) },
    { key: 'vat', header: 'With VAT 5%', align: 'right', hideBelow: 'md', cell: (b) => <span className="text-slate-500">{money(b.amount * 1.05)}</span> },
    {
      key: 'ref', header: 'Invoice',
      cell: (b) => {
        const inv = b.invoiceId ? s.invoices[b.invoiceId] : null;
        if (inv) {
          const label = inv.number || 'Draft invoice';
          return (
            <span className="inline-flex flex-wrap items-center gap-2">
              {access('billing') ? <Link to={`/billing/${inv.id}`} onClick={(e) => e.stopPropagation()} className="font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline">{label}</Link> : <span className="tabular-nums text-slate-700">{label}</span>}
              <InvoiceBadge v={invoiceView(s, inv, today)} />
            </span>
          );
        }
        if (b.invoiceRef) return <span className="tabular-nums text-slate-700">{b.invoiceRef}</span>;
        return b.dueOn < today ? <span className="font-medium text-red-700">Late: not invoiced</span> : <span className="text-slate-500">{b.dueOn === today ? 'Due to be invoiced today' : `Planned, ${relDays(b.dueOn, today)}`}</span>;
      },
    },
    {
      key: 'act', header: '',
      cell: (b) => {
        const soon = !b.invoiceId && !b.invoiceRef && c.status === 'active' && b.dueOn <= addDays(today, 14);
        if (!soon || !may('issue_invoices')) return null;
        return <Button size="xs" variant={b.dueOn <= today ? 'primary' : 'secondary'} onClick={() => { const id = createInvoiceFromSource({ kind: 'contract', contractId: c.id, rowId: b.id }); toast('Draft invoice made: check it and issue it'); navigate(`/billing/${id}`); }}>Invoice now</Button>;
      },
    },
  ];

  return (
    <Page
      title={c.number}
      badge={<Status kind="contract" value={status} />}
      facts={`${site?.name} · ${customer?.name} · ${plural(c.visitsPerYear, 'visit')} a year`}
      back="/service"
      about={ABOUT}
      menu={menu}
      actions={cta && <Button variant="primary" icon={cta.icon} onClick={cta.run}>{cta.label}</Button>}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'terms', label: 'Terms' },
            { value: 'visits', label: 'Visit plan', count: c.visitPlan.length },
            { value: 'billing', label: 'Billing plan', count: c.billingPlan.length },
          ]}
        />
      }
    >
      <LifeCycle steps={contractSteps(c, today)} className="mb-5" />

      {status === 'expiring' && !to && (
        <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
          <strong className="font-semibold">Ends {relDays(c.endOn, today)}.</strong>{' '}
          {renewalQuote ? <>The renewal quotation is <Link className="font-medium underline underline-offset-2" to={`/sales/quotations/${renewalQuote.id}`}>{quotationLabel(renewalQuote)}</Link>.</> : 'Make the renewal quotation now, so the site is never without a contract.'}
        </div>
      )}
      {status === 'ended' && !to && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <strong className="font-semibold">Ended on {fmtDate(c.endOn)}.</strong> {c.notes}
        </div>
      )}
      {to && (
        <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-950">
          <strong className="font-semibold">Renewed.</strong> The next contract is <Link className="font-medium underline underline-offset-2" to={`/service/${to.id}`}>{to.number}</Link> ({to.status === 'active' ? 'active' : 'not active yet'}).
        </div>
      )}

      {tab === 'terms' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card title="Parties and site" action={manage && c.status === 'draft' && <Button variant="ghost" size="xs" icon={PencilIcon} onClick={() => setDrawer(true)}>Edit</Button>}>
              <DefinitionList
                items={[
                  { label: 'Customer', value: customer && <Link className="font-medium hover:underline" to={`/customers/${customer.id}`}>{customer.name}</Link> },
                  { label: 'Site', value: site && <Link className="font-medium hover:underline" to={`/customers/sites/${site.id}`}>{site.name}</Link> },
                  { label: 'Contact', value: contact && `${contact.name}, ${contact.title}` },
                  payer && { label: 'Invoices go to', value: <Link className="font-medium hover:underline" to={`/customers/${payer.id}`}>{payer.name}</Link> },
                  { label: 'Made from', value: quotation ? <Link className="font-medium hover:underline" to={`/sales/quotations/${quotation.id}`}>{quotationLabel(quotation)}</Link> : 'A contract from before this system' },
                  from && { label: 'Renews', value: <Link className="font-medium hover:underline" to={`/service/${from.id}`}>{from.number}</Link> },
                ]}
              />
            </Card>
            <Card title="Period and price">
              <DefinitionList
                items={[
                  { label: 'Starts', value: fmtDate(c.startOn) },
                  { label: 'Ends', value: `${fmtDate(c.endOn)} (${relDays(c.endOn, today)})` },
                  { label: 'Term', value: `${c.termMonths} months` },
                  { label: 'Planned visits', value: `${c.visitsPerYear} a year` },
                  { label: 'Emergency response', value: `Within ${c.responseHours} hours` },
                  { label: 'Fee for one year', value: `${aed(c.annualFee)} before VAT` },
                  { label: 'Billing', value: { annual: 'Once a year, in advance', quarterly: 'Every quarter, in advance', monthly: 'Every month, in advance' }[c.billing] },
                ]}
              />
            </Card>
            <Card title={`Covered systems (${c.systemIds.length})`} bodyClassName="!px-2">
              {c.systemIds.length === 0 ? (
                <p className="px-3 pb-2 text-sm text-slate-500">No system is covered.</p>
              ) : (
                <ul>
                  {c.systemIds.map((id) => {
                    const sys = s.systems[id];
                    if (!sys) return null;
                    const Icon = SYSTEM_TYPES[sys.type].icon;
                    const sum = summariseDevices(devicesBySystem(s)[id] ?? []);
                    return (
                      <li key={id}>
                        <Link to={`/customers/sites/${c.siteId}?tab=equipment`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                          <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon className="size-4" aria-hidden="true" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">{sys.name}</span>
                            <span className="block truncate text-xs text-slate-500">{SYSTEM_TYPES[sys.type].standard} · {plural(sum.items, 'item')}</span>
                          </span>
                          {sys.status === 'impaired' && <Status kind="system" value="impaired" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
          <div className="space-y-5">
            <Card title="Approval by the authority">
              <div className="space-y-3">
                <Status kind="cd" value={c.cdApproval.status} />
                <DefinitionList
                  cols={1}
                  items={[
                    c.cdApproval.reference && { label: 'Reference (sample)', value: <span className="tabular-nums">{c.cdApproval.reference}</span> },
                    c.cdApproval.submittedOn && { label: 'Submitted', value: fmtDate(c.cdApproval.submittedOn) },
                    c.cdApproval.decidedOn && { label: 'Answer', value: fmtDate(c.cdApproval.decidedOn) },
                    c.cdApproval.note && { label: 'Note', value: c.cdApproval.note },
                  ]}
                />
                <p className="text-xs text-slate-500">Sample: how each emirate approves contracts is confirmed in the research of phase 2.</p>
              </div>
            </Card>
            <Card title="Recent activity"><ActivityList entries={activity} /></Card>
          </div>
        </div>
      )}

      {tab === 'visits' && (
        <div className="space-y-4">
          <p className="max-w-3xl text-sm text-slate-600">
            The visits of the contract, from the visit plan. Each is released as a job. A job needs planning 30 days before its date, then the coordinator gives it a day and the people who go.
          </p>
          <DataTable columns={visitColumns} rows={visitRows} onRowClick={(r) => r.job && navigate(`/service/jobs/${r.job.id}`)} mobileRow={(r) => (
            <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="font-medium text-slate-900">Visit {r.n} of {c.visitPlan.length}</p><p className="text-xs text-slate-500">{fmtDate(r.dueOn)}</p></div><Status kind="visit" value={r.state} dot={false} /></div>
          )} />
          {manage && c.status === 'active' && waitingRows > 0 && (
            <Button icon={PlayIcon} onClick={() => { releaseContractVisits(c.id); toast('Visits released as jobs'); }}>Release {plural(waitingRows, 'more visit')}</Button>
          )}
          {c.status === 'draft' && <p className="text-sm text-slate-500">The visits are released as jobs when the contract becomes active.</p>}
        </div>
      )}

      {tab === 'billing' && (
        <div className="space-y-4">
          <p className="max-w-3xl text-sm text-slate-600">
            What will be invoiced and when, in equal parts for each period, in advance. Each instalment is turned into an invoice in Billing: it shows in "Ready to invoice" 14 days before its date, and can be started from here with "Invoice now".
          </p>
          <DataTable columns={billColumns} rows={c.billingPlan} mobileRow={(b) => (
            <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="font-medium text-slate-900">{fmtDate(b.dueOn)}</p><p className="text-xs text-slate-500">{(b.invoiceId && s.invoices[b.invoiceId]?.number) || b.invoiceRef || (b.dueOn < today ? 'Late: not invoiced' : 'Planned')}</p></div><span className="tabular-nums text-slate-900">{money(b.amount)}</span></div>
          )} />
          <div className="flex justify-end">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-600">Total of the term</dt><dd className="font-semibold tabular-nums text-slate-900">AED {money(c.billingPlan.reduce((sum, b) => sum + b.amount, 0))}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">Fee for one year</dt><dd className="tabular-nums text-slate-700">AED {money(c.annualFee)}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {dialog === 'submit' && <SubmitDialog c={c} onClose={() => setDialog(null)} />}
      {dialog === 'decide' && <DecisionDialog c={c} onClose={() => setDialog(null)} />}
      {dialog === 'end' && <EndDialog c={c} onClose={() => setDialog(null)} />}
      {drawer && <TermsDrawer c={c} onClose={() => setDrawer(false)} />}
    </Page>
  );
}
