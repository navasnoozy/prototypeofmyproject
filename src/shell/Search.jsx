import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRightIcon, BoxIcon, ClipboardListIcon, CornerDownLeftIcon, FileMinusIcon, FileSignatureIcon, FileTextIcon, HardHatIcon, InboxIcon, MapPinIcon, PlusIcon, ReceiptIcon, SearchIcon, ShoppingCartIcon, TagIcon, TriangleAlertIcon, TruckIcon, WalletIcon, XIcon } from 'lucide-react';
import { AREAS } from '@/data/areas.js';
import { cn } from '@/lib/cn.js';
import { splitMatch } from '@/lib/format.js';
import { billingSearchEntries } from '@/store/billingSelectors.js';
import { itemSearchEntries } from '@/store/inventorySelectors.js';
import { purchaseSearchEntries } from '@/store/purchaseSelectors.js';
import { salesSearchEntries } from '@/store/salesSelectors.js';
import { buildSearchIndex } from '@/store/selectors.js';
import { projectSearchEntries } from '@/store/projectSelectors.js';
import { serviceSearchEntries } from '@/store/serviceSelectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Avatar, Kbd, modKey } from '@/ui/Badge.jsx';
import { Floating } from '@/ui/Floating.jsx';

// The global search: an icon at the left of the top bar that grows into a
// search box where it stands (click it, or press Cmd/Ctrl+K), with results
// grouped by kind, quick actions and recent items when the box is empty, and
// the keys explained at the bottom.

const RECENT_KEY = 'fs-erp-recent';
const readRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) ?? [];
  } catch {
    return [];
  }
};
const pushRecent = (entry) => {
  try {
    const next = [entry, ...readRecent().filter((r) => r.path !== entry.path)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Not saved: recents are only a convenience.
  }
};

const TYPE_ORDER = ['Go to', 'Customers', 'Sites', 'Contacts', 'Enquiries', 'Quotations', 'Contracts', 'Jobs', 'Deficiencies', 'Projects', 'Purchase orders', 'Suppliers', 'Invoices', 'Receipts', 'Credit notes', 'Items', 'Equipment'];

function score(entry, tokens) {
  const title = entry.title.toLowerCase();
  const hay = `${title} ${entry.sub.toLowerCase()} ${(entry.keywords ?? '').toLowerCase()}`;
  if (!tokens.every((t) => hay.includes(t))) return null;
  const q = tokens.join(' ');
  if (title.startsWith(q)) return 0;
  if (title.split(/[\s—-]+/).some((w) => w.startsWith(tokens[0]))) return 1;
  if (title.includes(tokens[0])) return 2;
  return 3;
}

function Row({ entry, query, active, onHover, onPick }) {
  const [before, match, after] = splitMatch(entry.title, query);
  let lead;
  if (entry.type === 'Customers') lead = <Avatar name={entry.title} shape="square" size="sm" />;
  else if (entry.type === 'Contacts') lead = <Avatar name={entry.title} size="sm" />;
  else {
    const Icon = { Sites: MapPinIcon, Equipment: BoxIcon, Action: PlusIcon, Enquiries: InboxIcon, Quotations: FileTextIcon, Items: TagIcon, 'Purchase orders': ShoppingCartIcon, Suppliers: TruckIcon, Contracts: FileSignatureIcon, Jobs: ClipboardListIcon, Deficiencies: TriangleAlertIcon, Projects: HardHatIcon, Invoices: ReceiptIcon, Receipts: WalletIcon, 'Credit notes': FileMinusIcon }[entry.type] ?? ArrowRightIcon;
    lead = (
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="size-4" aria-hidden="true" />
      </span>
    );
  }
  return (
    <li
      role="option"
      aria-selected={active}
      data-active={active}
      onMouseEnter={onHover}
      onClick={onPick}
      className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2', active && 'bg-slate-100')}
    >
      {lead}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">
          {before}<mark className="rounded-[2px] bg-yellow-200 text-inherit">{match}</mark>{after}
        </span>
        <span className="block truncate text-xs text-slate-500">{entry.sub}</span>
      </span>
      {active && <CornerDownLeftIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />}
    </li>
  );
}

export function Search({ onOpenChange }) {
  const navigate = useNavigate();
  const state = useStore();
  const { access, canEdit } = useSession();
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const setOpen = useCallback(
    (value) => {
      setOpenState(value);
      onOpenChange?.(value);
      if (!value) setQuery('');
    },
    [onOpenChange],
  );

  // Cmd/Ctrl+K opens and closes the search from anywhere; "/" opens it when
  // the person is not typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '') || document.activeElement?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === '/' && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const index = useMemo(() => {
    const goTo = AREAS.flatMap((a) =>
      a.id === 'home' || !access(a.id)
        ? []
        : (a.pages.length ? a.pages : [{ label: a.label, path: a.path }]).map((p) => ({
            type: 'Go to',
            id: `${a.id}_${p.path}`,
            title: p.label === a.label ? a.label : `${a.label}: ${p.label}`,
            sub: a.purpose,
            path: p.path,
            keywords: '',
          })),
    );
    return [
      ...goTo,
      ...buildSearchIndex(state).filter(() => access('customers')),
      ...salesSearchEntries(state).filter(() => access('sales')),
      ...serviceSearchEntries(state).filter(() => access('service')),
      ...projectSearchEntries(state).filter(() => access('projects')),
      ...purchaseSearchEntries(state).filter(() => access('purchases')),
      ...itemSearchEntries(state).filter(() => access('inventory')),
      ...billingSearchEntries(state).filter(() => access('billing')),
    ];
    // `access` follows the person, who is part of the state.
  }, [state]);

  // Quick actions are the "Create" entries of the areas the person may change.
  const actions = useMemo(
    () =>
      AREAS.flatMap((a) => (canEdit(a.id) ? a.actions ?? [] : [])).map((a) => ({
        ...a,
        type: 'Action',
        id: a.path,
        keywords: '',
      })),
    [state],
  );

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!q) {
      const recent = readRecent().map((r) => ({ ...r, id: `recent_${r.path}` }));
      return [
        actions.length > 0 && { name: 'Quick actions', entries: actions },
        recent.length > 0 && { name: 'Recent', entries: recent },
      ].filter(Boolean);
    }
    const tokens = q.split(/\s+/);
    const found = index
      .map((e) => ({ e, s: score(e, tokens) }))
      .filter((x) => x.s !== null)
      .sort((a, b) => a.s - b.s || a.e.title.localeCompare(b.e.title));
    return TYPE_ORDER.map((type) => ({
      name: type,
      entries: found.filter((x) => x.e.type === type).slice(0, type === 'Go to' ? 3 : 5).map((x) => x.e),
    })).filter((g) => g.entries.length > 0);
    // Recent items are read again each time the search opens.
  }, [q, index, actions, open]);

  const flat = groups.flatMap((g) => g.entries);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (entry) => {
    if (entry.type !== 'Action') pushRecent({ title: entry.title, sub: entry.sub, path: entry.path, type: entry.type });
    setOpen(false);
    navigate(entry.path);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault();
      pick(flat[active]);
    }
  };

  let offset = 0;
  return (
    <>
      <div
        ref={boxRef}
        className={cn(
          'relative flex h-9 shrink-0 items-center rounded-full transition-[width,background-color,box-shadow] duration-200 ease-standard',
          open ? 'w-full bg-slate-100 shadow-[inset_0_0_0_1px_#cbd5e1] md:w-[380px]' : 'w-9 hover:bg-slate-100',
        )}
      >
        <button
          type="button"
          aria-label={`Search (${modKey()} K)`}
          title={`Search (${modKey()} K)`}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="grid size-9 shrink-0 place-items-center rounded-full text-slate-600"
        >
          <SearchIcon className="size-[18px]" aria-hidden="true" />
        </button>
        {open && (
          <>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search customers, sites, equipment…"
              aria-label="Search"
              role="combobox"
              aria-expanded="true"
              aria-controls="global-search-list"
              className="min-w-0 flex-1 bg-transparent pr-2 text-base outline-none placeholder:text-slate-500 md:text-sm"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="mr-1.5 grid size-6 place-items-center rounded-full text-slate-500 hover:bg-slate-200"
              >
                <XIcon className="size-3.5" aria-hidden="true" />
              </button>
            ) : (
              <span className="mr-3 hidden items-center gap-1 md:flex" aria-hidden="true">
                <Kbd>{modKey()}</Kbd>
                <Kbd>K</Kbd>
              </span>
            )}
          </>
        )}
      </div>

      <Floating anchorRef={boxRef} open={open} onClose={() => setOpen(false)} matchWidth className="min-w-[min(420px,calc(100vw-16px))]">
        <div ref={listRef} id="global-search-list" role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
          {groups.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Nothing matches “{query}”. Try a name, a number or an area.</p>
          )}
          {groups.map((g) => {
            const start = offset;
            offset += g.entries.length;
            return (
              <div key={g.name} className="pb-1">
                <div className="px-3 pb-1 pt-2 text-xs font-medium text-slate-500">{g.name}</div>
                <ul>
                  {g.entries.map((entry, i) => (
                    <Row
                      key={entry.id}
                      entry={entry}
                      query={query}
                      active={start + i === active}
                      onHover={() => setActive(start + i)}
                      onPick={() => pick(entry)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="flex gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd></span> Move</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> Open</span>
          <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> Close</span>
        </div>
      </Floating>
    </>
  );
}
