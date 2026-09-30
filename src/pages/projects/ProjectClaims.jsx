import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PlusIcon } from 'lucide-react';
import { amountOf, certifiedFigures, claimedTotal, contractValue, netOf, paidTotal, progressClaims, retentionHeld } from '@/data/projectRules.js';
import { addDays, addMonths, diffDays, fmtDate, todayISO } from '@/lib/dates.js';
import { aed, money } from '@/lib/format.js';
import { createInvoiceFromSource } from '@/store/billingActions.js';
import { invoiceView } from '@/store/billingSelectors.js';
import { certifyClaim, createProgressClaim, deleteClaim, releaseRetention, submitClaim } from '@/store/projectActions.js';
import { claimLabel, claimView, draftClaim, sinceLastClaim } from '@/store/projectSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Field, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { Modal } from '@/ui/Overlay.jsx';
import { EmptyState } from '@/ui/Page.jsx';
import { ProgressBar, Stat } from './parts.jsx';

const previousNetOf = (p, c) => {
  const before = progressClaims(p).filter((x) => x.status !== 'draft' && x.n < c.n).at(-1);
  return before ? netOf(before) : 0;
};

function CertifyDialog({ p, c, onClose }) {
  const isProgress = c.kind === 'progress';
  const form = useForm(
    { gross: String(c.gross ?? 0), note: '' },
    (v) => (isProgress && !(Number(v.gross) > 0 && Number(v.gross) <= c.gross * 1.5) ? { gross: 'Write the certified value of the work.' } : {}),
  );
  const preview = isProgress && Number(form.values.gross) > 0 ? certifiedFigures(p, { ...c, certifiedGross: Number(form.values.gross) }, previousNetOf(p, c)) : null;
  const go = form.submit((v) => {
    certifyClaim(p.id, c.id, { certifiedGross: Number(v.gross), note: v.note.trim() });
    toast('Certificate recorded');
    onClose();
  });
  return (
    <Modal open onClose={onClose} title={`Certificate for ${claimLabel(p, c)}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Record the certificate</Button></>}>
      <form onSubmit={go} className="mt-3 grid grid-cols-1 gap-4">
        {isProgress ? (
          <>
            <p className="text-sm text-slate-600">The customer's engineer certifies the value of the work done. It may be less than the {aed(c.gross)} that was claimed.</p>
            <Field label="Certified value of the work done to date" required error={form.error('gross')}><TextInput {...form.bind('gross')} prefix="AED" inputMode="decimal" /></Field>
            {preview && <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">Payable for this claim: <strong className="font-semibold tabular-nums">{aed(preview.amount)}</strong> <span className="text-slate-500">(claimed {aed(c.amount)})</span></p>}
          </>
        ) : (
          <p className="text-sm text-slate-600">The customer confirms the amount of {aed(c.amount)}.</p>
        )}
        <Field label="Note"><TextArea {...form.bind('note')} rows={2} placeholder="For example Levels 19 to 22 not accepted yet." /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function ClaimCard({ p, c, manage, onCertify }) {
  const s = useStore();
  const navigate = useNavigate();
  const { may, access } = useSession();
  const view = claimView(p, c);
  const [open, setOpen] = useState(c.status === 'draft');
  const inv = c.invoiceId ? s.invoices[c.invoiceId] : null;
  const invState = inv?.status === 'issued' ? invoiceView(s, inv) : null;
  const makeInvoice = () => {
    const id = createInvoiceFromSource({ kind: 'claim', projectId: p.id, claimId: c.id });
    if (!inv) toast('Draft invoice made: check it and issue it');
    navigate(`/billing/${id}`);
  };
  const prev = c.status === 'draft' ? progressClaims(p).filter((x) => x.status !== 'draft').at(-1) : progressClaims(p).filter((x) => x.status !== 'draft' && x.n < c.n).at(-1);
  const previous = prev ? netOf(prev) : 0;
  const isProgress = c.kind === 'progress';
  const progress = c.status === 'draft' ? Object.fromEntries(p.packages.map((x) => [x.id, x.progress])) : c.progress;
  const certified = ['certified', 'invoiced', 'paid'].includes(c.status);
  const differs = certified && isProgress && c.certAmount !== c.amount;
  return (
    <li className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-900">{claimLabel(p, c)}</span>
        <Status kind="claim" value={c.status} dot={false} />
        <span className="ml-auto text-base font-semibold tabular-nums text-slate-900">{aed(amountOf(view.live ? { amount: view.amount } : c))}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {[
          c.periodEnd && `Work up to ${fmtDate(c.periodEnd)}`, c.submittedOn && `submitted ${fmtDate(c.submittedOn)}`, c.certifiedOn && `certified ${fmtDate(c.certifiedOn)}`,
          c.invoiceRef && c.invoiceRef, c.paidOn && `paid ${fmtDate(c.paidOn)}`,
        ].filter(Boolean).join(' · ') || 'Not submitted yet'}
      </p>
      {c.note && <p className="mt-1 text-xs text-slate-600">{c.note}</p>}
      {differs && <p className="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-950">Claimed {aed(c.amount)}, certified {aed(c.certAmount)}: the customer's engineer certified less.</p>}

      {isProgress && (
        <>
          <dl className="mt-3 grid grid-cols-1 gap-y-1.5 text-sm sm:max-w-md">
            {[
              ['Work done to date', money(view.gross)],
              [`Less retention (${p.retentionPct}%)`, `− ${money(view.retention)}`],
              ['Less advance paid back', `− ${money(view.advance)}`],
              ['Net to date', money(view.net)],
              ['Less earlier claims', `− ${money(previous)}`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4"><dt className="text-slate-600">{label}</dt><dd className="tabular-nums text-slate-900">{value}</dd></div>
            ))}
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-1.5 font-semibold"><dt>This claim</dt><dd className="tabular-nums">{money(view.amount)}</dd></div>
          </dl>
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-3 text-xs font-medium text-slate-700 underline underline-offset-2">{open ? 'Hide the working' : 'Show the working'}</button>
          {open && (
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {p.packages.map((pkg) => (
                <li key={pkg.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-3 py-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                  <span className="min-w-0 truncate text-slate-800">{pkg.title}</span>
                  <ProgressBar value={progress[pkg.id] ?? 0} className="max-md:col-span-2 max-md:row-start-2" />
                  <span className="text-right tabular-nums text-slate-700">{money((pkg.value * (progress[pkg.id] ?? 0)) / 100)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {c.kind === 'advance' && <p className="mt-2 text-sm text-slate-600">{p.advancePct}% of the original contract value. It is paid back with the work: every progress claim takes a share of it off.</p>}
      {c.kind === 'retention' && <p className="mt-2 text-sm text-slate-600">The retention that was held back from the progress claims, released at the end of the defects liability period.</p>}

      {manage && (
        <div className="mt-3 flex flex-wrap gap-2">
          {c.status === 'draft' && <Button size="xs" variant="primary" onClick={() => { submitClaim(p.id, c.id); toast('Claim submitted to the customer: its figures are now fixed'); }}>Submit to the customer</Button>}
          {c.status === 'draft' && isProgress && <Button size="xs" variant="danger-ghost" onClick={() => deleteClaim(p.id, c.id)}>Delete the draft</Button>}
          {c.status === 'submitted' && <Button size="xs" variant="primary" onClick={onCertify}>Record the certificate</Button>}
        </div>
      )}
      {c.status === 'certified' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {may('issue_invoices')
            ? <Button size="xs" variant="primary" onClick={makeInvoice}>{inv ? 'Open the invoice draft' : 'Make invoice'}</Button>
            : <p className="text-xs text-slate-500">Certified: Accounts makes the invoice{inv ? ' (a draft is ready)' : ''}.</p>}
        </div>
      )}
      {['invoiced', 'paid'].includes(c.status) && inv && (
        <p className="mt-2 text-sm text-slate-700">
          Invoice {access('billing') ? <Link to={`/billing/${inv.id}`} className="font-medium tabular-nums underline-offset-2 hover:underline">{inv.number}</Link> : <span className="font-medium tabular-nums">{inv.number}</span>}
          {invState && (invState.state === 'paid' ? ': paid.' : `: AED ${money(invState.balance)} still owed${invState.state === 'overdue' ? `, ${invState.overdueDays} days overdue` : ''}.`)}
        </p>
      )}
    </li>
  );
}

export function ProjectClaims({ p, manage, boss }) {
  const [certifying, setCertifying] = useState(null);
  const today = todayISO();
  const draft = draftClaim(p);
  const since = sinceLastClaim(p);
  const canMake = manage && !draft && ['installation', 'testing', 'handover'].includes(p.phase);
  const certifiedTotal = p.claims.filter((c) => ['certified', 'invoiced', 'paid'].includes(c.status)).reduce((n, c) => n + amountOf(c), 0);
  const sorted = p.claims.toSorted((a, b) => b.n - a.n);
  const dlpOver = p.phase === 'retention' && diffDays(today, p.handover.dlpEnd) <= 0;
  const releaseMade = p.claims.some((c) => c.kind === 'retention');
  const monthEnd = addDays(addMonths(`${today.slice(0, 7)}-01`, 1), -1);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-slate-600">
          The customer pays by claims: an advance at the start, progress claims for the work done (each one cumulative, less the retention and the advance paid back), and the retention at the end. A claim is submitted, certified by the customer's engineer, invoiced and paid.
        </p>
        {canMake && (
          <Button icon={PlusIcon} onClick={() => { createProgressClaim(p.id, monthEnd); toast('Progress claim started as a draft'); }} disabled={since <= 0} title={since <= 0 ? 'No new work since the last claim' : undefined}>Make progress claim</Button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Contract value" amount={contractValue(p)} />
        <Stat label="Claimed" amount={claimedTotal(p)} />
        <Stat label="Certified" amount={certifiedTotal} />
        <Stat label="Paid" amount={paidTotal(p)} />
        <Stat label="Retention held" amount={retentionHeld(p)} sub={p.handover.dlpEnd ? `until ${fmtDate(p.handover.dlpEnd)}` : `${p.retentionPct}% of the work claimed`} />
      </dl>
      {p.phase === 'retention' && !releaseMade && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <span className="min-w-0 flex-1">
            {dlpOver ? 'The defects liability period is over.' : `The defects liability period ends ${fmtDate(p.handover.dlpEnd)}.`} The retention of {aed(retentionHeld(p))} can be claimed{dlpOver ? ' now' : ' then, or earlier by agreement with the customer'}.
          </span>
          {manage && (dlpOver || boss) && <Button size="xs" variant={dlpOver ? 'primary' : 'secondary'} onClick={() => { releaseRetention(p.id, !dlpOver); toast('Retention release claim made'); }}>{dlpOver ? 'Release the retention' : 'Release early'}</Button>}
        </div>
      )}
      {p.claims.length === 0 ? (
        <EmptyState title="No claim yet">The advance claim is made when the project starts.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {sorted.map((c) => <ClaimCard key={c.id} p={p} c={c} manage={manage && p.phase !== 'complete'} onCertify={() => setCertifying(c)} />)}
        </ul>
      )}
      {certifying && <CertifyDialog p={p} c={p.claims.find((x) => x.id === certifying.id) ?? certifying} onClose={() => setCertifying(null)} />}
    </div>
  );
}
