import { CompassIcon } from 'lucide-react';
import { Button } from '@/ui/Button.jsx';
import { EmptyState, Page } from '@/ui/Page.jsx';

export const NotFound = () => (
  <Page title="Page not found">
    <EmptyState icon={CompassIcon} title="This page does not exist" action={<Button variant="primary" to="/">Go to Home</Button>}>
      The address may be old, or the page is not part of the prototype yet.
    </EmptyState>
  </Page>
);
