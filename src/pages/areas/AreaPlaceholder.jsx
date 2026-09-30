import { useLocation } from 'react-router';
import { ArrowRightIcon, HammerIcon } from 'lucide-react';
import { AREA_BY_ID, currentPage } from '@/data/areas.js';
import { Card, NavTabs, Page } from '@/ui/Page.jsx';

// What each area that is not built yet will hold, in the words of the study
// behind record 39. Shown until the area is built; only Reports is left.
const PLAN = {
  reports: {
    can: [
      'See sales, service, project, stock and money figures in one place.',
      'Filter by customer, site, person and period.',
    ],
    research: 'Reporting is a separate area in the mature products (record 39, point 1).',
  },
};

export function AreaPlaceholder({ areaId }) {
  const area = AREA_BY_ID[areaId];
  const plan = PLAN[areaId];
  const { pathname } = useLocation();
  const page = currentPage(area, pathname);
  return (
    <Page
      title={area.label}
      facts={page && area.pages.length > 1 ? `${page.label}: ${page.blurb}` : area.purpose}
      tabs={area.pages.length > 1 ? <NavTabs items={area.pages.map((p) => ({ to: p.path, label: p.label }))} /> : undefined}
      about={{
        purpose: `${area.label} is not built yet in this prototype. This page shows what will be inside it. The tabs and the sidebar popup already lead to each of its sub modules.`,
        why: [plan.research],
        assumed: ['The names of the pages are working names; the study of each phase fixes the real terms.'],
      }}
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <div className="flex items-start gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800">
                <HammerIcon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {page && area.pages.length > 1 ? `${page.label} is built` : 'Built'} in step {area.step} of the prototype
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  The sidebar is already the real one, so you can judge the navigation now. The screens of this
                  area come with step {area.step}.
                </p>
              </div>
            </div>
          </Card>
          <Card title="What you will be able to do here">
            <ul className="space-y-2.5 text-sm text-slate-700">
              {plan.can.map((line) => (
                <li key={line} className="flex gap-3">
                  <ArrowRightIcon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card title="Pages in this area">
          <ul className="divide-y divide-slate-100">
            {area.pages.map((p) => (
              <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-slate-900">{p.label}</p>
                <p className="text-xs text-slate-500">{p.blurb}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Page>
  );
}
