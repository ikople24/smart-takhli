import { useState, useEffect, useRef } from 'react';

// Animated counter component
function AnimatedCounter({ value, duration = 1000 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef(null);
  const startValueRef = useRef(0);
  const animationRef = useRef(null);

  useEffect(() => {
    // Store current display value as start point
    startValueRef.current = displayValue;
    startTimeRef.current = Date.now();
    
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (easeOutCubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startValueRef.current + (value - startValueRef.current) * easeProgress);
      
      setDisplayValue(current);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span>{displayValue.toLocaleString('th-TH')}</span>;
}

// Progress bar component
function ProgressBar({ value, max, color }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  return (
    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all duration-1000 ease-out ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default function ComplaintStatsNew({ stats, isLoading, onStatClick }) {
  const statCards = [
    {
      key: 'total',
      label: 'เรื่องร้องเรียนทั้งหมด',
      value: stats?.total || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'bg-slate-50 border-slate-200',
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
      valueColor: 'text-slate-900',
      progressColor: 'bg-slate-400',
      filter: 'all'
    },
    {
      key: 'pending',
      label: 'รอการมอบหมาย',
      value: stats?.pending || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-amber-50 border-amber-200',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-600',
      progressColor: 'bg-amber-400',
      filter: 'รอการมอบหมาย'
    },
    {
      key: 'inProgress',
      label: 'กำลังดำเนินการ',
      value: stats?.inProgress || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      color: 'bg-blue-50 border-blue-200',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      valueColor: 'text-blue-600',
      progressColor: 'bg-blue-400',
      filter: 'อยู่ระหว่างดำเนินการ'
    },
    {
      key: 'completed',
      label: 'เสร็จสิ้น',
      value: stats?.completed || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-emerald-50 border-emerald-200',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-600',
      progressColor: 'bg-emerald-400',
      filter: 'ดำเนินการเสร็จสิ้น'
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-xl" />
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
                <div className="h-6 bg-gray-200 rounded w-12" />
              </div>
            </div>
            <div className="mt-3 h-1.5 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {statCards.map((card, index) => (
        <div
          key={card.key}
          onClick={() => onStatClick?.(card.filter)}
          className={`${card.color} border rounded-xl p-4 cursor-pointer 
            hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
            transition-all duration-300 ease-out
            animate-fade-in`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-center gap-3">
            <div className={`${card.iconBg} ${card.iconColor} p-3 rounded-xl`}>
              {card.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 truncate">{card.label}</p>
              <p className={`text-2xl font-bold ${card.valueColor}`}>
                <AnimatedCounter value={card.value} />
              </p>
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar 
              value={card.value} 
              max={stats?.total || 1} 
              color={card.progressColor}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

