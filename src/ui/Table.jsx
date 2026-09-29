import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { IconButton } from './Button.jsx';

// Sorting and paging for a list, kept apart from drawing it, so the rows of
// the current page go to <DataTable> and the pager goes to the panel footer.
export function useTable(rows, columns, { pageSize = 10, initialSort } = {}) {
  const [sort, setSort] = useState(initialSort ?? null); // { key, dir }
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return rows.toSorted((a, b) => {
      const x = col.sortValue(a);
      const y = col.sortValue(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * factor;
    });
  }, [rows, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  return {
    rows: sorted.slice(safePage * pageSize, (safePage + 1) * pageSize),
    all: sorted,
    total: sorted.length,
    page: safePage,
    pageCount,
    pageSize,
    setPage,
    sort,
    toggleSort: (key) => {
      setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
      setPage(0);
    },
  };
}

const hideClass = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' };

// columns: [{ key, header, cell(row), sortValue(row), align, className, hideBelow }]
// Give `mobileRow(row)` to show a list of cards on phones instead of a table.
export function DataTable({ columns, rows, rowKey = (r) => r.id, rowHref, onRowClick, sort, onSort, empty, mobileRow }) {
  const navigate = useNavigate();
  const open = (row) => (onRowClick ? onRowClick(row) : rowHref && navigate(rowHref(row)));
  const clickable = Boolean(onRowClick || rowHref);

  if (rows.length === 0) return empty ?? null;

  return (
    <>
      {mobileRow && (
        <ul className="divide-y divide-slate-200 md:hidden">
          {rows.map((row) => (
            <li key={rowKey(row)}>
              <button type="button" onClick={() => open(row)} className="block w-full px-1 py-3 text-left active:bg-slate-50">
                {mobileRow(row)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={cn(mobileRow && 'hidden md:block')}>
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const SortIcon = !isSorted ? ArrowUpDownIcon : sort.dir === 'asc' ? ArrowUpIcon : ArrowDownIcon;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={isSorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'border-b border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-500 first:pl-0 last:pr-0',
                      col.align === 'right' && 'text-right',
                      col.hideBelow && hideClass[col.hideBelow],
                      col.className,
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.sortValue && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className={cn('inline-flex items-center gap-1 rounded-sm hover:text-slate-900', col.align === 'right' && 'flex-row-reverse', isSorted && 'text-slate-900')}
                      >
                        {col.header}
                        <SortIcon className={cn('size-3', !isSorted && 'opacity-40')} aria-hidden="true" />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={clickable ? () => open(row) : undefined}
                onKeyDown={clickable ? (e) => e.key === 'Enter' && open(row) : undefined}
                tabIndex={clickable ? 0 : undefined}
                className={cn('group', clickable && 'cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-offset-[-2px]')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'border-b border-slate-100 px-3 py-3 align-middle first:pl-0 last:pr-0',
                      col.align === 'right' && 'text-right tabular-nums',
                      col.hideBelow && hideClass[col.hideBelow],
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// "Showing 1–10 of 19 customers" with previous, next and page numbers.
export function Pagination({ table, noun = 'rows' }) {
  const { page, pageCount, total, pageSize, setPage } = table;
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  // Show first, last, current and its neighbours; the rest becomes "…".
  const numbers = [];
  for (let i = 0; i < pageCount; i += 1) {
    if (i === 0 || i === pageCount - 1 || Math.abs(i - page) <= 1) numbers.push(i);
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…');
  }
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <p className="text-sm text-slate-600">
        Showing <span className="font-medium text-slate-900">{from}–{to}</span> of {total} {noun}
      </p>
      {pageCount > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-1">
          <IconButton icon={ChevronLeftIcon} label="Previous page" size="xs" disabled={page === 0} onClick={() => setPage(page - 1)} />
          {numbers.map((n, i) =>
            n === '…' ? (
              <span key={`gap${i}`} className="px-1 text-slate-400">…</span>
            ) : (
              <button
                key={n}
                type="button"
                aria-current={n === page ? 'page' : undefined}
                onClick={() => setPage(n)}
                className={cn(
                  'grid size-8 place-items-center rounded-full text-sm tabular-nums transition-colors duration-150',
                  n === page ? 'bg-slate-900 font-medium text-white' : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                {n + 1}
              </button>
            ),
          )}
          <IconButton icon={ChevronRightIcon} label="Next page" size="xs" disabled={page === pageCount - 1} onClick={() => setPage(page + 1)} />
        </nav>
      )}
    </div>
  );
}
