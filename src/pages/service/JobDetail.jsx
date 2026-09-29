import { useState } from 'react';
import { useParams } from 'react-router';
import { CalendarPlusIcon, CircleCheckIcon, FileTextIcon, PenLineIcon, PencilIcon, PlayIcon, SendIcon, XIcon } from 'lucide-react';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { startJob } from '@/store/serviceActions.js';
import { canPlanJobs, jobStatus, jobSteps } from '@/store/serviceSelectors.js';
import { activityFor } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { useParam } from '@/lib/useParam.js';
import { ActivityList } from '@/ui/Activity.jsx';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { LifeCycle } from '@/ui/LifeCycle.jsx';
import { Card, EmptyState, Page, Tabs } from '@/ui/Page.jsx';
import { DeficiencyDrawer } from './DeficiencyDialogs.jsx';
import { CancelDialog, CompleteDialog, IssueDialog, PlanDrawer, SendDialog, SignDrawer } from './JobDialogs.jsx';
import { ChecklistCard, DetailsCard, FindingsCard, JobOrdersCard, OnSiteTimer, PartsTimeCard, ReportedCard, SignoffCard, WhereCard } from './JobPanels.jsx';
import { ReportPreview } from './ReportPreview.jsx';

const ABOUT = {
  purpose: 'One piece of field work from the request to the report: planned, started, checked, written up, signed by the customer, reported. The same page serves the coordinator at the office and the technician on the phone.',
  why: [
    'The main button always says the next step of the job (plan, start, complete, get the signature, issue the report, send it). A person never has to decide what comes next.',
    'A planned visit gets its checklist from the equipment register at the moment it starts: the groups that are due within 45 days. When the visit is completed, what was tested moves its due date, so the register, the site health and the bell all update by themselves.',
    'A failed check must become a deficiency before the report is issued, because a failed test that nobody follows is a liability (NFPA 25 keeps the list of deficiencies as the record).',
    'The customer signs on the screen; the report is a document with a number that cannot change after it is issued, and the maintenance certificate comes with it (study, K.4).',
    'For the technician on a phone: the top card says where to go, opens the map, dials the contact and shows how to get in; the checklist buttons are big; photos go with the findings; and the time on site is counted from the moment of starting, so completing the job can write the hours on the time sheet.',
  ],
  assumed: [
    'A technician can act only on jobs planned for him; the coordinator, the manager and the owner can act on all of them. The permission table is one of the things the prototype tests.',
    'The signature is a drawing kept in the browser; in the product it would be stored as an image with the time and place.',
    'The wording of the maintenance certificate is a sample; the format the authority accepts is confirmed in phase 2.',
  ],
};

export function JobDetail() {
  const { jobId } = useParams();
  const s = useStore();
  const j = s.jobs[jobId];
  if (!j) {
    return (
      <Page title="Job not found" back="/service/jobs">
        <EmptyState title="This job does not exist" action={<Button variant="primary" to="/service/jobs">All jobs</Button>}>It may have been removed.</EmptyState>
      </Page>
    );
  }
  return <Body key={j.id} j={j} />;
}

function Body({ j }) {
  const s = useStore();
  const { user, roleKey, canEdit } = useSession();
  const [tab, setTab] = useParam('tab', 'job');
  const [dialog, setDialog] = useState(null); // plan | complete | sign | issue | send | cancel
  const [defDrawer, setDefDrawer] = useState(null); // the prefill of the deficiency form
  const today = todayISO();
  const st = jobStatus(j, today);
  const site = s.sites[j.siteId];
  const contract = s.contracts[j.contractId];
  const planner = canEdit('service') && canPlanJobs(roleKey);
  const canAct = canEdit('service') && (planner || j.assigneeIds.includes(user.id));
  const done = ['completed', 'report_sent'].includes(st);
  const live = st === 'in_progress';
  const writable = canAct && (live || (st === 'completed' && !j.report));
  const activity = activityFor(s, 'job', j.id);
  const past = st === 'planned' && j.plannedOn && j.plannedOn < today;

  let cta = null;
  if ((st === 'upcoming' || st === 'unplanned') && planner) cta = { label: 'Plan job', icon: CalendarPlusIcon, run: () => setDialog('plan') };
  else if (st === 'planned' && canAct) cta = { label: 'Start job', icon: PlayIcon, run: () => { startJob(j.id); toast('Job started'); } };
  else if (live && canAct) cta = { label: 'Complete job', icon: CircleCheckIcon, run: () => setDialog('complete') };
  else if (st === 'completed' && canAct) {
    if (!j.signature) cta = { label: 'Get signature', icon: PenLineIcon, run: () => setDialog('sign') };
    else if (!j.report) cta = { label: 'Issue service report', icon: FileTextIcon, run: () => setDialog('issue') };
    else if (!j.report.sentOn) cta = { label: 'Send report', icon: SendIcon, run: () => setDialog('send') };
  }

  const menu = [
    planner && st === 'planned' && { label: 'Change the plan', icon: PencilIcon, onClick: () => setDialog('plan') },
    done && { label: 'Open service report', icon: FileTextIcon, onClick: () => setTab('report') },
    planner && ['upcoming', 'unplanned', 'planned'].includes(st) && { separator: true },
    planner && ['upcoming', 'unplanned', 'planned'].includes(st) && { label: 'Cancel job', icon: XIcon, tone: 'danger', onClick: () => setDialog('cancel') },
  ].filter(Boolean);

  const record = (row) =>
    setDefDrawer(
      row
        ? { systemId: row.systemId, deviceId: row.deviceId, title: `${row.label}: failed`, description: row.note, severity: 'noncritical' }
        : { systemId: j.systemIds[0] ?? '' },
    );

  return (
    <Page
      title={j.number}
      badge={<span className="flex items-center gap-2"><Status kind="job" value={st} /><OnSiteTimer j={j} /></span>}
      facts={`${j.title} · ${site?.name}`}
      back="/service/jobs"
      about={ABOUT}
      menu={menu.length > 0 ? menu : undefined}
      actions={cta && <Button variant="primary" icon={cta.icon} onClick={cta.run}>{cta.label}</Button>}
      tabs={done ? <Tabs value={tab} onChange={setTab} items={[{ value: 'job', label: 'Job' }, { value: 'report', label: 'Service report' }]} /> : undefined}
    >
      {tab === 'report' && done ? (
        <ReportPreview j={j} />
      ) : (
        <>
          {st !== 'cancelled' && <LifeCycle steps={jobSteps(j, today)} className="mb-5" />}
          {st === 'cancelled' && (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <strong className="font-semibold">Cancelled.</strong> The job stays on the record.
            </div>
          )}
          {j.urgency === 'emergency' && !done && st !== 'cancelled' && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
              <strong className="font-semibold">Emergency.</strong>{' '}
              {contract ? `The contract promises a technician within ${contract.responseHours} hours of the call.` : 'There is no contract, so tell the customer the visit is chargeable.'}
            </div>
          )}
          {past && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
              <span><strong className="font-semibold">Planned for {fmtDate(j.plannedOn)} ({relDays(j.plannedOn, today)}) and not started.</strong> Find out what happened.</span>
              {planner && <Button size="xs" onClick={() => setDialog('plan')}>Change the plan</Button>}
            </div>
          )}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              {!done && st !== 'cancelled' && <WhereCard j={j} />}
              <ReportedCard j={j} />
              {j.kind === 'planned_visit' && (
                <ChecklistCard j={j} editable={canAct && live} canRecord={writable} onRecord={record} />
              )}
              {(live || done) && <FindingsCard j={j} editable={writable} canRecord={writable} onRecord={record} />}
              {(live || done) && <PartsTimeCard j={j} editable={writable} />}
              {st !== 'cancelled' && <JobOrdersCard j={j} />}
              {!live && !done && st !== 'cancelled' && j.kind !== 'planned_visit' && (
                <Card title="When the job starts">
                  <p className="text-sm text-slate-600">
                    The time on site is counted from the moment of starting. The technician records what was found and done, adds photos, the parts used and any deficiency, and gets the customer's signature.
                  </p>
                </Card>
              )}
            </div>
            <div className="space-y-5">
              <DetailsCard j={j} />
              <SignoffCard j={j} canAct={canAct} onSign={() => setDialog('sign')} onIssue={() => setDialog('issue')} onSend={() => setDialog('send')} onOpenReport={() => setTab('report')} />
              <Card title="Recent activity"><ActivityList entries={activity} /></Card>
            </div>
          </div>
        </>
      )}

      {dialog === 'plan' && <PlanDrawer j={j} onClose={() => setDialog(null)} />}
      {dialog === 'complete' && <CompleteDialog j={j} onClose={() => setDialog(null)} />}
      {dialog === 'sign' && <SignDrawer j={j} onClose={() => setDialog(null)} />}
      {dialog === 'issue' && <IssueDialog j={j} onClose={() => setDialog(null)} />}
      {dialog === 'send' && <SendDialog j={j} onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && <CancelDialog j={j} onClose={() => setDialog(null)} />}
      {defDrawer && <DeficiencyDrawer siteId={j.siteId} jobId={j.id} prefill={defDrawer} onClose={() => setDefDrawer(null)} />}
    </Page>
  );
}

