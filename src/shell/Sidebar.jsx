import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { CircleQuestionMarkIcon, ClipboardListIcon, EllipsisIcon, HouseIcon, MapPinIcon } from 'lucide-react';
import { areaOfPath, currentPage } from '@/data/areas.js';
import { cn } from '@/lib/cn.js';
import { useSession } from '@/store/session.js';
import { Floating, hasOpenLayer } from '@/ui/Floating.jsx';
import { Drawer } from '@/ui/Overlay.jsx';
import { FlyoutPanel } from './Flyout.jsx';
import { HelpContent } from './Help.jsx';
import { useAttention } from './attention.js';

// One item: an icon over a short label. The current area is a soft tile with a
// small red bar on the edge (red is the brand accent, used sparingly).
const itemBase =
  'group relative flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors duration-150 ease-standard';

const CountBadge = ({ count }) =>
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
        <CountBadge count={count} />
      </span>
      <span className={cn('text-[11px] leading-[14px]', active ? 'font-semibold' : 'font-medium')}>{label}</span>
    </>
  );
}

// An item whose popup is open keeps the hover colour, so the popup and its
// item read as one thing.
const itemColour = (active, expanded) =>
  active
    ? 'bg-slate-100 text-slate-900'
    : expanded
      ? 'bg-slate-50 text-slate-900'
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900';

export function NavItem({ area, count, className, bar, expanded, hasPopup, ...rest }) {
  return (
    <NavLink
      to={area.path}
      end={area.path === '/'}
      aria-haspopup={hasPopup ? 'true' : undefined}
      aria-expanded={hasPopup ? Boolean(expanded) : undefined}
      className={({ isActive }) => cn(itemBase, itemColour(isActive, expanded), className)}
      {...rest}
    >
      {({ isActive }) => <ItemBody icon={area.icon} label={area.label} active={isActive} count={count} bar={bar} />}
    </NavLink>
  );
}

// ---- The popup of an area (its sub modules) --------------------------------
const OPEN_DELAY = 90; // ms: a mouse that only passes by opens nothing
const CLOSE_DELAY = 180; // ms: time to cross the gap into the popup

// Hover intent for the sidebar popups, the way a menu bar behaves: the first
// popup opens after a short delay, a popup that is open switches at once when
// the mouse moves to the next item, and leaving closes after a short delay
// that entering the popup cancels.
function usePopupController() {
  const [openId, setOpenId] = useState(null);
  const openIdRef = useRef(null);
  const anchorRef = useRef(null);
  const timers = useRef({});
  const touching = useRef(false);

  const clear = () => {
    clearTimeout(timers.current.open);
    clearTimeout(timers.current.close);
  };
  const show = useCallback((id, element) => {
    clear();
    anchorRef.current = element;
    openIdRef.current = id;
    setOpenId(id);
  }, []);
  const hide = useCallback(() => {
    clear();
    openIdRef.current = null;
    setOpenId(null);
  }, []);
  // Escape (or any other reason from the layer): give focus back to the item.
  const closeFromLayer = useCallback(() => {
    const inside = document.querySelector('[data-popup]')?.contains(document.activeElement);
    hide();
    if (inside) anchorRef.current?.querySelector('a')?.focus();
  }, [hide]);
  const leave = useCallback(() => {
    clearTimeout(timers.current.open);
    timers.current.close = setTimeout(hide, CLOSE_DELAY);
  }, [hide]);
  const enterItem = (id, element, hasPopup) => {
    if (!hasPopup) {
      if (openIdRef.current) leave();
      return;
    }
    // A menu, the bell or the search is open: stay quiet.
    if (hasOpenLayer()) return;
    clearTimeout(timers.current.close);
    clearTimeout(timers.current.open);
    if (openIdRef.current) show(id, element);
    else timers.current.open = setTimeout(() => show(id, element), OPEN_DELAY);
  };
  const enterPanel = () => clearTimeout(timers.current.close);

  useEffect(() => clear, []);
  return { openId, anchorRef, touching, show, hide, closeFromLayer, leave, enterItem, enterPanel };
}

const ITEM_HEIGHT = 56; // an item plus the 2 px between items
const PAD = 24; // the capsule's padding above and below

// The main navigation as a vertical capsule. It shows as many areas as the
// window's height holds; "More" takes the rest (record 39, point 14). Pointing
// at an area opens a popup with its sub modules.
export function Sidebar({ areas }) {
  const { byArea } = useAttention();
  const { access } = useSession();
  const location = useLocation();
  const boxRef = useRef(null);
  const capsuleRef = useRef(null);
  const moreRef = useRef(null);
  const [capacity, setCapacity] = useState(areas.length);
  const [moreOpen, setMoreOpen] = useState(false);
  const popup = usePopupController();

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => setCapacity(Math.max(1, Math.floor((el.clientHeight - PAD + 2) / ITEM_HEIGHT)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A page change closes the popup.
  const { hide } = popup;
  useEffect(() => {
    hide();
  }, [location.pathname, hide]);

  const fitsAll = capacity >= areas.length;
  const shown = fitsAll ? areas : areas.slice(0, capacity - 1);
  const hidden = fitsAll ? [] : areas.slice(capacity - 1);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const hiddenActive = hidden.some((a) => (a.path === '/' ? location.pathname === '/' : location.pathname.startsWith(a.path)));
  const hiddenCount = hidden.reduce((n, a) => n + (byArea[a.id] ?? 0), 0);

  // An area has a popup when it has more than one sub module, or actions the
  // person may use.
  const hasPopup = (a) => a.pages.length > 1 || (access(a.id) === 'edit' && (a.actions?.length ?? 0) > 0);
  const openArea = areas.find((a) => a.id === popup.openId);

  // Mouse: a click goes straight to the area's first page (the popup was
  // already there on hover). Finger: the first tap opens the popup, the second
  // goes to the page.
  const onItemClick = (event, area) => {
    if (popup.touching.current && hasPopup(area) && popup.openId !== area.id) {
      event.preventDefault();
      popup.show(area.id, event.currentTarget.closest('li'));
      return;
    }
    popup.hide();
  };
  // Keyboard: the right arrow opens the popup and moves into it.
  const onItemKeyDown = (event, area) => {
    if (event.key === 'ArrowRight' && hasPopup(area)) {
      event.preventDefault();
      popup.show(area.id, event.currentTarget.closest('li'));
      setTimeout(() => document.querySelector('[data-popup] a')?.focus(), 30);
    }
  };

  // Keyboard inside the popup: up and down move between its links, left goes
  // back to the item (Escape does the same).
  const onPanelKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const links = [...event.currentTarget.querySelectorAll('a')];
      const at = links.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? (at + 1) % links.length : (at - 1 + links.length) % links.length;
      links[next]?.focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      popup.closeFromLayer();
    }
  };

  return (
    <div ref={boxRef} className="min-h-0 flex-1">
      <div ref={capsuleRef} className="max-h-full overflow-hidden rounded-full bg-white px-2 py-3 shadow-float">
        <ul className="flex flex-col gap-0.5">
          {shown.map((a) => (
            <li
              key={a.id}
              onPointerEnter={(e) => e.pointerType !== 'touch' && popup.enterItem(a.id, e.currentTarget, hasPopup(a))}
              onPointerLeave={(e) => e.pointerType !== 'touch' && popup.leave()}
            >
              <NavItem
                area={a}
                count={byArea[a.id]}
                hasPopup={hasPopup(a)}
                expanded={popup.openId === a.id}
                onPointerDown={(e) => {
                  popup.touching.current = e.pointerType === 'touch';
                }}
                onClick={(e) => onItemClick(e, a)}
                onKeyDown={(e) => onItemKeyDown(e, a)}
              />
            </li>
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
              <Floating anchorRef={moreRef} edgeRef={capsuleRef} open={moreOpen} onClose={closeMore} side="right" className="w-64 p-1.5" role="menu">
                <div className="max-h-[min(70vh,520px)] overflow-y-auto">
                  <AreaTree areas={hidden} byArea={byArea} onNavigate={closeMore} />
                </div>
              </Floating>
            </li>
          )}
        </ul>
      </div>
      <Floating
        anchorRef={popup.anchorRef}
        edgeRef={capsuleRef}
        open={Boolean(openArea)}
        onClose={popup.closeFromLayer}
        side="right"
        gap={0}
        passive
        bare
        data-popup=""
        onPointerEnter={popup.enterPanel}
        onPointerLeave={popup.leave}
        onKeyDown={onPanelKeyDown}
        className="pl-2"
      >
        {openArea && <FlyoutPanel area={openArea} onNavigate={popup.hide} />}
      </Floating>
    </div>
  );
}

// Areas with their sub modules under them, as one list. Used where there is no
// room for hover popups: the sidebar's "More" and the phone's sheet.
export function AreaTree({ areas, byArea, onNavigate }) {
  const { pathname } = useLocation();
  const insideId = areaOfPath(pathname)?.id;
  return (
    <div>
      {areas.map((a) => {
        const Icon = a.icon;
        const page = currentPage(a, pathname);
        const count = byArea[a.id] ?? 0;
        return (
          <section key={a.id} className="py-0.5">
            <NavLink
              to={a.path}
              end={a.path === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-base md:text-sm',
                  isActive ? 'bg-slate-100 font-semibold text-slate-900' : 'font-medium text-slate-800 hover:bg-slate-50',
                )
              }
            >
              <Icon className="size-[18px] text-slate-500" aria-hidden="true" />
              <span className="flex-1">{a.label}</span>
              {count > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">{count}</span>}
            </NavLink>
            {a.pages.length > 1 && (
              <ul className="ml-[22px] mt-0.5 border-l border-slate-200 pl-3">
                {a.pages.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={p.path}
                      onClick={onNavigate}
                      className={cn(
                        'block rounded-lg px-2.5 py-1.5 text-base md:text-sm',
                        insideId === a.id && page?.id === p.id ? 'font-semibold text-slate-900' : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      {p.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Help sits in its own small capsule under the navigation.
export function HelpCapsule() {
  const ref = useRef(null);
  const capsuleRef = useRef(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div ref={capsuleRef} className="shrink-0 rounded-full bg-white px-2 py-3 shadow-float">
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
      <Floating anchorRef={ref} edgeRef={capsuleRef} open={open} onClose={close} side="right" className="w-80" role="dialog">
        <HelpContent onNavigate={close} />
      </Floating>
    </div>
  );
}

// A technician's bottom bar is built around the work, not around the modules:
// today's jobs, all the jobs, and a look-up of sites.
const TECH_TABS = [
  { id: 'today', label: 'Today', icon: HouseIcon, path: '/' },
  { id: 'jobs', label: 'Jobs', icon: ClipboardListIcon, path: '/service/jobs' },
  { id: 'sites', label: 'Sites', icon: MapPinIcon, path: '/customers/sites' },
];

// The phone's bottom bar: the first four areas (for a technician: Today, Jobs
// and Sites), then "More" in a sheet with the rest (with their sub modules),
// Settings and Help. The sub modules of the areas on the bar are the tabs under
// the page title.
export function PhoneBar({ areas }) {
  const { byArea } = useAttention();
  const { role } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const tech = Boolean(role.phoneFirst);
  const bar = tech ? TECH_TABS : areas.slice(0, 4);
  const rest = tech ? areas.filter((a) => a.id !== 'home') : areas.slice(4);
  const countOf = (a) => (tech ? (a.id === 'jobs' ? byArea.service : 0) : byArea[a.id]);
  const restCount = tech ? 0 : rest.reduce((n, a) => n + (byArea[a.id] ?? 0), 0);
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
          <NavItem key={a.id} area={a} count={countOf(a)} className="w-16" bar={false} />
        ))}
        <button type="button" onClick={() => setOpen(true)} className={cn(itemBase, itemColour(open), 'w-16')}>
          <ItemBody icon={EllipsisIcon} label="More" active={false} count={restCount} />
        </button>
      </nav>
      <Drawer open={open} onClose={() => setOpen(false)} title="More">
        <AreaTree areas={rest} byArea={byArea} onNavigate={() => setOpen(false)} />
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
