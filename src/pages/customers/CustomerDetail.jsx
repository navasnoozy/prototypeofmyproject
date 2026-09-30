import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { InboxIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, Trash2Icon, UserPlusIcon } from 'lucide-react';
import { effectiveStatus, customerEnquiries, customerQuotations, quotationLabel, quoteTotals } from '@/store/salesSelectors.js';
import { activityFor, customerContacts, customerSites, paidSites, siteSummary } from '@/store/selectors.js';
import { deleteCustomer, setCustomerStatus } from '@/store/actions.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { aed, plural } from '@/lib/format.js';
import { todayISO } from '@/lib/dates.js';
import { fmtDate } from '@/lib/dates.js';
import { useParam } from '@/lib/useParam.js';
import { Avatar, Badge, Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { ConfirmDialog, Modal } from '@/ui/Overlay.jsx';
import { Field, TextArea } from '@/ui/Form.jsx';
import { Card, DefinitionList, EmptyState, Page, Tabs } from '@/ui/Page.jsx';
import { DataTable } from '@/ui/Table.jsx';
import { CustomerMoneyCard } from '@/pages/billing/parts.jsx';
import { ContactDrawer } from './ContactDrawer.jsx';
import { KindTag } from '@/pages/sales/parts.jsx';
import { ActivityList } from '@/ui/Activity.jsx';
import { ContactRows, HealthBadge, SiteTile, staffName } from './parts.jsx';

const ABOUT = {
  purpose: 'Everything about one customer in one place: terms, people, the sites we look after for them, the money they owe (for those who see Billing), and what happened.',
  why: [
    'The header keeps the name, the state and the one next step visible while you scroll; the next step follows the life cycle: a customer without a site starts with "Add site".',
    'A customer on hold shows a banner at the top of the page and a red dot on the bell, so nobody starts work by mistake.',
    'The party that pays for a site can differ from its owner; the Sites view therefore lists the sites this customer owns and the ones it only pays for (record 39, point 8).',
  ],
  assumed: [
    'Only the owner or the operations manager may release a hold (sample rule).',
    'Deleting is allowed only while a customer has no sites; a customer with history is put on hold or made inactive instead.',
  ],
};

export function CustomerDetail() {
  const { customerId } = useParams();
  const s = useStore();
  const customer = s.customers[customerId];
  if (!customer) {
    return (
      <Page title="Customer not found" back="/customers">
        <EmptyState title="This customer does not exist" action={<Button variant="primary" to="/customers">All customers</Button>}>
          It may have been deleted.
        </EmptyState>
      </Page>
    );
  }
  return <Body key={customer.id} customer={customer} />;
}

function Body({ customer }) {
  const s = useStore();
  const navigate = useNavigate();
  const { canEdit, access, roleKey } = useSession();
  const [tab, setTab] = useParam('tab', 'overview');
  const [contactDrawer, setContactDrawer] = useState({ open: false, contact: null });
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sites = customerSites(s, customer.id);
  const paying = paidSites(s, customer.id);
  const contacts = customerContacts(s, customer.id);
  const activity = activityFor(s, 'customer', customer.id);
  const enquiries = customerEnquiries(s, customer.id);
  const quotes = customerQuotations(s, customer.id);

  const editable = canEdit('customers');
  const canRelease = ['owner', 'manager'].includes(roleKey);
  const onHold = customer.status === 'on_hold';
  const canDelete = sites.length === 0 && paying.length === 0;

  const menu = editable
    ? [
        { label: 'Edit customer', icon: PencilIcon, onClick: () => navigate(`/customers/${customer.id}/edit`) },
        { label: 'Add contact', icon: UserPlusIcon, onClick: () => setContactDrawer({ open: true, contact: null }) },
        canEdit('sales') && { label: 'New enquiry', icon: InboxIcon, onClick: () => navigate(`/sales/new?customer=${customer.id}`) },
        { separator: true },
        onHold
          ? { label: 'Take off hold', icon: PlayIcon, onClick: () => { setCustomerStatus(customer.id, 'active'); toast('Customer taken off hold'); }, disabled: !canRelease, sub: canRelease ? undefined : 'Owner or manager only' }
          : { label: 'Put on hold', icon: PauseIcon, onClick: () => setHoldOpen(true) },
        { label: 'Delete customer', icon: Trash2Icon, tone: 'danger', onClick: () => setConfirmDelete(true), disabled: !canDelete, sub: canDelete ? undefined : 'It has sites' },
      ].filter(Boolean)
    : undefined;

  // The one main step follows the life cycle: a customer without a site starts
  // with a site; after that the next step is a quotation.
  const hasSite = sites.length + paying.length > 0;
  const cta =
    editable &&
    (hasSite && canEdit('sales') ? (
      <Button variant="primary" icon={PlusIcon} to={`/sales/quotations/new?customer=${customer.id}`}>New quotation</Button>
    ) : (
      <Button variant="primary" icon={PlusIcon} to={`/customers/sites/new?customer=${customer.id}`}>Add site</Button>
    ));

  return (
    <Page
      title={customer.name}
      badge={<Status kind="customer" value={customer.status} />}
      facts={`${customer.code} · ${customer.segment} · ${customer.terms} · ${sites.length > 0 || paying.length === 0 ? plural(sites.length, 'site') : ''}${sites.length > 0 && paying.length > 0 ? ', ' : ''}${paying.length > 0 ? `pays for ${plural(paying.length, 'site')}` : ''}`}
      back="/customers"
      about={ABOUT}
      menu={menu}
      actions={cta}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'sites', label: 'Sites', count: sites.length + paying.length },
            { value: 'contacts', label: 'Contacts', count: contacts.length },
            ...(access('sales') ? [{ value: 'sales', label: 'Sales', count: enquiries.length + quotes.length }] : []),
          ]}
        />
      }
    >
      {onHold && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <PauseIcon className="size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            <strong className="font-semibold">On hold.</strong> {customer.holdReason ? `${customer.holdReason.replace(/[.\s]*$/, '.')} ` : ''}New work needs the owner's approval.
          </p>
          {editable && canRelease && (
            <Button size="sm" onClick={() => { setCustomerStatus(customer.id, 'active'); toast('Customer taken off hold'); }}>Take off hold</Button>
          )}
        </div>
      )}

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card title="Details" action={editable && <Button variant="ghost" size="xs" icon={PencilIcon} to={`/customers/${customer.id}/edit`}>Edit</Button>}>
              <DefinitionList
                items={[
                  { label: 'Type', value: customer.type === 'individual' ? 'Individual' : 'Company' },
                  { label: 'Segment', value: customer.segment },
                  customer.group && { label: 'Group', value: customer.group },
                  { label: 'TRN', value: customer.trn && <span className="tabular-nums">{customer.trn}</span> },
                  { label: 'Payment terms', value: customer.terms },
                  { label: 'Credit limit', value: customer.creditLimit ? aed(customer.creditLimit) : 'No credit (pay on delivery)' },
                  { label: 'Sales owner', value: staffName(s, customer.salesOwner) },
                  { label: 'Customer since', value: fmtDate(customer.since) },
                  { label: 'Phone', value: customer.phone && <a className="hover:underline" href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a> },
                  { label: 'E-mail', value: customer.email && <a className="break-all hover:underline" href={`mailto:${customer.email}`}>{customer.email}</a> },
                  { label: 'Address', span: 2, value: [customer.address, customer.area, customer.emirate].filter(Boolean).join(', ') },
                  customer.notes && { label: 'Notes', span: 2, value: customer.notes },
                ]}
              />
            </Card>
            <Card
              title={`Sites (${sites.length + paying.length})`}
              action={editable && <Button variant="ghost" size="xs" icon={PlusIcon} to={`/customers/sites/new?customer=${customer.id}`}>Add site</Button>}
              bodyClassName="!px-2"
            >
              {sites.length === 0 && paying.length === 0 && (
                <p className="px-3 pb-2 text-sm text-slate-500">No site yet. Add the first one to start quoting and servicing.</p>
              )}
              {sites.length === 0 && paying.length > 0 && (
                <p className="px-3 pb-2 text-sm text-slate-500">This customer owns no site of its own. It pays for the sites below.</p>
              )}
              <SiteLinks s={s} sites={sites} />
              {paying.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-3 text-xs font-medium text-slate-500">Pays for (owned by others)</p>
                  <SiteLinks s={s} sites={paying} showOwner />
                </>
              )}
            </Card>
          </div>
          <div className="space-y-5">
            {access('billing') && <CustomerMoneyCard customerId={customer.id} />}
            <Card
              title="People"
              action={editable && <Button variant="ghost" size="xs" icon={PlusIcon} onClick={() => setContactDrawer({ open: true, contact: null })}>Add</Button>}
            >
              {contacts.length === 0 ? (
                <p className="text-sm text-slate-500">No contact yet.</p>
              ) : (
                <ul className="-my-1.5 divide-y divide-slate-100">
                  {contacts.toSorted((a, b) => Number(b.primary) - Number(a.primary)).slice(0, 5).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <Avatar name={p.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                        <p className="truncate text-xs text-slate-500">{p.title}</p>
                      </div>
                      {p.primary && <Badge tone="blue">Main</Badge>}
                    </li>
                  ))}
                </ul>
              )}
              {contacts.length > 5 && (
                <button type="button" onClick={() => setTab('contacts')} className="mt-3 text-sm font-medium text-slate-900 underline underline-offset-2">
                  See all {contacts.length}
                </button>
              )}
            </Card>
            <Card title="Recent activity"><ActivityList entries={activity} /></Card>
          </div>
        </div>
      )}

      {tab === 'sites' && (
        <div className="space-y-8">
          <SitesTable s={s} sites={sites} empty="This customer owns no site yet." />
          {paying.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Sites this customer pays for</h2>
              <p className="mb-2 mt-0.5 text-xs text-slate-500">Owned by another customer; the invoices go here.</p>
              <SitesTable s={s} sites={paying} showOwner />
            </div>
          )}
        </div>
      )}

      {tab === 'sales' && <SalesTab s={s} enquiries={enquiries} quotes={quotes} canSell={canEdit('sales')} customer={customer} />}

      {tab === 'contacts' && (
        <ContactRows
          contacts={contacts}
          editable={editable}
          onEdit={(contact) => setContactDrawer({ open: true, contact })}
          onAdd={() => setContactDrawer({ open: true, contact: null })}
        />
      )}

      <ContactDrawer
        open={contactDrawer.open}
        contact={contactDrawer.contact}
        customerId={customer.id}
        onClose={() => setContactDrawer({ open: false, contact: null })}
      />

      <Modal
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        title="Put this customer on hold?"
        footer={
          <>
            <Button onClick={() => setHoldOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!holdReason.trim()}
              onClick={() => {
                setCustomerStatus(customer.id, 'on_hold', holdReason.trim());
                setHoldOpen(false);
                setHoldReason('');
                toast('Customer put on hold');
              }}
            >
              Put on hold
            </Button>
          </>
        }
      >
        <p className="mb-4">New quotations and jobs for this customer will then need the owner's approval.</p>
        <Field label="Reason" required>
          <TextArea value={holdReason} onChange={setHoldReason} rows={3} placeholder="For example: two invoices overdue by more than 60 days" />
        </Field>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this customer?"
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteCustomer(customer.id);
          toast('Customer deleted');
          navigate('/customers', { replace: true });
        }}
      >
        {customer.name} and its contacts will be removed. This cannot be undone.
      </ConfirmDialog>
    </Page>
  );
}

function SiteLinks({ s, sites, showOwner }) {
  return (
    <ul>
      {sites.map((site) => (
        <li key={site.id}>
          <Link to={`/customers/sites/${site.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
            <SiteTile />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">{site.name}</span>
              <span className="block truncate text-xs text-slate-500">
                {showOwner ? `Owner: ${s.customers[site.customerId]?.name}` : `${site.type} · ${site.area}`}
              </span>
            </span>
            <HealthBadge summary={siteSummary(s, site.id)} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SitesTable({ s, sites, empty, showOwner }) {
  const columns = [
    {
      key: 'name', header: 'Site',
      cell: (x) => (
        <div className="flex min-w-0 items-center gap-3">
          <SiteTile />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{x.name}</p>
            <p className="truncate text-xs text-slate-500">{showOwner ? `Owner: ${s.customers[x.customerId]?.name}` : `${x.address}, ${x.area}`}</p>
          </div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', hideBelow: 'md', cell: (x) => <span className="text-slate-700">{x.type}</span> },
    { key: 'systems', header: 'Systems', align: 'right', cell: (x) => siteSummary(s, x.id).systems },
    { key: 'health', header: 'Service', cell: (x) => <HealthBadge summary={siteSummary(s, x.id)} /> },
  ];
  return (
    <DataTable
      columns={columns}
      rows={sites}
      rowHref={(x) => `/customers/sites/${x.id}`}
      empty={<EmptyState title={empty ?? 'No sites'} />}
      mobileRow={(x) => (
        <div className="flex items-center gap-3">
          <SiteTile />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">{x.name}</p>
            <p className="truncate text-xs text-slate-500">{x.type} · {x.area}</p>
          </div>
          <HealthBadge summary={siteSummary(s, x.id)} />
        </div>
      )}
    />
  );
}

function SalesTab({ s, enquiries, quotes, canSell, customer }) {
  const today = todayISO();
  const newest = (a, b) => b.localeCompare(a);
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Quotations</h2>
          {canSell && <Button size="xs" icon={PlusIcon} to={`/sales/quotations/new?customer=${customer.id}`}>New quotation</Button>}
        </div>
        {quotes.length === 0 ? (
          <p className="text-sm text-slate-500">No quotation for this customer yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {quotes.toSorted((a, b) => newest(a.createdOn, b.createdOn)).map((q) => (
              <li key={q.id}>
                <Link to={`/sales/quotations/${q.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{quotationLabel(q)} · {q.title}</span>
                    <span className="block truncate text-xs text-slate-500"><KindTag kind={q.kind} className="text-xs" /> · {s.sites[q.siteId]?.name ?? 'No site'} · {fmtDate(q.createdOn)}</span>
                  </span>
                  <span className="hidden text-sm tabular-nums text-slate-700 sm:block">{aed(quoteTotals(q, s.settings.vatRate).total)}</span>
                  <Status kind="quotation" value={effectiveStatus(q, today)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Enquiries</h2>
          {canSell && <Button size="xs" icon={PlusIcon} to={`/sales/new?customer=${customer.id}`}>New enquiry</Button>}
        </div>
        {enquiries.length === 0 ? (
          <p className="text-sm text-slate-500">No enquiry from this customer yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {enquiries.toSorted((a, b) => newest(a.receivedOn, b.receivedOn)).map((e) => (
              <li key={e.id}>
                <Link to={`/sales/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{e.number} · {e.title}</span>
                    <span className="block truncate text-xs text-slate-500"><KindTag kind={e.kind} className="text-xs" /> · came in {fmtDate(e.receivedOn)}</span>
                  </span>
                  <Status kind="enquiry" value={e.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
