import { useMemo, useState } from 'react';
import { PlusIcon, UsersIcon } from 'lucide-react';
import { CONTACT_ROLES } from '@/data/catalog.js';
import { plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Button } from '@/ui/Button.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { ContactDrawer } from './ContactDrawer.jsx';
import { ContactRows, CustomersTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'Everyone we may need to call, across all customers: who decides, who lets us in, who pays. Search by name, phone or e-mail.',
  why: [
    'A contact belongs to a customer and may act for particular sites; the role says what to call them for (approvals, access, accounts).',
    'Contacts are their own page because a technician standing at a gate looks for a person, not for a customer.',
  ],
  assumed: ['The five roles are samples. Whether contacts also get a login for a customer portal is a later decision.'],
};

export function ContactList() {
  const s = useStore();
  const { canEdit } = useSession();
  const [q, setQ] = useParam('q');
  const [role, setRole] = useParam('role');
  const [newParam, setNewParam] = useParam('new');
  const [openId, setOpenId] = useParam('open');
  const [drawer, setDrawer] = useState(null); // { contact|null }

  const all = list(s.contacts);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter(
        (p) =>
          (!role || p.role === role) &&
          (!needle || `${p.name} ${p.title} ${p.phone} ${p.email} ${s.customers[p.customerId]?.name}`.toLowerCase().includes(needle)),
      )
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [all, q, role, s.customers]);

  // Opened from the search ("?open=id") or from a quick action ("?new=1").
  const linked = openId ? s.contacts[openId] : null;
  const current = drawer ?? (linked ? { contact: linked } : newParam ? { contact: null } : null);
  const closeDrawer = () => {
    setDrawer(null);
    setOpenId('');
    setNewParam('');
  };

  return (
    <Page
      title="Contacts"
      facts={`${plural(all.length, 'person', 'people')} at ${plural(new Set(all.map((p) => p.customerId)).size, 'customer')}`}
      tabs={<CustomersTabs />}
      about={ABOUT}
      actions={canEdit('customers') && <Button variant="primary" icon={PlusIcon} onClick={() => setDrawer({ contact: null })}>New contact</Button>}
    >
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search name, phone, e-mail, customer" />
        <FilterSelect label="Role" value={role} onChange={setRole} options={Object.entries(CONTACT_ROLES).map(([value, label]) => ({ value, label }))} />
      </Toolbar>
      {rows.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No contact matches" action={<Button onClick={() => { setQ(''); setRole(''); }}>Clear filters</Button>}>
          Try fewer words or clear the filters.
        </EmptyState>
      ) : (
        <ContactRows
          contacts={rows}
          editable={canEdit('customers')}
          showCustomer={(p) => s.customers[p.customerId]?.name}
          mainFirst={false}
          onEdit={(contact) => setDrawer({ contact })}
          onAdd={() => setDrawer({ contact: null })}
        />
      )}
      {current && (
        <ContactDrawer open contact={current.contact} onClose={closeDrawer} />
      )}
    </Page>
  );
}
