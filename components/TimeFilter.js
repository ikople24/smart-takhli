import React from 'react';
import { Zap } from 'lucide-react';

const TimeFilter = ({ 
  selectedFilter, 
  onFilterChange,
  className = "" 
}) => {
  const timeFilters = [
    { id: 'all', label: 'ทั้งหมด', value: null },
    { id: '24h', label: 'ภายใน 24 ชม.', value: 24, icon: Zap },
    { id: '2d', label: '1-2 วัน', value: 48, icon: Zap },
    { id: '3d', label: '2-3 วัน', value: 72, icon: Zap },
    { id: '7d', label: '3-7 วัน', value: 168, icon: Zap },
    { id: '15d', label: '7-15 วัน', value: 360, icon: Zap },
    { id: 'over15d', label: 'เกิน 15 วัน', value: 361, icon: Zap },
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {timeFilters.map((filter) => {
        const Icon = filter.icon;
        const isSelected = selectedFilter === filter.id;
        
        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              isSelected
                ? 'bg-green-50 text-green-700 border border-green-300 shadow-sm'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            {Icon && <Icon size={16} className={isSelected ? 'text-green-600' : 'text-gray-500'} />}
            <span>{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TimeFilter; 