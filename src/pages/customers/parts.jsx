import { MapPinIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { fmtDate } from '@/lib/dates.js';
import { list, dueOf, siteHealth } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { Status } from '@/ui/Badge.jsx';
import { NavTabs } from '@/ui/Page.jsx';

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
