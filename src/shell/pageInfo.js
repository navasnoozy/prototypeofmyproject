import { latestQuotations } from '@/store/salesSelectors.js';
import { list, siteHealth, siteSummary, summariseDevices } from '@/store/selectors.js';
import { contractStatus, jobStatus, openDeficiencies } from '@/store/serviceSelectors.js';
import { addMonths, todayISO } from '@/lib/dates.js';

// The small facts shown next to a sub module in the sidebar popup: a count,
// and a warning when something in it needs attention. Every step of the build
// adds its own pages here; a page not listed simply shows nothing.
//   returns { count?: number, note?: { tone: 'red' | 'orange', text: string } }
export function pageInfo(s, areaId, pageId) {
  if (areaId === 'customers') {
    if (pageId === 'customers') {
      const holds = list(s.customers).filter((c) => c.status === 'on_hold').length;
      return {
        count: list(s.customers).length,
        note: holds > 0 ? { tone: 'red', text: `${holds} on hold` } : undefined,
      };
    }
    if (pageId === 'sites') {
      const overdue = list(s.sites).filter((x) => siteHealth(siteSummary(s, x.id)) === 'overdue').length;
      return {
        count: list(s.sites).length,
        note: overdue > 0 ? { tone: 'orange', text: `${overdue} overdue` } : undefined,
      };
    }
    if (pageId === 'contacts') return { count: list(s.contacts).length };
  }
  if (areaId === 'sales') {
    if (pageId === 'enquiries') {
      const open = list(s.enquiries).filter((e) => ['new', 'survey', 'estimating'].includes(e.status));
      const late = open.filter((e) => e.dueOn && e.dueOn < todayISO()).length;
      return {
        count: open.length,
        note: late > 0 ? { tone: 'red', text: `${late} late` } : undefined,
      };
    }
    if (pageId === 'quotations') {
      const waiting = latestQuotations(s).filter((q) => q.status === 'waiting_approval').length;
      return {
        count: latestQuotations(s).length,
        note: waiting > 0 ? { tone: 'orange', text: `${waiting} waiting approval` } : undefined,
      };
    }
    if (pageId === 'catalogue') return { count: list(s.items).filter((i) => i.active).length };
  }
  if (areaId === 'service') {
    const today = todayISO();
    if (pageId === 'contracts') {
      const live = list(s.contracts).map((c) => contractStatus(c, today));
      const ending = live.filter((x) => x === 'expiring').length;
      return {
        count: live.filter((x) => ['active', 'expiring'].includes(x)).length,
        note: ending > 0 ? { tone: 'orange', text: `${ending} ending soon` } : undefined,
      };
    }
    if (pageId === 'jobs') {
      const jobs = list(s.jobs).map((j) => jobStatus(j, today));
      const need = jobs.filter((x) => x === 'unplanned').length;
      return {
        count: jobs.filter((x) => ['unplanned', 'planned', 'in_progress'].includes(x)).length,
        note: need > 0 ? { tone: 'orange', text: `${need} need planning` } : undefined,
      };
    }
    if (pageId === 'deficiencies') {
      const open = openDeficiencies(s).filter((d) => d.status !== 'declined');
      const imp = open.filter((d) => d.severity === 'impairment').length;
      return {
        count: open.length,
        note: imp > 0 ? { tone: 'red', text: `${imp} impairment${imp === 1 ? '' : 's'}` } : undefined,
      };
    }
    if (pageId === 'compliance') {
      const previous = addMonths(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
      return { note: s.returns[previous] ? undefined : { tone: 'orange', text: 'Return to submit' } };
    }
    if (pageId === 'equipment') {
      const sum = summariseDevices(list(s.devices), today);
      return { count: sum.rows, note: sum.overdue > 0 ? { tone: 'orange', text: `${sum.overdue} overdue` } : undefined };
    }
  }
  return {};
}

