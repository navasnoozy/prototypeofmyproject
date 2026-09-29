import { Link } from 'react-router';
import { PO_PURPOSE } from '@/data/purchaseKinds.js';
import { todayISO } from '@/lib/dates.js';
import { billRows, forWhat, inSegment, orderViews } from '@/store/purchaseSelectors.js';
import { list } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { Badge, Status } from '@/ui/Badge.jsx';
import { NavTabs } from '@/ui/Page.jsx';

// Small pieces shared by the screens of the Purchases area.

export function PurchaseTabs() {
  const s = useStore();
  const today = todayISO();
  const open = orderViews(s, today).filter((v) => inSegment(v, 'open')).length;
  const toPay = billRows(s, today).filter((r) => r.state !== 'paid').length;
  return (
    <NavTabs
      items={[
        { to: '/purchases', label: 'Purchase orders', count: open },
        { to: '/purchases/bills', label: 'Supplier bills', count: toPay > 0 ? toPay : undefined },
        { to: '/purchases/suppliers', label: 'Suppliers', count: list(s.suppliers).filter((x) => x.active).length },
      ]}
    />
  );
}

/** The state of an order, with "Late" beside it when the promised day has passed. */
export const OrderBadge = ({ v }) => (
  <span className="inline-flex flex-wrap items-center gap-1.5">
    <Status kind="po" value={v.status} />
    {v.late && <Badge tone="red">Late</Badge>}
  </span>
);

/** What an order is for: "Stock", or the project or the job as a link. */
export function ForCell({ po, link = true }) {
  const s = useStore();
  const text = forWhat(s, po);
  const to = po.purpose === 'project' ? `/projects/${po.projectId}?tab=materials` : po.purpose === 'job' ? `/service/jobs/${po.jobId}` : '';
  return (
    <span className="text-slate-700">
      {po.purpose === 'stock' ? PO_PURPOSE.stock : link && to ? <Link to={to} onClick={(e) => e.stopPropagation()} className="font-medium underline-offset-2 hover:underline">{text}</Link> : text}
    </span>
  );
}

// ---- options for the dropdowns of the forms -------------------------------------------------
export const supplierOptions = (s, { all = false } = {}) =>
  list(s.suppliers)
    .filter((x) => all || x.active)
    .map((x) => ({
      value: x.id, label: x.name, sub: `${x.kind} · ${x.area} · ${Number(x.terms) === 0 ? 'cash' : `net ${x.terms}`}`, avatar: x.name, shape: 'square',
      badge: x.active ? undefined : { tone: 'neutral', text: 'Not used' },
    }));

export const projectOptions = (s) =>
  list(s.projects)
    .filter((p) => p.phase !== 'complete')
    .map((p) => ({ value: p.id, label: `${p.number} · ${p.title}`, sub: `${s.customers[p.customerId]?.name ?? ''}`, avatar: p.title, shape: 'square' }));

export const jobOptions = (s) =>
  list(s.jobs)
    .filter((j) => !['report_sent', 'cancelled'].includes(j.status))
    .toSorted((a, b) => b.number.localeCompare(a.number))
    .map((j) => ({ value: j.id, label: `${j.number} · ${j.title}`, sub: s.sites[j.siteId]?.name ?? '', avatar: j.title, shape: 'square' }));
