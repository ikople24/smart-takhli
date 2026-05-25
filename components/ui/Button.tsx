import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { BUTTON_SIZES, COLORS } from '@/lib/constants';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'error' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClasses = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  accent: 'btn-accent',
  ghost: 'btn-ghost',
  error: 'btn-error',
  success: 'btn-success',
};

const sizeMap = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    className = '',
    disabled = false,
    children,
    ...props
  }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          btn gap-2 font-medium transition-all duration-300
          ${variantClasses[variant]}
          ${sizeMap[size]}
          ${fullWidth ? 'w-full' : ''}
          ${(disabled || loading) ? 'opacity-60 cursor-not-allowed' : ''}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <span className="loading loading-spinner loading-sm" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
