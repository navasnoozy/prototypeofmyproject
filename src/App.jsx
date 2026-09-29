import { Navigate, Route, Routes } from 'react-router';
import { AREAS } from '@/data/areas.js';
import { AppShell } from '@/shell/AppShell.jsx';
import { Guard } from '@/shell/Guard.jsx';
import { AreaPlaceholder } from '@/pages/areas/AreaPlaceholder.jsx';
import { NotFound } from '@/pages/NotFound.jsx';
import { Settings } from '@/pages/Settings.jsx';
import { Home } from '@/pages/home/Home.jsx';
import { ContactList } from '@/pages/customers/ContactList.jsx';
import { CustomerDetail } from '@/pages/customers/CustomerDetail.jsx';
import { CustomerForm } from '@/pages/customers/CustomerForm.jsx';
import { CustomerList } from '@/pages/customers/CustomerList.jsx';
import { SiteDetail } from '@/pages/customers/SiteDetail.jsx';
import { SiteForm } from '@/pages/customers/SiteForm.jsx';
import { SiteList } from '@/pages/customers/SiteList.jsx';

// Areas that are built in a later step show a page that explains what will be
// there. Each is replaced by the real pages when its step is done.
const LATER = AREAS.filter((a) => !['home', 'customers'].includes(a.id));

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />

        <Route path="customers" element={<Guard area="customers" />}>
          <Route index element={<CustomerList />} />
          <Route path="new" element={<CustomerForm />} />
          <Route path="sites" element={<SiteList />} />
          <Route path="sites/new" element={<SiteForm />} />
          <Route path="sites/:siteId" element={<SiteDetail />} />
          <Route path="sites/:siteId/edit" element={<SiteForm />} />
          <Route path="contacts" element={<ContactList />} />
          <Route path=":customerId" element={<CustomerDetail />} />
          <Route path=":customerId/edit" element={<CustomerForm />} />
        </Route>

        {LATER.map((a) => (
          <Route key={a.id} path={a.id} element={<Guard area={a.id} />}>
            <Route path="*" element={<AreaPlaceholder areaId={a.id} />} />
            <Route index element={<AreaPlaceholder areaId={a.id} />} />
          </Route>
        ))}

        <Route path="settings" element={<Settings />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
