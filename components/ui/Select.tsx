import React, { SelectHTMLAttributes } from 'react';

interface Option {
  value: string | number;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  error?: string;
  helper?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const sizeMap = {
  sm: 'select-sm',
  md: 'select-md',
  lg: 'select-lg',
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({
    label,
    options,
    error,
    helper,
    size = 'md',
    fullWidth = true,
    className = '',
    disabled = false,
    ...props
  }, ref) => {
    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label className="label">
            <span className="label-text font-medium">{label}</span>
          </label>
        )}
        <select
          ref={ref}
          disabled={disabled}
          className={`
            select select-bordered w-full transition-all duration-200
            ${sizeMap[size]}
            ${error ? 'select-error' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${className}
          `}
          {...props}
        >
          <option value="">-- เลือก --</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <label className="label">
            <span className="label-text-alt text-error">{error}</span>
          </label>
        )}
        {helper && !error && (
          <label className="label">
            <span className="label-text-alt text-base-content/60">{helper}</span>
          </label>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
