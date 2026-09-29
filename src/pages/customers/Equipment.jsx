import { useMemo, useState } from 'react';
import { BanIcon, BoxIcon, PencilIcon, PlusIcon, PowerIcon, Trash2Icon } from 'lucide-react';
import { SYSTEM_TYPES, SYSTEM_TYPE_OPTIONS, deviceTypeOptions } from '@/data/catalog.js';
import { deleteDevice, deleteSystem, saveDevice, saveSystem, setSystemStatus } from '@/store/actions.js';
import { deviceTypeLabel, devicesBySystem, summariseDevices, systemsBySite } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { todayISO } from '@/lib/dates.js';
import { fmtDate } from '@/lib/dates.js';
import { plural } from '@/lib/format.js';
import { Badge, Status } from '@/ui/Badge.jsx';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Segmented, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Menu } from '@/ui/Floating.jsx';
import { ConfirmDialog, Drawer } from '@/ui/Overlay.jsx';
import { EmptyState } from '@/ui/Page.jsx';
import { DataTable } from '@/ui/Table.jsx';
import { DueCell } from './parts.jsx';

// The equipment of one site: systems (what the contractor installed and
// maintains), and inside each the devices, with their next due dates. The
// register is owned by Service (record 39, point 8) and shown here at the site.

const pad = (n) => String(n).padStart(2, '0');
const nextTag = (s, siteId, prefix) => {
  let max = 0;
  for (const d of Object.values(s.devices)) {
    if (d.siteId !== siteId) continue;
    for (const m of d.tag.matchAll(new RegExp(`${prefix}-(\\d+)`, 'g'))) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${pad(max + 1)}`;
};

// `systemDrawer` ({ system|null } or null) is owned by the page, because the
// page header's "Add system" button opens the same drawer.
export function EquipmentTab({ site, editable, openDeviceId, onCloseDevice, systemDrawer, setSystemDrawer }) {
  const s = useStore();
  const systems = systemsBySite(s)[site.id] ?? [];
  const [deviceDrawer, setDeviceDrawer] = useState(null); // { system, device|null }

  // A device opened from the search arrives as ?open=<id>.
  const linked = openDeviceId ? s.devices[openDeviceId] : null;
  const drawer =
    deviceDrawer ?? (linked && linked.siteId === site.id ? { system: s.systems[linked.systemId], device: linked } : null);
  const closeDevice = () => {
    setDeviceDrawer(null);
    onCloseDevice?.();
  };

  return (
    <>
      {systems.length === 0 ? (
        <EmptyState
          icon={BoxIcon}
          title={site.stage === 'construction' ? 'No equipment yet: the site is under construction' : 'No systems recorded at this site'}
          action={editable && <Button variant="primary" icon={PlusIcon} onClick={() => setSystemDrawer({ system: null })}>Add system</Button>}
        >
          {site.stage === 'construction'
            ? 'Systems are added at handover, from the project (Projects, step 5).'
            : 'Add the fire alarm, sprinklers, extinguishers and so on, so visits can be planned.'}
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {systems.map((system) => (
            <SystemCard
              key={system.id}
              system={system}
              editable={editable}
              onAddDevice={() => setDeviceDrawer({ system, device: null })}
              onOpenDevice={(device) => setDeviceDrawer({ system, device })}
              onEditSystem={() => setSystemDrawer({ system })}
            />
          ))}
          {editable && (
            <div>
              <Button icon={PlusIcon} onClick={() => setSystemDrawer({ system: null })}>Add system</Button>
            </div>
          )}
        </div>
      )}
      {drawer?.system && (
        <DeviceDrawer
          key={drawer.device?.id ?? `new-${drawer.system.id}`}
          site={site}
          system={drawer.system}
          device={drawer.device}
          editable={editable}
          onClose={closeDevice}
        />
      )}
      {systemDrawer && (
        <SystemDrawer
          key={systemDrawer.system?.id ?? 'new-system'}
          site={site}
          system={systemDrawer.system}
          onClose={() => setSystemDrawer(null)}
        />
      )}
    </>
  );
}

function SystemCard({ system, editable, onAddDevice, onOpenDevice, onEditSystem }) {
  const s = useStore();
  const type = SYSTEM_TYPES[system.type];
  const Icon = type.icon;
  const devices = devicesBySystem(s)[system.id] ?? [];
  const sum = summariseDevices(devices);
  const [confirm, setConfirm] = useState(false);
  const impaired = system.status === 'impaired';

  const columns = [
    { key: 'tag', header: 'Tag', cell: (d) => <span className="whitespace-nowrap tabular-nums text-slate-900">{d.tag}</span> },
    {
      key: 'type', header: 'Equipment',
      cell: (d) => (
        <div className="min-w-0">
          <p className="truncate text-slate-900">
            {deviceTypeLabel(system.type, d.type)}
            {d.qty > 1 && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs font-medium tabular-nums text-slate-600">× {d.qty}</span>}
          </p>
          <p className="truncate text-xs text-slate-500 lg:hidden">{d.location}</p>
        </div>
      ),
    },
    { key: 'location', header: 'Where', hideBelow: 'lg', cell: (d) => <span className="block max-w-[260px] truncate text-slate-700">{d.location}</span> },
    { key: 'make', header: 'Make and model', hideBelow: 'xl', cell: (d) => <span className="block max-w-[200px] truncate text-slate-700">{[d.make, d.model].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'last', header: 'Last service', hideBelow: 'md', cell: (d) => <span className="whitespace-nowrap tabular-nums text-slate-700">{fmtDate(d.lastServiced)}</span> },
    { key: 'due', header: 'Next due', cell: (d) => <DueCell device={d} /> },
  ];

  return (
    <section className="rounded-2xl border border-slate-200">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{system.name}</h3>
            <Badge>{type.standard}</Badge>
            {impaired && <Status kind="system" value="impaired" />}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {system.location} · installed {system.installedOn.slice(0, 4)} · {plural(sum.items, 'item')} in {plural(sum.rows, 'group')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sum.overdue > 0 && <Badge tone="red" dot>{sum.overdue} overdue</Badge>}
          {sum.soon > 0 && <Badge tone="orange" dot>{sum.soon} due soon</Badge>}
          {sum.overdue === 0 && sum.soon === 0 && sum.rows > 0 && <Badge tone="green" dot>On schedule</Badge>}
          {editable && <Button size="xs" icon={PlusIcon} onClick={onAddDevice}>Add equipment</Button>}
          {editable && (
            <Menu
              button={(p) => <IconButton icon={PencilIcon} label="System actions" size="xs" {...p} />}
              items={[
                { label: 'Edit system', icon: PencilIcon, onClick: onEditSystem },
                impaired
                  ? { label: 'Put back in service', icon: PowerIcon, onClick: () => { setSystemStatus(system.id, 'in_service'); toast('System back in service'); } }
                  : { label: 'Mark out of service (impaired)', icon: BanIcon, onClick: () => { setSystemStatus(system.id, 'impaired'); toast('System marked out of service', { tone: 'error' }); } },
                { separator: true },
                { label: 'Remove system', icon: Trash2Icon, tone: 'danger', onClick: () => setConfirm(true) },
              ]}
            />
          )}
        </div>
      </header>
      {impaired && (
        <p className="mx-5 mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-900">
          <strong className="font-semibold">Out of service.</strong> The customer must be told and the impairment recorded. In step 3 this
          also creates a deficiency of the class “impairment”.
        </p>
      )}
      <div className="border-t border-slate-100 px-5 pb-2">
        <DataTable
          columns={columns}
          rows={devices}
          onRowClick={onOpenDevice}
          empty={<p className="py-6 text-center text-sm text-slate-500">No equipment in this system yet.</p>}
          mobileRow={(d) => (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{d.tag}</p>
                <p className="truncate text-xs text-slate-500">{deviceTypeLabel(system.type, d.type)}{d.qty > 1 ? ` × ${d.qty}` : ''}</p>
              </div>
              <DueCell device={d} />
            </div>
          )}
        />
      </div>
      <ConfirmDialog
        open={confirm}
        title="Remove this system?"
        confirmLabel="Remove"
        tone="danger"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          deleteSystem(system.id);
          toast('System removed');
        }}
      >
        {system.name} and its {plural(devices.length, 'equipment group')} will be removed from the register.
      </ConfirmDialog>
    </section>
  );
}

const validateSystem = (v) => {
  const e = {};
  if (!v.type) e.type = 'Choose the kind of system.';
  if (v.name.trim().length < 3) e.name = 'Give the system a name.';
  return e;
};

function SystemDrawer({ site, system, onClose }) {
  const form = useForm(
    {
      type: system?.type ?? '',
      name: system?.name ?? '',
      location: system?.location ?? '',
      installedOn: system?.installedOn ?? '',
      notes: system?.notes ?? '',
    },
    validateSystem,
  );
  const options = useMemo(() => SYSTEM_TYPE_OPTIONS.map((o) => ({ ...o, icon: SYSTEM_TYPES[o.value].icon })), []);
  const save = form.submit((v) => {
    saveSystem({ ...(system ?? {}), siteId: site.id, ...v, name: v.name.trim() });
    toast(system ? 'System updated' : 'System added');
    onClose();
  });
  return (
    <Drawer
      open
      onClose={onClose}
      title={system ? 'Edit system' : 'Add system'}
      subtitle={site.name}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{system ? 'Save changes' : 'Add system'}</Button>
        </>
      }
    >
      <form onSubmit={save} className="grid gap-4">
        <Field label="Kind of system" required error={form.error('type')} hint={form.values.type ? `Standard: ${SYSTEM_TYPES[form.values.type].standard}` : undefined}>
          <Combobox
            options={options}
            noun="kinds"
            placeholder="Choose a kind"
            searchPlaceholder="Search kinds of system"
            {...form.bind('type')}
            onChange={(v) => {
              form.set('type', v);
              if (!form.values.name) form.set('name', SYSTEM_TYPES[v].label);
            }}
            disabled={Boolean(system)}
          />
        </Field>
        <Field label="Name" required error={form.error('name')}><TextInput {...form.bind('name')} /></Field>
        <Field label="Main location" hint="Where the panel, pump or main equipment is."><TextInput {...form.bind('location')} /></Field>
        <Field label="Installed on"><TextInput type="date" {...form.bind('installedOn')} /></Field>
        <Field label="Notes"><TextInput {...form.bind('notes')} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

const validateDevice = (v) => {
  const e = {};
  if (!v.type) e.type = 'Choose what it is.';
  if (!(Number(v.qty) >= 1)) e.qty = 'At least 1.';
  if (!v.location.trim()) e.location = 'Say where it is.';
  return e;
};

function DeviceDrawer({ site, system, device, editable, onClose }) {
  const s = useStore();
  const def = SYSTEM_TYPES[system.type].devices;
  const form = useForm(
    {
      type: device?.type ?? '',
      qty: String(device?.qty ?? 1),
      tag: device?.tag ?? '',
      location: device?.location ?? '',
      make: device?.make ?? '',
      model: device?.model ?? '',
      serial: device?.serial ?? '',
      installedOn: device?.installedOn ?? todayISO(),
      lastServiced: device?.lastServiced ?? todayISO(),
      intervalMonths: String(device?.intervalMonths ?? 12),
      condition: device?.condition ?? 'ok',
    },
    validateDevice,
  );
  const { values } = form;
  const save = form.submit((v) => {
    const prefix = def[v.type]?.prefix ?? 'EQ';
    saveDevice({
      ...(device ?? {}), siteId: site.id, systemId: system.id, ...v,
      qty: Number(v.qty), intervalMonths: Number(v.intervalMonths),
      tag: v.tag.trim() || nextTag(s, site.id, prefix),
    });
    toast(device ? 'Equipment updated' : 'Equipment added');
    onClose();
  });
  return (
    <Drawer
      open
      onClose={onClose}
      title={device ? device.tag : 'Add equipment'}
      subtitle={`${system.name} · ${site.name}`}
      footer={
        editable ? (
          <>
            {device && (
              <Button
                variant="danger-ghost"
                className="mr-auto"
                onClick={() => {
                  deleteDevice(device.id);
                  toast('Equipment removed');
                  onClose();
                }}
              >
                Remove
              </Button>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save}>{device ? 'Save changes' : 'Add equipment'}</Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <form onSubmit={save} className="grid gap-4" inert={editable ? undefined : true}>
        <Field label="What it is" required error={form.error('type')}>
          <Combobox
            options={deviceTypeOptions(system.type)}
            noun="kinds"
            placeholder="Choose the equipment"
            searchPlaceholder="Search equipment"
            {...form.bind('type')}
            onChange={(v) => {
              form.set('type', v);
              form.set('intervalMonths', String(def[v]?.months ?? 12));
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantity" required error={form.error('qty')} hint="More than 1 for a group of the same item.">
            <TextInput {...form.bind('qty')} inputMode="numeric" />
          </Field>
          <Field label="Tag" hint="Leave empty for an automatic tag.">
            <TextInput {...form.bind('tag')} placeholder={values.type ? nextTag(s, site.id, def[values.type]?.prefix ?? 'EQ') : ''} />
          </Field>
        </div>
        <Field label="Where" required error={form.error('location')}><TextInput {...form.bind('location')} placeholder="For example Level 3 corridor" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Make"><TextInput {...form.bind('make')} /></Field>
          <Field label="Model"><TextInput {...form.bind('model')} /></Field>
        </div>
        <Field label="Serial number"><TextInput {...form.bind('serial')} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Installed on"><TextInput type="date" {...form.bind('installedOn')} /></Field>
          <Field label="Last serviced"><TextInput type="date" {...form.bind('lastServiced')} /></Field>
        </div>
        <Field label="Service every" hint="Sample interval. The real one comes from the standard, the authority and the contract.">
          <Select {...form.bind('intervalMonths')} options={[{ value: '3', label: '3 months' }, { value: '6', label: '6 months' }, { value: '12', label: '12 months' }]} />
        </Field>
        <Field label="Condition">
          <Segmented
            label="Condition"
            value={values.condition}
            onChange={(v) => form.set('condition', v)}
            options={[{ value: 'ok', label: 'In service' }, { value: 'out_of_service', label: 'Out of service' }]}
          />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}
