import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SmartphoneIcon, XIcon } from 'lucide-react';
import { ROLES } from '@/data/roles.js';
import { useStore } from '@/store/store.js';
import { IconButton } from '@/ui/Button.jsx';

// The phone next to the office: the same application inside a phone-sized
// frame, opened as a person of the company (a technician at first). The frame
// and this window share the data and follow each other at once, so the
// coordinator can plan a job here and watch it arrive on the phone.
// (A prototype control, marked amber like "View as".)
const W = 390;
const H = 844;
const BEZEL = 12;

// The phone is as large as the window's height allows (below the top bar), and
// the office layout leaves room for it on the right instead of hiding behind it.
export function usePhoneScale(active) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!active) return undefined;
    const fit = () => setScale(Math.max(0.5, Math.min(1, (window.innerHeight - 160) / H)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [active]);
  return scale;
}
export const phoneReserve = (scale) => Math.round(W * scale) + BEZEL * 2 + 12;

export function PhoneFrame({ scale, onClose }) {
  const state = useStore();
  const [person, setPerson] = useState(() => Object.values(state.staff).find((p) => ROLES[p.roleKey].phoneFirst)?.id ?? 'staff_rashid');

  const w = Math.round(W * scale);
  const h = Math.round(H * scale);
  return createPortal(
    <aside aria-label="Phone view" className="no-print fixed bottom-3 right-3 z-40 flex flex-col gap-2 max-md:hidden" style={{ width: w + BEZEL * 2 }}>
      <div className="flex h-10 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 pl-3 pr-1 text-sm text-amber-950 shadow-float">
        <SmartphoneIcon className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
        <label htmlFor="phone-person" className="sr-only">Phone view of</label>
        <select
          id="phone-person"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className="min-w-0 flex-1 truncate bg-transparent font-medium outline-none"
        >
          {Object.values(state.staff).map((p) => (
            <option key={p.id} value={p.id}>{p.name} · {ROLES[p.roleKey].label}</option>
          ))}
        </select>
        <IconButton icon={XIcon} label="Close phone view" size="xs" onClick={onClose} />
      </div>
      <div className="rounded-[44px] bg-slate-900 p-3 shadow-pop" style={{ width: w + BEZEL * 2, height: h + BEZEL * 2 }}>
        <div className="overflow-hidden rounded-[34px] bg-white" style={{ width: w, height: h }}>
          <iframe
            key={person}
            title="Phone view"
            src={`/?frame=1&as=${person}`}
            style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0 }}
          />
        </div>
      </div>
    </aside>,
    document.body,
  );
}
