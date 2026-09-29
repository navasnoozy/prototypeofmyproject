import { useEffect, useMemo, useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { SYSTEM_TYPES } from '@/data/catalog.js';
import { cn } from '@/lib/cn.js';
import { newId } from '@/lib/ids.js';
import { money, num } from '@/lib/format.js';
import { updateQuotation } from '@/store/salesActions.js';
import { lineAmount } from '@/store/salesSelectors.js';
import { list } from '@/store/selectors.js';
import { useStore } from '@/store/store.js';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Combobox } from '@/ui/Combobox.jsx';

// A number that can be typed freely ("12.", "1,200") and is kept as a number.
export function NumberCell({ value, onChange, className, label, suffix }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);
  const parse = (t) => Number(t.replace(/,/g, '').trim() || 0);
  return (
    <span className="relative inline-flex">
      <input
        inputMode="decimal"
        aria-label={label}
        value={text}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          const n = parse(text);
          onChange(Number.isNaN(n) ? value : Math.max(0, n));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = parse(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.max(0, n));
        }}
        className={cn(
          'h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-right tabular-nums text-slate-900',
          'hover:border-slate-400 focus:border-blue-600',
          suffix && 'pr-6',
          className,
        )}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-2 grid place-items-center text-xs text-slate-500">{suffix}</span>}
    </span>
  );
}

const inputClass =
  'h-9 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-slate-900 hover:border-slate-300 focus:border-blue-600 focus:bg-white';

// The sections and lines of a quotation. While the quotation is a draft the
// numbers can be edited in place; otherwise it is a read-only list.
//   project:  named sections and a bill of quantities
//   contract: one section per covered system (from the equipment register)
//   repair, supply: one plain list
export function LinesEditor({ q, editable, seeCost, onCoverage }) {
  const s = useStore();
  const catalogue = useMemo(() => list(s.items).filter((i) => i.active), [s.items]);
  const options = useMemo(
    () => catalogue.map((i) => ({ value: i.id, label: i.name, sub: `${i.code} · AED ${money(i.price)} per ${i.unit}` })),
    [catalogue],
  );
  const isProject = q.kind === 'project';
  const isContract = q.kind === 'contract';
  const showTitles = isProject || isContract;

  const set = (patch) => updateQuotation(q.id, patch);
  const changeLine = (id, changes) => set({ lines: q.lines.map((l) => (l.id === id ? { ...l, ...changes } : l)) });
  const removeLine = (id) => set({ lines: q.lines.filter((l) => l.id !== id) });
  const newLine = (sectionId, item) => ({
    id: newId('ln'), sectionId, itemId: item?.id ?? '', description: item?.name ?? '', unit: item?.unit ?? 'nos',
    qty: 1, cost: item?.cost ?? 0, price: item?.price ?? 0,
  });
  const addLine = (sectionId, itemId) => set({ lines: [...q.lines, newLine(sectionId, catalogue.find((i) => i.id === itemId))] });
  const addSection = () => set({ sections: [...q.sections, { id: newId('sec'), title: 'New section' }] });
  const renameSection = (id, title) => set({ sections: q.sections.map((x) => (x.id === id ? { ...x, title } : x)) });
  const removeSection = (id) => set({ sections: q.sections.filter((x) => x.id !== id), lines: q.lines.filter((l) => l.sectionId !== id) });

  // A contract's other items go to a section of their own.
  const addOtherLine = (itemId) => {
    let other = q.sections.find((x) => x.title === 'Other items' && !x.systemId);
    let sections = q.sections;
    if (!other) {
      other = { id: newId('sec'), title: 'Other items' };
      sections = [...sections, other];
    }
    set({ sections, lines: [...q.lines, newLine(other.id, catalogue.find((i) => i.id === itemId))] });
  };

  if (isContract && q.sections.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-slate-900">No system is covered yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Choose the systems of the site this contract covers. The price is worked out from the equipment register.
        </p>
        {editable && <Button variant="primary" className="mt-5" icon={PlusIcon} onClick={onCoverage}>Choose covered systems</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {q.sections.map((sec) => {
        const lines = q.lines.filter((l) => l.sectionId === sec.id);
        const subtotal = lines.reduce((sum, l) => sum + lineAmount(l), 0);
        const system = sec.systemId ? s.systems[sec.systemId] : null;
        const SysIcon = system ? SYSTEM_TYPES[system.type]?.icon : null;
        return (
          <section key={sec.id} className="rounded-2xl border border-slate-200">
            {showTitles && (
              <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5">
                {SysIcon && <span className="grid size-7 place-items-center rounded-lg bg-slate-100 text-slate-600"><SysIcon className="size-4" aria-hidden="true" /></span>}
                {editable && isProject ? (
                  <input
                    value={sec.title}
                    onChange={(e) => renameSection(sec.id, e.target.value)}
                    aria-label="Section title"
                    className="h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-semibold text-slate-900 hover:border-slate-300 focus:border-blue-600 focus:bg-white"
                  />
                ) : (
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{sec.title}</h3>
                )}
                <span className="text-sm tabular-nums text-slate-600">{money(subtotal)}</span>
                {editable && (isProject || sec.systemId || sec.title === 'Other items') && (
                  <IconButton icon={Trash2Icon} label={`Remove ${sec.title}`} size="xs" onClick={() => removeSection(sec.id)} />
                )}
              </header>
            )}

            {lines.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-500">No items here yet.</p>
            ) : (
              <>
                <table className="hidden w-full border-separate border-spacing-0 text-sm md:table">
                  <thead>
                    <tr className="text-xs text-slate-500">
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                      <th className="w-20 px-2 py-2 text-right font-medium">Quantity</th>
                      <th className="w-14 px-2 py-2 text-left font-medium">Unit</th>
                      <th className="w-28 px-2 py-2 text-right font-medium">Unit price</th>
                      <th className="w-28 px-2 py-2 text-right font-medium">Amount</th>
                      {seeCost && <th className="w-24 px-2 py-2 text-right font-medium">Cost</th>}
                      {seeCost && <th className="w-16 px-2 py-2 text-right font-medium">Margin</th>}
                      {editable && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const amount = lineAmount(l);
                      const cost = l.qty * (l.cost ?? 0);
                      const margin = amount > 0 ? ((amount - cost) / amount) * 100 : 0;
                      return (
                        <tr key={l.id} className="align-middle">
                          <td className="border-t border-slate-100 px-2 py-1.5">
                            {editable ? (
                              <input value={l.description} onChange={(e) => changeLine(l.id, { description: e.target.value })} aria-label="Description" className={inputClass} />
                            ) : (
                              <span className="block px-2 py-1.5 text-slate-900">{l.description}</span>
                            )}
                          </td>
                          <td className="border-t border-slate-100 px-2 py-1.5 text-right">
                            {editable ? <NumberCell value={l.qty} onChange={(n) => changeLine(l.id, { qty: n })} label="Quantity" /> : <span className="tabular-nums">{num(l.qty)}</span>}
                          </td>
                          <td className="border-t border-slate-100 px-2 py-1.5 text-slate-500">{l.unit}</td>
                          <td className="border-t border-slate-100 px-2 py-1.5 text-right">
                            {editable ? <NumberCell value={l.price} onChange={(n) => changeLine(l.id, { price: n })} label="Unit price" /> : <span className="tabular-nums">{money(l.price)}</span>}
                          </td>
                          <td className="border-t border-slate-100 px-2 py-1.5 text-right font-medium tabular-nums text-slate-900">{money(amount)}</td>
                          {seeCost && <td className="border-t border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-500">{money(cost)}</td>}
                          {seeCost && (
                            <td className={cn('border-t border-slate-100 px-2 py-1.5 text-right tabular-nums', margin < s.settings.approvals.marginFloor ? 'font-medium text-red-700' : 'text-slate-500')}>
                              {margin.toFixed(0)}%
                            </td>
                          )}
                          {editable && (
                            <td className="border-t border-slate-100 px-1 py-1.5">
                              <IconButton icon={Trash2Icon} label="Remove line" size="xs" onClick={() => removeLine(l.id)} />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <ul className="divide-y divide-slate-100 md:hidden">
                  {lines.map((l) => (
                    <li key={l.id} className="space-y-2 px-4 py-3">
                      {editable ? (
                        <input value={l.description} onChange={(e) => changeLine(l.id, { description: e.target.value })} aria-label="Description" className={cn(inputClass, '-mx-2 w-[calc(100%+1rem)]')} />
                      ) : (
                        <p className="text-sm font-medium text-slate-900">{l.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        {editable ? (
                          <>
                            <NumberCell value={l.qty} onChange={(n) => changeLine(l.id, { qty: n })} label="Quantity" className="w-20" />
                            <span className="text-slate-500">{l.unit} ×</span>
                            <NumberCell value={l.price} onChange={(n) => changeLine(l.id, { price: n })} label="Unit price" className="w-28" />
                          </>
                        ) : (
                          <span className="text-slate-500">{num(l.qty)} {l.unit} × {money(l.price)}</span>
                        )}
                        <span className="ml-auto font-semibold tabular-nums text-slate-900">{money(lineAmount(l))}</span>
                        {editable && <IconButton icon={Trash2Icon} label="Remove line" size="xs" onClick={() => removeLine(l.id)} />}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {editable && !isContract && (
              <div className="border-t border-slate-100 p-3">
                <Combobox
                  options={options}
                  noun="items"
                  value=""
                  onChange={(id) => addLine(sec.id, id)}
                  placeholder="Add an item from the catalogue…"
                  searchPlaceholder="Search code or name"
                  createLabel={() => 'Add a custom line'}
                  onCreate={() => addLine(sec.id, null)}
                />
              </div>
            )}
          </section>
        );
      })}

      {editable && isProject && (
        <Button icon={PlusIcon} onClick={addSection}>Add section</Button>
      )}
      {editable && isContract && (
        <div className="flex flex-wrap items-start gap-3">
          <Button icon={PlusIcon} onClick={onCoverage}>Cover more systems</Button>
          <div className="min-w-[260px] flex-1">
            <Combobox
              options={options}
              noun="items"
              value=""
              onChange={addOtherLine}
              placeholder="Add another item…"
              searchPlaceholder="Search code or name"
            />
          </div>
        </div>
      )}
    </div>
  );
}
