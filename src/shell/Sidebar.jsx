import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { CircleQuestionMarkIcon, EllipsisIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { Floating } from '@/ui/Floating.jsx';
import { Drawer } from '@/ui/Overlay.jsx';
import { HelpContent } from './Help.jsx';
import { useAttention } from './attention.js';

// One item: an icon over a short label. The current area is a soft tile with a
// small red bar on the edge (red is the brand accent, used sparingly).
const itemBase =
  'group relative flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors duration-150 ease-standard';

const Badge = ({ count }) =>
  count > 0 ? (
    <span
      className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white"
      aria-label={`${count} need attention`}
    >
      {count}
    </span>
  ) : null;

function ItemBody({ icon: Icon, label, active, count, bar = true }) {
  return (
    <>
      {active && bar && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" aria-hidden="true" />}
      <span className="relative">
        <Icon className="size-5" aria-hidden="true" />
        <Badge count={count} />
      </span>
      <span className={cn('text-[11px] leading-[14px]', active ? 'font-semibold' : 'font-medium')}>{label}</span>
    </>
  );
}

const itemColour = (active) => (active ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900');

export function NavItem({ area, count, onNavigate, className, bar }) {
  return (
    <NavLink
      to={area.path}
      end={area.path === '/'}
      onClick={onNavigate}
      className={({ isActive }) => cn(itemBase, itemColour(isActive), className)}
    >
      {({ isActive }) => <ItemBody icon={area.icon} label={area.label} active={isActive} count={count} bar={bar} />}
    </NavLink>
  );
}

const ITEM_HEIGHT = 56; // an item plus the 2 px between items
const PAD = 24; // the capsule's padding above and below

// The main navigation as a vertical capsule. It shows as many areas as the
// window's height holds; "More" takes the rest (record 39, point 14).
export function Sidebar({ areas }) {
  const { byArea } = useAttention();
  const location = useLocation();
  const boxRef = useRef(null);
  const moreRef = useRef(null);
  const [capacity, setCapacity] = useState(areas.length);
  const [moreOpen, setMoreOpen] = useState(false);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => setCapacity(Math.max(1, Math.floor((el.clientHeight - PAD + 2) / ITEM_HEIGHT)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitsAll = capacity >= areas.length;
  const shown = fitsAll ? areas : areas.slice(0, capacity - 1);
  const hidden = fitsAll ? [] : areas.slice(capacity - 1);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const hiddenActive = hidden.some((a) => (a.path === '/' ? location.pathname === '/' : location.pathname.startsWith(a.path)));
  const hiddenCount = hidden.reduce((n, a) => n + (byArea[a.id] ?? 0), 0);

  return (
    <div ref={boxRef} className="min-h-0 flex-1">
      <div className="max-h-full overflow-hidden rounded-full bg-white px-2 py-3 shadow-float">
        <ul className="flex flex-col gap-0.5">
          {shown.map((a) => (
            <li key={a.id}><NavItem area={a} count={byArea[a.id]} /></li>
          ))}
          {hidden.length > 0 && (
            <li>
              <span ref={moreRef} className="block">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((o) => !o)}
                  className={cn(itemBase, itemColour(hiddenActive || moreOpen))}
                >
                  <ItemBody icon={EllipsisIcon} label="More" active={hiddenActive} count={hiddenCount} />
                </button>
              </span>
              <Floating anchorRef={moreRef} open={moreOpen} onClose={closeMore} side="right" className="w-56 p-1.5" role="menu">
                {hidden.map((a) => (
                  <MoreRow key={a.id} area={a} count={byArea[a.id]} onNavigate={closeMore} />
                ))}
              </Floating>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function MoreRow({ area, count, onNavigate }) {
  const Icon = area.icon;
  return (
    <NavLink
      to={area.path}
      onClick={onNavigate}
      role="menuitem"
      className={({ isActive }) =>
        cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm', isActive ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700 hover:bg-slate-50')
      }
    >
      <Icon className="size-[18px] text-slate-500" aria-hidden="true" />
      <span className="flex-1">{area.label}</span>
      {count > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">{count}</span>}
    </NavLink>
  );
}

// Help sits in its own small capsule under the navigation.
export function HelpCapsule() {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div className="shrink-0 rounded-full bg-white px-2 py-3 shadow-float">
      <span ref={ref} className="block">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(itemBase, itemColour(open))}
        >
          <ItemBody icon={CircleQuestionMarkIcon} label="Help" active={false} />
        </button>
      </span>
      <Floating anchorRef={ref} open={open} onClose={close} side="right" className="w-80" role="dialog">
        <HelpContent onNavigate={close} />
      </Floating>
    </div>
  );
}

// The phone's bottom bar: the first four areas, then "More" in a sheet with
// the rest, Settings and Help.
export function PhoneBar({ areas }) {
  const { byArea } = useAttention();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const bar = areas.slice(0, 4);
  const rest = areas.slice(4);
  const restCount = rest.reduce((n, a) => n + (byArea[a.id] ?? 0), 0);
  const go = (path) => {
    setOpen(false);
    navigate(path);
  };
  return (
    <>
      <nav
        aria-label="Main"
        className="no-print fixed inset-x-2 bottom-2 z-30 flex h-16 items-center justify-around rounded-full bg-white px-2 shadow-float md:hidden"
      >
        {bar.map((a) => (
          <NavItem key={a.id} area={a} count={byArea[a.id]} className="w-16" bar={false} />
        ))}
        <button type="button" onClick={() => setOpen(true)} className={cn(itemBase, itemColour(open), 'w-16')}>
          <ItemBody icon={EllipsisIcon} label="More" active={false} count={restCount} />
        </button>
      </nav>
      <Drawer open={open} onClose={() => setOpen(false)} title="More">
        <div className="grid grid-cols-3 gap-2">
          {rest.map((a) => (
            <NavItem key={a.id} area={a} count={byArea[a.id]} onNavigate={() => setOpen(false)} className="py-3" bar={false} />
          ))}
        </div>
        <div className="mt-6 border-t border-slate-200 pt-4">
          <HelpContent onNavigate={() => setOpen(false)} inline />
          <button
            type="button"
            onClick={() => go('/settings')}
            className="mt-3 w-full rounded-xl bg-slate-100 px-4 py-3 text-left text-sm font-medium"
          >
            Settings
          </button>
        </div>
      </Drawer>
    </>
  );
}
