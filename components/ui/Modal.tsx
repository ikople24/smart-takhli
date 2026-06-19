import React, { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeable?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  ({
    open,
    title,
    children,
    footer,
    onClose,
    size = 'md',
    closeable = true,
    className = '',
  }, ref) => {
    if (!open) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            ref={ref}
            className={`
              bg-base-100 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto
              w-full ${sizeMap[size]}
              ${className}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between gap-4 p-6 border-b border-base-200">
                <h2 className="text-xl font-semibold">{title}</h2>
                {closeable && (
                  <button
                    onClick={onClose}
                    className="btn btn-ghost btn-sm btn-circle"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className={title ? 'p-6' : 'p-6'}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex gap-3 justify-end p-6 border-t border-base-200">
                {footer}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
);

Modal.displayName = 'Modal';
