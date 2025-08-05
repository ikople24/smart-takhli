import React from 'react';

const EmptyState = ({ 
  icon = "📋", 
  title = "ไม่พบข้อมูล", 
  description = "ยังไม่มีข้อมูลที่ต้องการแสดง",
  action = null 
}) => {
  return (
    <div className="text-center py-12">
      <div className="text-gray-400 text-6xl mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-600 mb-2">
        {title}
      </h3>
      <p className="text-gray-500 mb-4">
        {description}
      </p>
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState; 