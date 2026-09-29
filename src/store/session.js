import { AREAS } from '@/data/areas.js';
import { ROLES } from '@/data/roles.js';
import { useStore } from './store.js';

/** Who is "signed in" in the demo, and what that person may see and do. */
export function useSession() {
  const state = useStore();
  const user = state.staff[state.session.userId];
  const role = ROLES[user.roleKey];
  return {
    user,
    role,
    roleKey: user.roleKey,
    access: (areaId) => role.access[areaId] ?? null,
    canEdit: (areaId) => role.access[areaId] === 'edit',
    // What the person may do inside an area (see ACTIONS in data/roles.js).
    may: (action) => role.can?.includes(action) ?? false,
    areas: AREAS.filter((a) => role.access[a.id]),
  };
}
