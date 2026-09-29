import { useState } from 'react';
import { CheckIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { COST_KINDS, COST_STATE } from '@/data/projectKinds.js';
import { budgetTotal, costTotals, forecast } from '@/data/projectRules.js';
import { cn } from '@/lib/cn.js';
import { fmtDate } from '@/lib/dates.js';
import { aed, money } from '@/lib/format.js';
import { addCost, markCostBilled, removeCost } from '@/store/projectActions.js';
import { toast } from '@/store/toast.js';
import { Badge } from '@/ui/Badge.jsx';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Field, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer } from '@/ui/Overlay.jsx';
import { Card } from '@/ui/Page.jsx';
import { ProgressBar, Stat } from './parts.jsx';

function CostDrawer({ p, onClose }) {
  const form = useForm(
    { packageId: p.packages[0]?.id ?? '', kind: 'material', description: '', ref: '', amount: '', state: 'incurred' },
    (v) => ({
      ...(v.description.trim().length >= 3 ? {} : { description: 'Say what the cost is for.' }),
      ...(Number(v.amount) > 0 ? {} : { amount: 'Write the amount.' }),
    }),
  );
  const save = form.submit((v) => {
    addCost(p.id, { packageId: v.packageId, kind: v.kind, description: v.description.trim(), ref: v.ref.trim(), amount: Number(v.amount), state: v.state });
    toast('Cost recorded');
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Record a cost" subtitle={p.number}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Record cost</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Package"><Select {...form.bind('packageId')} options={p.packages.map((x) => ({ value: x.id, label: x.title }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind"><Select {...form.bind('kind')} options={Object.entries(COST_KINDS).map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="State"><Select {...form.bind('state')} options={Object.entries(COST_STATE).map(([value, label]) => ({ value, label }))} /></Field>
        </div>
        <Field label="What for" required error={form.error('description')}><TextInput {...form.bind('description')} autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reference" hint="Order or bill number."><TextInput {...form.bind('ref')} autoComplete="off" /></Field>
          <Field label="Amount" required error={form.error('amount')}><TextInput {...form.bind('amount')} prefix="AED" inputMode="decimal" /></Field>
        </div>
        <p className="text-xs text-slate-500">From step 6 the purchase orders and supplier bills of Purchases fill these lines by themselves; until then they are written by hand.</p>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

export function ProjectCosts({ p, manage }) {
  const [adding, setAdding] = useState(false);
  const totals = costTotals(p);
  const f = forecast(p);
  const sorted = p.costs.toSorted((a, b) => b.on.localeCompare(a.on));
  const nameOf = (id) => p.packages.find((x) => x.id === id)?.title ?? '';
  const editable = manage && p.phase !== 'complete';
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Budget" amount={budgetTotal(p)} sub="The cost of the quotation" />
        <Stat label="Ordered, not billed" amount={totals.committed} />
        <Stat label="Billed or booked" amount={totals.incurred} />
        <Stat label="Expected margin" value={`${f.marginPct.toFixed(0)}%`} sub={aed(f.margin)} tone={f.marginPct < 20 ? 'text-red-700' : undefined} />
      </dl>

      <Card title="Budget against cost, by package" bodyClassName="!px-2">
        <ul className="divide-y divide-slate-100">
          {p.packages.map((pkg) => {
            const c = costTotals(p, pkg.id);
            const over = c.exposure > pkg.cost;
            return (
              <li key={pkg.id} className="grid grid-cols-1 gap-x-6 gap-y-2 px-3 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{pkg.title}</p>
                  <p className="text-xs tabular-nums text-slate-500">Budget AED {money(pkg.cost)}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 text-xs">
                  <div><dt className="text-slate-500">Ordered</dt><dd className="tabular-nums text-slate-800">{money(c.committed)}</dd></div>
                  <div><dt className="text-slate-500">Billed</dt><dd className="tabular-nums text-slate-800">{money(c.incurred)}</dd></div>
                </dl>
                <div>
                  <p className={cn('mb-1 text-xs tabular-nums', over ? 'font-semibold text-red-700' : 'text-slate-500')}>
                    {over ? `Over the budget by AED ${money(c.exposure - pkg.cost)}` : `AED ${money(pkg.cost - c.exposure)} left`}
                  </p>
                  <ProgressBar value={pkg.cost > 0 ? (c.exposure / pkg.cost) * 100 : 0} tone={over ? 'orange' : 'green'} label="Share of the budget used" />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Cost entries" action={editable && <Button size="xs" icon={PlusIcon} onClick={() => setAdding(true)}>Record cost</Button>}>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500">No cost recorded yet.</p>
        ) : (
          <ul className="-my-2 divide-y divide-slate-100">
            {sorted.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="w-20 shrink-0 text-xs tabular-nums text-slate-500">{fmtDate(c.on)}</span>
                <span className="min-w-0 flex-1 basis-56">
                  <span className="block text-sm text-slate-900">{c.description}</span>
                  <span className="block truncate text-xs text-slate-500">{COST_KINDS[c.kind]}{c.ref ? ` · ${c.ref}` : ''} · {nameOf(c.packageId)}</span>
                </span>
                <span className="text-sm font-medium tabular-nums text-slate-900">{money(c.amount)}</span>
                <Badge tone={c.state === 'committed' ? 'orange' : 'green'} dot>{c.state === 'committed' ? 'Ordered' : 'Billed'}</Badge>
                {editable && c.state === 'committed' && <IconButton icon={CheckIcon} label={`Mark as billed: ${c.description}`} size="xs" onClick={() => markCostBilled(p.id, c.id)} />}
                {editable && <IconButton icon={Trash2Icon} label={`Remove: ${c.description}`} size="xs" onClick={() => removeCost(p.id, c.id)} />}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">Ordered means a purchase order or an agreement exists and the bill has not come. Both count against the budget.</p>
      </Card>
      {adding && <CostDrawer p={p} onClose={() => setAdding(false)} />}
    </div>
  );
}
