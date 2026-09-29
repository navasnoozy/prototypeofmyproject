import { useEffect, useRef, useState } from 'react';
import { CircleAlertIcon, EraserIcon } from 'lucide-react';
import { WINDOWS } from '@/data/serviceKinds.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { billableHours, clockTime, durationWords } from '@/lib/useNow.js';
import { cancelJob, completeJob, issueReport, planJob, sendReport, signJob } from '@/store/serviceActions.js';
import { checklistProgress, unrecordedFails } from '@/store/serviceSelectors.js';
import { customerContacts, list } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Checkbox, Field, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer, Modal } from '@/ui/Overlay.jsx';
import { staffOptions } from '@/pages/sales/parts.jsx';

// ---- plan: a day, a time window and the people ------------------------------------------------------
export function PlanDrawer({ j, onClose }) {
  const s = useStore();
  const today = todayISO();
  const site = s.sites[j.siteId];
  const form = useForm(
    {
      plannedOn: j.plannedOn || (j.dueOn > today ? j.dueOn : today),
      window: j.window || 'morning',
      assigneeIds: j.assigneeIds,
    },
    (v) => ({
      ...(v.plannedOn ? {} : { plannedOn: 'Choose the day.' }),
      ...(v.assigneeIds.length > 0 ? {} : { assigneeIds: 'Choose who goes.' }),
    }),
  );
  const { values } = form;
  const people = staffOptions(s, ['technician', 'engineer']);
  const load = (id) => list(s.jobs).filter((x) => x.id !== j.id && x.plannedOn === values.plannedOn && x.assigneeIds.includes(id) && ['planned', 'in_progress'].includes(x.status));
  const toggle = (id, on) => form.set('assigneeIds', on ? [...values.assigneeIds, id] : values.assigneeIds.filter((x) => x !== id));
  const late = values.plannedOn && j.dueOn && values.plannedOn > j.dueOn;

  const save = form.submit((v) => {
    planJob(j.id, { plannedOn: v.plannedOn, window: v.window, assigneeIds: v.assigneeIds });
    toast(`${j.number} planned for ${fmtDate(v.plannedOn)}`);
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title={j.status === 'planned' ? 'Change the plan' : 'Plan the job'} subtitle={`${j.number} · ${site?.name}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{j.status === 'planned' ? 'Save the plan' : 'Plan the job'}</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Day" required error={form.error('plannedOn')} hint={j.dueOn ? `Needed by ${fmtDate(j.dueOn)} (${relDays(j.dueOn, today)}).` : undefined}>
          <TextInput type="date" min={today} {...form.bind('plannedOn')} />
        </Field>
        {late && <p className="rounded-xl bg-orange-50 px-4 py-2.5 text-sm text-orange-950">This is after the day the job is needed by.</p>}
        <Field label="Time">
          <Select {...form.bind('window')} options={Object.entries(WINDOWS).map(([value, label]) => ({ value, label }))} />
        </Field>
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-xs font-medium text-slate-700">Who goes <span className="text-slate-400" aria-hidden="true">*</span></legend>
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            {people.map((p) => {
              const others = load(p.value);
              return (
                <Checkbox
                  key={p.value}
                  label={p.label}
                  hint={`${p.sub}${others.length ? ` · ${plural(others.length, 'other job')} that day` : ' · free that day'}`}
                  checked={values.assigneeIds.includes(p.value)}
                  onChange={(on) => toggle(p.value, on)}
                />
              );
            })}
          </div>
          {form.error('assigneeIds') && <p role="alert" className="mt-1.5 text-xs text-red-700">{form.error('assigneeIds')}</p>}
        </fieldset>
        {(site?.access || j.description) && (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="text-xs font-medium text-slate-500">To remember at this site</p>
            {j.description && <p className="mt-1">{j.description}</p>}
            {site?.access && <p className="mt-1">{site.access}</p>}
          </div>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

// ---- complete -----------------------------------------------------------------------------------
export function CompleteDialog({ j, onClose }) {
  const s = useStore();
  const p = checklistProgress(j);
  const visit = j.kind === 'planned_visit';
  const noFindings = !visit && j.findings.trim().length < 5;
  const nothingChecked = visit && p.done === 0;
  const blocked = noFindings || nothingChecked;
  const unrecorded = unrecordedFails(s, j).length;
  // The time since the job was started can be written on the time sheet of each person who went.
  const elapsed = j.startedAt ? Date.now() - Date.parse(j.startedAt) : 0;
  const hours = billableHours(elapsed);
  const offer = Boolean(j.startedAt) && j.labour.length === 0 && j.assigneeIds.length > 0;
  const [auto, setAuto] = useState(true);
  const go = () => {
    completeJob(j.id, { autoHours: offer && auto ? hours : 0 });
    toast(`${j.number} completed`);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Complete ${j.number}?`}
      footer={<><Button onClick={onClose}>Not yet</Button><Button variant="primary" onClick={go} disabled={blocked}>Complete job</Button></>}>
      <div className="mt-1 space-y-3">
        {visit && (
          <p>
            {p.done} of {p.total} items checked{p.failed ? `, ${p.failed} failed` : ''}.
            {p.done < p.total ? ` The ${p.total - p.done} not checked stay "not tested" and stay due.` : ''}
            {' '}The items you passed or failed are marked as serviced today, so their next due dates move.
          </p>
        )}
        {j.kind === 'repair' && j.deficiencyIds.length > 0 && <p>The deficiency this repair answers becomes "repaired". Someone must verify it before it is closed.</p>}
        {noFindings && (
          <p className="flex items-start gap-2 rounded-xl bg-orange-50 px-4 py-2.5 text-orange-950">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Write what you found and did in the findings first: the customer's report needs it.
          </p>
        )}
        {nothingChecked && (
          <p className="flex items-start gap-2 rounded-xl bg-orange-50 px-4 py-2.5 text-orange-950">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Check at least one item before completing the visit.
          </p>
        )}
        {offer && (
          <Checkbox
            label={`Write ${hours} h on the time sheet of ${j.assigneeIds.length === 1 ? 'the technician' : `each of the ${j.assigneeIds.length} people`}`}
            hint={`On site from ${clockTime(j.startedAt)} until now (${durationWords(elapsed)}), rounded to the half hour.`}
            checked={auto}
            onChange={setAuto}
          />
        )}
        {unrecorded > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-blue-950">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {plural(unrecorded, 'failed item')} not recorded as a deficiency yet. You can still complete, but the report cannot be issued until each one is recorded.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ---- the customer signs -------------------------------------------------------------------------------
// The drawing is kept as a small SVG path (a few hundred numbers), so the
// signature prints on the report without storing an image.
function SignaturePad({ onChange }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [strokes, setStrokes] = useState([]);
  const point = (e) => {
    const r = ref.current.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) * 400) / r.width), Math.round(((e.clientY - r.top) * 140) / r.height)];
  };
  const path = strokes.map((st) => st.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')).join(' ');
  useEffect(() => { onChange(strokes.flat().length >= 6 ? path : ''); }, [path]);

  return (
    <div>
      <svg
        ref={ref}
        viewBox="0 0 400 140"
        role="img"
        aria-label="Signature box: the customer signs here with a finger or a mouse"
        className="h-36 w-full touch-none rounded-xl border border-control bg-white"
        onPointerDown={(e) => {
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
          drawing.current = true;
          setStrokes((v) => [...v, [point(e)]]);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          setStrokes((v) => { const c = v.slice(); c[c.length - 1] = [...c[c.length - 1], point(e)]; return c; });
        }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerCancel={() => { drawing.current = false; }}
      >
        <line x1="16" y1="112" x2="384" y2="112" stroke="#cbd5e1" strokeWidth="1" />
        {strokes.length === 0 && <text x="200" y="76" textAnchor="middle" fontSize="14" fill="#94a3b8">Sign here</text>}
        <path d={path} fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-2 flex justify-end">
        <Button size="xs" icon={EraserIcon} onClick={() => setStrokes([])} disabled={strokes.length === 0}>Clear</Button>
      </div>
    </div>
  );
}

export function SignDrawer({ j, onClose }) {
  const s = useStore();
  const caller = j.callInfo ? list(s.contacts).find((c) => c.name === j.callInfo.reportedBy && c.customerId === j.customerId) : null;
  const contact = caller ?? customerContacts(s, j.customerId).find((c) => c.primary);
  const form = useForm(
    { name: contact?.name ?? '', role: contact?.title ?? '', path: '' },
    (v) => ({
      ...(v.name.trim() ? {} : { name: 'Write the name of the person who signs.' }),
      ...(v.path ? {} : { path: 'The customer must sign in the box.' }),
    }),
  );
  const save = form.submit((v) => {
    signJob(j.id, { name: v.name.trim(), role: v.role.trim(), path: v.path });
    toast('Signed by the customer');
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Customer's signature" subtitle={`${j.number} · ${s.sites[j.siteId]?.name}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save signature</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <p className="text-sm text-slate-600">Give the phone to the customer. The signature says the customer saw the work and the findings; it does not say the customer agrees to pay for repairs.</p>
        <Field label="Name" required error={form.error('name')}><TextInput {...form.bind('name')} autoComplete="off" /></Field>
        <Field label="Position"><TextInput {...form.bind('role')} autoComplete="off" /></Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">Signature <span className="text-slate-400" aria-hidden="true">*</span></p>
          <SignaturePad onChange={(path) => form.set('path', path)} />
          {form.error('path') && <p role="alert" className="mt-1.5 text-xs text-red-700">{form.error('path')}</p>}
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

// ---- the service report ----------------------------------------------------------------------------------------
export function IssueDialog({ j, onClose }) {
  const s = useStore();
  const visit = j.kind === 'planned_visit' && j.systemIds.length > 0;
  const [certificate, setCertificate] = useState(visit);
  const unrecorded = unrecordedFails(s, j);
  const go = () => {
    issueReport(j.id, { certificate: visit && certificate });
    toast('Service report issued');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Issue the service report"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go} disabled={unrecorded.length > 0}>Issue report</Button></>}>
      <div className="mt-1 space-y-4">
        <p>The report gets its number and can no longer be changed. It carries the checks, the findings, the parts, the time and the customer's signature.</p>
        {unrecorded.length > 0 && (
          <div className="rounded-xl bg-orange-50 px-4 py-3 text-orange-950">
            <p className="flex items-start gap-2 font-medium"><CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Record the failed items as deficiencies first</p>
            <ul className="mt-1.5 list-disc pl-6 text-sm">{unrecorded.map((r) => <li key={r.id}>{r.label}</li>)}</ul>
            <p className="mt-1.5 text-sm">A failed test that is not recorded is a liability that nobody follows.</p>
          </div>
        )}
        {visit && (
          <Checkbox
            label="Also issue a maintenance certificate"
            hint="It says the systems were inspected and tested, and when the next visit is due."
            checked={certificate}
            onChange={setCertificate}
          />
        )}
      </div>
    </Modal>
  );
}

export function SendDialog({ j, onClose }) {
  const s = useStore();
  const site = s.sites[j.siteId];
  const contacts = customerContacts(s, j.customerId).filter((c) => c.siteIds.length === 0 || c.siteIds.includes(site.id));
  const asker = j.callInfo ? contacts.find((c) => c.name === j.callInfo.reportedBy) : null;
  const [chosen, setChosen] = useState([(asker ?? contacts.find((c) => c.primary) ?? contacts[0])?.id].filter(Boolean));
  const [submitted, setSubmitted] = useState(false);
  const cert = s.certificates[j.report.certificateId];
  const go = () => {
    setSubmitted(true);
    if (chosen.length === 0) return;
    sendReport(j.id, { to: chosen });
    toast('Service report sent to the customer');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Send the report to the customer" width="max-w-lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Send report</Button></>}>
      <div className="mt-1 space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-slate-700">To</legend>
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            {contacts.map((c) => (
              <Checkbox
                key={c.id}
                label={c.name}
                hint={`${c.title} · ${c.email}`}
                checked={chosen.includes(c.id)}
                onChange={(on) => setChosen(on ? [...chosen, c.id] : chosen.filter((x) => x !== c.id))}
              />
            ))}
          </div>
          {submitted && chosen.length === 0 && <p role="alert" className="mt-1.5 text-xs text-red-700">Choose at least one person.</p>}
        </fieldset>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <p className="text-xs font-medium text-slate-500">The email (a sample: nothing is really sent)</p>
          <p className="mt-1 font-medium text-slate-900">Service report {j.report.number} for {site?.name}</p>
          <p className="mt-1">Please find the report of our visit on {fmtDate(j.completedOn)}. It lists what we checked, what we found and what we did.</p>
          <p className="mt-2 text-xs text-slate-500">Attached: {j.report.number}.pdf{cert ? `, ${cert.number}.pdf (maintenance certificate)` : ''}</p>
        </div>
      </div>
    </Modal>
  );
}

const CANCEL_REASONS = ['The customer cancelled', 'No access to the site', 'Raised by mistake', 'Replaced by another job', 'Other'];
export function CancelDialog({ j, onClose }) {
  const form = useForm({ reason: '' }, (v) => (v.reason ? {} : { reason: 'Choose the reason.' }));
  const go = form.submit((v) => {
    cancelJob(j.id, v.reason);
    toast(`${j.number} cancelled`);
    onClose();
  });
  return (
    <Modal open onClose={onClose} title={`Cancel ${j.number}?`}
      footer={<><Button onClick={onClose}>Keep the job</Button><Button variant="danger" onClick={go}>Cancel job</Button></>}>
      <p className="mt-1">{j.kind === 'planned_visit' ? 'The visit will show as cancelled in the visit plan of its contract. Nothing replaces it by itself.' : 'The job stays on the record as cancelled.'}</p>
      <form onSubmit={go} className="mt-4">
        <Field label="Reason" required error={form.error('reason')}><Select {...form.bind('reason')} options={CANCEL_REASONS} placeholder="Choose a reason" /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

