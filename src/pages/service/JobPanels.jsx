import { useState } from 'react';
import { Link } from 'react-router';
import { CheckIcon, ClockIcon, FileTextIcon, MinusIcon, NavigationIcon, PenLineIcon, PhoneIcon, PlusIcon, SendIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { dueGroups } from '@/data/serviceRules.js';
import { URGENCY } from '@/data/quotationKinds.js';
import { CALL_VIA, JOB_KINDS, WINDOWS } from '@/data/serviceKinds.js';
import { cn } from '@/lib/cn.js';
import { fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { clockTime, durationWords, useNow } from '@/lib/useNow.js';
import { plural } from '@/lib/format.js';
import { addJobPart, removeJobPart } from '@/store/inventoryActions.js';
import { balanceOf } from '@/store/inventorySelectors.js';
import { orderTitle } from '@/data/purchaseRules.js';
import { orderView, ordersOfJob } from '@/store/purchaseSelectors.js';
import { issueLocationOf } from '@/store/stockCore.js';
import { toast } from '@/store/toast.js';
import { passRemaining, setCheckResult, updateJob } from '@/store/serviceActions.js';
import { checklistProgress, deficiencyOfCheck, deviceLabel, unrecordedFails } from '@/store/serviceSelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Badge, Status } from '@/ui/Badge.jsx';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Select, TextArea, TextInput } from '@/ui/Form.jsx';
import { Card, DefinitionList } from '@/ui/Page.jsx';
import { PhotoStrip } from '@/ui/Photos.jsx';
import { OrderBadge } from '@/pages/purchases/parts.jsx';
import { SiteTile } from '@/pages/customers/parts.jsx';
import { mapsUrl, staffName, staffNames, telHref, whoToCall } from './parts.jsx';

// ---- the checklist of a planned visit ---------------------------------------------------------------
const RESULT = [
  { value: 'pass', label: 'Pass', icon: CheckIcon, on: 'bg-green-600 text-white' },
  { value: 'fail', label: 'Fail', icon: XIcon, on: 'bg-red-600 text-white' },
  { value: 'not_tested', label: 'Not tested', icon: MinusIcon, on: 'bg-slate-600 text-white' },
];

function ResultButtons({ value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full rounded-full bg-slate-100 p-0.5 md:inline-flex md:w-auto">
      {RESULT.map((r) => {
        const selected = value === r.value;
        return (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? '' : r.value)}
            className={cn(
              'inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-1.5 text-[13px] font-medium transition-colors duration-150 ease-standard md:h-8 md:flex-none md:px-3 md:text-xs',
              selected ? r.on : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <r.icon className="size-3.5" aria-hidden="true" />
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

const ResultTag = ({ value }) => {
  const tone = { pass: 'green', fail: 'red', not_tested: 'neutral' }[value] ?? 'neutral';
  const text = { pass: 'Pass', fail: 'Fail', not_tested: 'Not tested' }[value] ?? 'Not checked';
  return <Badge tone={tone} dot>{text}</Badge>;
};

function ChecklistPreview({ j }) {
  const s = useStore();
  const today = todayISO();
  const contract = s.contracts[j.contractId];
  const atSite = list(s.devices).filter((d) => d.siteId === j.siteId);
  const covered = contract ? contract.systemIds : list(s.systems).filter((x) => x.siteId === j.siteId).map((x) => x.id);
  const on = j.plannedOn || (j.dueOn > today ? j.dueOn : today);
  const due = dueGroups(atSite, covered, on);
  const rows = due.length > 0 ? due : atSite.filter((d) => covered.includes(d.systemId));
  return (
    <div className="space-y-3 text-sm text-slate-600">
      <p>
        The checklist is made when the visit starts, from the equipment that is due within 45 days of the visit.
        {' '}{due.length > 0 ? `Today that would be ${plural(due.length, 'group')}:` : `Nothing is due now, so the visit would check all the covered equipment (${plural(rows.length, 'group')}):`}
      </p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {rows.slice(0, 6).map((d) => <li key={d.id} className="px-3 py-2 text-slate-800">{deviceLabel(s, d)}</li>)}
        {rows.length > 6 && <li className="px-3 py-2 text-slate-500">and {rows.length - 6} more</li>}
        {rows.length === 0 && <li className="px-3 py-2 text-slate-500">No equipment is registered for this contract.</li>}
      </ul>
    </div>
  );
}

export function ChecklistCard({ j, editable, canRecord, onRecord }) {
  const s = useStore();
  const p = checklistProgress(j);
  const started = j.checklist.length > 0;
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <Card
      title="Checklist"
      action={editable && p.done < p.total && <Button size="xs" icon={CheckIcon} onClick={() => passRemaining(j.id)}>Mark the rest as pass</Button>}
    >
      {!started ? (
        <ChecklistPreview j={j} />
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
            <span>{p.done} of {p.total} checked{p.failed ? ` · ${p.failed} failed` : ''}</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className={cn('h-full rounded-full transition-[width] duration-200', p.failed ? 'bg-orange-500' : 'bg-slate-900')} style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-2 divide-y divide-slate-100">
            {j.checklist.map((row) => {
              const def = deficiencyOfCheck(s, j, row);
              return (
                <li key={row.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <p className="min-w-0 flex-1 basis-56 text-sm text-slate-900">{row.label}</p>
                    {editable ? (
                      <ResultButtons value={row.result} label={`Result for ${row.label}`} onChange={(result) => setCheckResult(j.id, row.id, { result })} />
                    ) : (
                      <ResultTag value={row.result} />
                    )}
                  </div>
                  {row.result === 'fail' && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {editable ? (
                        <TextInput
                          aria-label={`What failed: ${row.label}`}
                          value={row.note}
                          onChange={(note) => setCheckResult(j.id, row.id, { note })}
                          placeholder="What failed?"
                          className="!h-9 min-w-0 flex-1 basis-64"
                        />
                      ) : (
                        <p className="min-w-0 flex-1 basis-64 text-sm text-slate-600">{row.note || 'No note'}</p>
                      )}
                      {def ? (
                        <Link to={`/service/deficiencies/${def.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 underline underline-offset-2">
                          <TriangleAlertIcon className="size-3.5 text-orange-600" aria-hidden="true" />{def.number}
                        </Link>
                      ) : canRecord ? (
                        <Button size="xs" icon={PlusIcon} onClick={() => onRecord(row)}>Record deficiency</Button>
                      ) : (
                        <Badge tone="orange">No deficiency recorded</Badge>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

// ---- findings and the deficiencies found in this job -----------------------------------------------------
export function FindingsCard({ j, editable, canRecord, onRecord }) {
  const s = useStore();
  const { user } = useSession();
  const found = list(s.deficiencies).filter((d) => d.jobId === j.id);
  return (
    <Card
      title="Findings and deficiencies"
      action={canRecord && <Button size="xs" icon={PlusIcon} onClick={() => onRecord(null)}>Record deficiency</Button>}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">What was found and done</p>
          {editable ? (
            <TextArea
              aria-label="What was found and done"
              value={j.findings}
              onChange={(findings) => updateJob(j.id, { findings })}
              rows={4}
              placeholder="Say what you saw, what you did, and what still has to be done."
            />
          ) : (
            <p className="whitespace-pre-line text-sm text-slate-800">{j.findings || <span className="text-slate-400">Nothing written.</span>}</p>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">Photos</p>
          <PhotoStrip photos={j.photos ?? []} editable={editable} by={user.id} onChange={(photos) => updateJob(j.id, { photos })} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">Deficiencies found in this job</p>
          {found.length === 0 ? (
            <p className="text-sm text-slate-500">None recorded.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {found.map((d) => (
                <li key={d.id}>
                  <Link to={`/service/deficiencies/${d.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 hover:bg-slate-50">
                    <span className="text-sm font-medium tabular-nums text-slate-900">{d.number}</span>
                    <span className="min-w-0 flex-1 basis-48 truncate text-sm text-slate-700">{d.title}</span>
                    <Status kind="severity" value={d.severity} dot={false} />
                    <Status kind="deficiency" value={d.status} dot={false} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---- parts and time -------------------------------------------------------------------------------------------
export function PartsTimeCard({ j, editable }) {
  const s = useStore();
  const [item, setItem] = useState('');
  const [qty, setQty] = useState('1');
  const [who, setWho] = useState(j.assigneeIds[0] ?? '');
  const [hours, setHours] = useState('1');
  const from = issueLocationOf(s, j); // the van of the first person on the job with one, else the store
  const items = list(s.items)
    .filter((i) => i.active && i.kind === 'material')
    .map((i) => ({ value: i.id, label: i.name, sub: i.stocked ? `${i.code} · ${balanceOf(s, i.id, from)} in ${s.locations[from]?.name.split(' (')[0]}` : `${i.code} · not kept in stock` }));
  const staff = list(s.staff).filter((p) => ['technician', 'engineer'].includes(p.roleKey));
  const totalHours = j.labour.reduce((sum, r) => sum + r.hours, 0);

  const addPart = () => {
    const it = s.items[item];
    if (!it || !(Number(qty) > 0)) return;
    const result = addJobPart(j.id, { itemId: it.id, qty: Number(qty) });
    if (result.short) toast(`${result.name} did not have that many: recorded, and the van needs a count`, { tone: 'error' });
    setItem('');
    setQty('1');
  };
  const addTime = () => {
    if (!who || !(Number(hours) > 0)) return;
    updateJob(j.id, { labour: [...j.labour, { staffId: who, hours: Number(hours) }] });
    setHours('1');
  };
  if (!editable && j.parts.length === 0 && j.labour.length === 0) return null;

  return (
    <Card title="Parts used and time">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">Parts used</p>
          {j.parts.length === 0 ? (
            <p className="text-sm text-slate-500">None recorded.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {j.parts.map((r) => (
                <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-slate-900">{r.description}</span>
                    {r.fromId && <span className="block truncate text-xs text-slate-500">From {s.locations[r.fromId]?.name}</span>}
                  </span>
                  <span className="tabular-nums text-slate-600">{r.qty} {r.unit}</span>
                  {editable && <IconButton icon={XIcon} label={`Remove ${r.description}`} size="xs" onClick={() => removeJobPart(j.id, r.id)} />}
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 basis-44">
                <Combobox options={items} noun="items" placeholder="Choose a part" searchPlaceholder="Search the catalogue" value={item} onChange={setItem} />
              </div>
              <TextInput aria-label="Quantity" inputMode="decimal" value={qty} onChange={setQty} className="!h-10 !w-16 text-center" />
              <Button icon={PlusIcon} onClick={addPart} disabled={!item}>Add</Button>
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">Time on site</p>
          {j.labour.length === 0 ? (
            <p className="text-sm text-slate-500">None recorded.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {j.labour.map((r, i) => (
                <li key={`${r.staffId}-${i}`} className="flex items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-900">{staffName(s, r.staffId)}</span>
                  <span className="tabular-nums text-slate-600">{r.hours} h</span>
                  {editable && <IconButton icon={XIcon} label={`Remove time of ${staffName(s, r.staffId)}`} size="xs" onClick={() => updateJob(j.id, { labour: j.labour.filter((_, k) => k !== i) })} />}
                </li>
              ))}
              <li className="flex justify-between py-2 text-sm font-medium text-slate-900"><span>Total</span><span className="tabular-nums">{totalHours} h</span></li>
            </ul>
          )}
          {editable && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 basis-40">
                <Select
                  aria-label="Person"
                  value={who}
                  onChange={setWho}
                  placeholder="Choose a person"
                  options={[...j.assigneeIds.map((id) => ({ value: id, label: staffName(s, id) })), ...staff.filter((p) => !j.assigneeIds.includes(p.id)).map((p) => ({ value: p.id, label: p.name }))]}
                />
              </div>
              <TextInput aria-label="Hours" inputMode="decimal" value={hours} onChange={setHours} className="!h-10 !w-16 text-center" />
              <Button icon={PlusIcon} onClick={addTime} disabled={!who}>Add</Button>
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">Parts kept in stock come out of {s.locations[from]?.name ?? 'the store'}, the van of the first technician on the job, and are counted in Inventory. The time goes to the cost of the job (step 7).</p>
    </Card>
  );
}

// ---- the facts of the job -------------------------------------------------------------------------------------------
export function DetailsCard({ j }) {
  const s = useStore();
  const today = todayISO();
  const customer = s.customers[j.customerId];
  const site = s.sites[j.siteId];
  const contract = s.contracts[j.contractId];
  const quotation = s.quotations[j.quotationId];
  const deficiencies = j.deficiencyIds.map((id) => s.deficiencies[id]).filter(Boolean);
  const link = (to, text) => <Link className="font-medium hover:underline" to={to}>{text}</Link>;
  return (
    <Card title="Details">
      <DefinitionList
        cols={1}
        items={[
          { label: 'Kind', value: JOB_KINDS[j.kind].label },
          { label: 'Customer', value: customer && link(`/customers/${customer.id}`, customer.name) },
          { label: 'Site', value: site && link(`/customers/sites/${site.id}`, site.name) },
          { label: 'Contract', value: contract ? link(`/service/${contract.id}`, contract.number) : <span className="text-orange-800">No contract: chargeable</span> },
          quotation && { label: 'Quotation', value: link(`/sales/quotations/${quotation.id}`, quotation.number) },
          deficiencies.length > 0 && { label: 'Deficiency', value: <span className="flex flex-col gap-0.5">{deficiencies.map((d) => <span key={d.id}>{link(`/service/deficiencies/${d.id}`, d.number)}</span>)}</span> },
          { label: 'Urgency', value: j.urgency === 'normal' ? URGENCY.normal : <Badge tone={j.urgency === 'emergency' ? 'red' : 'orange'}>{URGENCY[j.urgency]}</Badge> },
          { label: 'Needed by', value: j.dueOn && `${fmtDate(j.dueOn)} (${relDays(j.dueOn, today)})` },
          { label: 'Planned', value: j.plannedOn && `${fmtDate(j.plannedOn)}${j.window ? ` · ${WINDOWS[j.window]}` : ''}` },
          { label: 'People', value: j.assigneeIds.length > 0 && staffNames(s, j.assigneeIds) },
          j.startedOn && { label: 'Started', value: j.startedAt ? `${fmtDate(j.startedOn)}, ${clockTime(j.startedAt)}` : fmtDate(j.startedOn) },
          j.completedOn && { label: 'Completed', value: fmtDate(j.completedOn) },
        ]}
      />
    </Card>
  );
}

// ---- what was reported, for call-outs --------------------------------------------------------------------------------------
export function ReportedCard({ j }) {
  if (!j.callInfo && !j.description) return null;
  return (
    <Card title={j.callInfo ? 'What the customer reported' : 'About this job'}>
      <div className="space-y-3 text-sm text-slate-800">
        {j.callInfo && (
          <>
            <p className="whitespace-pre-line">{j.callInfo.fault}</p>
            <p className="text-xs text-slate-500">Reported by {j.callInfo.reportedBy || 'the customer'} · {CALL_VIA[j.callInfo.via] ?? j.callInfo.via} · {fmtDate(j.requestedOn)}</p>
          </>
        )}
        {j.description && j.description !== j.callInfo?.fault && <p className="whitespace-pre-line">{j.description}</p>}
      </div>
    </Card>
  );
}

// ---- signature, report and certificate --------------------------------------------------------------------------------------
export function SignoffCard({ j, canAct, onSign, onIssue, onSend, onOpenReport }) {
  const s = useStore();
  const done = ['completed', 'report_sent'].includes(j.status);
  const unrecorded = unrecordedFails(s, j).length;
  const cert = s.certificates[j.report?.certificateId];
  const sent = j.report?.sentTo?.map((id) => s.contacts[id]?.name).filter(Boolean).join(', ');
  return (
    <Card title="Sign-off">
      {!done ? (
        <p className="text-sm text-slate-500">After the work is complete, the customer signs and the service report is issued and sent.</p>
      ) : (
        <div className="space-y-5 text-sm">
          <section>
            <h3 className="text-xs font-medium text-slate-500">Customer's signature</h3>
            {j.signature ? (
              <div className="mt-1.5">
                {j.signature.path && (
                  <svg viewBox="0 0 400 140" className="h-16 w-auto max-w-full rounded-lg bg-slate-50" role="img" aria-label={`Signature of ${j.signature.name}`}>
                    <path d={j.signature.path} fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <p className="mt-1 font-medium text-slate-900">{j.signature.name}</p>
                <p className="text-xs text-slate-500">{[j.signature.role, fmtDate(j.signature.on)].filter(Boolean).join(' · ')}</p>
              </div>
            ) : (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <p className="text-slate-600">Not signed yet.</p>
                {canAct && <Button size="xs" icon={PenLineIcon} onClick={onSign}>Get signature</Button>}
              </div>
            )}
          </section>
          <section>
            <h3 className="text-xs font-medium text-slate-500">Service report</h3>
            {j.report ? (
              <div className="mt-1.5 space-y-1">
                <p className="font-medium tabular-nums text-slate-900">{j.report.number}</p>
                <p className="text-xs text-slate-500">Issued {fmtDate(j.report.issuedOn)}</p>
                {j.report.sentOn ? <p className="text-xs text-green-800">Sent {fmtDate(j.report.sentOn)}{sent ? ` to ${sent}` : ''}</p> : <p className="text-xs text-orange-800">Not sent to the customer yet.</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="xs" icon={FileTextIcon} onClick={onOpenReport}>Open report</Button>
                  {canAct && !j.report.sentOn && <Button size="xs" variant="primary" icon={SendIcon} onClick={onSend}>Send to customer</Button>}
                </div>
              </div>
            ) : (
              <div className="mt-1.5 space-y-2">
                <p className="text-slate-600">{j.signature ? 'Ready to be issued.' : 'Needs the signature first.'}</p>
                {unrecorded > 0 && <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-950">{plural(unrecorded, 'failed item')} not recorded as a deficiency. Record {unrecorded === 1 ? 'it' : 'them'} before the report is issued.</p>}
                {canAct && j.signature && <Button size="xs" variant="primary" icon={FileTextIcon} onClick={onIssue}>Issue service report</Button>}
              </div>
            )}
          </section>
          {cert && (
            <section>
              <h3 className="text-xs font-medium text-slate-500">Maintenance certificate</h3>
              <p className="mt-1.5 font-medium tabular-nums text-slate-900">{cert.number}</p>
              <p className="text-xs text-slate-500">Next visit due {fmtDate(cert.nextDue)} ({relDays(cert.nextDue)})</p>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}

// ---- where to go and whom to ask for ------------------------------------------------------------------------------
// The first thing a technician needs on the way: the address, a button that opens
// the maps, the person to call, and how to get in.
export function WhereCard({ j }) {
  const s = useStore();
  const site = s.sites[j.siteId];
  const contact = whoToCall(s, j);
  if (!site) return null;
  const address = [site.address, site.area, site.emirate].filter(Boolean).join(', ');
  return (
    <Card title="Where and who">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <SiteTile className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{site.name}</p>
            <p className="text-sm text-slate-600">{address}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button href={mapsUrl(site)} target="_blank" rel="noreferrer" icon={NavigationIcon}>Navigate</Button>
          {contact?.phone ? <Button href={telHref(contact.phone)} icon={PhoneIcon}>Call {contact.name.split(' ')[0]}</Button> : <span />}
        </div>
        {contact && <p className="text-xs text-slate-500">{contact.name}, {contact.title}{contact.phone ? ` · ${contact.phone}` : ''}</p>}
        {site.access && (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Getting in</p>
            <p className="mt-0.5">{site.access}</p>
          </div>
        )}
        {j.description && j.description !== j.callInfo?.fault && (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">For this job</p>
            <p className="mt-0.5 whitespace-pre-line">{j.description}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

// "On site 1 h 05 min", counted from the moment the job was started.
export function OnSiteTimer({ j }) {
  const now = useNow(30000);
  if (!j.startedAt || j.status !== 'in_progress') return null;
  return (
    <Badge tone="violet">
      <ClockIcon className="size-3" aria-hidden="true" />
      On site {durationWords(now - Date.parse(j.startedAt))}
    </Badge>
  );
}

// ---- parts ordered for this job ------------------------------------------------------------------------------------
export function JobOrdersCard({ j }) {
  const s = useStore();
  const { may } = useSession();
  const orders = ordersOfJob(s, j.id).map((po) => orderView(s, po)).toSorted((a, b) => b.po.number.localeCompare(a.po.number));
  const canOrder = may('request_purchase') && !['report_sent', 'cancelled'].includes(j.status);
  if (orders.length === 0 && !canOrder) return null;
  return (
    <Card title="Parts ordered for this job" action={canOrder && <Button size="xs" icon={PlusIcon} to={`/purchases/new?job=${j.id}`}>Order a part</Button>}>
      {orders.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing is ordered for this job. A part that is not in the van is ordered here, so its cost is on the job.</p>
      ) : (
        <ul className="-my-2 divide-y divide-slate-100">
          {orders.map((v) => (
            <li key={v.po.id}>
              <Link to={`/purchases/${v.po.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="w-28 shrink-0 text-sm font-medium tabular-nums text-slate-900">{v.po.number}</span>
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate text-sm text-slate-800">{orderTitle(v.po)}</span>
                  <span className="block truncate text-xs text-slate-500">{v.supplier?.name}{v.po.expectedOn ? ` · expected ${fmtDate(v.po.expectedOn)}` : ''}</span>
                </span>
                <OrderBadge v={v} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
