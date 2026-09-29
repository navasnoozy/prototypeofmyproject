import { Link } from 'react-router';
import { cn } from '@/lib/cn.js';

// The one button of the prototype: a capsule (records 36 and 37). "primary" is
// the calm dark colour and is used once per view, for the next step of the
// work; "secondary" is an outline; "ghost" is for toolbars and quiet actions.

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none ' +
  'transition-colors duration-150 ease-standard disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45';

const sizes = {
  md: 'h-11 px-5 text-base md:h-10 md:text-sm',
  sm: 'h-9 px-4 text-sm',
  xs: 'h-8 px-3 text-xs',
};

const variants = {
  primary: 'bg-action text-white hover:bg-action-hover active:bg-slate-700',
  secondary: 'border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-700 hover:bg-slate-100 active:bg-slate-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  'danger-ghost': 'text-red-700 hover:bg-red-50 active:bg-red-100',
};

const iconSizes = { md: 'size-[18px]', sm: 'size-4', xs: 'size-4' };

export function Button({
  variant = 'secondary', size = 'md', icon: Icon, iconEnd: IconEnd, to, href, className, children, type = 'button', ...rest
}) {
  const classes = cn(base, sizes[size], variants[variant], className);
  const content = (
    <>
      {Icon && <Icon className={iconSizes[size]} aria-hidden="true" />}
      {children}
      {IconEnd && <IconEnd className={iconSizes[size]} aria-hidden="true" />}
    </>
  );
  if (to) return <Link to={to} className={classes} {...rest}>{content}</Link>;
  if (href) return <a href={href} className={classes} {...rest}>{content}</a>;
  return <button type={type} className={classes} {...rest}>{content}</button>;
}

const iconButtonSizes = { md: 'size-11 md:size-10', sm: 'size-9', xs: 'size-8' };

// A round icon-only button. The label is required (it is also the tooltip).
export const IconButton = ({
  icon: Icon, label, variant = 'ghost', size = 'sm', className, badge, ...rest
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cn(
      'relative inline-grid shrink-0 place-items-center rounded-full transition-colors duration-150 ease-standard disabled:opacity-45',
      iconButtonSizes[size],
      variants[variant],
      className,
    )}
    {...rest}
  >
    <Icon className="size-[18px]" aria-hidden="true" />
    {badge}
  </button>
);
