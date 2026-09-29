import { useMemo } from 'react';
import { CONTACT_ROLES } from '@/data/catalog.js';
import { customerSites, list } from '@/store/selectors.js';
import { deleteContact, saveContact } from '@/store/actions.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Checkbox, Field, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer } from '@/ui/Overlay.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = (v) => {
  const e = {};
  if (!v.customerId) e.customerId = 'Choose the customer this person belongs to.';
  if (!v.name.trim()) e.name = 'Write the person\'s name.';
  if (!v.phone.trim() && !v.email.trim()) e.phone = 'Give a phone number or an e-mail address.';
  if (v.email && !EMAIL.test(v.email)) e.email = 'This does not look like an e-mail address.';
  return e;
};

// Adds or edits a contact. `contact` is the person being edited (or null for
// a new one); `customerId` presets the customer when the drawer is opened from
// a customer or a site.
export function ContactDrawer({ open, onClose, contact, customerId }) {
  if (!open) return null;
  return <Body key={contact?.id ?? 'new'} onClose={onClose} contact={contact} customerId={customerId} />;
}

function Body({ onClose, contact, customerId }) {
  const s = useStore();
  const form = useForm(
    {
      customerId: contact?.customerId ?? customerId ?? '',
      name: contact?.name ?? '',
      title: contact?.title ?? '',
      role: contact?.role ?? 'decision',
      phone: contact?.phone ?? '',
      email: contact?.email ?? '',
      siteIds: contact?.siteIds ?? [],
      primary: contact?.primary ?? false,
    },
    validate,
  );
  const { values } = form;

  const customers = useMemo(
    () => list(s.customers).map((c) => ({ value: c.id, label: c.name, sub: `${c.code} · ${c.segment}`, avatar: c.name, shape: c.type === 'individual' ? 'circle' : 'square' })),
    [s.customers],
  );
  const sites = values.customerId ? customerSites(s, values.customerId) : [];

  const save = form.submit((v) => {
    saveContact({ ...(contact ?? {}), ...v, name: v.name.trim() });
    toast(contact ? 'Contact updated' : 'Contact added');
    onClose();
  });

  const toggleSite = (id) =>
    form.set('siteIds', values.siteIds.includes(id) ? values.siteIds.filter((x) => x !== id) : [...values.siteIds, id]);

  return (
    <Drawer
      open
      onClose={onClose}
      title={contact ? 'Edit contact' : 'New contact'}
      subtitle={contact ? undefined : 'A person to call at a customer'}
      footer={
        <>
          {contact && (
            <Button
              variant="danger-ghost"
              className="mr-auto"
              onClick={() => {
                deleteContact(contact.id);
                toast('Contact removed');
                onClose();
              }}
            >
              Remove
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{contact ? 'Save changes' : 'Add contact'}</Button>
        </>
      }
    >
      <form onSubmit={save} className="grid gap-4">
        <Field label="Customer" required error={form.error('customerId')}>
          <Combobox
            options={customers}
            noun="customers"
            placeholder="Choose a customer"
            searchPlaceholder="Search customers"
            {...form.bind('customerId')}
            onChange={(v) => {
              form.set('customerId', v);
              form.set('siteIds', []);
            }}
            disabled={Boolean(contact)}
          />
        </Field>
        <Field label="Name" required error={form.error('name')}>
          <TextInput {...form.bind('name')} autoComplete="off" />
        </Field>
        <Field label="Job title" error={form.error('title')}>
          <TextInput {...form.bind('title')} placeholder="For example Building manager" />
        </Field>
        <Field label="Role in our work" hint="Decides who we call for what: approvals, access, invoices." error={form.error('role')}>
          <Select {...form.bind('role')} options={Object.entries(CONTACT_ROLES).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label="Phone" error={form.error('phone')}>
          <TextInput {...form.bind('phone')} inputMode="tel" placeholder="+971 50 555 0100" />
        </Field>
        <Field label="E-mail" error={form.error('email')}>
          <TextInput {...form.bind('email')} inputMode="email" type="email" />
        </Field>
        {sites.length > 1 && (
          <fieldset className="grid gap-2.5">
            <legend className="mb-1 text-xs font-medium text-slate-700">Acts for these sites</legend>
            <p className="-mt-1 text-xs text-slate-500">Leave all unchecked if this person acts for every site.</p>
            {sites.map((site) => (
              <Checkbox key={site.id} label={site.name} checked={values.siteIds.includes(site.id)} onChange={() => toggleSite(site.id)} />
            ))}
          </fieldset>
        )}
        <Checkbox
          label="Main contact of this customer"
          hint="One person per customer. The list shows this person first."
          checked={values.primary}
          onChange={(v) => form.set('primary', v)}
        />
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}
