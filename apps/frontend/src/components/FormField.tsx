import {
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import { AlertCircle, LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  trailing?: ReactNode;
}

export function FormField({
  id,
  label,
  icon: Icon,
  error,
  trailing,
  required,
  className,
  ...inputProps
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[13px] font-semibold text-ink-950 mb-1.5"
      >
        {label}
        {required && <span className="text-signal-600"> *</span>}
      </label>

      <div className="relative">
        <Icon
          className={clsx(
            'absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] pointer-events-none',
            error ? 'text-danger-600' : 'text-ink-500',
          )}
        />

        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={clsx(
            'w-full h-11 bg-white border rounded-lg pl-10 text-sm text-ink-950 placeholder:text-ink-500/60 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600',
            'disabled:bg-sand-200/50 disabled:text-ink-500',
            trailing ? 'pr-11' : error ? 'pr-10' : 'pr-3.5',
            error
              ? 'border-danger-600 bg-danger-100/30'
              : 'border-sand-300',
            className,
          )}
          {...inputProps}
        />

        {error && !trailing && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-danger-600" />
        )}

        {trailing && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
            {trailing}
          </div>
        )}
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
