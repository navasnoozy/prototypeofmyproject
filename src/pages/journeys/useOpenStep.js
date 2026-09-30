import { useNavigate } from 'react-router';
import { ROLES } from '@/data/roles.js';
import { useSession } from '@/store/session.js';
import { setSession, useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';

/**
 * Opens a step of a journey: the window becomes the person who does the step (if it is not that person
 * already) and goes to the page of the step.
 */
export function useOpenStep() {
  const s = useStore();
  const { user } = useSession();
  const navigate = useNavigate();
  return (step) => {
    const person = s.staff[step.person];
    if (person && person.id !== user.id) {
      setSession(person.id);
      toast(`Now viewing as ${person.name}, ${ROLES[person.roleKey].label.toLowerCase()}`);
    }
    navigate(step.path);
  };
}

/** "Open as Nadia", or just "Open" when the window already is that person. */
export const openLabel = (s, userId, step) => {
  const person = s.staff[step.person];
  return !person || person.id === userId ? 'Open' : `Open as ${person.name.split(' ')[0]}`;
};
