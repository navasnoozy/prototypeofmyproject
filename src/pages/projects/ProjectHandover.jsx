import { useState } from 'react';
import { Link } from 'react-router';
import { CheckIcon, CircleCheckIcon, CircleIcon, KeyRoundIcon, PlusIcon, XIcon } from 'lucide-react';
import { SYSTEM_TYPES } from '@/data/catalog.js';
import { cn } from '@/lib/cn.js';
import { fmtDate, todayISO } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { addSnag, recordCdCertificate, recordTest, requestCivilDefence, setSnagStatus } from '@/store/projectActions.js';
import { handoverChecks, readyToHandOver } from '@/store/projectSelectors.js';
import { quotationLabel } from '@/store/salesSelectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Badge } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Field, TextInput } from '@/ui/Form.jsx';
import { Card, DefinitionList } from '@/ui/Page.jsx';

function PassFail({ value, onChange, label }) {
  const options = [
    { value: 'pass', label: 'Pass', icon: CheckIcon, on: 'bg-green-600 text-white' },
    { value: 'fail', label: 'Fail', icon: XIcon, on: 'bg-red-600 text-white' },
  ];
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-slate-100 p-0.5">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(on ? '' : o.value)}
            className={cn('inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors duration-150 md:h-8', on ? o.on : 'text-slate-600 hover:text-slate-900')}
          >
            <o.icon className="size-3.5" aria-hidden="true" />{o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProjectHandover({ p, manage, onHandOver }) {
  const s = useStore();
  const [snag, setSnag] = useState({ title: '', location: '' });
  const [cert, setCert] = useState({ open: false, ref: '', on: todayISO() });
  const checks = handoverChecks(p);
  const ready = readyToHandOver(p);
  const working = manage && ['installation', 'testing', 'handover'].includes(p.phase);
  const byType = p.tests.reduce((m, t) => ({ ...m, [t.systemType]: [...(m[t.systemType] ?? []), t] }), {});
  const handedOver = Boolean(p.handover.handedOverOn);
  const contract = s.contracts[p.handover.contractId];
  const offer = s.quotations[p.handover.contractQuotationId];

  const addNewSnag = () => {
    if (snag.title.trim().length < 3) return;
    addSnag(p.id, { title: snag.title.trim(), location: snag.location.trim() });
    setSnag({ title: '', location: '' });
  };

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-slate-600">
        Before the customer takes over: every system passes its acceptance tests, the snags are closed, the authority has inspected, and the documents are issued. The handover then writes the systems into the equipment register and starts the defects liability period.
      </p>

      {handedOver ? (
        <Card title="Handover record">
          <DefinitionList
            items={[
              { label: 'Handed over', value: fmtDate(p.handover.handedOverOn) },
              { label: 'Taken over by', value: `${p.handover.receivedBy}${p.handover.receivedRole ? `, ${p.handover.receivedRole}` : ''}` },
              p.handover.cdCertificate && { label: 'Civil Defence completion certificate (sample)', value: `${p.handover.cdCertificate.ref}, ${fmtDate(p.handover.cdCertificate.on)}` },
              { label: 'Defects liability ends', value: fmtDate(p.handover.dlpEnd) },
              {
                label: 'Systems in the register', span: 2,
                value: p.handover.systemIds.length > 0 ? (
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    {p.handover.systemIds.map((id) => s.systems[id] && (
                      <Link key={id} className="font-medium hover:underline" to={`/customers/sites/${p.siteId}?tab=equipment`}>{s.systems[id].name}</Link>
                    ))}
                  </span>
                ) : 'None',
              },
              {
                label: 'Maintenance contract', span: 2,
                value: contract ? <Link className="font-medium hover:underline" to={`/service/${contract.id}`}>{contract.number}</Link>
                  : offer ? <span>Offered: <Link className="font-medium hover:underline" to={`/sales/quotations/${offer.id}`}>{quotationLabel(offer)}</Link></span> : 'Not offered',
              },
            ]}
          />
        </Card>
      ) : (
        <Card
          title="Handover checklist"
          action={manage && ['handover'].includes(p.phase) && <Button size="xs" variant={ready ? 'primary' : 'secondary'} icon={KeyRoundIcon} onClick={onHandOver} disabled={!ready}>Hand over</Button>}
        >
          <ul className="-my-1.5 divide-y divide-slate-100">
            {checks.map((c) => (
              <li key={c.key} className="flex items-center gap-3 py-3">
                {c.ok ? <CircleCheckIcon className="size-5 shrink-0 text-green-600" aria-hidden="true" /> : <CircleIcon className="size-5 shrink-0 text-slate-300" aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-900">{c.label}</span>
                  <span className="block text-xs text-slate-500">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          {p.phase !== 'handover' && <p className="mt-3 text-xs text-slate-500">The handover is offered when the project reaches the handover phase.</p>}
        </Card>
      )}

      <Card title="Acceptance tests">
        {p.tests.length === 0 ? (
          <p className="text-sm text-slate-500">This project installs no system that needs an acceptance test.</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(byType).map(([type, tests]) => (
              <section key={type}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{SYSTEM_TYPES[type]?.label ?? type} <span className="font-normal normal-case">· {SYSTEM_TYPES[type]?.standard}</span></h3>
                <ul className="divide-y divide-slate-100">
                  {tests.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                      <span className="min-w-0 flex-1 basis-64 text-sm text-slate-900">{t.title}</span>
                      {t.on && <span className="text-xs text-slate-500">{fmtDate(t.on)}{t.by ? ` · ${s.staff[t.by]?.name}` : ''}</span>}
                      {working ? (
                        <PassFail value={t.result} label={`Result of ${t.title}`} onChange={(result) => recordTest(p.id, t.id, { result })} />
                      ) : (
                        <Badge tone={t.result === 'pass' ? 'green' : t.result === 'fail' ? 'red' : 'neutral'} dot>{t.result === 'pass' ? 'Passed' : t.result === 'fail' ? 'Failed' : 'Not tested'}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Sample test lists from the standards named in the study; the consultant's specification of each project decides the real list.</p>
      </Card>

      <Card title={`Snag list (${plural(p.snags.filter((x) => x.status === 'open').length, 'open snag')})`}>
        {p.snags.length === 0 && <p className="text-sm text-slate-500">No snag raised.</p>}
        <ul className="-my-1 divide-y divide-slate-100">
          {p.snags.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="min-w-0 flex-1 basis-64">
                <span className={cn('block text-sm', x.status === 'closed' ? 'text-slate-500 line-through' : 'text-slate-900')}>{x.title}</span>
                <span className="block text-xs text-slate-500">{x.location ? `${x.location} · ` : ''}raised {fmtDate(x.raisedOn)}{x.closedOn ? `, closed ${fmtDate(x.closedOn)}` : ''}</span>
              </span>
              <Badge tone={x.status === 'open' ? 'orange' : 'green'} dot>{x.status === 'open' ? 'Open' : 'Closed'}</Badge>
              {working && <Button size="xs" onClick={() => setSnagStatus(p.id, x.id, x.status === 'open' ? 'closed' : 'open')}>{x.status === 'open' ? 'Close' : 'Reopen'}</Button>}
            </li>
          ))}
        </ul>
        {working && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-60"><TextInput aria-label="Snag" value={snag.title} onChange={(title) => setSnag((v) => ({ ...v, title }))} placeholder="What is not right" className="!h-10" /></div>
            <div className="min-w-0 basis-40"><TextInput aria-label="Where" value={snag.location} onChange={(location) => setSnag((v) => ({ ...v, location }))} placeholder="Where" className="!h-10" /></div>
            <Button icon={PlusIcon} onClick={addNewSnag} disabled={snag.title.trim().length < 3}>Raise snag</Button>
          </div>
        )}
      </Card>

      <Card title="Civil Defence completion (sample)">
        {p.cdApproval !== 'contractor' ? (
          <p className="text-sm text-slate-600">The customer handles the completion certificate of the building.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <DefinitionList
              items={[
                { label: 'Inspection requested', value: p.handover.cdRequestedOn ? fmtDate(p.handover.cdRequestedOn) : 'Not yet' },
                { label: 'Completion certificate', value: p.handover.cdCertificate ? `${p.handover.cdCertificate.ref}, ${fmtDate(p.handover.cdCertificate.on)}` : 'Not received yet' },
              ]}
            />
            {working && (
              <div className="flex flex-wrap items-end gap-2">
                {!p.handover.cdRequestedOn && <Button onClick={() => { requestCivilDefence(p.id); toast('Inspection requested from the Civil Defence'); }}>Request the inspection</Button>}
                {!p.handover.cdCertificate && !cert.open && <Button variant={p.handover.cdRequestedOn ? 'primary' : 'secondary'} onClick={() => setCert((c) => ({ ...c, open: true }))}>Record the certificate</Button>}
                {!p.handover.cdCertificate && cert.open && (
                  <>
                    <Field label="Reference" className="w-48"><TextInput value={cert.ref} onChange={(ref) => setCert((c) => ({ ...c, ref }))} placeholder="CD-COC-00000" /></Field>
                    <Field label="Date" className="w-44"><TextInput type="date" value={cert.on} onChange={(on) => setCert((c) => ({ ...c, on }))} /></Field>
                    <Button variant="primary" disabled={!cert.ref.trim()} onClick={() => { recordCdCertificate(p.id, { ref: cert.ref.trim(), on: cert.on }); toast('Certificate recorded'); setCert({ open: false, ref: '', on: todayISO() }); }}>Save</Button>
                    <Button onClick={() => setCert((c) => ({ ...c, open: false }))}>Cancel</Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
