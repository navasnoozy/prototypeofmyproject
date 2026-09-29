import { useLocation } from 'react-router';
import { ArrowRightIcon, HammerIcon } from 'lucide-react';
import { AREA_BY_ID, currentPage } from '@/data/areas.js';
import { Card, NavTabs, Page } from '@/ui/Page.jsx';

// What each later area will hold, in the words of the study behind record 39.
// Shown until the area is built.
const PLAN = {
  sales: {
    can: [
      'Register an enquiry and follow it from the first call to a quotation.',
      'Prepare an estimate as a bill of quantities and turn it into a quotation.',
      'Write one of four kinds of quotation: project, contract, repair or supply.',
      'Send it for approval when the amount or the discount is above a limit.',
      'Record the customer\'s answer. Accepting starts the right next thing: a project, a contract, a repair job or a supply order.',
    ],
    research: 'Fire-specific products have no Sales area of their own; our scope includes project contracting, which is won by estimating and quoting (record 39, points 1 and 4).',
  },
  service: {
    can: [
      'Keep annual maintenance contracts: terms, visit plan and billing plan are three linked parts.',
      'Run jobs of every kind: planned visits, call-outs and repairs, from request to service report.',
      'Record deficiencies with a severity (non-critical, critical, impairment) and a separate resolution status.',
      'Send a repair quotation from a deficiency and see the repair job and the invoice from it.',
      'Keep certificates and Civil Defence approvals for each site.',
    ],
    research: 'Mature fire-service products all treat the deficiency-to-quote-to-repair chain as first-class, keep the equipment register per site, and separate the schedule of a contract from its billing (record 39, point 5).',
  },
  projects: {
    can: [
      'Start a project from an accepted quotation, with a budget and stages.',
      'Track cost against budget, variations and their approval.',
      'Raise progress claims, certify them, invoice them and release retention.',
      'Hand over with the completion certificate and the equipment list.',
    ],
    research: 'Projects exist only in service-management platforms, and small works stay jobs of Service (record 39, point 6).',
  },
  schedule: {
    can: [
      'See people by day and drag planned work onto them.',
      'Work from a list of unplanned jobs and visits that are due.',
      'See a technician\'s own days on the phone.',
    ],
    research: 'Schedule plans the work of Service and Projects and owns only the planned time and the assigned people (record 39, point 7).',
  },
  purchases: {
    can: [
      'Keep suppliers with terms and history.',
      'Raise purchase orders, approved above a limit, and send them.',
      'Receive goods, fully or partly, against the order.',
      'Record the supplier\'s bill and match it to the order and the receipt.',
    ],
    research: 'Buying and stock are two areas because they have different staff, and in project contracting much is bought without passing a store (record 39, rejected alternatives).',
  },
  inventory: {
    can: [
      'Keep the catalogue of items we sell and use, with prices.',
      'See stock in the store and in each van.',
      'Follow every receipt, issue and transfer as a movement.',
    ],
    research: 'Sales needs the item catalogue in phase 1, so until this area exists it is reached from Sales (record 39, consequences).',
  },
  billing: {
    can: [
      'Issue tax invoices with 5% VAT and the customer\'s TRN, from a job, a project claim or a sale.',
      'Issue credit notes for corrections, and record receipts against invoices.',
      'Send statements with ageing, and release retention.',
    ],
    research: 'Invoices are always their own list and the ledger is delegated to an accounting package; a real ledger is phase 4 (records 2 and 39).',
  },
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
