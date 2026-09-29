import { useMemo, useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { COUNT_REASONS } from '@/data/purchaseKinds.js';
import { round3 } from '@/data/purchaseRules.js';
import { countStock, transferStock } from '@/store/inventoryActions.js';
import { balanceOf, locationList } from '@/store/inventorySelectors.js';
import { list } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';
import { Field, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer } from '@/ui/Overlay.jsx';
import { cn } from '@/lib/cn.js';
import { shortPlace } from './parts.jsx';

const placeOptions = (s) => locationList(s).map((l) => ({ value: l.id, label: l.name }));

// ---- transfer between places -----------------------------------------------------------------------
// `preset` is { from, to, lines: [{ itemId, qty }] }, for a van top-up.
export function TransferDrawer({ open, onClose, preset }) {
  if (!open) return null;
  return <TransferBody onClose={onClose} preset={preset} />;
}

function TransferBody({ onClose, preset }) {
  const s = useStore();
  const places = locationList(s);
  const [rows, setRows] = useState(() => (preset?.lines ?? []).map((l) => ({ itemId: l.itemId, qty: String(l.qty) })));
  const form = useForm(
    { from: preset?.from ?? places[0]?.id, to: preset?.to ?? places[1]?.id, note: '' },
    (v) => ({
      ...(v.from === v.to ? { to: 'Choose a different place to send it to.' } : {}),
      ...(rows.length === 0 || rows.every((r) => !(Number(r.qty) > 0)) ? { rows: 'Add at least one item with a quantity.' } : {}),
      ...(rows.some((r) => Number(r.qty) > balanceOf(s, r.itemId, v.from)) ? { rows: `There is not enough in ${shortPlace(s.locations[v.from])} for one of the items.` } : {}),
    }),
  );
  const { values } = form;
  const options = useMemo(
    () => list(s.items).filter((i) => i.stocked && !rows.some((r) => r.itemId === i.id)).map((i) => ({ value: i.id, label: i.name, sub: `${i.code} · ${balanceOf(s, i.id, values.from)} in ${shortPlace(s.locations[values.from])}` })),
    [s, rows, values.from],
  );
  const save = form.submit((v) => {
    const n = transferStock({ from: v.from, to: v.to, lines: rows.map((r) => ({ itemId: r.itemId, qty: Number(r.qty) })), note: v.note.trim() || `${shortPlace(s.locations[v.from])} to ${shortPlace(s.locations[v.to])}` });
    toast(`${n} ${n === 1 ? 'item' : 'items'} moved to ${shortPlace(s.locations[v.to])}`);
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Transfer stock" subtitle="Move items from one place to another"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Transfer</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><Select {...form.bind('from')} options={placeOptions(s)} /></Field>
          <Field label="To" error={form.error('to')}><Select {...form.bind('to')} options={placeOptions(s)} /></Field>
        </div>
        {rows.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {rows.map((r) => {
              const it = s.items[r.itemId];
              const have = balanceOf(s, r.itemId, values.from);
              return (
                <li key={r.itemId} className="grid grid-cols-[minmax(0,1fr)_84px_32px] items-center gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-900">{it.name}</p>
                    <p className={cn('text-xs tabular-nums', Number(r.qty) > have ? 'text-red-700' : 'text-slate-500')}>{have} in {shortPlace(s.locations[values.from])}</p>
                  </div>
                  <TextInput aria-label={`Quantity of ${it.name}`} inputMode="decimal" value={r.qty} onChange={(v) => setRows((x) => x.map((y) => (y.itemId === r.itemId ? { ...y, qty: v } : y)))} className="!h-9 text-right" />
                  <IconButton icon={Trash2Icon} label={`Remove ${it.name}`} size="xs" onClick={() => setRows((x) => x.filter((y) => y.itemId !== r.itemId))} />
                </li>
              );
            })}
          </ul>
        )}
        <Combobox options={options} noun="items" placeholder="Add an item…" searchPlaceholder="Search stock items" value="" onChange={(id) => setRows((x) => [...x, { itemId: id, qty: '1' }])} />
        {form.error('rows') && <p role="alert" className="text-xs text-red-700">{form.error('rows')}</p>}
        <Field label="Note" hint="Optional. Why, and who asked."><TextInput {...form.bind('note')} autoComplete="off" /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

// ---- count one place ---------------------------------------------------------------------------------------------
export function CountDrawer({ open, onClose, locationId }) {
  if (!open) return null;
  return <CountBody onClose={onClose} locationId={locationId} />;
}

function CountBody({ onClose, locationId }) {
  const s = useStore();
  const places = locationList(s);
  const [place, setPlace] = useState(locationId || places[0].id);
  const items = useMemo(
    () => list(s.items).filter((i) => i.stocked && (place === places[0].id || i.vanPar > 0 || balanceOf(s, i.id, place) !== 0)).toSorted((a, b) => a.code.localeCompare(b.code)),
    [s, place, places],
  );
  const [counted, setCounted] = useState({});
  const book = (id) => balanceOf(s, id, place);
  const value = (id) => (counted[id] ?? String(book(id)));
  const changed = items.filter((i) => round3(Number(value(i.id)) - book(i.id)) !== 0 && value(i.id) !== '');
  const form = useForm({ reason: COUNT_REASONS[0] });
  const save = form.submit((v) => {
    const n = countStock({ locationId: place, counts: changed.map((i) => ({ itemId: i.id, counted: Number(value(i.id)) })), reason: v.reason });
    toast(n === 0 ? 'The count matches the books: nothing to change' : `Count saved: ${n} ${n === 1 ? 'difference' : 'differences'} corrected`);
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Count stock" subtitle="Write what you really counted; the differences are corrected"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{changed.length === 0 ? 'Nothing differs' : `Save ${changed.length} ${changed.length === 1 ? 'difference' : 'differences'}`}</Button></>}
      width="md:w-[560px]">
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Place"><Select value={place} onChange={(v) => { setPlace(v); setCounted({}); }} options={placeOptions(s)} /></Field>
          <Field label="Reason for the differences"><Select {...form.bind('reason')} options={COUNT_REASONS} /></Field>
        </div>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {items.map((i) => {
            const diff = round3(Number(value(i.id)) - book(i.id));
            return (
              <li key={i.id} className="grid grid-cols-[minmax(0,1fr)_72px_84px] items-center gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-900">{i.name}</p>
                  <p className="text-xs text-slate-500">{i.code}</p>
                </div>
                <p className="text-right text-xs tabular-nums text-slate-500">books {book(i.id)}</p>
                <div>
                  <TextInput aria-label={`Counted ${i.name}`} inputMode="decimal" value={value(i.id)} onChange={(v) => setCounted((c) => ({ ...c, [i.id]: v }))} className={cn('!h-9 text-right', diff !== 0 && value(i.id) !== '' && '!border-orange-500')} />
                  {diff !== 0 && value(i.id) !== '' && <p className={cn('mt-0.5 text-right text-[11px] tabular-nums', diff < 0 ? 'text-red-700' : 'text-green-700')}>{diff > 0 ? '+' : '−'}{Math.abs(diff)}</p>}
                </div>
              </li>
            );
          })}
        </ul>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}
