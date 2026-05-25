import React, { InputHTMLAttributes } from 'react';

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'checkbox-sm',
  md: 'checkbox-md',
  lg: 'checkbox-lg',
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({
    label,
    helper,
    size = 'md',
    className = '',
    disabled = false,
    ...props
  }, ref) => {
    return (
      <div>
        <div className="flex items-center gap-3">
          <input
            ref={ref}
            type="checkbox"
            disabled={disabled}
            className={`
              checkbox
              ${sizeMap[size]}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${className}
            `}
            {...props}
          />
          {label && (
            <label className="label cursor-pointer">
              <span className="label-text font-medium">{label}</span>
            </label>
          )}
        </div>
        {helper && (
          <p className="text-sm text-base-content/60 mt-2 ml-10">
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
