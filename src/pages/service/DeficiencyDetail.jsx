import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BanIcon, CheckCircle2Icon, CircleIcon, FilePlusIcon, PencilIcon, SendIcon, ShieldCheckIcon, WrenchIcon } from 'lucide-react';
import { SEVERITY } from '@/data/serviceKinds.js';
import { cn } from '@/lib/cn.js';
import { fmtDate } from '@/lib/dates.js';
import { setDeficiencyPhotos, startRepairJob } from '@/store/serviceActions.js';
import { canPlanJobs, deficiencySteps, deviceLabel } from '@/store/serviceSelectors.js';
import { quotationLabel } from '@/store/salesSelectors.js';
import { activityFor } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { ActivityList } from '@/ui/Activity.jsx';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { LifeCycle } from '@/ui/LifeCycle.jsx';
import { Card, DefinitionList, EmptyState, Page } from '@/ui/Page.jsx';
import { PhotoStrip } from '@/ui/Photos.jsx';
import { DeclineDialog, DeficiencyDrawer, ReportDialog, VerifyDialog } from './DeficiencyDialogs.jsx';

const ABOUT = {
  purpose: 'One thing that was found wrong, from the day it was found to the day the repair was checked. It shows who was told, what was quoted, what the customer answered, which job repaired it, and who verified it.',
  why: [
    'The way to closing is drawn as a list of steps with dates, so anyone can see where it stands and what is missing without reading the activity list.',
    'The repair quotation is made from here and linked back: when the customer accepts it, this deficiency becomes "approved" by itself, and the repair job is made from the accepted quotation (record 39, points 4 and 9).',
    'A repair job that is completed makes the deficiency "repaired". It is closed only when someone verifies it. Verifying an impairment puts the system back in service.',
    'The rule and the standard are shown because the customer, the authority and an insurer will ask which requirement was not met.',
  ],
  assumed: [
    'Repair work under a maintenance contract may need no quotation; the menu allows a repair job without one. Which repairs a contract includes is a term of the contract, not modelled here.',
  ],
};

export function DeficiencyDetail() {
  const { deficiencyId } = useParams();
  const s = useStore();
  const d = s.deficiencies[deficiencyId];
  if (!d) {
    return (
      <Page title="Deficiency not found" back="/service/deficiencies">
        <EmptyState title="This deficiency does not exist" action={<Button variant="primary" to="/service/deficiencies">All deficiencies</Button>}>It may have been removed.</EmptyState>
      </Page>
    );
  }
  return <Body key={d.id} d={d} />;
}

function Step({ done, title, children, last }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className={cn('absolute left-[9px] top-5 h-[calc(100%-12px)] w-px', done ? 'bg-slate-300' : 'bg-slate-200')} aria-hidden="true" />}
      {done ? <CheckCircle2Icon className="relative mt-0.5 size-5 shrink-0 bg-white text-slate-900" aria-hidden="true" /> : <CircleIcon className="relative mt-0.5 size-5 shrink-0 bg-white text-slate-300" aria-hidden="true" />}
      <div className="min-w-0 text-sm">
        <p className={cn('font-medium', done ? 'text-slate-900' : 'text-slate-500')}>{title}</p>
        <div className="mt-0.5 text-slate-600">{children}</div>
      </div>
    </li>
  );
}

function Body({ d }) {
  const s = useStore();
  const navigate = useNavigate();
  const { user, roleKey, canEdit } = useSession();
  const [dialog, setDialog] = useState(null); // report | decline | verify | edit
  const site = s.sites[d.siteId];
  const system = s.systems[d.systemId];
  const device = s.devices[d.deviceId];
  const quotation = s.quotations[d.quotationId];
  const repair = s.jobs[d.repairJobId];
  const job = s.jobs[d.jobId];
  const reportedTo = s.contacts[d.reportedTo];
  const service = canEdit('service');
  const planner = service && canPlanJobs(roleKey);
  const open = !['verified', 'declined'].includes(d.status);
  const sev = SEVERITY[d.severity];

  const makeRepairJob = () => {
    const id = startRepairJob({ quotationId: d.quotationId && quotation?.status === 'accepted' ? d.quotationId : undefined, deficiencyId: d.id });
    toast('Repair job created: it needs planning');
    navigate(`/service/jobs/${id}`);
  };
  const quoteUrl = `/sales/quotations/new?kind=repair&customer=${site.customerId}&site=${site.id}&deficiency=${d.number}`;

  let cta = null;
  if (d.status === 'found' && service) cta = { label: 'Report to the customer', icon: SendIcon, run: () => setDialog('report') };
  else if (d.status === 'reported' && !quotation && canEdit('sales')) cta = { label: 'Make repair quotation', icon: FilePlusIcon, to: quoteUrl };
  else if (['reported', 'quoted'].includes(d.status) && quotation) cta = { label: 'Open the quotation', icon: FilePlusIcon, to: `/sales/quotations/${quotation.id}` };
  else if (d.status === 'approved' && !repair && planner) cta = { label: 'Create repair job', icon: WrenchIcon, run: makeRepairJob };
  else if (d.status === 'approved' && repair) cta = { label: 'Open repair job', icon: WrenchIcon, to: `/service/jobs/${repair.id}` };
  else if (d.status === 'repaired' && planner) cta = { label: 'Verify the repair', icon: ShieldCheckIcon, run: () => setDialog('verify') };

  const menu = [
    service && { label: 'Edit details', icon: PencilIcon, onClick: () => setDialog('edit') },
    planner && open && !repair && d.status !== 'approved' && { label: 'Repair without a quotation', icon: WrenchIcon, sub: 'For work the contract covers', onClick: makeRepairJob },
    service && ['reported', 'quoted'].includes(d.status) && { separator: true },
    service && ['reported', 'quoted'].includes(d.status) && { label: 'The customer declined', icon: BanIcon, tone: 'danger', onClick: () => setDialog('decline') },
  ].filter(Boolean);

  return (
    <Page
      title={d.number}
      badge={<span className="flex items-center gap-2"><Status kind="severity" value={d.severity} /><Status kind="deficiency" value={d.status} dot={false} /></span>}
      facts={`${site?.name} · ${system?.name}`}
      back="/service/deficiencies"
      about={ABOUT}
      menu={menu.length > 0 ? menu : undefined}
      actions={cta && <Button variant="primary" icon={cta.icon} to={cta.to} onClick={cta.run}>{cta.label}</Button>}
    >
      <LifeCycle steps={deficiencySteps(d)} className="mb-5" />
      {d.severity === 'impairment' && d.status !== 'verified' && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
          <strong className="font-semibold">Impairment: {device ? 'the equipment is' : 'the system is'} out of service.</strong>{' '}
          {d.status === 'found' ? 'The owner must be told at once and in writing.' : 'It stays out of service until the repair is verified.'}
        </div>
      )}
      {d.status === 'declined' && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <strong className="font-semibold">The customer declined the repair.</strong> {d.note} Keep this record: it shows the customer was told.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="What was found">
            <div className="space-y-4">
              <p className="text-base font-semibold text-slate-900">{d.title}</p>
              {d.description && <p className="whitespace-pre-line text-sm text-slate-700">{d.description}</p>}
              <DefinitionList
                items={[
                  { label: 'Class', value: `${sev.label}: ${sev.blurb}`, span: 2 },
                  d.requirement && { label: 'The rule it breaks', value: d.requirement, span: 2 },
                  { label: 'Equipment', value: device ? deviceLabel(s, device) : 'The whole system' },
                  { label: 'Found', value: `${fmtDate(d.foundOn)} by ${s.staff[d.foundBy]?.name ?? '—'}` },
                  job && { label: 'Found during', value: <Link className="font-medium hover:underline" to={`/service/jobs/${job.id}`}>{job.number}</Link> },
                ]}
              />
            </div>
          </Card>
          {(service && open) || (d.photos ?? []).length > 0 ? (
            <Card title="Photos">
              <PhotoStrip photos={d.photos ?? []} editable={service && open} by={user.id} onChange={(photos) => setDeficiencyPhotos(d.id, photos)} />
            </Card>
          ) : null}
          <Card title="The way to closing">
            <ol>
              <Step done title="Found">{fmtDate(d.foundOn)} · {s.staff[d.foundBy]?.name}{job ? <> · <Link className="font-medium text-slate-900 hover:underline" to={`/service/jobs/${job.id}`}>{job.number}</Link></> : ''}</Step>
              <Step done={Boolean(d.reportedOn)} title="Reported to the customer, in writing">
                {d.reportedOn ? `${fmtDate(d.reportedOn)}${reportedTo ? ` · ${reportedTo.name}` : ''}${d.note && d.status !== 'declined' ? ` · ${d.note}` : ''}` : d.status === 'found' ? 'Not yet.' : 'Not recorded: the quotation was made first.'}
              </Step>
              <Step done={Boolean(quotation)} title="Repair quotation">
                {quotation ? <><Link className="font-medium text-slate-900 hover:underline" to={`/sales/quotations/${quotation.id}`}>{quotationLabel(quotation)}</Link> · <Status kind="quotation" value={quotation.status} dot={false} /></> : d.status === 'declined' ? 'None.' : `Not made yet.${canEdit('sales') ? '' : ' Sales makes it from this deficiency.'}`}
              </Step>
              <Step done={['approved', 'repaired', 'verified'].includes(d.status) || Boolean(repair)} title="The customer approves the repair">
                {d.status === 'declined' ? 'Declined.' : ['approved', 'repaired', 'verified'].includes(d.status) ? 'Approved.' : repair ? 'Repair without a quotation.' : 'Waiting.'}
              </Step>
              <Step done={Boolean(repair) && ['completed', 'report_sent'].includes(repair.status)} title="Repair job">
                {repair ? <><Link className="font-medium text-slate-900 hover:underline" to={`/service/jobs/${repair.id}`}>{repair.number}</Link> · <Status kind="job" value={repair.status} dot={false} /></> : 'Not created yet.'}
              </Step>
              <Step last done={d.status === 'verified'} title="Verified">
                {d.verifiedOn ? `${fmtDate(d.verifiedOn)} · ${s.staff[d.verifiedBy]?.name ?? '—'}${d.note ? ` · ${d.note}` : ''}` : 'Not yet.'}
              </Step>
            </ol>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Details">
            <DefinitionList
              cols={1}
              items={[
                { label: 'Site', value: site && <Link className="font-medium hover:underline" to={`/customers/sites/${site.id}`}>{site.name}</Link> },
                { label: 'Customer', value: s.customers[site?.customerId]?.name },
                { label: 'System', value: system && <Link className="font-medium hover:underline" to={`/customers/sites/${site.id}?tab=equipment`}>{system.name}</Link> },
                { label: 'System state', value: system && <Status kind="system" value={system.status} /> },
              ]}
            />
          </Card>
          <Card title="Recent activity"><ActivityList entries={activityFor(s, 'deficiency', d.id)} /></Card>
        </div>
      </div>

      {dialog === 'report' && <ReportDialog d={d} onClose={() => setDialog(null)} />}
      {dialog === 'decline' && <DeclineDialog d={d} onClose={() => setDialog(null)} />}
      {dialog === 'verify' && <VerifyDialog d={d} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <DeficiencyDrawer deficiency={d} onClose={() => setDialog(null)} />}
    </Page>
  );
}
