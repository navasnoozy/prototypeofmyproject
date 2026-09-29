import { useMemo, useState } from 'react';
import { PlusIcon, TagIcon } from 'lucide-react';
import { ITEM_CATEGORIES, ITEM_UNITS } from '@/data/quotationKinds.js';
import { money, plural } from '@/lib/format.js';
import { useParam } from '@/lib/useParam.js';
import { saveItem } from '@/store/salesActions.js';
import { list } from '@/store/selectors.js';
import { useSession } from '@/store/session.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Badge } from '@/ui/Badge.jsx';
import { Button } from '@/ui/Button.jsx';
import { Checkbox, Field, Segmented, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer } from '@/ui/Overlay.jsx';
import { EmptyState, FilterSelect, Page, SearchField, Toolbar } from '@/ui/Page.jsx';
import { DataTable, Pagination, useTable } from '@/ui/Table.jsx';
import { SalesTabs } from './parts.jsx';

const ABOUT = {
  purpose: 'The items the company sells and uses, with a cost and a selling price. Quotations take their lines from here, and the yearly maintenance rates too.',
  why: [
    'One catalogue for quotations, jobs and invoices: every mature product keeps a single list of items and prices (study, section F).',
    'The catalogue is needed by Sales in the first phase, before stock exists. Record 39 therefore keeps it reachable from Sales until the Inventory area is built (step 6); then this page moves there.',
    'Cost is only shown to people who work in Sales, so the margin of each line can be judged when quoting.',
  ],
  assumed: ['All names, costs and prices are samples. The maintenance rates (yearly, per device) are an assumption of how contracts are priced.'],
};

export function Catalogue() {
  const s = useStore();
  const { canEdit } = useSession();
  const editable = canEdit('sales');
  const [q, setQ] = useParam('q');
  const [category, setCategory] = useParam('category');
  const [show, setShow] = useParam('show', 'active');
  const [openId, setOpenId] = useParam('open');
  const [drawer, setDrawer] = useState(null); // { item|null }

  const all = list(s.items);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (i) =>
        (show === 'all' || i.active) &&
        (!category || i.category === category) &&
        (!needle || `${i.code} ${i.name} ${i.category}`.toLowerCase().includes(needle)),
    );
  }, [all, q, category, show]);

  const columns = useMemo(
    () => [
      { key: 'code', header: 'Code', sortValue: (i) => i.code, cell: (i) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">{i.code}</span> },
      {
        key: 'name', header: 'Item', sortValue: (i) => i.name,
        cell: (i) => (
          <div className="min-w-0">
            <p className="truncate text-slate-900">{i.name}</p>
            <p className="truncate text-xs text-slate-500 lg:hidden">{i.category}</p>
          </div>
        ),
      },
      { key: 'category', header: 'Category', hideBelow: 'lg', sortValue: (i) => i.category, cell: (i) => <span className="text-slate-700">{i.category}</span> },
      { key: 'unit', header: 'Unit', hideBelow: 'md', cell: (i) => <span className="text-slate-500">{i.unit}</span> },
      ...(editable
        ? [
            { key: 'cost', header: 'Cost (AED)', align: 'right', hideBelow: 'md', sortValue: (i) => i.cost, cell: (i) => <span className="text-slate-500">{money(i.cost)}</span> },
          ]
        : []),
      { key: 'price', header: 'Price (AED)', align: 'right', sortValue: (i) => i.price, cell: (i) => money(i.price) },
      ...(editable
        ? [
            {
              key: 'margin', header: 'Margin', align: 'right', hideBelow: 'lg', sortValue: (i) => (i.price ? (i.price - i.cost) / i.price : 0),
              cell: (i) => <span className="text-slate-500">{i.price ? `${(((i.price - i.cost) / i.price) * 100).toFixed(0)}%` : '—'}</span>,
            },
          ]
        : []),
      { key: 'active', header: 'State', hideBelow: 'md', cell: (i) => (i.active ? <Badge tone="green" dot>In use</Badge> : <Badge>Not used</Badge>) },
    ],
    [editable],
  );

  const table = useTable(rows, columns, { pageSize: 12, initialSort: { key: 'code', dir: 'asc' } });
  const linked = openId ? s.items[openId] : null;
  const current = drawer ?? (linked ? { item: linked } : null);
  const close = () => {
    setDrawer(null);
    setOpenId('');
  };

  return (
    <Page
      title="Catalogue"
      facts={`${plural(all.filter((i) => i.active).length, 'item')} in use · a temporary home in Sales until Inventory exists`}
      tabs={<SalesTabs />}
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
          options={[{ value: 'active', label: 'In use' }, { value: 'all', label: 'All' }]}
        />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSort={table.toggleSort}
        onRowClick={(item) => setDrawer({ item })}
        empty={<EmptyState icon={TagIcon} title="No item matches" action={<Button onClick={() => { setQ(''); setCategory(''); setShow('active'); }}>Clear filters</Button>}>Try fewer words or clear the filters.</EmptyState>}
        mobileRow={(i) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{i.name}</p>
              <p className="truncate text-xs text-slate-500">{i.code} · per {i.unit}</p>
            </div>
            <span className="text-sm tabular-nums text-slate-900">{money(i.price)}</span>
          </div>
        )}
      />
      {current && <ItemDrawer key={current.item?.id ?? 'new'} item={current.item} editable={editable} onClose={close} />}
    </Page>
  );
}

function ItemDrawer({ item, editable, onClose }) {
  const s = useStore();
  const form = useForm(
    {
      code: item?.code ?? '', name: item?.name ?? '', category: item?.category ?? ITEM_CATEGORIES[0], unit: item?.unit ?? 'nos',
      cost: String(item?.cost ?? ''), price: String(item?.price ?? ''), kind: item?.kind ?? 'material', active: item?.active ?? true,
    },
    (v) => ({
      ...(v.code.trim() ? {} : { code: 'Give the item a code.' }),
      ...(list(s.items).some((i) => i.code.toLowerCase() === v.code.trim().toLowerCase() && i.id !== item?.id) ? { code: 'This code is already used.' } : {}),
      ...(v.name.trim().length >= 3 ? {} : { name: 'Write the name of the item.' }),
      ...(v.price !== '' && Number(v.price) >= 0 ? {} : { price: 'Write the selling price.' }),
      ...(v.cost === '' || Number(v.cost) >= 0 ? {} : { cost: 'Write an amount of zero or more.' }),
    }),
  );
  const { values } = form;
  const margin = Number(values.price) > 0 ? ((Number(values.price) - Number(values.cost || 0)) / Number(values.price)) * 100 : null;
  const save = form.submit((v) => {
    saveItem({ ...(item ?? {}), code: v.code.trim(), name: v.name.trim(), category: v.category, unit: v.unit, cost: Number(v.cost || 0), price: Number(v.price), kind: v.kind, active: v.active });
    toast(item ? 'Item saved' : 'Item added');
    onClose();
  });
  return (
    <Drawer
      open
      onClose={onClose}
      title={item ? item.code : 'New item'}
      subtitle={item ? undefined : 'An item of the catalogue'}
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
          <Field label="Cost" hint="What it costs us." error={form.error('cost')}><TextInput {...form.bind('cost')} prefix="AED" inputMode="decimal" /></Field>
          <Field label="Selling price" required error={form.error('price')}><TextInput {...form.bind('price')} prefix="AED" inputMode="decimal" /></Field>
        </div>
        {margin !== null && <p className="text-sm text-slate-600">Margin: <strong className="font-semibold text-slate-900">{margin.toFixed(1)}%</strong></p>}
        <Field label="Kind">
          <Segmented label="Kind" value={values.kind} onChange={(v) => form.set('kind', v)} options={[{ value: 'material', label: 'Material' }, { value: 'service', label: 'Service' }]} />
        </Field>
        <Checkbox label="In use" hint="An item that is not in use stays in old quotations but cannot be added to new ones." checked={values.active} onChange={(v) => form.set('active', v)} />
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}
