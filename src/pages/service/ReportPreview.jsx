import { PrinterIcon } from 'lucide-react';
import { SYSTEM_TYPES } from '@/data/catalog.js';
import { COMPANY } from '@/data/seed/staff.js';
import { JOB_KINDS, SEVERITY } from '@/data/serviceKinds.js';
import { fmtDate } from '@/lib/dates.js';
import { list } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { Button } from '@/ui/Button.jsx';
import { staffName, staffNames } from './parts.jsx';

const RESULT = { pass: 'Pass', fail: 'Fail', not_tested: 'Not tested', '': 'Not checked' };
const Heading = ({ children }) => <h2 className="mb-2 mt-7 text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;

// The service report as the customer receives it, and the maintenance
// certificate on its own page when one was issued. Printing hides the frame.
export function ReportPreview({ j }) {
  const s = useStore();
  const customer = s.customers[j.customerId];
  const site = s.sites[j.siteId];
  const contact = j.callInfo ? list(s.contacts).find((c) => c.name === j.callInfo.reportedBy && c.customerId === j.customerId) : null;
  const cert = s.certificates[j.report?.certificateId];
  const found = list(s.deficiencies).filter((d) => d.jobId === j.id);
  const contract = s.contracts[j.contractId];
  const totalHours = j.labour.reduce((sum, r) => sum + r.hours, 0);
  const systems = j.systemIds.map((id) => s.systems[id]).filter(Boolean);

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {j.report ? 'This is the report the customer receives.' : 'A draft: the report gets its number when it is issued.'}
        </p>
        <Button icon={PrinterIcon} onClick={() => window.print()}>Print or save as PDF</Button>
      </div>

      <article className="mx-auto max-w-[840px] rounded-2xl border border-slate-200 bg-white p-6 text-[13px] leading-5 text-slate-900 shadow-sm sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-300 pb-5">
          <div>
            <p className="text-lg font-bold tracking-tight">{COMPANY.name}</p>
            <p className="mt-1 text-slate-600">{COMPANY.address}</p>
            <p className="text-slate-600">{COMPANY.phone} · {COMPANY.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide">Service report</p>
            <p className="mt-1 font-semibold">{j.report?.number ?? 'Draft, not issued'}</p>
            <p className="text-slate-600">Date of work: {fmtDate(j.completedOn || j.plannedOn || j.dueOn)}</p>
            <p className="text-slate-600">Job {j.number}</p>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 border-b border-slate-200 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</p>
            <p className="mt-1 font-semibold">{customer?.name}</p>
            <p className="text-slate-600">{[customer?.address, customer?.area, customer?.emirate].filter(Boolean).join(', ')}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Site</p>
            <p className="mt-1 font-semibold">{site?.name}</p>
            <p className="text-slate-600">{[site?.address, site?.area, site?.emirate].filter(Boolean).join(', ')}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Work</p>
            <p className="mt-1">{j.kind === 'planned_visit' ? j.title : `${JOB_KINDS[j.kind].label}: ${j.title}`}</p>
            {contract && <p className="text-slate-600">Under contract {contract.number}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Done by</p>
            <p className="mt-1">{staffNames(s, j.assigneeIds)}</p>
            {contact && <p className="text-slate-600">Reported by {contact.name}</p>}
          </div>
        </section>

        {j.callInfo && (
          <>
            <Heading>Reported problem</Heading>
            <p className="whitespace-pre-line">{j.callInfo.fault}</p>
          </>
        )}

        {j.checklist.length > 0 && (
          <>
            <Heading>Inspection and tests</Heading>
            <table className="w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-2 py-2 font-semibold">Equipment</th>
                  <th className="w-24 px-2 py-2 font-semibold">Result</th>
                  <th className="px-2 py-2 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {j.checklist.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="border-b border-slate-100 px-2 py-1.5">{r.label}</td>
                    <td className={`border-b border-slate-100 px-2 py-1.5 font-medium ${r.result === 'fail' ? 'text-red-700' : ''}`}>{RESULT[r.result]}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <Heading>Findings and work done</Heading>
        <p className="whitespace-pre-line">{j.findings || 'No findings were written.'}</p>

        {(() => {
          const shots = [...(j.photos ?? []), ...found.flatMap((d) => d.photos ?? [])];
          return shots.length > 0 ? (
            <>
              <Heading>Photos</Heading>
              <ul className="flex flex-wrap gap-2">
                {shots.map((p, i) => (
                  <li key={p.id}><img src={p.url} alt={`Photo ${i + 1}`} className="h-28 w-auto rounded-lg border border-slate-200 object-cover print:h-32" /></li>
                ))}
              </ul>
            </>
          ) : null;
        })()}

        {found.length > 0 && (
          <>
            <Heading>Deficiencies found</Heading>
            <table className="w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <th className="w-36 px-2 py-2 font-semibold">Number</th>
                  <th className="w-24 px-2 py-2 font-semibold">Class</th>
                  <th className="px-2 py-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {found.map((d) => (
                  <tr key={d.id} className="align-top">
                    <td className="border-b border-slate-100 px-2 py-1.5 tabular-nums">{d.number}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5">{SEVERITY[d.severity].label}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5">{d.title}. {d.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-slate-600">The customer is informed of these deficiencies in writing and decides on the repair.</p>
          </>
        )}

        {(j.parts.length > 0 || j.labour.length > 0) && (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Heading>Parts used</Heading>
              {j.parts.length === 0 ? <p className="text-slate-500">None.</p> : (
                <ul>{j.parts.map((p) => <li key={p.id} className="flex justify-between border-b border-slate-100 py-1"><span>{p.description}</span><span className="tabular-nums">{p.qty} {p.unit}</span></li>)}</ul>
              )}
            </div>
            <div>
              <Heading>Time on site</Heading>
              {j.labour.length === 0 ? <p className="text-slate-500">None.</p> : (
                <ul>
                  {j.labour.map((r, i) => <li key={`${r.staffId}-${i}`} className="flex justify-between border-b border-slate-100 py-1"><span>{staffName(s, r.staffId)}</span><span className="tabular-nums">{r.hours} h</span></li>)}
                  <li className="flex justify-between py-1 font-semibold"><span>Total</span><span className="tabular-nums">{totalHours} h</span></li>
                </ul>
              )}
            </div>
          </div>
        )}

        <section className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">For {COMPANY.short}</p>
            <p className="mt-8 border-t border-slate-400 pt-1 font-semibold">{staffNames(s, j.assigneeIds)}</p>
            <p className="text-slate-600">Technician{j.assigneeIds.length > 1 ? 's' : ''}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Received for the customer</p>
            <div className="mt-2 h-14">
              {j.signature?.path && (
                <svg viewBox="0 0 400 140" className="h-14 w-auto" role="img" aria-label={`Signature of ${j.signature.name}`}>
                  <path d={j.signature.path} fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <p className="border-t border-slate-400 pt-1 font-semibold">{j.signature?.name ?? 'Not signed'}</p>
            <p className="text-slate-600">{[j.signature?.role, j.signature ? fmtDate(j.signature.on) : ''].filter(Boolean).join(' · ')}</p>
          </div>
        </section>
        <p className="mt-6 text-[11px] text-slate-500">The signature confirms that the work and the findings were shown to the customer. It is not an approval of any repair.</p>
      </article>

      {cert && (
        <article className="mx-auto mt-6 max-w-[840px] rounded-2xl border border-slate-200 bg-white p-6 text-[13px] leading-5 text-slate-900 shadow-sm sm:p-10 print:mt-0 print:max-w-none print:break-before-page print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="border-b border-slate-300 pb-5 text-center">
            <p className="text-lg font-bold tracking-tight">{COMPANY.name}</p>
            <p className="text-slate-600">{COMPANY.licence}</p>
            <p className="mt-4 text-2xl font-bold uppercase tracking-wide">Maintenance certificate</p>
            <p className="mt-1 font-semibold">{cert.number}</p>
          </header>
          <p className="mt-6">
            We certify that the fire protection systems listed below at <strong>{site?.name}</strong>, {customer?.name}, were inspected and tested on{' '}
            <strong>{fmtDate(cert.issuedOn)}</strong> according to the maintenance programme of contract {contract?.number ?? '—'}, and that the results are recorded in service report {j.report?.number}.
          </p>
          <ul className="mt-4 divide-y divide-slate-100 border-y border-slate-200">
            {systems.map((x) => (
              <li key={x.id} className="flex justify-between gap-4 py-2"><span>{x.name}</span><span className="text-slate-600">{SYSTEM_TYPES[x.type].standard}</span></li>
            ))}
          </ul>
          {found.length > 0 && <p className="mt-4">Deficiencies were found and reported to the customer: {found.map((d) => d.number).join(', ')}.</p>}
          <p className="mt-4">Next inspection due: <strong>{fmtDate(cert.nextDue)}</strong>.</p>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <p className="border-t border-slate-400 pt-1 text-slate-600">Authorised signature and stamp</p>
            <p className="border-t border-slate-400 pt-1 text-slate-600">Date</p>
          </div>
          <p className="mt-6 text-[11px] text-slate-500">Sample wording. The certificate the authority accepts, and its format, are confirmed in the research of phase 2.</p>
        </article>
      )}
    </div>
  );
}
