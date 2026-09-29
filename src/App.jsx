import { Navigate, Route, Routes, useLocation } from 'react-router';
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
import { EnquiryDetail } from '@/pages/sales/EnquiryDetail.jsx';
import { EnquiryForm } from '@/pages/sales/EnquiryForm.jsx';
import { EnquiryList } from '@/pages/sales/EnquiryList.jsx';
import { QuotationDetail } from '@/pages/sales/QuotationDetail.jsx';
import { QuotationList } from '@/pages/sales/QuotationList.jsx';
import { QuotationNew } from '@/pages/sales/QuotationNew.jsx';
import { Compliance } from '@/pages/service/Compliance.jsx';
import { ContractDetail } from '@/pages/service/ContractDetail.jsx';
import { ContractList } from '@/pages/service/ContractList.jsx';
import { DeficiencyDetail } from '@/pages/service/DeficiencyDetail.jsx';
import { DeficiencyList } from '@/pages/service/DeficiencyList.jsx';
import { EquipmentRegister } from '@/pages/service/EquipmentRegister.jsx';
import { JobDetail } from '@/pages/service/JobDetail.jsx';
import { JobForm } from '@/pages/service/JobForm.jsx';
import { JobList } from '@/pages/service/JobList.jsx';
import { ProjectDetail } from '@/pages/projects/ProjectDetail.jsx';
import { ProjectList } from '@/pages/projects/ProjectList.jsx';
import { ScheduleHome } from '@/pages/schedule/ScheduleHome.jsx';
import { Items } from '@/pages/inventory/Items.jsx';
import { Movements } from '@/pages/inventory/Movements.jsx';
import { Stock } from '@/pages/inventory/Stock.jsx';
import { BillList } from '@/pages/purchases/BillList.jsx';
import { PurchaseOrderDetail } from '@/pages/purchases/PurchaseOrderDetail.jsx';
import { PurchaseOrderForm } from '@/pages/purchases/PurchaseOrderForm.jsx';
import { PurchaseOrderList } from '@/pages/purchases/PurchaseOrderList.jsx';
import { SupplierDetail } from '@/pages/purchases/SupplierDetail.jsx';
import { SupplierList } from '@/pages/purchases/SupplierList.jsx';

// Areas that are built in a later step show a page that explains what will be
// there. Each is replaced by the real pages when its step is done.
const LATER = AREAS.filter((a) => !['home', 'customers', 'sales', 'service', 'projects', 'schedule', 'purchases', 'inventory'].includes(a.id));

// The catalogue moved from Sales to Inventory (step 6): old links keep working, with their query.
function CatalogueRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/inventory${search}`} replace />;
}

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

        <Route path="sales" element={<Guard area="sales" />}>
          <Route index element={<EnquiryList />} />
          <Route path="new" element={<EnquiryForm />} />
          <Route path="quotations" element={<QuotationList />} />
          <Route path="quotations/new" element={<QuotationNew />} />
          <Route path="quotations/:quotationId" element={<QuotationDetail />} />
          <Route path="catalogue" element={<CatalogueRedirect />} />
          <Route path=":enquiryId" element={<EnquiryDetail />} />
          <Route path=":enquiryId/edit" element={<EnquiryForm />} />
        </Route>

        <Route path="service" element={<Guard area="service" />}>
          <Route index element={<ContractList />} />
          <Route path="jobs" element={<JobList />} />
          <Route path="jobs/new" element={<JobForm />} />
          <Route path="jobs/:jobId" element={<JobDetail />} />
          <Route path="deficiencies" element={<DeficiencyList />} />
          <Route path="deficiencies/:deficiencyId" element={<DeficiencyDetail />} />
          <Route path="equipment" element={<EquipmentRegister />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path=":contractId" element={<ContractDetail />} />
        </Route>

        <Route path="projects" element={<Guard area="projects" />}>
          <Route index element={<ProjectList />} />
          <Route path=":projectId" element={<ProjectDetail />} />
        </Route>

        <Route path="schedule" element={<Guard area="schedule" />}>
          <Route index element={<ScheduleHome />} />
        </Route>

        <Route path="purchases" element={<Guard area="purchases" />}>
          <Route index element={<PurchaseOrderList />} />
          <Route path="new" element={<PurchaseOrderForm />} />
          <Route path="bills" element={<BillList />} />
          <Route path="suppliers" element={<SupplierList />} />
          <Route path="suppliers/:supplierId" element={<SupplierDetail />} />
          <Route path=":poId" element={<PurchaseOrderDetail />} />
          <Route path=":poId/edit" element={<PurchaseOrderForm />} />
        </Route>

        <Route path="inventory" element={<Guard area="inventory" />}>
          <Route index element={<Items />} />
          <Route path="stock" element={<Stock />} />
          <Route path="movements" element={<Movements />} />
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
