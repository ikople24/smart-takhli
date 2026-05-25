import React, { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helper?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  fullWidth?: boolean;
}

const sizeMap = {
  sm: 'input-sm',
  md: 'input-md',
  lg: 'input-lg',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    error,
    helper,
    size = 'md',
    icon,
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
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={`
              input input-bordered w-full transition-all duration-200
              ${sizeMap[size]}
              ${error ? 'input-error' : ''}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${icon ? 'pl-10' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
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

Input.displayName = 'Input';
