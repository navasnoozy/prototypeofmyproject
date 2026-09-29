import { useMemo } from 'react';
import { attentionItems } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';

// What needs attention, limited to the areas the current person can see, and
// counted per area for the small red numbers in the sidebar.
export function useAttention() {
  const state = useStore();
  const { access } = useSession();
  // The person is part of the state, so [state] covers `access` too.
  return useMemo(() => {
    const items = attentionItems(state).filter((i) => access(i.area));
    const byArea = {};
    for (const i of items) byArea[i.area] = (byArea[i.area] ?? 0) + 1;
    return { items, byArea, total: items.length };
  }, [state]);
}
