import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const shadowMap = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
};

const paddingMap = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({
    children,
    className = '',
    shadow = 'md',
    padding = 'md',
    interactive = false,
  }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-lg bg-base-100 border border-base-200
          ${shadowMap[shadow]}
          ${paddingMap[padding]}
          ${interactive ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200' : ''}
          ${className}
        `}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card Header component
interface CardHeaderProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export const CardHeader = ({ title, subtitle, action, className = '' }: CardHeaderProps) => (
  <div className={`flex items-center justify-between gap-4 pb-4 border-b border-base-200 ${className}`}>
    <div className="flex-1">
      {title && <h3 className="font-semibold text-lg">{title}</h3>}
      {subtitle && <p className="text-sm text-base-content/60 mt-1">{subtitle}</p>}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
);

// Card Body component
interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export const CardBody = ({ children, className = '' }: CardBodyProps) => (
  <div className={`py-4 ${className}`}>
    {children}
  </div>
);

// Card Footer component
interface CardFooterProps {
  children: ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export const CardFooter = ({ children, className = '', align = 'end' }: CardFooterProps) => {
  const alignMap = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
  };

  return (
    <div className={`flex gap-3 pt-4 border-t border-base-200 ${alignMap[align]} ${className}`}>
      {children}
    </div>
  );
};
