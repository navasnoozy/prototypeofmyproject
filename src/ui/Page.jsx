import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { ArrowLeftIcon, ChevronDownIcon, EllipsisIcon, InfoIcon, SearchIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { Button, IconButton } from './Button.jsx';
import { Menu } from './Floating.jsx';
import { Drawer } from './Overlay.jsx';

// ---- Back ---------------------------------------------------------------
// Goes back to where the person came from; if the page was opened directly,
// it goes to the given fallback (the list it belongs to).
export function BackButton({ fallback = '/' }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={ArrowLeftIcon}
      onClick={() => (location.key !== 'default' ? navigate(-1) : navigate(fallback))}
    >
      Back
    </Button>
  );
}

// ---- Tabs ---------------------------------------------------------------
const tabClass = (active) =>
  cn(
    'relative inline-flex items-center gap-2 whitespace-nowrap py-3 text-sm font-medium transition-colors duration-150 ease-standard',
    active
      ? 'text-slate-900 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-slate-900'
      : 'text-slate-500 hover:text-slate-900',
  );

const Count = ({ children }) => (
  <span className="rounded-full bg-slate-100 px-1.5 text-xs font-medium tabular-nums text-slate-600">{children}</span>
);

// Tabs that are pages of an area (the address changes).
export const NavTabs = ({ items }) => (
  <nav aria-label="Pages of this area" className="-mb-px flex gap-6 overflow-x-auto">
    {items.map((t) => (
      <NavLink key={t.to} to={t.to} end={t.end ?? true} className={({ isActive }) => tabClass(isActive)}>
        {t.label}
        {t.count !== undefined && <Count>{t.count}</Count>}
      </NavLink>
    ))}
  </nav>
);

// Tabs that switch the view of one record (a value in the address's query).
export const Tabs = ({ items, value, onChange }) => (
  <div role="tablist" className="-mb-px flex gap-6 overflow-x-auto">
    {items.map((t) => (
      <button
        key={t.value}
        type="button"
        role="tab"
        aria-selected={t.value === value}
        onClick={() => onChange(t.value)}
        className={tabClass(t.value === value)}
      >
        {t.label}
        {t.count !== undefined && <Count>{t.count}</Count>}
      </button>
    ))}
  </div>
);

// ---- About this screen ------------------------------------------------------
// A note that belongs to the prototype, not to the product: what the screen is
// for, why it looks like this, and what is only assumed.
function About({ about, title, open, onClose }) {
  return (
    <Drawer open={open} onClose={onClose} title="About this screen" subtitle={title}>
      <div className="space-y-6 text-sm text-slate-700">
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">What it is for</h3>
          <p>{about.purpose}</p>
        </section>
        {about.why?.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Why it looks like this</h3>
            <ul className="list-disc space-y-1.5 pl-5">
              {about.why.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </section>
        )}
        {about.assumed?.length > 0 && (
          <section className="rounded-2xl bg-amber-50 p-4">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">Assumed in this demo (sample)</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-amber-950">
              {about.assumed.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </section>
        )}
        <p className="text-xs text-slate-500">
          This note is part of the prototype only. It helps you judge the screen; it will not be in the product.
        </p>
      </div>
    </Drawer>
  );
}

// ---- Page ---------------------------------------------------------------------
// The inside of the content panel. The header (Back on the left, the title
// with its status and facts, the one main action on the right) stays visible
// above the divider line; the body scrolls; the footer is only for what
// belongs at the bottom: totals, paging, form buttons.
export function Page({ title, badge, facts, back, actions, menu, about, tabs, footer, children, className, flush = false }) {
  const [aboutOpen, setAboutOpen] = useState(false);
  useEffect(() => {
    document.title = `${title} · Fire & Safety ERP prototype`;
  }, [title]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 shrink-0 rounded-t-3xl border-b border-slate-200 bg-white px-4 pt-4 md:static md:px-6 md:pt-5">
        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-3 md:flex-nowrap', !tabs && 'pb-4')}>
          {back && <div className="order-1"><BackButton fallback={back} /></div>}
          <div className="order-3 w-full min-w-0 md:order-2 md:w-auto md:flex-1">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 md:text-[22px] md:leading-7">{title}</h1>
              {badge}
            </div>
            {facts && <p className="mt-0.5 truncate text-sm text-slate-500">{facts}</p>}
          </div>
          <div className="order-2 ml-auto flex shrink-0 items-center gap-2 md:order-3">
            {about && <IconButton icon={InfoIcon} label="About this screen" onClick={() => setAboutOpen(true)} />}
            {menu?.length > 0 && (
              <Menu button={(p) => <IconButton icon={EllipsisIcon} label="More actions" {...p} />} items={menu} />
            )}
            {actions}
          </div>
        </div>
        {tabs && <div className="mt-3">{tabs}</div>}
      </header>

      <div className={cn('min-h-0 flex-1 md:overflow-y-auto', !flush && 'px-4 py-5 md:px-6', className)}>{children}</div>

      {footer && (
        <footer className="shrink-0 rounded-b-3xl border-t border-slate-200 bg-white px-4 py-3 md:px-6">{footer}</footer>
      )}
      {about && <About about={about} title={title} open={aboutOpen} onClose={() => setAboutOpen(false)} />}
    </div>
  );
}

// ---- Small building blocks used inside pages ----------------------------------------
export const Card = ({ title, action, children, className, bodyClassName }) => (
  <section className={cn('rounded-2xl border border-slate-200 bg-white', className)}>
    {(title || action) && (
      <header className="flex items-center justify-between gap-3 px-5 pt-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </header>
    )}
    <div className={cn('px-5 pb-5 pt-3', !title && !action && 'pt-5', bodyClassName)}>{children}</div>
  </section>
);

// Label and value pairs. `span: 2` makes an item take the whole row.
export const DefinitionList = ({ items, cols = 2 }) => (
  <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', cols === 2 && 'sm:grid-cols-2')}>
    {items
      .filter((i) => i)
      .map((i) => (
        <div key={i.label} className={cn('min-w-0', i.span === 2 && 'sm:col-span-2')}>
          <dt className="text-xs text-slate-500">{i.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-slate-900">{i.value || <span className="text-slate-400">—</span>}</dd>
        </div>
      ))}
  </dl>
);

export const EmptyState = ({ icon: Icon, title, children, action }) => (
  <div className="grid place-items-center px-4 py-14 text-center">
    <div className="max-w-sm">
      {Icon && (
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {children && <p className="mt-1 text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  </div>
);

// The row of filters above a list.
export const Toolbar = ({ children }) => <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>;

export const SearchField = ({ value, onChange, placeholder = 'Search', className }) => (
  <div className={cn('relative w-full sm:w-80', className)}>
    <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-11 w-full rounded-full border border-control bg-white pl-10 pr-4 text-base placeholder:text-slate-400 hover:border-slate-500 focus:border-blue-600 md:h-9 md:text-sm"
    />
  </div>
);

// A filter as a capsule: "Segment: All".
export function FilterSelect({ label, value, onChange, options, allLabel = 'All' }) {
  const items = [{ value: '', label: allLabel }, ...options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))];
  const current = items.find((o) => o.value === value) ?? items[0];
  return (
    <label className="relative inline-flex h-11 items-center rounded-full border border-control bg-white pl-4 pr-9 text-base hover:border-slate-500 md:h-9 md:text-sm">
      <span className="text-slate-500">{label}:&nbsp;</span>
      <span className="font-medium text-slate-900">{current.label}</span>
      <ChevronDownIcon className="pointer-events-none absolute right-3 size-4 text-slate-500" aria-hidden="true" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      >
        {items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
