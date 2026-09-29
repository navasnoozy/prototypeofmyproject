import { useContext, useId, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { FieldContext } from './FieldContext.js';

// Form controls. Every control takes `value` and `onChange(value)` (the value,
// not the browser event), so text boxes, dropdowns and segmented controls
// are used the same way. A control inside <Field> is linked to its label.

export function Field({ label, hint, error, required, span, className, children }) {
  const id = useId();
  return (
    <FieldContext.Provider value={{ id, invalid: Boolean(error) }}>
      <div className={cn('flex min-w-0 flex-col gap-1.5', span === 2 && 'md:col-span-2', className)}>
        <label htmlFor={id} className="text-xs font-medium text-slate-700">
          {label}
          {required && <span className="text-slate-400" aria-hidden="true"> *</span>}
        </label>
        {children}
        {error ? (
          <p role="alert" className="text-xs text-red-700">{error}</p>
        ) : hint ? (
          <p className="text-xs text-slate-500">{hint}</p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

// The box shared by text, number, date, select and the dropdown trigger:
// 12 px corner, the accessible grey border of record 36, blue when focused.
export const controlClass = (invalid) =>
  cn(
    'w-full rounded-xl border bg-white text-base text-slate-900 transition-colors duration-150 ease-standard md:text-sm',
    'placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500',
    invalid ? 'border-red-600' : 'border-control hover:border-slate-500 focus:border-blue-600',
  );

export function TextInput({ value, onChange, onBlur, prefix, suffix, className, type = 'text', ...rest }) {
  const { id, invalid } = useContext(FieldContext);
  const input = (
    <input
      id={id}
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      aria-invalid={invalid || undefined}
      className={cn(
        controlClass(invalid), 'h-11 px-3 md:h-10',
        prefix && 'pl-12', suffix && 'pr-12', className,
      )}
      {...rest}
    />
  );
  if (!prefix && !suffix) return input;
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-slate-500">{prefix}</span>}
      {input}
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-slate-500">{suffix}</span>}
    </div>
  );
}

export function TextArea({ value, onChange, onBlur, rows = 3, className, ...rest }) {
  const { id, invalid } = useContext(FieldContext);
  return (
    <textarea
      id={id}
      rows={rows}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      aria-invalid={invalid || undefined}
      className={cn(controlClass(invalid), 'resize-y px-3 py-2.5', className)}
      {...rest}
    />
  );
}

// A native select (the phone's own picker is best for short fixed lists).
// For long or searchable lists use <Combobox>.
export function Select({ value, onChange, onBlur, options, placeholder, className, ...rest }) {
  const { id, invalid } = useContext(FieldContext);
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div className="relative">
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid || undefined}
        className={cn(controlClass(invalid), 'h-11 appearance-none pl-3 pr-9 md:h-10', !value && 'text-slate-400', className)}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {items.map((o) => (
          <option key={o.value} value={o.value} className="text-slate-900">{o.label}</option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
    </div>
  );
}

export const DateInput = (props) => <TextInput type="date" {...props} />;

export function Checkbox({ checked, onChange, label, hint }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded-sm border-control accent-slate-900"
      />
      <label htmlFor={id} className="text-sm text-slate-800">
        {label}
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </label>
    </div>
  );
}

// A few exclusive choices side by side: a pill with a raised selected part.
export function Segmented({ options, value, onChange, size = 'md', label, className }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex max-w-full rounded-full bg-slate-100 p-1', className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-all duration-150 ease-standard',
              size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-4 text-sm',
              selected ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/12%),0_0_0_1px_rgb(15_23_42/5%)]' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden="true" />}
            {o.label}
            {o.count !== undefined && <span className="text-xs text-slate-500">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// A titled group of fields with a hairline under the title.
export function Section({ title, description, children, cols = 2, className }) {
  return (
    <section className={cn('py-5 first:pt-0', className)}>
      <div className="border-b border-slate-200 pb-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <div className={cn('mt-4 grid grid-cols-1 gap-x-6 gap-y-4', cols === 2 && 'md:grid-cols-2')}>{children}</div>
    </section>
  );
}

// Form state with the rule of the product: an error shows only after the
// person leaves a field (or presses save), and goes away as soon as it is fixed.
export function useForm(initial, validate) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const errors = validate ? validate(values) : {};
  return {
    values,
    errors,
    set: (name, value) => setValues((v) => ({ ...v, [name]: value })),
    // Props for the control: <TextInput {...form.bind('name')} />
    bind: (name) => ({
      value: values[name],
      onChange: (v) => setValues((s) => ({ ...s, [name]: v })),
      onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
    }),
    // Message for the field: <Field error={form.error('name')}>
    error: (name) => (touched[name] || submitted ? errors[name] : undefined),
    submit: (fn) => (e) => {
      e?.preventDefault();
      setSubmitted(true);
      if (Object.keys(errors).length > 0) {
        // Bring the first problem into view.
        setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
        return;
      }
      fn(values);
    },
  };
}
