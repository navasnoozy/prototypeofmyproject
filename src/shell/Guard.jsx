import { Outlet } from 'react-router';
import { EyeOffIcon } from 'lucide-react';
import { AREA_BY_ID } from '@/data/areas.js';
import { useSession } from '@/store/session.js';
import { Button } from '@/ui/Button.jsx';
import { EmptyState, Page } from '@/ui/Page.jsx';

// A person reaches an area only if their role allows something inside it. In
// the product the item would not even be in the sidebar; here the address can
// still be typed, so this screen explains it.
export function Guard({ area }) {
  const { access, user, role } = useSession();
  if (access(area)) return <Outlet />;
  return (
    <Page title={AREA_BY_ID[area]?.label ?? 'Not available'}>
      <EmptyState
        icon={EyeOffIcon}
        title="Not in this person's menu"
        action={<Button variant="primary" to="/">Go to Home</Button>}
      >
        {user.name} ({role.label.toLowerCase()}) does not use {AREA_BY_ID[area]?.label ?? 'this area'}, so the
        product would not show it. Use “View as” in the top bar to look at it as someone else.
      </EmptyState>
    </Page>
  );
}
