import React from 'react';

const PageHeader = ({ 
  title, 
  subtitle, 
  icon = null,
  children = null 
}) => {
  return (
    <div className="text-center mb-6">
      {icon && (
        <div className="text-4xl mb-3">{icon}</div>
      )}
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        {title}
      </h1>
      {subtitle && (
        <p className="text-gray-600">
          {subtitle}
        </p>
      )}
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default PageHeader; 