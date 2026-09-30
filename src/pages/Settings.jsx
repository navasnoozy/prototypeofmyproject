import { RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { AREAS } from '@/data/areas.js';
import { NUMBER_FORMATS } from '@/data/numbering.js';
import { ROLES } from '@/data/roles.js';
import { COMPANY } from '@/data/seed/staff.js';
import { saveApprovalLimits } from '@/store/salesActions.js';
import { useSession } from '@/store/session.js';
import { list } from '@/store/selectors.js';
import { resetDemo, useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Avatar } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { ConfirmDialog } from '@/ui/Overlay.jsx';
import { Field, TextInput, useForm } from '@/ui/Form.jsx';
import { Card, DefinitionList, Page } from '@/ui/Page.jsx';

const SAMPLE_KINDS = [
  ['customer', 'Customer'], ['enquiry', 'Enquiry'], ['quotation', 'Quotation'], ['contract', 'AMC contract'],
  ['job', 'Job'], ['deficiency', 'Deficiency'], ['report', 'Service report'], ['project', 'Project'],
  ['po', 'Purchase order'], ['grn', 'Goods received'], ['bill', 'Supplier bill'], ['invoice', 'Tax invoice'],
  ['creditNote', 'Credit note'], ['receipt', 'Receipt'],
];

// Settings. Its real content is decided later (record 37 keeps the button as a
// placeholder); the prototype uses it to show the company, the people with the
// areas each sees, and the numbering, so they can be reviewed in one place.
export function Settings() {
  const state = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <Page
      title="Settings"
      facts="Company, people and roles, numbering"
      about={{
        purpose: 'Where the company is set up: its details, its people with their roles, and how documents are numbered.',
        why: [
          'The list of people and the areas each sees is the proposal of record 39, point 10: what a person sees is limited by function (areas, pages, actions), and the navigation depends only on the function.',
          'Numbers are per kind of document, with the year in it, as in the reference company\'s practice (sample).',
        ],
        assumed: [
          'The company name, TRN, licence number and every person are invented.',
          'The formats of the numbers are samples; in the product each company sets its own.',
        ],
      }}
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="People and what they see">
            <ul className="divide-y divide-slate-100">
              {list(state.staff).map((p) => {
                const role = ROLES[p.roleKey];
                const seen = AREAS.filter((a) => role.access[a.id]);
                return (
                  <li key={p.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar name={p.name} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{p.name} <span className="font-normal text-slate-500">· {role.label}</span></p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {seen.map((a) => `${a.label}${role.access[a.id] === 'view' ? ' (view)' : ''}`).join(', ')}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <ApprovalLimits />
          <Card title="Numbering (samples)">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {SAMPLE_KINDS.map(([kind, label]) => (
                <div key={kind} className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 text-sm">
                  <dt className="text-slate-600">{label}</dt>
                  <dd className="font-medium tabular-nums text-slate-900">{NUMBER_FORMATS[kind](state.counters[kind] ? state.counters[kind] + 1 : 1)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-slate-500">Shown: the number the next document of each kind will get.</p>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Company">
            <DefinitionList
              cols={1}
              items={[
                { label: 'Name', value: COMPANY.name },
                { label: 'TRN (sample)', value: COMPANY.trn },
                { label: 'Address', value: COMPANY.address },
                { label: 'Phone', value: COMPANY.phone },
                { label: 'E-mail', value: COMPANY.email },
                { label: 'Licence (sample)', value: COMPANY.licence },
              ]}
            />
          </Card>
          <Card title="Demo data">
            <p className="text-sm text-slate-600">
              Your changes are saved in this browser only. Reset to start again from the first sample.
            </p>
            <div className="mt-4">
              <Button icon={RotateCcwIcon} onClick={() => setConfirm(true)}>Reset demo data</Button>
            </div>
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Reset demo data?"
        confirmLabel="Reset"
        tone="danger"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          resetDemo();
          toast('Demo data restored to the first sample');
        }}
      >
        This puts back the first sample data and removes every change you made in this browser. It cannot be undone.
      </ConfirmDialog>
    </Page>
  );
}

// Who must approve a quotation, a purchase order or a credit note. Only the
// owner changes the limits.
function ApprovalLimits() {
  const s = useStore();
  const { roleKey } = useSession();
  const owner = roleKey === 'owner';
  const a = s.settings.approvals;
  const num = (v) => Number(v);
  const form = useForm(
    {
      salesLimit: String(a.salesLimit), managerLimit: String(a.managerLimit),
      salesDiscount: String(a.salesDiscount), managerDiscount: String(a.managerDiscount), marginFloor: String(a.marginFloor),
      poLimit: String(a.poLimit), poManagerLimit: String(a.poManagerLimit), cnLimit: String(a.cnLimit), cnManagerLimit: String(a.cnManagerLimit),
    },
    (v) => ({
      ...(v.salesLimit !== '' && num(v.salesLimit) >= 0 ? {} : { salesLimit: 'Write an amount.' }),
      ...(num(v.managerLimit) >= num(v.salesLimit) ? {} : { managerLimit: 'The manager\'s limit must not be below the first limit.' }),
      ...(v.salesDiscount !== '' && num(v.salesDiscount) >= 0 && num(v.salesDiscount) <= 100 ? {} : { salesDiscount: 'Write a percentage from 0 to 100.' }),
      ...(num(v.managerDiscount) >= num(v.salesDiscount) && num(v.managerDiscount) <= 100 ? {} : { managerDiscount: 'Not below the first discount, not above 100.' }),
      ...(num(v.marginFloor) >= 0 && num(v.marginFloor) < 100 ? {} : { marginFloor: 'Write a percentage below 100.' }),
      ...(v.poLimit !== '' && num(v.poLimit) >= 0 ? {} : { poLimit: 'Write an amount.' }),
      ...(num(v.poManagerLimit) >= num(v.poLimit) ? {} : { poManagerLimit: 'The manager\'s limit must not be below the first limit.' }),
      ...(v.cnLimit !== '' && num(v.cnLimit) >= 0 ? {} : { cnLimit: 'Write an amount.' }),
      ...(num(v.cnManagerLimit) >= num(v.cnLimit) ? {} : { cnManagerLimit: 'The manager\'s limit must not be below the first limit.' }),
    }),
  );
  const save = form.submit((v) => {
    saveApprovalLimits({
      salesLimit: num(v.salesLimit), managerLimit: num(v.managerLimit),
      salesDiscount: num(v.salesDiscount), managerDiscount: num(v.managerDiscount), marginFloor: num(v.marginFloor),
      poLimit: num(v.poLimit), poManagerLimit: num(v.poManagerLimit), cnLimit: num(v.cnLimit), cnManagerLimit: num(v.cnManagerLimit),
    });
    toast('Approval limits saved');
  });
  return (
    <Card title="Approval limits (samples)">
      <form onSubmit={save} inert={owner ? undefined : true} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="A sales person may send up to" hint="Net value of the quotation, before VAT." error={form.error('salesLimit')}>
          <TextInput {...form.bind('salesLimit')} prefix="AED" inputMode="decimal" />
        </Field>
        <Field label="The operations manager may approve up to" hint="Above this the owner approves." error={form.error('managerLimit')}>
          <TextInput {...form.bind('managerLimit')} prefix="AED" inputMode="decimal" />
        </Field>
        <Field label="Discount a sales person may give" error={form.error('salesDiscount')}>
          <TextInput {...form.bind('salesDiscount')} suffix="%" inputMode="decimal" />
        </Field>
        <Field label="Discount the manager may approve" hint="Above this the owner approves." error={form.error('managerDiscount')}>
          <TextInput {...form.bind('managerDiscount')} suffix="%" inputMode="decimal" />
        </Field>
        <Field label="Margin below which a manager must approve" error={form.error('marginFloor')}>
          <TextInput {...form.bind('marginFloor')} suffix="%" inputMode="decimal" />
        </Field>
        <p className="border-t border-slate-100 pt-4 text-xs font-medium text-slate-700 sm:col-span-2">Purchase orders</p>
        <Field label="A purchase officer may order up to" hint="Net value of the order, before VAT." error={form.error('poLimit')}>
          <TextInput {...form.bind('poLimit')} prefix="AED" inputMode="decimal" />
        </Field>
        <Field label="The operations manager may approve up to" hint="Above this the owner approves." error={form.error('poManagerLimit')}>
          <TextInput {...form.bind('poManagerLimit')} prefix="AED" inputMode="decimal" />
        </Field>
        <p className="border-t border-slate-100 pt-4 text-xs font-medium text-slate-700 sm:col-span-2">Credit notes</p>
        <Field label="The accountant may issue up to" hint="Net value, before VAT." error={form.error('cnLimit')}>
          <TextInput {...form.bind('cnLimit')} prefix="AED" inputMode="decimal" />
        </Field>
        <Field label="The operations manager may approve up to" hint="Above this the owner approves." error={form.error('cnManagerLimit')}>
          <TextInput {...form.bind('cnManagerLimit')} prefix="AED" inputMode="decimal" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
      <p className="mt-4 text-xs text-slate-500">
        A customer on hold always needs the owner. If the person who prepared a quotation or an order already has the authority, nobody else has to approve it; the one who approves is never the one who prepared it, except the owner. An order for a project that takes a package over its budget always needs the operations manager.
      </p>
      <div className="mt-4">
        <Button variant="primary" size="sm" disabled={!owner} onClick={save}>Save limits</Button>
        {!owner && <span className="ml-3 text-xs text-slate-500">Only the owner changes the limits.</span>}
      </div>
    </Card>
  );
}
