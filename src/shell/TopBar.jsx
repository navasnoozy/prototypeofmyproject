import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { SettingsIcon, SmartphoneIcon } from 'lucide-react';
import { EMBEDDED } from '@/lib/embed.js';
import { cn } from '@/lib/cn.js';
import { IconButton } from '@/ui/Button.jsx';
import { AccountMenu } from './AccountMenu.jsx';
import { Bell } from './Bell.jsx';
import { JourneyPill } from './JourneyPill.jsx';
import { Mark } from './Mark.jsx';
import { Search } from './Search.jsx';
import { SyncChip } from './SyncChip.jsx';
import { ViewAs } from './ViewAs.jsx';

// The brand capsule and the top bar capsule (record 37). The page title is not
// here: it lives in the content header. On a phone the search takes the whole
// bar while it is open.
export function TopBar({ phoneOpen = false, onPhone }) {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  return (
    <header className="no-print flex gap-2 md:col-span-full md:gap-3">
      <Link
        to="/"
        aria-label="Home"
        className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white shadow-float md:w-20', searching && 'max-md:hidden')}
      >
        <Mark />
      </Link>
      <div className="flex h-14 min-w-0 flex-1 items-center gap-1 rounded-full bg-white pl-3 pr-2 shadow-float md:pl-4">
        <Search onOpenChange={setSearching} />
        <div className="flex-1" />
        <div className={cn('flex items-center gap-1', searching && 'max-md:hidden')}>
          <SyncChip />
          {!EMBEDDED && (
            <button
              type="button"
              aria-pressed={phoneOpen}
              onClick={onPhone}
              className={cn(
                'hidden h-9 items-center gap-2 whitespace-nowrap rounded-full border border-amber-200 px-3 text-sm text-amber-950 transition-colors duration-150 hover:bg-amber-100 md:inline-flex',
                phoneOpen ? 'bg-amber-100' : 'bg-amber-50',
              )}
            >
              <SmartphoneIcon className="size-4 text-amber-700" aria-hidden="true" />
              Phone view
            </button>
          )}
          <JourneyPill />
          <ViewAs />
          <Bell />
          <IconButton
            icon={SettingsIcon}
            label="Settings"
            onClick={() => navigate('/settings')}
            className="max-md:hidden"
          />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
