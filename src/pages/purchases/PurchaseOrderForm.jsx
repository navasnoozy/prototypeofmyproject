import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ShieldCheckIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { costTotals } from '@/data/projectRules.js';
import { PO_PURPOSE, PO_PURPOSE_HINT, STORE_ID } from '@/data/purchaseKinds.js';
import { lineNet, orderTotals } from '@/data/purchaseRules.js';
import { cn } from '@/lib/cn.js';
import { todayISO } from '@/lib/dates.js';
import { money, round2 } from '@/lib/format.js';
import { savePurchaseOrder } from '@/store/purchaseActions.js';
import { poApprovalNeeds, projectView } from '@/store/purchaseSelectors.js';
import { balanceOf, locationList } from '@/store/inventorySelectors.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Section, Segmented, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { EmptyState, Page } from '@/ui/Page.jsx';
import { jobOptions, projectOptions, supplierOptions } from './parts.jsx';

const ABOUT = {
  purpose: 'Writes a purchase order: who we buy from, what for, where it goes, and the lines with their cost. It is saved as a draft; the next step (approval if needed, then sending) is on the order itself.',
  why: [
    'The first question is what the order is for. A project or a job is charged with the order at once, so it needs the project or the job; an order for stock just fills the store or a van.',
    'Lines come from the catalogue, so the cost starts from what the company paid last (the average cost), and can be changed. A line that is not in the catalogue is typed by hand.',
    'The form shows early, before saving, whether the order needs the operations manager or the owner, and whether it takes a project package over its budget, so nobody is surprised later.',
    'The VAT rate follows the supplier: local suppliers charge 5%, an imported supply none on the invoice.',
  ],
  assumed: ['The prices, the suppliers and the delivery times are invented.'],
};

const newKey = () => Math.random().toString(36).slice(2, 8);

export function PurchaseOrderForm() {
  const { poId } = useParams();
  const s = useStore();
  const existing = poId ? s.purchaseOrders[poId] : null;
  if (poId && (!existing || existing.status !== 'draft')) {
    return (
      <Page title="Purchase order" back="/purchases">
        <EmptyState title={existing ? 'Only a draft can be edited' : 'This order does not exist'} action={<Button variant="primary" to={existing ? `/purchases/${poId}` : '/purchases'}>{existing ? 'Open the order' : 'All orders'}</Button>}>
          {existing ? 'Once an order is sent for approval or to the supplier, change it by returning it to draft first.' : 'It may have been deleted.'}
        </EmptyState>
      </Page>
    );
  }
  return <Body key={existing?.id ?? 'new'} existing={existing} />;
}

function Body({ existing }) {
  const s = useStore();
  const navigate = useNavigate();
  const { user } = useSession();
  const [params] = useSearchParams();

  const presetProject = s.projects[params.get('project')] ? params.get('project') : '';
  const presetJob = s.jobs[params.get('job')] ? params.get('job') : '';
  const presetPackage = params.get('package') ?? '';
  const defaultPackage = (projectId) => (presetPackage && s.projects[projectId]?.packages.some((x) => x.id === presetPackage) ? presetPackage : s.projects[projectId]?.packages[0]?.id ?? '');
  const toRow = (l) => ({ key: newKey(), id: l.id, itemId: l.itemId, description: l.description, unit: l.unit, qty: String(l.qty), cost: String(l.cost), packageId: l.packageId ?? '' });

  const form = useForm(
    existing
      ? {
          supplierId: existing.supplierId, purpose: existing.purpose, projectId: existing.projectId, jobId: existing.jobId, deliverTo: existing.deliverTo,
          expectedOn: existing.expectedOn, title: existing.title, supplierRef: existing.supplierRef, notes: existing.notes, lines: existing.lines.map(toRow),
        }
      : {
          supplierId: s.suppliers[params.get('supplier')] ? params.get('supplier') : '',
          purpose: presetProject ? 'project' : presetJob ? 'job' : 'stock',
          projectId: presetProject, jobId: presetJob, deliverTo: presetProject || presetJob ? 'site' : STORE_ID,
          expectedOn: '', title: '', supplierRef: '', notes: '', lines: [],
        },
    (v) => ({
      ...(v.supplierId ? {} : { supplierId: 'Choose the supplier.' }),
      ...(v.purpose === 'project' && !v.projectId ? { projectId: 'Choose the project.' } : {}),
      ...(v.purpose === 'job' && !v.jobId ? { jobId: 'Choose the job.' } : {}),
      ...(v.lines.length === 0 ? { lines: 'Add at least one item.' } : v.lines.some((l) => !(Number(l.qty) > 0) || l.cost === '' || Number(l.cost) < 0 || l.description.trim().length < 2 || (v.purpose === 'project' && !l.packageId)) ? { lines: 'Every line needs a name, a quantity above zero and a cost' + (v.purpose === 'project' ? ', and the package it is charged to.' : '.') } : {}),
    }),
  );
  const { values } = form;
  const supplier = s.suppliers[values.supplierId];
  const project = s.projects[values.projectId];

  const suppliers = useMemo(() => supplierOptions(s), [s]);
  const projects = useMemo(() => projectOptions(s), [s]);
  const jobs = useMemo(() => jobOptions(s), [s]);
  const places = locationList(s).map((l) => ({ value: l.id, label: l.name }));
  const deliverOptions = values.purpose === 'stock' ? places : [{ value: 'site', label: 'Straight to the site' }, { value: STORE_ID, label: 'Main store (held for it)' }];

  // The order as it would be saved, to show the totals and the approval it needs.
  const draft = useMemo(
    () => ({
      ...(existing ?? {}), status: 'draft', createdBy: existing?.createdBy ?? user.id, purpose: values.purpose, projectId: values.projectId,
      vatRate: supplier ? (supplier.taxable ? s.settings.vatRate : 0) : s.settings.vatRate,
      lines: values.lines.map((l) => ({ ...l, qty: Number(l.qty) || 0, cost: Number(l.cost) || 0 })),
    }),
    [existing, user.id, values.purpose, values.projectId, values.lines, supplier, s.settings.vatRate],
  );
  const totals = orderTotals(draft);
  const needs = poApprovalNeeds(draft, s);
  const view = project ? projectView(s, project) : null;
  const perPackage = view
    ? view.packages
        .map((pkg) => {
          const added = round2(draft.lines.filter((l) => l.packageId === pkg.id).reduce((n, l) => n + lineNet(l), 0));
          const exposure = costTotals(view, pkg.id).exposure;
          return { pkg, added, exposure, left: round2(pkg.cost - exposure - added) };
        })
        .filter((r) => r.added > 0)
    : [];

  // ---- the items to add
  const itemOptions = useMemo(
    () =>
      list(s.items)
        .filter((i) => i.active && i.kind === 'material' && (values.purpose !== 'stock' || i.stocked))
        .map((i) => ({
          value: i.id, label: i.name,
          sub: `${i.code} · cost AED ${money(i.avgCost ?? i.cost)} per ${i.unit}${i.stocked ? ` · ${balanceOf(s, i.id, STORE_ID)} in the store` : ''}`,
        })),
    [s, values.purpose],
  );
  const setLines = (lines) => form.set('lines', lines);
  const defaultPkg = values.purpose === 'project' ? defaultPackage(values.projectId) : '';
  const addItem = (itemId) => {
    const it = s.items[itemId];
    if (!it) return;
    setLines([...values.lines, { key: newKey(), itemId: it.id, description: it.name, unit: it.unit, qty: String(it.reorderQty > 0 && values.purpose === 'stock' ? it.reorderQty : 1), cost: String(it.avgCost ?? it.cost), packageId: defaultPkg }]);
    if (!values.supplierId && it.supplierId) form.set('supplierId', it.supplierId);
  };
  const addTyped = (text) => setLines([...values.lines, { key: newKey(), itemId: '', description: text || 'New line', unit: 'lot', qty: '1', cost: '', packageId: defaultPkg }]);
  const change = (key, patch) => setLines(values.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const setPurpose = (purpose) => {
    form.set('purpose', purpose);
    form.set('deliverTo', purpose === 'stock' ? STORE_ID : 'site');
    if (purpose !== 'project') setLines(values.lines.map((l) => ({ ...l, packageId: '' })));
  };
  const chooseProject = (id) => {
    form.set('projectId', id);
    setLines(values.lines.map((l) => ({ ...l, packageId: s.projects[id]?.packages.some((x) => x.id === l.packageId) ? l.packageId : defaultPackage(id) })));
  };

  const save = form.submit((v) => {
    const id = savePurchaseOrder({
      id: existing?.id, supplierId: v.supplierId, purpose: v.purpose, projectId: v.projectId, jobId: v.jobId, deliverTo: v.deliverTo,
      title: v.title.trim(), expectedOn: v.expectedOn, supplierRef: v.supplierRef.trim(), notes: v.notes.trim(),
      lines: v.lines.map((l) => ({ id: l.id, itemId: l.itemId, description: l.description.trim(), unit: l.unit.trim() || 'nos', qty: Number(l.qty), cost: Number(l.cost), packageId: l.packageId })),
    });
    toast(existing ? 'Order saved' : 'Draft order made');
    navigate(`/purchases/${id}`, { replace: true });
  });

  return (
    <Page
      title={existing ? `Edit ${existing.number}` : 'New purchase order'}
      facts={existing ? 'A draft' : 'Saved as a draft: approval and sending come next'}
      back={existing ? `/purchases/${existing.id}` : '/purchases'}
      about={ABOUT}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {values.lines.length > 0 ? <>Total <strong className="font-semibold tabular-nums text-slate-900">AED {money(totals.total)}</strong> with VAT</> : 'No items yet'}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => navigate(-1)}>Cancel</Button>
            <Button variant="primary" onClick={save}>{existing ? 'Save changes' : 'Save draft'}</Button>
          </div>
        </div>
      }
    >
      <form onSubmit={save} className="mx-auto max-w-4xl">
        <Section title="The order">
          <Field label="Supplier" required span={2} error={form.error('supplierId')}
            hint={supplier ? `${Number(supplier.terms) === 0 ? 'Cash on delivery' : `Net ${supplier.terms} days`} · ${supplier.taxable ? `VAT ${s.settings.vatRate}%` : 'no VAT on the invoice (imported)'} · ${supplier.contactName}` : undefined}>
            <Combobox options={suppliers} noun="suppliers" placeholder="Choose a supplier" searchPlaceholder="Search suppliers" {...form.bind('supplierId')} />
          </Field>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <p className="text-xs font-medium text-slate-700">Bought for</p>
            <Segmented label="Bought for" value={values.purpose} onChange={setPurpose} options={Object.entries(PO_PURPOSE).map(([value, label]) => ({ value, label }))} />
            <p className="text-xs text-slate-500">{PO_PURPOSE_HINT[values.purpose]}</p>
          </div>
          {values.purpose === 'project' && (
            <Field label="Project" required span={2} error={form.error('projectId')}>
              <Combobox options={projects} noun="projects" placeholder="Choose a project" searchPlaceholder="Search projects" {...form.bind('projectId')} onChange={chooseProject} />
            </Field>
          )}
          {values.purpose === 'job' && (
            <Field label="Job" required span={2} error={form.error('jobId')}>
              <Combobox options={jobs} noun="jobs" placeholder="Choose a job" searchPlaceholder="Search jobs" {...form.bind('jobId')} />
            </Field>
          )}
          <Field label="Deliver to" hint={values.purpose === 'stock' ? 'The balance of this place grows when the goods arrive.' : 'No stock balance changes: the cost goes to the project or the job.'}>
            <Select {...form.bind('deliverTo')} options={deliverOptions} />
          </Field>
          <Field label="Expected on" hint="The day the supplier promised. After it, the order shows as late.">
            <TextInput type="date" {...form.bind('expectedOn')} min={todayISO()} />
          </Field>
          <Field label="Title" span={2} hint="Optional. Shown in the lists. If empty, the first item is used.">
            <TextInput {...form.bind('title')} autoComplete="off" placeholder="For example Detectors for the Tower B fire alarm" />
          </Field>
          <Field label="Supplier's reference" hint="Their quotation or offer number.">
            <TextInput {...form.bind('supplierRef')} autoComplete="off" />
          </Field>
          <Field label="Notes" span={2}>
            <TextArea {...form.bind('notes')} rows={2} placeholder="For example Deliver to the laydown area before 10:00." />
          </Field>
        </Section>

        <Section title="Items" description={values.purpose === 'stock' ? 'Only items kept in stock are offered. Type a name to add a line that is not in the catalogue.' : 'Type a name to add a line that is not in the catalogue.'} cols={1}>
          {values.lines.length > 0 && (
            <div className="space-y-3">
              <div className="hidden gap-2 px-1 text-xs font-medium text-slate-500 md:grid md:grid-cols-[minmax(0,1fr)_84px_84px_112px_104px_36px]">
                <span>Item</span><span>Quantity</span><span>Unit</span><span>Cost each</span><span className="text-right">Amount</span><span />
              </div>
              {values.lines.map((l, i) => (
                <div key={l.key} className="grid grid-cols-2 items-center gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_84px_84px_112px_104px_36px] md:border-0 md:p-0">
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <TextInput aria-label={`Item ${i + 1}`} value={l.description} onChange={(v) => change(l.key, { description: v })} className="!h-10" />
                    {values.purpose === 'project' && (
                      <select
                        aria-label={`Package of item ${i + 1}`}
                        value={l.packageId}
                        onChange={(e) => change(l.key, { packageId: e.target.value })}
                        className={cn('mt-1.5 h-8 w-full rounded-lg border bg-white px-2 text-xs text-slate-700', l.packageId ? 'border-control' : 'border-red-600')}
                      >
                        <option value="">Charge to which package?</option>
                        {(project?.packages ?? []).map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.title}</option>)}
                      </select>
                    )}
                  </div>
                  <TextInput aria-label={`Quantity of item ${i + 1}`} inputMode="decimal" value={l.qty} onChange={(v) => change(l.key, { qty: v })} className="!h-10" />
                  <TextInput aria-label={`Unit of item ${i + 1}`} value={l.unit} onChange={(v) => change(l.key, { unit: v })} className="!h-10" />
                  <TextInput aria-label={`Cost of item ${i + 1}`} inputMode="decimal" value={l.cost} onChange={(v) => change(l.key, { cost: v })} placeholder="0.00" className="!h-10" />
                  <p className="text-right text-sm tabular-nums text-slate-900">{money((Number(l.qty) || 0) * (Number(l.cost) || 0))}</p>
                  <div className="col-span-2 flex justify-end md:col-span-1">
                    <IconButton icon={Trash2Icon} label={`Remove item ${i + 1}`} size="xs" onClick={() => setLines(values.lines.filter((x) => x.key !== l.key))} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="max-w-xl">
            <Combobox
              options={itemOptions}
              noun="items"
              placeholder={values.lines.length === 0 ? 'Add the first item…' : 'Add another item…'}
              searchPlaceholder="Search the catalogue"
              value=""
              onChange={addItem}
              onCreate={addTyped}
              createLabel={(text) => (text ? `Add “${text}” as a line typed by hand` : 'Add a line typed by hand')}
            />
          </div>
          {form.error('lines') && <p role="alert" className="text-xs text-red-700">{form.error('lines')}</p>}

          {values.lines.length > 0 && (
            <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-3">
                {needs.needed ? (
                  <p className="flex items-start gap-2 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-950">
                    <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      <strong className="font-semibold">This order needs approval by the {needs.roleLabel}</strong> before it can be sent.
                      <span className="mt-1 block text-xs">{needs.reasons.join(' · ')}</span>
                    </span>
                  </p>
                ) : (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {needs.reasons.length > 0 ? `Within your own authority, so no one else has to approve. (${needs.reasons[0]}.)` : 'No approval is needed: it is within the limit of the purchase officer.'}
                  </p>
                )}
                {perPackage.length > 0 && (
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="mb-1.5 text-xs font-medium text-slate-700">Budget of the packages this order is charged to</p>
                    <ul className="space-y-1 text-sm">
                      {perPackage.map((r) => (
                        <li key={r.pkg.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="min-w-0 truncate text-slate-800">{r.pkg.title}</span>
                          <span className={cn('tabular-nums', r.left < 0 ? 'font-semibold text-red-700' : 'text-slate-600')}>
                            {r.left < 0 ? (<><TriangleAlertIcon className="mr-1 inline size-3.5" aria-hidden="true" />over by AED {money(-r.left)}</>) : `AED ${money(r.left)} left after this order`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-slate-600">Net</dt><dd className="tabular-nums">{money(totals.net)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-600">VAT {draft.vatRate}%</dt><dd className="tabular-nums">{money(totals.vat)}</dd></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><dt>Total (AED)</dt><dd className="tabular-nums">{money(totals.total)}</dd></div>
              </dl>
            </div>
          )}
        </Section>
        <button type="submit" className="hidden" />
      </form>
    </Page>
  );
}

