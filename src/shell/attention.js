import { useMemo } from 'react';
import { attentionItems } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';

// What needs attention, limited to the areas where the current person can act,
// and counted per area for the small red numbers in the sidebar.
export function useAttention() {
  const state = useStore();
  const { canEdit } = useSession();
  // The person is part of the state, so [state] covers `canEdit` too.
  return useMemo(() => {
    // Only what the person can act on: an area that is only viewed adds nothing.
    const items = attentionItems(state).filter((i) => canEdit(i.area));
    const byArea = {};
    for (const i of items) byArea[i.area] = (byArea[i.area] ?? 0) + 1;
    return { items, byArea, total: items.length };
  }, [state]);
}
