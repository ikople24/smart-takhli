import React, { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
  fullWidth?: boolean;
  rows?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    label,
    error,
    helper,
    fullWidth = true,
    rows = 3,
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
        <textarea
          ref={ref}
          rows={rows}
          disabled={disabled}
          className={`
            textarea textarea-bordered w-full transition-all duration-200
            ${error ? 'textarea-error' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${className}
          `}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
