import { Link } from 'react-router';
import { ArrowRightIcon } from 'lucide-react';
import { claimedTotal, contractValue, costTotals, forecast, originalValue, paidTotal, percentComplete, retentionHeld, retentionReleased, workDone } from '@/data/projectRules.js';
import { cn } from '@/lib/cn.js';
import { diffDays, fmtDate, relDays, todayISO } from '@/lib/dates.js';
import { aed, money } from '@/lib/format.js';
import { nextSteps } from '@/store/projectSelectors.js';
import { quotationLabel } from '@/store/salesSelectors.js';
import { activityFor } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { ActivityList } from '@/ui/Activity.jsx';
import { Badge } from '@/ui/Badge.jsx';
import { Card, DefinitionList } from '@/ui/Page.jsx';
import { ProgressBar, Stat, signed } from './parts.jsx';

const dot = { red: 'bg-red-500', orange: 'bg-orange-500', blue: 'bg-blue-500' };

export function ProjectOverview({ p, setTab }) {
  const s = useStore();
  const today = todayISO();
  const f = forecast(p);
  const costs = costTotals(p);
  const value = contractValue(p);
  const extra = value - originalValue(p);
  const steps = nextSteps(p, today);
  const customer = s.customers[p.customerId];
  const site = s.sites[p.siteId];
  const contact = s.contacts[p.contactId];
  const quotation = s.quotations[p.quotationId];
  const days = diffDays(p.startOn, p.endOn);
  const link = (to, text) => <Link className="font-medium hover:underline" to={to}>{text}</Link>;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card title="The money">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Contract value" amount={value} sub={extra ? `with variations ${signed(extra)}` : 'before VAT'} />
            <Stat label="Work done" value={`${percentComplete(p).toFixed(0)}%`} sub={aed(workDone(p))} />
            <Stat label="Paid by the customer" amount={paidTotal(p)} sub={claimedTotal(p) ? `${aed(claimedTotal(p))} claimed` : 'nothing claimed yet'} />
            <Stat label="Retention held" amount={retentionHeld(p)} sub={retentionReleased(p) ? 'claimed back' : `${p.retentionPct}% of the work claimed`} />
          </dl>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Budget (cost)" amount={f.budget} />
            <Stat label="Ordered, not billed" amount={costs.committed} />
            <Stat label="Billed or booked" amount={costs.incurred} />
            <Stat label="Expected margin" value={`${f.marginPct.toFixed(0)}%`} sub={aed(f.margin)} tone={f.marginPct < 20 ? 'text-red-700' : undefined} />
          </dl>
        </Card>

        <Card title="What needs attention">
          {steps.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing needs attention now.</p>
          ) : (
            <ul className="-my-1.5 divide-y divide-slate-100">
              {steps.map((st) => (
                <li key={st.text}>
                  <button type="button" onClick={() => setTab(st.tab)} className="flex w-full items-center gap-3 py-3 text-left hover:opacity-80">
                    <span className={cn('size-2 shrink-0 rounded-full', dot[st.tone])} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm text-slate-800">{st.text}</span>
                    <ArrowRightIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Packages" bodyClassName="!px-2">
          <ul className="divide-y divide-slate-100">
            {p.packages.map((pkg) => {
              const c = costTotals(p, pkg.id);
              const over = c.exposure > pkg.cost;
              return (
                <li key={pkg.id} className="grid grid-cols-1 gap-x-6 gap-y-2 px-3 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                      <span className="truncate">{pkg.title}</span>
                      {pkg.kind === 'variation' && <Badge tone="violet">Variation</Badge>}
                    </p>
                    <p className="text-xs tabular-nums text-slate-500">Price AED {money(pkg.value)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-slate-500">Work done</p>
                    <ProgressBar value={pkg.progress} />
                  </div>
                  <div>
                    <p className={cn('mb-1 text-xs', over ? 'font-medium text-red-700' : 'text-slate-500')}>
                      Cost AED {money(c.exposure)} of {money(pkg.cost)}{over ? ' (over)' : ''}
                    </p>
                    <ProgressBar value={pkg.cost > 0 ? (c.exposure / pkg.cost) * 100 : 0} tone={over ? 'orange' : 'green'} label="Share of the budget spent" />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="The project">
          <DefinitionList
            cols={1}
            items={[
              { label: 'Customer', value: customer && link(`/customers/${customer.id}`, customer.name) },
              { label: 'Site', value: site && link(`/customers/sites/${site.id}`, site.name) },
              contact && { label: 'Contact', value: `${contact.name}, ${contact.title}` },
              quotation && { label: 'Made from', value: link(`/sales/quotations/${quotation.id}`, quotationLabel(quotation)) },
              { label: 'Customer\'s order', value: p.lpo },
              { label: 'Project engineer', value: s.staff[p.engineerId]?.name },
              { label: 'Site supervisor', value: s.staff[p.supervisorId]?.name },
              { label: 'Awarded', value: fmtDate(p.awardedOn) },
              { label: 'Start', value: fmtDate(p.startOn) },
              { label: 'Planned end', value: `${fmtDate(p.endOn)} (${relDays(p.endOn, today)}) · ${Math.round(days / 7)} weeks` },
              { label: 'Payment terms', value: `${p.advancePct}% advance, ${p.retentionPct}% retention, ${p.dlpMonths} months of liability` },
              { label: 'Civil Defence approval', value: p.cdApproval === 'contractor' ? 'We handle it' : 'The customer handles it' },
              p.notes && { label: 'Notes', value: p.notes },
            ]}
          />
        </Card>
        <Card title="Recent activity"><ActivityList entries={activityFor(s, 'project', p.id)} /></Card>
      </div>
    </div>
  );
}
