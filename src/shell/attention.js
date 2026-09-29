import { useMemo } from 'react';
import { inventoryAttention } from '@/store/inventorySelectors.js';
import { purchaseAttention } from '@/store/purchaseSelectors.js';
import { salesAttention } from '@/store/salesSelectors.js';
import { projectAttention } from '@/store/projectSelectors.js';
import { scheduleAttention } from '@/store/scheduleSelectors.js';
import { serviceAttention } from '@/store/serviceSelectors.js';
import { attentionItems } from '@/store/selectors.js';
import { todayISO } from '@/lib/dates.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';

// What needs attention, limited to the areas where the current person can act,
// and counted per area for the small red numbers in the sidebar.
export function useAttention() {
  const state = useStore();
  const { canEdit, may, roleKey, user } = useSession();
  // The person is part of the state, so [state] covers `canEdit` too.
  return useMemo(() => {
    // Only what the person can act on: an area that is only viewed adds nothing.
    const today = todayISO();
    // A technician sees his own jobs (from Service), not the planning worries of the office.
    const office = attentionItems(state, today).filter((i) => roleKey !== 'technician' || i.area !== 'service');
    const items = [
      ...office, ...salesAttention(state, today, user.id), ...serviceAttention(state, today, user.id), ...projectAttention(state, today, user.id),
      ...scheduleAttention(state, today, user.id), ...purchaseAttention(state, today, user.id), ...inventoryAttention(state, today, user.id),
    ].filter((i) => (i.action ? may(i.action) : canEdit(i.area)));
    const byArea = {};
    for (const i of items) byArea[i.area] = (byArea[i.area] ?? 0) + 1;
    return { items, byArea, total: items.length };
  }, [state]);
}
