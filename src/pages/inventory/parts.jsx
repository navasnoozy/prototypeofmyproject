import { STORE_ID } from '@/data/purchaseKinds.js';
import { list } from '@/store/selectors.js';
import { lowStockRows, movementRows, stockRows } from '@/store/inventorySelectors.js';
import { useStore } from '@/store/store.js';
import { NavTabs } from '@/ui/Page.jsx';

// Small pieces shared by the screens of the Inventory area.

export function InventoryTabs() {
  const s = useStore();
  const low = lowStockRows(stockRows(s)).length;
  return (
    <NavTabs
      items={[
        { to: '/inventory', label: 'Items', count: list(s.items).filter((i) => i.active).length },
        { to: '/inventory/stock', label: 'Stock', count: low > 0 ? low : undefined },
        { to: '/inventory/movements', label: 'Movements', count: movementRows(s).length },
      ]}
    />
  );
}

/** "Van 1 (Toyota Hiace)" becomes "Van 1". */
export const shortPlace = (location) => (location?.id === STORE_ID ? 'Main store' : location?.name.split(' (')[0] ?? '');
