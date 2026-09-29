import { lowStockRows, movementRows, negativeBalances, stockRows } from '@/store/inventorySelectors.js';
import { billRows, inSegment, orderViews, projectView } from '@/store/purchaseSelectors.js';
import { latestQuotations } from '@/store/salesSelectors.js';
import { list, siteHealth, siteSummary, summariseDevices } from '@/store/selectors.js';
import { contractStatus, jobStatus, openDeficiencies } from '@/store/serviceSelectors.js';
import { isActive, overBudget, readyToHandOver } from '@/store/projectSelectors.js';
import { boardItems, dayProblems, fieldStaff, queueItems } from '@/store/scheduleSelectors.js';
import { addDays } from '@/lib/dates.js';
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
  if (areaId === 'projects' && pageId === 'projects') {
    const active = list(s.projects).filter(isActive);
    const over = active.filter((p) => overBudget(projectView(s, p)).length > 0).length;
    const ready = active.filter((p) => p.phase === 'handover' && readyToHandOver(p)).length;
    return {
      count: active.length,
      note: over > 0 ? { tone: 'orange', text: `${over} over budget` } : ready > 0 ? { tone: 'orange', text: `${ready} ready to hand over` } : undefined,
    };
  }
  if (areaId === 'schedule' && pageId === 'board') {
    const today = todayISO();
    const queue = queueItems(s, today);
    const items = boardItems(s, today, addDays(today, 7));
    let clashes = 0;
    for (const person of fieldStaff(s)) for (let i = 0; i <= 7; i += 1) if (dayProblems(s, person.id, addDays(today, i), items).length > 0) clashes += 1;
    return {
      count: queue.jobs.length + queue.tasks.length,
      note: clashes > 0 ? { tone: 'orange', text: `${clashes} clash${clashes === 1 ? '' : 'es'} this week` } : undefined,
    };
  }
  if (areaId === 'purchases') {
    const today = todayISO();
    if (pageId === 'orders') {
      const views = orderViews(s, today);
      const late = views.filter((v) => v.late).length;
      const waiting = views.filter((v) => v.status === 'waiting_approval').length;
      return {
        count: views.filter((v) => inSegment(v, 'open')).length,
        note: late > 0 ? { tone: 'red', text: `${late} late` } : waiting > 0 ? { tone: 'orange', text: `${waiting} waiting approval` } : undefined,
      };
    }
    if (pageId === 'bills') {
      const unpaid = billRows(s, today).filter((r) => r.state !== 'paid');
      const overdue = unpaid.filter((r) => r.state === 'overdue').length;
      return { count: unpaid.length, note: overdue > 0 ? { tone: 'red', text: `${overdue} overdue` } : undefined };
    }
    if (pageId === 'suppliers') return { count: list(s.suppliers).filter((x) => x.active).length };
  }
  if (areaId === 'inventory') {
    if (pageId === 'items') return { count: list(s.items).filter((i) => i.active).length };
    if (pageId === 'stock') {
      const low = lowStockRows(stockRows(s)).length;
      const negative = negativeBalances(s).length;
      return { note: negative > 0 ? { tone: 'red', text: `${negative} need a count` } : low > 0 ? { tone: 'orange', text: `${low} below minimum` } : undefined };
    }
    if (pageId === 'movements') return { count: movementRows(s).length };
  }
  return {};
}
