import { useMemo, useState } from 'react';
import { PackageIcon, PlusIcon } from 'lucide-react';
import { ITEM_CATEGORIES, ITEM_UNITS } from '@/data/quotationKinds.js';
import { money, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { saveItem } from '@/store/inventoryActions.js';
import { onHandOf, stockRows } from '@/store/inventorySelectors.js';
import { supplierOptions } from '@/pages/purchases/parts.jsx';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Badge, Status } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Checkbox, Field, Segmented, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer } from '@/ui/Overlay.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { InventoryTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'The items the company sells, uses and keeps: one catalogue with a cost, a selling price and, for what is kept in stock, the levels that say when to reorder. Quotations, jobs, purchase orders and stock all take their items from here.',
  why: [
    'One catalogue for quotations, jobs, orders and stock: every mature product keeps a single list of items and prices (study, section F). It moved here from Sales now that stock exists.',
    'An item is either kept in stock (it has a minimum for the store and a level for each van) or not (bought when a project needs it). Services such as labour are never kept in stock.',
    'The cost has two meanings. "Cost" is the estimating cost that quotations use for their margin. "Average cost" is what the stock really cost, worked out from deliveries; issues to jobs and projects are valued with it.',
    'Cost and margin are shown only to those who deal with cost: sales, purchasing, stores, engineers, accounts and the managers.',
  ],
  assumed: ['All names, costs, prices and stock levels are samples. The maintenance rates (yearly, per device) are an assumption of how contracts are priced.'],
};

export function Items() {
  const s = useStore();
  const { may } = useSession();
  const editable = may('edit_items');
  const seeCost = may('see_cost');
  const [q, setQ] = useParam('q');
  const [category, setCategory] = useParam('category');
  const [show, setShow] = useParam('show', 'active');
  const [openId, setOpenId] = useParam('open');
  const [adding, setAdding] = useParam('new');
  const [drawer, setDrawer] = useState(null); // { item|null }

  const all = list(s.items);
  const stock = useMemo(() => Object.fromEntries(stockRows(s).map((r) => [r.item.id, r])), [s]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (i) =>
        (show === 'all' || (show === 'active' ? i.active : show === 'stocked' ? i.stocked && i.active : ['low', 'out'].includes(stock[i.id]?.state))) &&
        (!category || i.category === category) &&
        (!needle || `${i.code} ${i.name} ${i.category}`.toLowerCase().includes(needle)),
    );
  }, [all, stock, q, category, show]);

  const columns = useMemo(
    () => [
      { key: 'code', header: 'Code', sortValue: (i) => i.code, cell: (i) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">{i.code}</span> },
      {
        key: 'name', header: 'Item', sortValue: (i) => i.name,
        cell: (i) => (
          <div className="min-w-0">
            <p className="max-w-[44ch] truncate text-slate-900">{i.name}</p>
            <p className="truncate text-xs text-slate-500 lg:hidden">{i.category}</p>
          </div>
        ),
      },
      { key: 'category', header: 'Category', hideBelow: 'xl', sortValue: (i) => i.category, cell: (i) => <span className="text-slate-700">{i.category}</span> },
      { key: 'unit', header: 'Unit', hideBelow: 'md', cell: (i) => <span className="text-slate-500">{i.unit}</span> },
      ...(seeCost ? [{ key: 'cost', header: 'Cost (AED)', align: 'right', hideBelow: 'lg', sortValue: (i) => i.cost, cell: (i) => <span className="text-slate-500">{money(i.cost)}</span> }] : []),
      { key: 'price', header: 'Price (AED)', align: 'right', sortValue: (i) => i.price, cell: (i) => money(i.price) },
      ...(seeCost
        ? [{
            key: 'margin', header: 'Margin', align: 'right', hideBelow: 'xl', sortValue: (i) => (i.price ? (i.price - i.cost) / i.price : 0),
            cell: (i) => <span className="text-slate-500">{i.price ? `${(((i.price - i.cost) / i.price) * 100).toFixed(0)}%` : '—'}</span>,
          }]
        : []),
      {
        key: 'stock', header: 'In stock', align: 'right', hideBelow: 'md', sortValue: (i) => (i.stocked ? onHandOf(s, i.id) : -1),
        cell: (i) => (i.stocked ? <span className="tabular-nums text-slate-900">{stock[i.id]?.total ?? 0}</span> : <span className="text-slate-400">—</span>),
      },
      {
        key: 'state', header: 'State', hideBelow: 'md',
        cell: (i) => (!i.active ? <Badge>Not used</Badge> : i.stocked ? <Status kind="stock" value={stock[i.id]?.state ?? 'ok'} /> : <Badge tone="green" dot>In use</Badge>),
      },
    ],
    [s, stock, seeCost],
  );

  const table = useTable(rows, columns, { pageSize: 12, initialSort: { key: 'code', dir: 'asc' } });
  const linked = openId ? s.items[openId] : null;
  const current = drawer ?? (linked ? { item: linked } : adding === '1' && editable ? { item: null } : null);
  const close = () => {
    setDrawer(null);
    setOpenId('');
    setAdding('');
  };

  return (
    <Page
      title="Items"
      facts={`${plural(all.filter((i) => i.active).length, 'item')} in use · ${all.filter((i) => i.stocked).length} kept in stock`}
      tabs={<InventoryTabs />}
      about={ABOUT}
      actions={editable && <Button variant="primary" icon={PlusIcon} onClick={() => setDrawer({ item: null })}>New item</Button>}
      footer={<Pagination table={table} noun="items" />}
    >
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Search code, name, category" />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={ITEM_CATEGORIES} />
        <Segmented
          size="sm"
          label="Show"
          value={show}
          onChange={setShow}
          options={[{ value: 'active', label: 'In use' }, { value: 'stocked', label: 'Kept in stock' }, { value: 'low', label: 'Below minimum' }, { value: 'all', label: 'All' }]}
        />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        onRowClick={(item) => setDrawer({ item })}
        empty={<EmptyState icon={PackageIcon} title="No item matches" action={<Button onClick={() => { setQ(''); setCategory(''); setShow('active'); }}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(i) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{i.name}</p>
              <p className="truncate text-xs text-slate-500">{i.code} · per {i.unit}{i.stocked ? ` · ${stock[i.id]?.total ?? 0} in stock` : ''}</p>
            </div>
            <span className="text-sm tabular-nums text-slate-900">{money(i.price)}</span>
          </div>
        )}
      />
      {current && <ItemDrawer key={current.item?.id ?? 'new'} item={current.item} editable={editable} seeCost={seeCost} onClose={close} />}
    </Page>
  );
}

function ItemDrawer({ item, editable, seeCost, onClose }) {
  const s = useStore();
  const form = useForm(
    {
      code: item?.code ?? '', name: item?.name ?? '', category: item?.category ?? ITEM_CATEGORIES[0], unit: item?.unit ?? 'nos',
      cost: String(item?.cost ?? ''), price: String(item?.price ?? ''), kind: item?.kind ?? 'material', active: item?.active ?? true,
      stocked: item?.stocked ?? false, minStore: String(item?.minStore ?? ''), reorderQty: String(item?.reorderQty ?? ''), vanPar: String(item?.vanPar ?? ''),
      supplierId: item?.supplierId ?? '',
    },
    (v) => ({
      ...(v.code.trim() ? {} : { code: 'Give the item a code.' }),
      ...(list(s.items).some((i) => i.code.toLowerCase() === v.code.trim().toLowerCase() && i.id !== item?.id) ? { code: 'This code is already used.' } : {}),
      ...(v.name.trim().length >= 3 ? {} : { name: 'Write the name of the item.' }),
      ...(v.price !== '' && Number(v.price) >= 0 ? {} : { price: 'Write the selling price.' }),
      ...(v.cost === '' || Number(v.cost) >= 0 ? {} : { cost: 'Write an amount of zero or more.' }),
      ...(v.stocked && !(Number(v.minStore) >= 0 && v.minStore !== '') ? { minStore: 'Write the smallest quantity to keep in the store.' } : {}),
      ...(v.stocked && !(Number(v.reorderQty) > 0) ? { reorderQty: 'Write the usual order quantity.' } : {}),
    }),
  );
  const { values } = form;
  const margin = Number(values.price) > 0 ? ((Number(values.price) - Number(values.cost || 0)) / Number(values.price)) * 100 : null;
  const row = item ? stockRows(s).find((r) => r.item.id === item.id) : null;
  const save = form.submit((v) => {
    saveItem({
      ...(item ?? {}), code: v.code.trim(), name: v.name.trim(), category: v.category, unit: v.unit, cost: Number(v.cost || 0), price: Number(v.price), kind: v.kind, active: v.active,
      stocked: v.kind === 'material' && v.stocked, minStore: Number(v.minStore || 0), reorderQty: Number(v.reorderQty || 0), vanPar: Number(v.vanPar || 0), supplierId: v.supplierId,
      ...(item ? {} : { avgCost: Number(v.cost || 0) }),
    });
    toast(item ? 'Item saved' : 'Item added');
    onClose();
  });
  return (
    <Drawer
      open
      onClose={onClose}
      title={item ? item.code : 'New item'}
      subtitle={item ? item.name : 'An item of the catalogue'}
      footer={editable ? <><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{item ? 'Save changes' : 'Add item'}</Button></> : <Button onClick={onClose}>Close</Button>}
    >
      <form onSubmit={save} className="grid grid-cols-1 gap-4" inert={editable ? undefined : true}>
        <Field label="Code" required error={form.error('code')}><TextInput {...form.bind('code')} autoComplete="off" /></Field>
        <Field label="Name" required error={form.error('name')}><TextInput {...form.bind('name')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Select {...form.bind('category')} options={ITEM_CATEGORIES} /></Field>
          <Field label="Unit"><Select {...form.bind('unit')} options={ITEM_UNITS} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {seeCost && <Field label="Cost" hint="Used for the margin of quotations." error={form.error('cost')}><TextInput {...form.bind('cost')} prefix="AED" inputMode="decimal" /></Field>}
          <Field label="Selling price" required error={form.error('price')}><TextInput {...form.bind('price')} prefix="AED" inputMode="decimal" /></Field>
        </div>
        {seeCost && margin !== null && <p className="text-sm text-slate-600">Margin: <strong className="font-semibold text-slate-900">{margin.toFixed(1)}%</strong></p>}
        <Field label="Kind">
          <Segmented label="Kind" value={values.kind} onChange={(v) => form.set('kind', v)} options={[{ value: 'material', label: 'Material' }, { value: 'service', label: 'Service' }]} />
        </Field>

        {values.kind === 'material' && (
          <section className="rounded-2xl border border-slate-200 p-4">
            <Checkbox label="Keep in stock" hint="The store counts it, vans carry it, and the reorder panel watches it." checked={values.stocked} onChange={(v) => form.set('stocked', v)} />
            {values.stocked && (
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Minimum in the store" error={form.error('minStore')}><TextInput {...form.bind('minStore')} inputMode="decimal" /></Field>
                  <Field label="Usual order" error={form.error('reorderQty')}><TextInput {...form.bind('reorderQty')} inputMode="decimal" /></Field>
                  <Field label="Each van carries"><TextInput {...form.bind('vanPar')} inputMode="decimal" /></Field>
                </div>
                <Field label="Usually bought from"><Combobox options={supplierOptions(s)} noun="suppliers" placeholder="No usual supplier" searchPlaceholder="Search suppliers" clearable {...form.bind('supplierId')} /></Field>
                {row && (
                  <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                    <div><dt className="text-xs text-slate-500">In the store</dt><dd className="tabular-nums text-slate-900">{row.store}</dd></div>
                    <div><dt className="text-xs text-slate-500">In the vans</dt><dd className="tabular-nums text-slate-900">{row.inVans}</dd></div>
                    <div><dt className="text-xs text-slate-500">On order</dt><dd className="tabular-nums text-slate-900">{row.onOrder}</dd></div>
                    {seeCost && <div><dt className="text-xs text-slate-500">Average cost</dt><dd className="tabular-nums text-slate-900">AED {money(item.avgCost ?? item.cost)}</dd></div>}
                  </dl>
                )}
              </div>
            )}
          </section>
        )}
        <Checkbox label="In use" hint="An item that is not in use stays in old documents but cannot be added to new ones." checked={values.active} onChange={(v) => form.set('active', v)} />
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

