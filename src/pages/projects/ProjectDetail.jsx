import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BanknoteIcon, ClipboardCheckIcon, KeyRoundIcon, PackageCheckIcon, PauseIcon, PencilIcon, PlayIcon } from 'lucide-react';
import { PHASES } from '@/data/projectKinds.js';
import { diffDays, todayISO } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { moveToHandover, releaseRetention, resumeProject, startInstallation, startTesting } from '@/store/projectActions.js';
import { openSnags, openVariations, pendingDocuments, phaseSteps, projectStatus, readyToHandOver, testsPending } from '@/store/projectSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { LifeCycle } from '@/ui/LifeCycle.jsx';
import { ConfirmDialog } from '@/ui/Overlay.jsx';
import { EmptyState, Page, Tabs } from '@/ui/Page.jsx';
import { EditProjectDrawer, HandoverDialog, HoldDialog } from './ProjectDialogs.jsx';
import { ProjectClaims } from './ProjectClaims.jsx';
import { ProjectCosts } from './ProjectCosts.jsx';
import { ProjectDocuments } from './ProjectDocuments.jsx';
import { ProjectHandover } from './ProjectHandover.jsx';
import { ProjectOverview } from './ProjectOverview.jsx';
import { ProjectPlan } from './ProjectPlan.jsx';
import { ProjectVariations } from './ProjectVariations.jsx';

const ABOUT = {
  purpose: 'One installation project: its scope and budget (from the accepted quotation), its site work, its costs, its variations, its progress claims, its documents, and its testing and handover. The main button always says the next phase.',
  why: [
    'The work is split into packages, one for each section of the quotation and one for each approved variation. Each package has its own price, its own budget and its own percent complete, so progress, claims and costs all speak about the same parts.',
    'A progress claim is cumulative: the work done so far, less the retention held back and the share of the advance that is paid back with the work. What is due is the difference from the last claim. The customer\'s engineer may certify less than was claimed.',
    'Cost is shown as ordered (committed) and billed (incurred) against the budget, so an overrun is seen while there is still time to act, not at the end (the mature products do the same).',
    'The handover is one event: the systems go into the equipment register of the site, the defects liability period starts, and a maintenance contract is offered. Nothing has to be typed again.',
  ],
  assumed: [
    'Retention is released once, at the end of the defects liability period. Some contracts release half at completion; the UAE practice is not confirmed.',
    'The Civil Defence approval of drawings and the completion certificate are steps of the flow with sample references; how each emirate does them is confirmed in the research of phase 2.',
    'Costs are entered by hand here. From step 6 the purchase orders and supplier bills of Purchases fill them, and from step 7 Billing makes the invoices of the claims.',
  ],
};

export function ProjectDetail() {
  const { projectId } = useParams();
  const s = useStore();
  const p = s.projects[projectId];
  if (!p) {
    return (
      <Page title="Project not found" back="/projects">
        <EmptyState title="This project does not exist" action={<Button variant="primary" to="/projects">All projects</Button>}>It may have been removed.</EmptyState>
      </Page>
    );
  }
  return <Body key={p.id} p={p} />;
}

function Body({ p }) {
  const s = useStore();
  const navigate = useNavigate();
  const { canEdit, roleKey } = useSession();
  const [tab, setTab] = useParam('tab', 'overview');
  const [dialog, setDialog] = useState(null); // edit | hold | handover | start | testing
  const today = todayISO();
  const manage = canEdit('projects');
  const boss = ['owner', 'manager'].includes(roleKey);
  const customer = s.customers[p.customerId];
  const site = s.sites[p.siteId];
  const cdOk = p.cdApproval !== 'contractor' || p.documents.some((d) => d.kind === 'cd_drawings' && d.status === 'approved');
  const workUnfinished = p.packages.filter((x) => !x.docs && x.progress < 90);
  const dlpOver = p.phase === 'retention' && diffDays(today, p.handover.dlpEnd) <= 0;
  const hasRetentionClaim = p.claims.some((c) => c.kind === 'retention');

  let cta = null;
  if (manage && !p.onHold) {
    if (p.phase === 'approvals') {
      cta = { label: 'Start installation', icon: PlayIcon, run: () => (cdOk ? (startInstallation(p.id), toast('Installation started')) : setDialog('start')) };
    } else if (p.phase === 'installation') {
      cta = { label: 'Start testing', icon: ClipboardCheckIcon, run: () => (workUnfinished.length === 0 ? (startTesting(p.id), toast('Testing started')) : setDialog('testing')) };
    } else if (p.phase === 'testing') {
      cta = {
        label: 'Move to handover', icon: PackageCheckIcon,
        run: () => (testsPending(p).length === 0 ? (moveToHandover(p.id), toast('Handover phase started')) : (toast(`${plural(testsPending(p).length, 'test')} not passed yet`, { tone: 'error' }), setTab('handover'))),
      };
    } else if (p.phase === 'handover') {
      cta = { label: 'Hand over to the customer', icon: KeyRoundIcon, run: () => (readyToHandOver(p) ? setDialog('handover') : (toast('Not ready yet: see the checklist', { tone: 'error' }), setTab('handover'))) };
    } else if (dlpOver && !hasRetentionClaim) {
      cta = { label: 'Release the retention', icon: BanknoteIcon, run: () => { releaseRetention(p.id); toast('Retention release claim made'); setTab('claims'); } };
    }
  }

  const menu = manage
    ? [
        { label: 'Edit the project', icon: PencilIcon, onClick: () => setDialog('edit') },
        p.onHold
          ? { label: 'Resume the work', icon: PlayIcon, onClick: () => { resumeProject(p.id); toast('Work resumed'); } }
          : !['retention', 'complete'].includes(p.phase) && { label: 'Put on hold', icon: PauseIcon, onClick: () => setDialog('hold') },
        boss && p.phase === 'retention' && !dlpOver && !hasRetentionClaim && { separator: true },
        boss && p.phase === 'retention' && !dlpOver && !hasRetentionClaim && { label: 'Release the retention early', icon: BanknoteIcon, sub: 'By agreement with the customer', onClick: () => { releaseRetention(p.id, true); toast('Retention release claim made (early)'); setTab('claims'); } },
      ].filter(Boolean)
    : undefined;

  const open = { variations: openVariations(p).length, documents: pendingDocuments(p).length, snags: openSnags(p).length };

  return (
    <Page
      title={p.number}
      badge={<Status kind="project" value={projectStatus(p)} />}
      facts={`${p.title} · ${customer?.name}${site ? ` · ${site.name}` : ''}`}
      back="/projects"
      about={ABOUT}
      menu={menu}
      actions={cta && <Button variant="primary" icon={cta.icon} onClick={cta.run}>{cta.label}</Button>}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'plan', label: 'Plan' },
            { value: 'costs', label: 'Costs' },
            { value: 'variations', label: 'Variations', count: p.variations.length },
            { value: 'claims', label: 'Claims', count: p.claims.length },
            { value: 'documents', label: 'Documents', count: open.documents || undefined },
            { value: 'handover', label: 'Testing and handover', count: open.snags || undefined },
          ]}
        />
      }
    >
      {tab === 'overview' && (
        <>
          <LifeCycle steps={phaseSteps(p)} className="mb-2" />
          <p className="mb-5 text-sm text-slate-600">{PHASES[p.phase].blurb}</p>
        </>
      )}
      {p.onHold && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
          <strong className="font-semibold">On hold.</strong> {p.holdReason}
        </div>
      )}
      {tab === 'overview' && <ProjectOverview p={p} setTab={setTab} />}
      {tab === 'plan' && <ProjectPlan p={p} manage={manage} />}
      {tab === 'costs' && <ProjectCosts p={p} manage={manage} />}
      {tab === 'variations' && <ProjectVariations p={p} manage={manage} />}
      {tab === 'claims' && <ProjectClaims p={p} manage={manage} boss={boss} />}
      {tab === 'documents' && <ProjectDocuments p={p} manage={manage} />}
      {tab === 'handover' && <ProjectHandover p={p} manage={manage} onHandOver={() => setDialog('handover')} />}

      {dialog === 'edit' && <EditProjectDrawer p={p} onClose={() => setDialog(null)} />}
      {dialog === 'hold' && <HoldDialog p={p} onClose={() => setDialog(null)} />}
      {dialog === 'handover' && <HandoverDialog p={p} onClose={() => setDialog(null)} onDone={(qid) => navigate(`/sales/quotations/${qid}`)} />}
      <ConfirmDialog
        open={dialog === 'start'}
        title="Start without the Civil Defence approval?"
        confirmLabel="Start at our own risk"
        onCancel={() => setDialog(null)}
        onConfirm={() => { setDialog(null); startInstallation(p.id); toast('Installation started'); }}
      >
        The authority's approval of the drawings is not recorded yet. Installing before it is a risk: the work may have to be changed. Record the approval under Documents, or start now.
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'testing'}
        title="Start testing before the work is finished?"
        confirmLabel="Start testing"
        onCancel={() => setDialog(null)}
        onConfirm={() => { setDialog(null); startTesting(p.id); toast('Testing started'); }}
      >
        {plural(workUnfinished.length, 'package')} {workUnfinished.length === 1 ? 'is' : 'are'} below 90% complete: {workUnfinished.map((x) => x.title).join('; ')}. Tests on unfinished work may have to be repeated.
      </ConfirmDialog>
    </Page>
  );
}
