import React, { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

const variantMap = {
  primary: 'badge-primary',
  secondary: 'badge-secondary',
  accent: 'badge-accent',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  info: 'badge-info',
  neutral: 'badge-neutral',
};

const sizeMap = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
  lg: 'text-base px-4 py-2',
};

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({
    variant = 'primary',
    size = 'md',
    children,
    className = '',
  }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          badge gap-2 font-medium
          ${variantMap[variant]}
          ${sizeMap[size]}
          ${className}
        `}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

// Status Badge - common use case
interface StatusBadgeProps {
  status: 'pending' | 'completed' | 'in_progress' | 'error' | 'cancelled';
  className?: string;
}

const statusMap = {
  pending: { variant: 'warning' as const, label: 'รอดำเนิน' },
  completed: { variant: 'success' as const, label: 'เสร็จสิ้น' },
  in_progress: { variant: 'info' as const, label: 'กำลังดำเนิน' },
  error: { variant: 'error' as const, label: 'ผิดพลาด' },
  cancelled: { variant: 'neutral' as const, label: 'ยกเลิก' },
};

export const StatusBadge = ({ status, className = '' }: StatusBadgeProps) => {
  const { variant, label } = statusMap[status];
  return (
    <Badge variant={variant} size="sm" className={className}>
      {label}
    </Badge>
  );
};
