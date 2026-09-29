import { useParam } from '@/lib/useParam.js';
import { useSession } from '@/store/session.js';
import { Board } from './Board.jsx';
import { MyWeek } from './MyWeek.jsx';

// The Schedule page: a person who works on a phone sees their own week (and may
// look at the team board, read-only); everyone else plans on the board.
export function ScheduleHome() {
  const { role } = useSession();
  const [view] = useParam('view', 'mine');
  if (role.phoneFirst && view !== 'team') return <MyWeek />;
  return <Board readOnly={Boolean(role.phoneFirst)} />;
}
