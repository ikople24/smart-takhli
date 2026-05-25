import React, { ReactNode } from 'react';
import { CheckCircleIcon, ExclamationIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface AlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message?: string | ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
  closeable?: boolean;
  className?: string;
}

const variantConfig = {
  success: {
    bgClass: 'alert-success',
    icon: CheckCircleIcon,
  },
  error: {
    bgClass: 'alert-error',
    icon: XCircleIcon,
  },
  warning: {
    bgClass: 'alert-warning',
    icon: ExclamationIcon,
  },
  info: {
    bgClass: 'alert-info',
    icon: InformationCircleIcon,
  },
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({
    variant = 'info',
    title,
    message,
    icon,
    onClose,
    closeable = false,
    className = '',
  }, ref) => {
    const config = variantConfig[variant];
    const DefaultIcon = config.icon;

    return (
      <div
        ref={ref}
        className={`alert ${config.bgClass} gap-3 ${className}`}
      >
        <div className="flex-shrink-0">
          {icon ? (
            icon
          ) : (
            <DefaultIcon className="w-6 h-6" />
          )}
        </div>
        <div className="flex-1">
          {title && <h3 className="font-semibold">{title}</h3>}
          {message && (
            <p className={title ? 'text-sm mt-1' : ''}>
              {message}
            </p>
          )}
        </div>
        {closeable && (
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
          >
            ✕
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';
