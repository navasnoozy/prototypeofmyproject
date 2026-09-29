import { MailIcon, MapPinIcon, PencilIcon, PhoneIcon, PlusIcon, UserPlusIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { fmtDate } from '@/lib/dates.js';
import { contactRoleLabel, dueOf, list, siteHealth } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { Avatar, Badge, Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { EmptyState, NavTabs } from '@/ui/Page.jsx';

// Small pieces shared by the screens of the Customers area.

// The three pages of the area, as tabs above the divider line.
export function CustomersTabs() {
  const s = useStore();
  return (
    <NavTabs
      items={[
        { to: '/customers', label: 'Customers', count: list(s.customers).length },
        { to: '/customers/sites', label: 'Sites', count: list(s.sites).length },
        { to: '/customers/contacts', label: 'Contacts', count: list(s.contacts).length },
      ]}
    />
  );
}

// The service state of a whole site: its worst device decides.
export const HealthBadge = ({ summary }) => <Status kind="due" value={siteHealth(summary)} />;

// When a device is next due, with the state in words under the date.
const dueTone = { ok: 'text-slate-500', soon: 'text-orange-700', overdue: 'font-medium text-red-700', out: 'text-slate-400' };
export function DueCell({ device }) {
  const due = dueOf(device);
  const words =
    due.status === 'out' ? 'Out of service'
    : due.days < 0 ? `${-due.days} day${due.days === -1 ? '' : 's'} overdue`
    : due.days === 0 ? 'Due today'
    : `in ${due.days} day${due.days === 1 ? '' : 's'}`;
  return (
    <div>
      <div className="tabular-nums text-slate-900">{fmtDate(due.next)}</div>
      <div className={cn('text-xs', dueTone[due.status])}>{words}</div>
    </div>
  );
}

// A site's small square tile (a building has no initials worth showing).
export const SiteTile = ({ className }) => (
  <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600', className)}>
    <MapPinIcon className="size-4" aria-hidden="true" />
  </span>
);

export const customerName = (s, id) => s.customers[id]?.name ?? '—';
export const staffName = (s, id) => s.staff[id]?.name ?? '—';

// The people of a customer or of a site, one row each.
export function ContactRows({ contacts, editable, onEdit, onAdd, showCustomer, mainFirst = true }) {
  if (contacts.length === 0) {
    return (
      <EmptyState icon={UserPlusIcon} title="No contact yet" action={editable && <Button variant="primary" icon={PlusIcon} onClick={onAdd}>Add contact</Button>}>
        Add the people to call: the decision maker, the building manager, the accounts clerk.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {(mainFirst ? contacts.toSorted((a, b) => Number(b.primary) - Number(a.primary)) : contacts).map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <Avatar name={p.name} size="md" />
          <div className="min-w-0 flex-1 basis-48">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <span className="truncate">{p.name}</span>
              {p.primary && <Badge tone="blue">Main</Badge>}
            </p>
            <p className="truncate text-xs text-slate-500">{p.title} · {contactRoleLabel(p.role)}{showCustomer ? ` · ${showCustomer(p)}` : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
            {p.phone && <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 hover:underline"><PhoneIcon className="size-3.5 text-slate-400" aria-hidden="true" />{p.phone}</a>}
            {p.email && <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 hover:underline"><MailIcon className="size-3.5 text-slate-400" aria-hidden="true" /><span className="break-all">{p.email}</span></a>}
          </div>
          {editable && <Button variant="ghost" size="xs" icon={PencilIcon} onClick={() => onEdit(p)}>Edit</Button>}
        </li>
      ))}
    </ul>
  );
}
