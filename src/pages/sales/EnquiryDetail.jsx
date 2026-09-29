import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BinocularsIcon, FilePlusIcon, PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon, XIcon } from 'lucide-react';
import { ENQUIRY_SOURCES, LOST_REASONS } from '@/data/quotationKinds.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { aed } from '@/lib/format.js';
import { deleteEnquiry, markEnquiryLost, planSurvey, recordSurvey, reopenEnquiry } from '@/store/salesActions.js';
import { effectiveStatus, enquirySteps, enquiryQuotations, quoteTotals, quotationLabel } from '@/store/salesSelectors.js';
import { activityFor } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { ActivityList } from '@/ui/Activity.jsx';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { LifeCycle } from '@/ui/LifeCycle.jsx';
import { ConfirmDialog, Drawer, Modal } from '@/ui/Overlay.jsx';
import { Card, DefinitionList, EmptyState, Page } from '@/ui/Page.jsx';
import { KindTag, staffName, staffOptions } from './parts.jsx';

const ABOUT = {
  purpose: 'One request from a customer, followed until it is won or lost: the site survey, the quotations made for it, and what happened.',
  why: [
    'The strip under the title shows where the enquiry stands. The one main button always is the next step: plan the survey, record it, make the quotation, open it.',
    'The survey is a step of its own, with a date and a person, and its notes go into the estimate (study, workflow 1).',
    'Several quotations can belong to one enquiry (revisions and alternatives); the enquiry becomes won when one is accepted.',
  ],
  assumed: [
    'Lost reasons are a short sample list; they feed a report of why work is lost (Reports, step 8).',
    'An enquiry is lost by a person\'s decision, not automatically when a quotation is rejected: the customer may ask for a revision.',
  ],
};

export function EnquiryDetail() {
  const { enquiryId } = useParams();
  const s = useStore();
  const enquiry = s.enquiries[enquiryId];
  if (!enquiry) {
    return (
      <Page title="Enquiry not found" back="/sales">
        <EmptyState title="This enquiry does not exist" action={<Button variant="primary" to="/sales">All enquiries</Button>}>It may have been deleted.</EmptyState>
      </Page>
    );
  }
  return <Body key={enquiry.id} e={enquiry} />;
}

function Body({ e }) {
  const s = useStore();
  const navigate = useNavigate();
  const { canEdit } = useSession();
  const [surveyDrawer, setSurveyDrawer] = useState(null); // 'plan' | 'record'
  const [lostOpen, setLostOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const today = todayISO();
  const editable = canEdit('sales');
  const customer = s.customers[e.customerId];
  const site = s.sites[e.siteId];
  const contact = s.contacts[e.contactId];
  const quotes = enquiryQuotations(s, e.id);
  const open = ['new', 'survey', 'estimating', 'quoted'].includes(e.status);
  const late = ['new', 'survey', 'estimating'].includes(e.status) && e.dueOn && e.dueOn < today;
  const activity = activityFor(s, 'enquiry', e.id);
  const draft = quotes.find((q) => q.status === 'draft');
  const newQuotation = `/sales/quotations/new?enquiry=${e.id}`;

  // The one main step follows the life cycle.
  let cta = null;
  if (editable) {
    if (e.status === 'lost') cta = { label: 'Reopen', icon: RotateCcwIcon, run: () => { reopenEnquiry(e.id); toast('Enquiry reopened'); } };
    else if (e.status === 'new' && e.survey.needed && !e.survey.plannedOn) cta = { label: 'Plan survey', icon: BinocularsIcon, run: () => setSurveyDrawer('plan') };
    else if (e.status === 'survey') cta = { label: 'Record survey', icon: BinocularsIcon, run: () => setSurveyDrawer('record') };
    else if (e.status === 'new' || (e.status === 'estimating' && !quotes.length)) cta = { label: 'Create quotation', icon: FilePlusIcon, run: () => navigate(newQuotation) };
    else if (e.status === 'estimating' && draft) cta = { label: 'Open quotation', icon: FilePlusIcon, run: () => navigate(`/sales/quotations/${draft.id}`) };
    else if (e.status === 'quoted' && quotes.length) cta = { label: 'Open quotation', icon: FilePlusIcon, run: () => navigate(`/sales/quotations/${quotes[0].id}`) };
  }

  const menu = editable
    ? [
        { label: 'Edit enquiry', icon: PencilIcon, onClick: () => navigate(`/sales/${e.id}/edit`) },
        open && { label: e.survey.needed && !e.survey.doneOn ? 'Plan the survey again' : 'Plan a survey', icon: BinocularsIcon, onClick: () => setSurveyDrawer('plan') },
        open && { label: 'New quotation', icon: PlusIcon, onClick: () => navigate(newQuotation) },
        { separator: true },
        open && { label: 'Mark as lost', icon: XIcon, onClick: () => setLostOpen(true) },
        { label: 'Delete enquiry', icon: Trash2Icon, tone: 'danger', onClick: () => setConfirmDelete(true), disabled: e.status !== 'new' || quotes.length > 0, sub: e.status !== 'new' || quotes.length > 0 ? 'Only a new enquiry without quotations' : undefined },
      ].filter(Boolean)
    : undefined;

  return (
    <Page
      title={e.number}
      badge={<Status kind="enquiry" value={e.status} />}
      facts={`${e.title} · ${customer?.name}`}
      back="/sales"
      about={ABOUT}
      menu={menu}
      actions={cta && <Button variant="primary" icon={cta.icon} onClick={cta.run}>{cta.label}</Button>}
    >
      <LifeCycle steps={enquirySteps(e)} className="mb-5" />

      {e.status === 'lost' && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <strong className="font-semibold">Lost: {e.lostReason.toLowerCase()}.</strong> {e.lostNote}
        </div>
      )}
      {late && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong className="font-semibold">Late.</strong> The quotation was due {relDays(e.dueOn, today)}. The customer is waiting.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Request" action={editable && <Button variant="ghost" size="xs" icon={PencilIcon} to={`/sales/${e.id}/edit`}>Edit</Button>}>
            <DefinitionList
              items={[
                { label: 'Customer', value: customer && <Link className="font-medium hover:underline" to={`/customers/${customer.id}`}>{customer.name}</Link> },
                { label: 'Site', value: site ? <Link className="font-medium hover:underline" to={`/customers/sites/${site.id}`}>{site.name}</Link> : 'Not known yet' },
                { label: 'Contact', value: contact && `${contact.name}, ${contact.title}` },
                { label: 'Kind of work', value: <KindTag kind={e.kind} /> },
                { label: 'How it came in', value: ENQUIRY_SOURCES[e.source] },
                { label: 'Came in on', value: fmtDate(e.receivedOn) },
                { label: 'Quotation due by', value: e.dueOn && `${fmtDate(e.dueOn)} (${relDays(e.dueOn, today)})` },
                { label: 'Estimated value', value: e.estValue ? aed(e.estValue) : '' },
                { label: 'Owner', value: staffName(s, e.ownerId) },
                { label: 'Details', span: 2, value: e.description },
              ]}
            />
          </Card>

          <Card
            title={`Quotations (${quotes.length})`}
            bodyClassName="!px-2"
            action={editable && open && <Button variant="ghost" size="xs" icon={PlusIcon} to={newQuotation}>New quotation</Button>}
          >
            {quotes.length === 0 ? (
              <p className="px-3 pb-2 text-sm text-slate-500">
                {e.status === 'lost' ? 'No quotation was made.' : 'No quotation yet. When the survey is done, create one here.'}
              </p>
            ) : (
              <ul>
                {quotes.map((q) => {
                  const t = quoteTotals(q, s.settings.vatRate);
                  return (
                    <li key={q.id}>
                      <Link to={`/sales/quotations/${q.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">{quotationLabel(q)} · {q.title}</span>
                          <span className="block truncate text-xs text-slate-500"><KindTag kind={q.kind} className="text-xs" /> · {aed(t.total)} with VAT</span>
                        </span>
                        <Status kind="quotation" value={effectiveStatus(q, today)} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Site survey"
            action={editable && open && e.survey.needed && !e.survey.doneOn && e.survey.plannedOn && <Button variant="ghost" size="xs" onClick={() => setSurveyDrawer('record')}>Record</Button>}
          >
            {!e.survey.needed ? (
              <p className="text-sm text-slate-500">No survey is needed for this enquiry.</p>
            ) : e.survey.doneOn ? (
              <div className="space-y-2 text-sm">
                <p className="text-slate-800"><strong className="font-semibold">Done on {fmtDate(e.survey.doneOn)}</strong> by {staffName(s, e.survey.assigneeId)}.</p>
                {e.survey.notes && <p className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700">{e.survey.notes}</p>}
              </div>
            ) : e.survey.plannedOn ? (
              <p className="text-sm text-slate-800">
                <strong className="font-semibold">Planned for {fmtDate(e.survey.plannedOn)}</strong> ({relDays(e.survey.plannedOn, today)}).
                {e.survey.assigneeId && ` ${staffName(s, e.survey.assigneeId)} will go.`}
              </p>
            ) : (
              <p className="text-sm text-slate-500">Not planned yet.</p>
            )}
          </Card>
          <Card title="Recent activity"><ActivityList entries={activity} /></Card>
        </div>
      </div>

      {surveyDrawer === 'plan' && <PlanDrawer e={e} onClose={() => setSurveyDrawer(null)} />}
      {surveyDrawer === 'record' && <RecordDrawer e={e} onClose={() => setSurveyDrawer(null)} />}
      {lostOpen && <LostModal e={e} onClose={() => setLostOpen(false)} />}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this enquiry?"
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteEnquiry(e.id);
          toast('Enquiry deleted');
          navigate('/sales', { replace: true });
        }}
      >
        {e.number} will be removed. This cannot be undone.
      </ConfirmDialog>
    </Page>
  );
}

function PlanDrawer({ e, onClose }) {
  const s = useStore();
  const form = useForm(
    { plannedOn: e.survey.plannedOn || todayISO(), assigneeId: e.survey.assigneeId },
    (v) => ({ ...(v.plannedOn ? {} : { plannedOn: 'Choose the day.' }), ...(v.assigneeId ? {} : { assigneeId: 'Choose who goes.' }) }),
  );
  const save = form.submit((v) => {
    planSurvey(e.id, v);
    toast('Site survey planned');
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Plan the site survey" subtitle={e.number}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Plan survey</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Day" required error={form.error('plannedOn')}><TextInput type="date" {...form.bind('plannedOn')} /></Field>
        <Field label="Who goes" required error={form.error('assigneeId')}>
          <Combobox options={staffOptions(s, ['engineer', 'technician', 'coordinator', 'manager'])} noun="people" placeholder="Choose a person" searchPlaceholder="Search people" {...form.bind('assigneeId')} />
        </Field>
        <p className="text-xs text-slate-500">In step 5 the survey also appears on the planning board of the person who goes.</p>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

function RecordDrawer({ e, onClose }) {
  const form = useForm({ doneOn: e.survey.doneOn || todayISO(), notes: e.survey.notes }, (v) => (v.doneOn ? {} : { doneOn: 'Say when it was done.' }));
  const save = form.submit((v) => {
    recordSurvey(e.id, { doneOn: v.doneOn, notes: v.notes.trim() });
    toast('Survey recorded: the enquiry is now in estimating');
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Record the survey" subtitle={e.number}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save result</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Done on" required error={form.error('doneOn')}><TextInput type="date" {...form.bind('doneOn')} /></Field>
        <Field label="What was found" hint="What was counted and measured, access, problems, what the customer said.">
          <TextArea {...form.bind('notes')} rows={6} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

function LostModal({ e, onClose }) {
  const form = useForm({ reason: '', note: '' }, (v) => (v.reason ? {} : { reason: 'Choose the reason.' }));
  const save = form.submit((v) => {
    markEnquiryLost(e.id, { reason: v.reason, note: v.note.trim() });
    toast('Enquiry marked as lost');
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Mark this enquiry as lost?"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" onClick={save}>Mark as lost</Button></>}
    >
      <form onSubmit={save} className="mt-3 grid gap-4">
        <Field label="Reason" required error={form.error('reason')}>
          <Select {...form.bind('reason')} options={LOST_REASONS} placeholder="Choose a reason" />
        </Field>
        <Field label="Note"><TextArea {...form.bind('note')} rows={3} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
