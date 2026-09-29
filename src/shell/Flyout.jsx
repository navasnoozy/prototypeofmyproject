import { Link, useLocation } from 'react-router';
import { EyeIcon, PlusIcon } from 'lucide-react';
import { areaOfPath, currentPage, isBuilt } from '@/data/areas.js';
import { cn } from '@/lib/cn.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { Badge } from '@/ui/Badge.jsx';
import { pageInfo } from './pageInfo.js';

const noteTone = { red: 'red', orange: 'orange' };

// What sits at the right of a sub module: a count and a warning for built
// areas, a "Step N" tag for areas that are not built yet.
function Meta({ area, info }) {
  if (!isBuilt(area)) return <Badge tone="neutral" className="mt-0.5">Step {area.step}</Badge>;
  return (
    <span className="flex shrink-0 items-center gap-2 pt-0.5">
      {info.note && <Badge tone={noteTone[info.note.tone]} dot>{info.note.text}</Badge>}
      {info.count !== undefined && <span className="text-xs tabular-nums text-slate-500">{info.count}</span>}
    </span>
  );
}

// The popup of one area in the sidebar: what the area is for, its sub modules
// (each with one line, a count and a warning, the current one marked), and
// quick "Create" actions. The panel is a plain set of links, so it works with
// a mouse, a finger and a keyboard.
export function FlyoutPanel({ area, onNavigate }) {
  const s = useStore();
  const { access } = useSession();
  const { pathname } = useLocation();
  const insideArea = areaOfPath(pathname)?.id === area.id;
  const current = insideArea ? currentPage(area, pathname) : null;
  const actions = access(area.id) === 'edit' ? area.actions ?? [] : [];

  return (
    <div className="w-[360px] animate-flyout rounded-2xl bg-white p-2 shadow-pop">
      <div className="px-3 pb-1 pt-2">
        <p className="text-sm font-semibold text-slate-900">{area.label}</p>
        <p className="text-xs text-slate-500">{area.tagline}</p>
      </div>
      <nav aria-label={`${area.label}: sub modules`}>
        <ul>
          {area.pages.map((page) => {
            const isCurrent = current?.id === page.id;
            return (
              <li key={page.id}>
                <Link
                  to={page.path}
                  onClick={onNavigate}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'flex items-start gap-3 rounded-xl px-3 py-2 transition-colors duration-100 ease-standard',
                    isCurrent ? 'bg-slate-100' : 'hover:bg-slate-50 focus-visible:bg-slate-50',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm text-slate-900', isCurrent ? 'font-semibold' : 'font-medium')}>
                      {page.label}
                    </span>
                    <span className="line-clamp-2 block text-xs text-slate-500">{page.blurb}</span>
                  </span>
                  <Meta area={area} info={pageInfo(s, area.id, page.id)} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {actions.length > 0 && (
        <div className="mt-1 border-t border-slate-100 pt-1">
          <p className="px-3 pb-1 pt-2 text-xs font-medium text-slate-500">Create</p>
          <ul>
            {actions.map((action) => (
              <li key={action.path}>
                <Link
                  to={action.path}
                  onClick={onNavigate}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 focus-visible:bg-slate-50"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700">
                    <PlusIcon className="size-3.5" aria-hidden="true" />
                  </span>
                  {action.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {access(area.id) === 'view' && (
        <p className="mt-1 flex items-center gap-2 border-t border-slate-100 px-3 pb-1 pt-3 text-xs text-slate-500">
          <EyeIcon className="size-3.5" aria-hidden="true" /> You can look here, not change.
        </p>
      )}
    </div>
  );
}
