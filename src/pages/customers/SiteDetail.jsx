import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PencilIcon, PlusIcon, ShieldCheckIcon, Trash2Icon, UserPlusIcon } from 'lucide-react';
import { deleteSite, updateSite } from '@/store/actions.js';
import { contactRoleLabel, list, siteContacts, siteSummary, systemsBySite } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { diffDays, fmtDate, relTime, todayISO } from '@/lib/dates.js';
import { num, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { Avatar, Badge } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Field, TextInput, useForm } from '@/ui/Form.jsx';
import { ConfirmDialog, Drawer } from '@/ui/Overlay.jsx';
import { Card, DefinitionList, EmptyState, Page, Tabs } from '@/ui/Page.jsx';
import { SYSTEM_TYPES } from '@/data/catalog.js';
import { ContactDrawer } from './ContactDrawer.jsx';
import { EquipmentTab } from './Equipment.jsx';
import { ContactRows, HealthBadge, staffName } from './parts.jsx';

const ABOUT = {
  purpose: 'One building or place: what it is, who owns it and who pays, how to get in, what equipment is installed and how soon each part needs service.',
  why: [
    'Equipment is a tab of the site because inspections and service always attach to the site and run per device; customer, site, system, device is the hierarchy every mature product for fire contractors uses (record 39, point 8).',
    'The register of systems and devices belongs to the Service area; it is shown here because the site is where people look for it.',
    'The Civil Defence details are kept by Service too (record 39, point 8) and shown in their own card so it is clear they are not customer data.',
    'Health is the worst state among the devices, with a count, so an overdue item is never hidden inside a healthy site.',
  ],
  assumed: [
    'The Civil Defence file number, the last inspection and the certificate validity are samples; how each emirate approves and inspects is confirmed in the research of phase 2.',
    'Bulk items (600 detectors) are kept as one group with a quantity and a tag range, the way the reference company\'s register is assumed to work.',
  ],
};

export function SiteDetail() {
  const { siteId } = useParams();
  const s = useStore();
  const site = s.sites[siteId];
  if (!site) {
    return (
      <Page title="Site not found" back="/customers/sites">
        <EmptyState title="This site does not exist" action={<Button variant="primary" to="/customers/sites">All sites</Button>}>
          It may have been deleted.
        </EmptyState>
      </Page>
    );
  }
  return <Body key={site.id} site={site} />;
}

function certificate(expiry) {
  const days = diffDays(todayISO(), expiry);
  if (days < 0) return <Badge tone="red" dot>Expired {-days} days ago</Badge>;
  if (days <= 90) return <Badge tone="orange" dot>Expires in {days} days</Badge>;
  return <Badge tone="green" dot>Valid</Badge>;
}

function Body({ site }) {
  const s = useStore();
  const navigate = useNavigate();
  const { canEdit } = useSession();
  const [tab, setTab] = useParam('tab', 'overview');
  const [openDevice, setOpenDevice] = useParam('open');
  const [systemDrawer, setSystemDrawer] = useState(null);
  const [contactDrawer, setContactDrawer] = useState({ open: false, contact: null });
  const [cdOpen, setCdOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const owner = s.customers[site.customerId];
  const payer = s.customers[site.billToId];
  const sum = siteSummary(s, site.id);
  const systems = systemsBySite(s)[site.id] ?? [];
  const contacts = siteContacts(s, site);
  const activity = list(s.activity)
    .filter((a) => a.entity === 'site' && a.entityId === site.id)
    .toSorted((a, b) => b.at.localeCompare(a.at));

  const editSite = canEdit('customers');
  const editService = canEdit('service');

  const menu = editSite
    ? [
        { label: 'Edit site', icon: PencilIcon, onClick: () => navigate(`/customers/sites/${site.id}/edit`) },
        { label: 'Add contact', icon: UserPlusIcon, onClick: () => setContactDrawer({ open: true, contact: null }) },
        { separator: true },
        { label: 'Delete site', icon: Trash2Icon, tone: 'danger', onClick: () => setConfirmDelete(true), disabled: systems.length > 0, sub: systems.length > 0 ? 'It has systems' : undefined },
      ]
    : undefined;

  return (
    <Page
      title={site.name}
      badge={<HealthBadge summary={sum} />}
      facts={`${site.type} · ${site.area}, ${site.emirate} · ${plural(site.floors, 'floor')} · ${owner?.name}`}
      back="/customers/sites"
      about={ABOUT}
      menu={menu}
      actions={
        editService && (
          <Button
            variant="primary"
            icon={PlusIcon}
            onClick={() => {
              setTab('equipment');
              setSystemDrawer({ system: null });
            }}
          >
            Add system
          </Button>
        )
      }
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'equipment', label: 'Equipment', count: systems.length },
            { value: 'contacts', label: 'Contacts', count: contacts.length },
          ]}
        />
      }
    >
      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card title="Site details" action={editSite && <Button variant="ghost" size="xs" icon={PencilIcon} to={`/customers/sites/${site.id}/edit`}>Edit</Button>}>
              <DefinitionList
                items={[
                  { label: 'Type', value: site.type },
                  { label: 'Stage', value: site.stage === 'construction' ? 'Under construction' : 'Operating' },
                  { label: 'Floors', value: num(site.floors) },
                  { label: 'Built-up area', value: site.builtUp ? `${num(site.builtUp)} m²` : '' },
                  { label: 'Owner', value: owner && <Link className="font-medium hover:underline" to={`/customers/${owner.id}`}>{owner.name}</Link> },
                  { label: 'Invoices go to', value: payer && (payer.id === owner?.id ? 'The owner' : <Link className="font-medium hover:underline" to={`/customers/${payer.id}`}>{payer.name}</Link>) },
                  { label: 'Address', span: 2, value: [site.address, site.area, site.emirate].filter(Boolean).join(', ') },
                  { label: 'Access notes', span: 2, value: site.access },
                ]}
              />
            </Card>
            <Card title="Service health">
              {systems.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {site.stage === 'construction' ? 'Under construction: systems are added at handover.' : 'No systems recorded yet.'}
                </p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ['Systems', sum.systems, ''],
                      ['Items', sum.items, ''],
                      ['Overdue', sum.overdue, sum.overdue ? 'text-red-700' : ''],
                      ['Due in 30 days', sum.soon, sum.soon ? 'text-orange-700' : ''],
                    ].map(([label, value, tone]) => (
                      <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
                        <dt className="text-xs text-slate-500">{label}</dt>
                        <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${tone || 'text-slate-900'}`}>{num(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <ul className="mt-4 divide-y divide-slate-100">
                    {systems.map((sys) => {
                      const Icon = SYSTEM_TYPES[sys.type].icon;
                      return (
                        <li key={sys.id}>
                          <button type="button" onClick={() => setTab('equipment')} className="flex w-full items-center gap-3 py-2.5 text-left hover:opacity-80">
                            <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon className="size-4" aria-hidden="true" /></span>
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{sys.name}</span>
                            <span className="text-xs text-slate-500">{SYSTEM_TYPES[sys.type].standard}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Card>
          </div>
          <div className="space-y-5">
            <Card
              title="Civil Defence"
              action={editService && <Button variant="ghost" size="xs" icon={PencilIcon} onClick={() => setCdOpen(true)}>{site.civilDefence ? 'Edit' : 'Add'}</Button>}
            >
              {site.civilDefence ? (
                <DefinitionList
                  cols={1}
                  items={[
                    { label: 'File number (sample)', value: <span className="tabular-nums">{site.civilDefence.fileNo}</span> },
                    { label: 'Last inspection', value: fmtDate(site.civilDefence.lastInspection) },
                    { label: 'Certificate valid until', value: <span className="flex flex-wrap items-center gap-2">{fmtDate(site.civilDefence.certificateExpiry)} {certificate(site.civilDefence.certificateExpiry)}</span> },
                  ]}
                />
              ) : (
                <p className="flex items-start gap-3 text-sm text-slate-500">
                  <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  No Civil Defence details recorded for this site.
                </p>
              )}
              <p className="mt-4 text-xs text-slate-500">Kept by Service and shown here. Sample data.</p>
            </Card>
            <Card
              title="People at this site"
              action={editSite && <Button variant="ghost" size="xs" icon={PlusIcon} onClick={() => setContactDrawer({ open: true, contact: null })}>Add</Button>}
            >
              {contacts.length === 0 ? (
                <p className="text-sm text-slate-500">No contact yet.</p>
              ) : (
                <ul className="-my-1.5 divide-y divide-slate-100">
                  {contacts.toSorted((a, b) => Number(b.siteIds.length > 0) - Number(a.siteIds.length > 0)).slice(0, 4).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <Avatar name={p.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                        <p className="truncate text-xs text-slate-500">{p.title} · {contactRoleLabel(p.role)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {contacts.length > 4 && (
                <button type="button" onClick={() => setTab('contacts')} className="mt-3 text-sm font-medium text-slate-900 underline underline-offset-2">
                  See all {contacts.length}
                </button>
              )}
            </Card>
            <Card title="Recent activity">
              {activity.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing yet.</p>
              ) : (
                <ol className="space-y-3">
                  {activity.slice(0, 6).map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800">{a.text}</p>
                        <p className="text-xs text-slate-500">{staffName(s, a.by)} · {relTime(a.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'equipment' && (
        <EquipmentTab
          site={site}
          editable={editService}
          openDeviceId={openDevice}
          onCloseDevice={() => setOpenDevice('')}
          systemDrawer={systemDrawer}
          setSystemDrawer={setSystemDrawer}
        />
      )}

      {tab === 'contacts' && (
        <ContactRows
          contacts={contacts}
          editable={editSite}
          onEdit={(contact) => setContactDrawer({ open: true, contact })}
          onAdd={() => setContactDrawer({ open: true, contact: null })}
        />
      )}

      <ContactDrawer
        open={contactDrawer.open}
        contact={contactDrawer.contact}
        customerId={site.customerId}
        siteId={site.id}
        onClose={() => setContactDrawer({ open: false, contact: null })}
      />
      {cdOpen && <CivilDefenceDrawer site={site} onClose={() => setCdOpen(false)} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this site?"
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteSite(site.id);
          toast('Site deleted');
          navigate('/customers/sites', { replace: true });
        }}
      >
        {site.name} will be removed. This cannot be undone.
      </ConfirmDialog>
    </Page>
  );
}

function CivilDefenceDrawer({ site, onClose }) {
  const cd = site.civilDefence;
  const form = useForm(
    { fileNo: cd?.fileNo ?? '', lastInspection: cd?.lastInspection ?? '', certificateExpiry: cd?.certificateExpiry ?? '' },
    (v) => (v.fileNo.trim() ? {} : { fileNo: 'Write the file number.' }),
  );
  const save = form.submit((v) => {
    updateSite(site.id, { civilDefence: { ...v, fileNo: v.fileNo.trim() } }, 'Civil Defence details updated');
    toast('Civil Defence details saved');
    onClose();
  });
  return (
    <Drawer
      open
      onClose={onClose}
      title="Civil Defence details"
      subtitle={site.name}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </>
      }
    >
      <form onSubmit={save} className="grid gap-4">
        <Field label="File number" required error={form.error('fileNo')}><TextInput {...form.bind('fileNo')} /></Field>
        <Field label="Last inspection"><TextInput type="date" {...form.bind('lastInspection')} /></Field>
        <Field label="Certificate valid until"><TextInput type="date" {...form.bind('certificateExpiry')} /></Field>
        <p className="text-xs text-slate-500">
          Sample fields. How each emirate approves contracts and receives reports is confirmed in the research of phase 2.
        </p>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}
