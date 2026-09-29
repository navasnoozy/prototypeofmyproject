import { cn } from '@/lib/cn.js';
import { initials } from '@/lib/format.js';

// A small label with a soft colour. It has a 4 px corner on purpose: a status
// must never look like a button (record 36). Colour is never the only signal:
// the text always says the state.
const tones = {
  neutral: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  orange: 'bg-orange-100 text-orange-800',
  red: 'bg-red-100 text-red-800',
  violet: 'bg-violet-100 text-violet-800',
  dark: 'bg-slate-900 text-white',
};
const dots = {
  neutral: 'bg-slate-400', blue: 'bg-blue-500', green: 'bg-green-500',
  orange: 'bg-orange-500', red: 'bg-red-500', violet: 'bg-violet-500', dark: 'bg-white',
};

export const Badge = ({ tone = 'neutral', dot = false, className, children }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium',
      tones[tone],
      className,
    )}
  >
    {dot && <span className={cn('size-1.5 rounded-full', dots[tone])} aria-hidden="true" />}
    {children}
  </span>
);

// The states of each kind of record, in one place, so a state looks the same
// on every screen. Later steps add their own kinds here.
export const STATUS = {
  customer: {
    active: ['green', 'Active'],
    on_hold: ['red', 'On hold'],
    inactive: ['neutral', 'Inactive'],
  },
  site: {
    active: ['green', 'Active'],
    inactive: ['neutral', 'Inactive'],
  },
  due: {
    ok: ['green', 'On schedule'],
    soon: ['orange', 'Due soon'],
    overdue: ['red', 'Overdue'],
    out: ['neutral', 'Out of service'],
    none: ['neutral', 'No equipment'],
  },
  system: {
    in_service: ['green', 'In service'],
    impaired: ['red', 'Out of service (impaired)'],
  },
};

export function Status({ kind, value, dot = true, className }) {
  const [tone, label] = STATUS[kind]?.[value] ?? ['neutral', value];
  return <Badge tone={tone} dot={dot} className={className}>{label}</Badge>;
}

// Initials in a soft circle (people) or square (companies, sites). The colour
// comes from the name, so the same name always looks the same.
const avatarTones = [
  'bg-slate-200 text-slate-700', 'bg-blue-100 text-blue-800', 'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800', 'bg-violet-100 text-violet-800', 'bg-rose-100 text-rose-800',
  'bg-cyan-100 text-cyan-800',
];
const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const avatarSizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-12 text-base' };

export const Avatar = ({ name, shape = 'circle', size = 'sm', className }) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-grid shrink-0 place-items-center font-semibold',
      shape === 'circle' ? 'rounded-full' : 'rounded-lg',
      avatarSizes[size],
      avatarTones[hash(name) % avatarTones.length],
      className,
    )}
  >
    {initials(name)}
  </span>
);

// A keyboard key. Two keys are two elements with a gap, never one glued text.
export const Kbd = ({ children, className }) => (
  <kbd
    className={cn(
      'inline-grid h-5 min-w-5 place-items-center rounded-sm border border-slate-300 bg-white px-1 font-sans text-[11px] font-medium leading-none text-slate-600 shadow-[0_1px_0_rgb(15_23_42/8%)]',
      className,
    )}
  >
    {children}
  </kbd>
);

// Cmd on a Mac, Ctrl elsewhere.
export const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = () => (isMac() ? '⌘' : 'Ctrl');
