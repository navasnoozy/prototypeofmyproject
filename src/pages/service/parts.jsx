import { JOB_KINDS } from '@/data/serviceKinds.js';
import { cn } from '@/lib/cn.js';
import { todayISO } from '@/lib/dates.js';
import { contractStatus, jobStatus, openDeficiencies } from '@/store/serviceSelectors.js';
import { list } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { NavTabs } from '@/ui/Page.jsx';

// Small pieces shared by the screens of the Service area.

export function ServiceTabs() {
  const s = useStore();
  const today = todayISO();
  const contracts = list(s.contracts).filter((c) => ['active', 'expiring'].includes(contractStatus(c, today))).length;
  const jobs = list(s.jobs).filter((j) => !['completed', 'report_sent', 'cancelled'].includes(j.status) && jobStatus(j, today) !== 'upcoming').length;
  return (
    <NavTabs
      items={[
        { to: '/service', label: 'Contracts', count: contracts },
        { to: '/service/jobs', label: 'Jobs', count: jobs },
        { to: '/service/deficiencies', label: 'Deficiencies', count: openDeficiencies(s).length },
        { to: '/service/equipment', label: 'Equipment' },
        { to: '/service/compliance', label: 'Compliance' },
      ]}
    />
  );
}

export const JobKindTag = ({ kind, className }) => {
  const k = JOB_KINDS[kind];
  const Icon = k.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-slate-700', className)}>
      <Icon className="size-4 text-slate-500" aria-hidden="true" />
      {k.label}
    </span>
  );
};

export const staffName = (s, id) => s.staff[id]?.name ?? '—';

/** A link that opens the site in the phone's maps application. */
export const mapsUrl = (site) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([site.name, site.address, site.area, site.emirate].filter(Boolean).join(', '))}`;

export const telHref = (phone) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** The person to ask for at a job: the caller of a call-out, else the main contact of the site. */
export function whoToCall(s, job) {
  const contacts = Object.values(s.contacts).filter((c) => c.customerId === job.customerId && (c.siteIds.length === 0 || c.siteIds.includes(job.siteId)));
  const caller = job.callInfo ? contacts.find((c) => c.name === job.callInfo.reportedBy) : null;
  return caller ?? contacts.find((c) => c.siteIds.includes(job.siteId)) ?? contacts.find((c) => c.primary) ?? contacts[0] ?? null;
}
export const staffNames = (s, ids) => ids.map((id) => s.staff[id]?.name).filter(Boolean).join(', ') || '—';
