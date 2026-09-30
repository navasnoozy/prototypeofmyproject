import { useSession } from '@/store/session.js';
import { RoleHome } from './RoleHome.jsx';
import { TechnicianToday } from './TechnicianToday.jsx';

// A technician's Home is the day's jobs (Today, built for the phone); every
// other role gets the Home of its role: four figures, what needs it, and the
// lists of its own work.
export function Home() {
  const { roleKey } = useSession();
  return roleKey === 'technician' ? <TechnicianToday /> : <RoleHome />;
}
