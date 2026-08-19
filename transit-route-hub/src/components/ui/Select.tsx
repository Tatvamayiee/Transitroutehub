import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, id, children, ...rest },
  ref,
) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-navy mb-1.5">
          {label}
        </label>
      )}
      <select
        id={id}
        ref={ref}
        aria-label={label || id || 'Select option'}
        title={label || id || 'Select option'}
        className={cn(
          'w-full px-3.5 py-2.5 rounded-sm border border-border bg-white text-navy focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal transition',
          error && 'border-danger focus:ring-danger/30 focus:border-danger',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p className="mt-1.5 text-xs text-danger" role="alert">{error}</p>
      )}
    </div>
  );
});
