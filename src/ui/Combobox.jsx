import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { splitMatch } from '@/lib/format.js';
import { Avatar, Badge, Kbd } from './Badge.jsx';
import { Floating } from './Floating.jsx';
import { controlClass } from './Form.jsx';
import { FieldContext } from './FieldContext.js';

// The rich dropdown (from the owner's Figma frame, with its faults removed):
// a search box, a count, rows with an initials avatar, a name, a second line
// and a small badge, a check on the chosen row, a "create new" row, matches
// highlighted, and a footer with the keys. Long text ends in "..." and never
// overlaps its neighbour.
//
// options: [{ value, label, sub, badge: { tone, text }, avatar: 'Name', shape, icon: LucideIcon }]
const IconTile = ({ icon: Icon, size = 'md' }) => (
  <span className={cn('grid shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600', size === 'sm' ? 'size-6' : 'size-8')}>
    <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden="true" />
  </span>
);

export function Combobox({
  options, value, onChange, onBlur, placeholder = 'Choose…', searchPlaceholder = 'Search…',
  noun = 'options', createLabel, onCreate, clearable = false, disabled = false, className,
}) {
  const { id: fieldId, invalid } = useContext(FieldContext);
  const ownId = useId();
  const id = fieldId ?? ownId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const anchorRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);
  const rows = onCreate ? [...filtered, { value: '__create__', create: true }] : filtered;

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    onBlur?.();
  }, [onBlur]);

  useEffect(() => {
    if (open) {
      setActive(Math.max(0, filtered.findIndex((o) => o.value === value)));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (row) => {
    if (row.create) {
      onCreate(query.trim());
    } else {
      onChange(row.value);
    }
    close();
    triggerRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rows[active]) choose(rows[active]);
    } else if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <>
      <span ref={anchorRef} className="block">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            controlClass(invalid), 'flex h-11 items-center gap-2.5 px-3 text-left md:h-10',
            open && 'border-blue-600', className,
          )}
        >
          {selected ? (
            <>
              {selected.avatar && <Avatar name={selected.avatar} shape={selected.shape} size="xs" />}
              {selected.icon && <IconTile icon={selected.icon} size="sm" />}
              <span className="min-w-0 flex-1 truncate">{selected.label}</span>
              {selected.sub && <span className="hidden max-w-[40%] truncate text-xs text-slate-500 sm:block">{selected.sub}</span>}
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-slate-400">{placeholder}</span>
          )}
          <ChevronsUpDownIcon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
        </button>
      </span>

      <Floating anchorRef={anchorRef} open={open} onClose={close} matchWidth className="min-w-[300px]">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3">
          <SearchIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400 md:text-sm"
          />
        </div>
        <div className="flex items-center justify-between px-4 pb-1 pt-2.5 text-xs text-slate-500">
          <span>{filtered.length} {filtered.length === 1 ? noun.replace(/s$/, '') : noun}</span>
          {clearable && value && (
            <button type="button" className="font-medium text-slate-700 hover:underline" onClick={() => { onChange(''); close(); }}>
              Clear
            </button>
          )}
        </div>
        <ul id={`${id}-list`} ref={listRef} role="listbox" className="max-h-64 overflow-y-auto px-1.5 pb-1.5">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-500">
              Nothing matches “{query}”.
            </li>
          )}
          {rows.map((row, i) => {
            const isActive = i === active;
            if (row.create) {
              return (
                <li key="create" role="option" aria-selected={false} data-active={isActive}
                  onMouseEnter={() => setActive(i)} onClick={() => choose(row)}
                  className={cn('mt-1 flex cursor-pointer items-center gap-3 rounded-xl border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-900', isActive && 'bg-slate-100')}
                >
                  <span className="grid size-6 place-items-center rounded-full bg-slate-900 text-white"><PlusIcon className="size-3.5" aria-hidden="true" /></span>
                  <span className="min-w-0 truncate">{createLabel ? createLabel(query.trim()) : 'Create new'}</span>
                </li>
              );
            }
            const [before, match, after] = splitMatch(row.label, query);
            const isSelected = row.value === value;
            return (
              <li key={row.value} role="option" aria-selected={isSelected} data-active={isActive}
                onMouseEnter={() => setActive(i)} onClick={() => choose(row)}
                className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2', isActive && 'bg-slate-100')}
              >
                {row.avatar && <Avatar name={row.avatar} shape={row.shape} size="sm" />}
                {row.icon && <IconTile icon={row.icon} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {before}<mark className="rounded-[2px] bg-yellow-200 text-inherit">{match}</mark>{after}
                  </span>
                  {row.sub && <span className="block truncate text-xs text-slate-500">{row.sub}</span>}
                </span>
                {row.badge && <Badge tone={row.badge.tone}>{row.badge.text}</Badge>}
                {isSelected && <CheckIcon className="size-4 shrink-0 text-slate-900" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="flex gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd></span> Move</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> Choose</span>
          <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> Close</span>
        </div>
      </Floating>
    </>
  );
}
