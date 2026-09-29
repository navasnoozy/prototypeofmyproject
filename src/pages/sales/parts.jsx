import { KINDS } from '@/data/quotationKinds.js';
import { ROLES } from '@/data/roles.js';
import { cn } from '@/lib/cn.js';
import { latestQuotations } from '@/store/salesSelectors.js';
import { customerContacts, customerSites, list, paidSites } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { NavTabs } from '@/ui/Page.jsx';

// Small pieces shared by the screens of the Sales area.

export function SalesTabs() {
  const s = useStore();
  const open = list(s.enquiries).filter((e) => !['won', 'lost'].includes(e.status)).length;
  return (
    <NavTabs
      items={[
        { to: '/sales', label: 'Enquiries', count: open },
        { to: '/sales/quotations', label: 'Quotations', count: latestQuotations(s).length },
      ]}
    />
  );
}

// The kind of a quotation or enquiry: an icon and a word, in plain slate (colour
// is kept for status, so the two never compete).
export const KindTag = ({ kind, className }) => {
  const k = KINDS[kind];
  const Icon = k.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-slate-700', className)}>
      <Icon className="size-4 text-slate-500" aria-hidden="true" />
      {k.label}
    </span>
  );
};

// ---- options for the dropdowns of the forms ------------------------------------
export const customerOptions = (s) =>
  list(s.customers).map((c) => ({
    value: c.id, label: c.name, sub: `${c.code} · ${c.segment}`, avatar: c.name,
    shape: c.type === 'individual' ? 'circle' : 'square',
    badge: c.status === 'on_hold' ? { tone: 'red', text: 'On hold' } : undefined,
  }));

// The sites a customer owns and the ones it only pays for.
export const sitesOfCustomer = (s, customerId) =>
  customerId ? [...customerSites(s, customerId), ...paidSites(s, customerId)] : [];

export const siteOptions = (s, customerId) =>
  sitesOfCustomer(s, customerId).map((x) => ({
    value: x.id, label: x.name,
    sub: `${x.type} · ${x.area}${x.customerId !== customerId ? ` · owned by ${s.customers[x.customerId]?.name}` : ''}`,
  }));

export const contactOptions = (s, customerId) =>
  (customerId ? customerContacts(s, customerId) : []).map((p) => ({
    value: p.id, label: p.name, sub: p.title, avatar: p.name,
  }));

export const staffOptions = (s, roleKeys) =>
  list(s.staff)
    .filter((p) => !roleKeys || roleKeys.includes(p.roleKey))
    .map((p) => ({ value: p.id, label: p.name, sub: ROLES[p.roleKey].label, avatar: p.name }));

export const staffName = (s, id) => s.staff[id]?.name ?? '—';
