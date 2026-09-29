import { ITEM_CATEGORIES } from '@/data/quotationKinds.js';
import { PAYMENT_TERMS, SUPPLIER_KINDS } from '@/data/purchaseKinds.js';
import { saveSupplier } from '@/store/purchaseActions.js';
import { list } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Checkbox, Field, Select, TextArea, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer } from '@/ui/Overlay.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Adds or edits a supplier. `supplier` is the one being edited (or null).
export function SupplierDrawer({ open, onClose, supplier, onSaved }) {
  if (!open) return null;
  return <Body key={supplier?.id ?? 'new'} onClose={onClose} supplier={supplier} onSaved={onSaved} />;
}

function Body({ onClose, supplier, onSaved }) {
  const s = useStore();
  const form = useForm(
    {
      name: supplier?.name ?? '', kind: supplier?.kind ?? 'Distributor', area: supplier?.area ?? '', address: supplier?.address ?? '',
      contactName: supplier?.contactName ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '', trn: supplier?.trn ?? '',
      terms: String(supplier?.terms ?? 30), taxable: supplier?.taxable ?? true, categories: supplier?.categories ?? [], notes: supplier?.notes ?? '',
      active: supplier?.active ?? true,
    },
    (v) => ({
      ...(v.name.trim().length >= 3 ? {} : { name: 'Write the name of the company.' }),
      ...(list(s.suppliers).some((x) => x.name.toLowerCase() === v.name.trim().toLowerCase() && x.id !== supplier?.id) ? { name: 'A supplier with this name exists already.' } : {}),
      ...(v.contactName.trim() ? {} : { contactName: 'Write the name of the person to call.' }),
      ...(v.phone.trim() || v.email.trim() ? {} : { phone: 'Give a phone number or an e-mail address.' }),
      ...(v.email && !EMAIL.test(v.email) ? { email: 'This does not look like an e-mail address.' } : {}),
    }),
  );
  const { values } = form;
  const toggle = (c) => form.set('categories', values.categories.includes(c) ? values.categories.filter((x) => x !== c) : [...values.categories, c]);

  const save = form.submit((v) => {
    const id = saveSupplier({
      ...(supplier ?? {}), name: v.name.trim(), kind: v.kind, area: v.area.trim(), address: v.address.trim() || v.area.trim(), contactName: v.contactName.trim(),
      phone: v.phone.trim(), email: v.email.trim(), trn: v.trn.trim(), terms: Number(v.terms), taxable: v.taxable, categories: v.categories,
      notes: v.notes.trim(), active: v.active,
    });
    toast(supplier ? 'Supplier saved' : 'Supplier added');
    onSaved?.(id);
    onClose();
  });

  return (
    <Drawer
      open
      onClose={onClose}
      title={supplier ? supplier.name : 'New supplier'}
      subtitle={supplier ? 'Edit the supplier' : 'A company we buy from'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{supplier ? 'Save changes' : 'Add supplier'}</Button></>}
    >
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Company name" required error={form.error('name')}><TextInput {...form.bind('name')} autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind"><Select {...form.bind('kind')} options={SUPPLIER_KINDS} /></Field>
          <Field label="Area"><TextInput {...form.bind('area')} autoComplete="off" placeholder="For example Al Quoz, Dubai" /></Field>
        </div>
        <Field label="Address"><TextInput {...form.bind('address')} autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Person to call" required error={form.error('contactName')}><TextInput {...form.bind('contactName')} autoComplete="off" /></Field>
          <Field label="Phone" error={form.error('phone')}><TextInput {...form.bind('phone')} inputMode="tel" autoComplete="off" /></Field>
        </div>
        <Field label="E-mail" error={form.error('email')}><TextInput {...form.bind('email')} inputMode="email" autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment terms"><Select {...form.bind('terms')} options={PAYMENT_TERMS} /></Field>
          <Field label="TRN (sample)"><TextInput {...form.bind('trn')} autoComplete="off" inputMode="numeric" /></Field>
        </div>
        <Checkbox label="Charges VAT" hint="A supplier abroad does not charge UAE VAT on its invoice." checked={values.taxable} onChange={(v) => form.set('taxable', v)} />
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-slate-700">What they supply</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ITEM_CATEGORIES.filter((c) => !/Maintenance|Labour|Documentation/.test(c)).map((c) => (
              <Checkbox key={c} label={c} checked={values.categories.includes(c)} onChange={() => toggle(c)} />
            ))}
          </div>
        </fieldset>
        <Field label="Notes"><TextArea {...form.bind('notes')} rows={3} /></Field>
        <Checkbox label="In use" hint="A supplier that is not in use stays on old orders but cannot be chosen for new ones." checked={values.active} onChange={(v) => form.set('active', v)} />
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}
