import { useState, useEffect } from 'react';

export default function OverdueComplaintsAlertNew({ complaints, assignments, onComplaintClick }) {
  const [overdueComplaints, setOverdueComplaints] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!complaints || !assignments) return;

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const overdue = complaints
      .filter(complaint => {
        const assignment = assignments.find(a => a.complaintId === complaint._id);
        const lastUpdate = new Date(complaint.updatedAt);
        
        if (complaint.status === "อยู่ระหว่างดำเนินการ" && assignment) {
          return lastUpdate < threeDaysAgo;
        }
        
        if (complaint.status === "รอการมอบหมาย" || !assignment) {
          return lastUpdate < oneWeekAgo;
        }
        
        return false;
      })
      .map(complaint => {
        const assignment = assignments.find(a => a.complaintId === complaint._id);
        const lastUpdate = new Date(complaint.updatedAt);
        const daysSinceUpdate = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
        
        return {
          ...complaint,
          daysSinceUpdate,
          isAssigned: !!assignment
        };
      })
      .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

    setOverdueComplaints(overdue);
  }, [complaints, assignments]);

  if (overdueComplaints.length === 0) {
    return null;
  }

  const getSeverityLevel = (days) => {
    if (days >= 7) return { level: 'critical', color: 'red', label: 'วิกฤต' };
    if (days >= 5) return { level: 'warning', color: 'orange', label: 'เร่งด่วน' };
    return { level: 'info', color: 'amber', label: 'ติดตาม' };
  };

  const criticalCount = overdueComplaints.filter(c => c.daysSinceUpdate >= 7).length;
  const warningCount = overdueComplaints.filter(c => c.daysSinceUpdate >= 5 && c.daysSinceUpdate < 7).length;
  const infoCount = overdueComplaints.filter(c => c.daysSinceUpdate < 5).length;

  const displayedComplaints = isExpanded ? overdueComplaints : overdueComplaints.slice(0, 3);

  return (
    <div className="bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 border border-red-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            {overdueComplaints.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                {overdueComplaints.length}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">เรื่องที่ต้องติดตาม</h3>
            <p className="text-xs text-gray-500">ยังไม่ได้รับการอัปเดตหรือดำเนินการ</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Severity badges */}
          <div className="hidden sm:flex items-center gap-1.5">
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                วิกฤต {criticalCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                เร่งด่วน {warningCount}
              </span>
            )}
            {infoCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                ติดตาม {infoCount}
              </span>
            )}
          </div>
          
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className={`transition-all duration-300 ease-out ${isExpanded ? 'max-h-[400px]' : 'max-h-48'}`}>
        <div className="px-4 pb-3 space-y-2 max-h-[350px] overflow-y-auto scrollbar-thin">
          {displayedComplaints.map((complaint) => {
            const severity = getSeverityLevel(complaint.daysSinceUpdate);
            
            return (
              <div
                key={complaint._id}
                onClick={(e) => {
                  e.stopPropagation();
                  onComplaintClick?.(complaint);
                }}
                className="group flex items-center gap-3 p-2.5 bg-white rounded-lg border border-gray-100 
                  hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-all duration-200"
              >
                {/* Severity indicator */}
                <div className={`w-1.5 h-10 rounded-full ${
                  severity.level === 'critical' ? 'bg-red-500' :
                  severity.level === 'warning' ? 'bg-orange-500' : 'bg-amber-400'
                }`} />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      severity.level === 'critical' ? 'bg-red-100 text-red-700' :
                      severity.level === 'warning' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {complaint.daysSinceUpdate} วัน
                    </span>
                    <span className={`text-xs ${complaint.isAssigned ? 'text-blue-600' : 'text-gray-400'}`}>
                      {complaint.isAssigned ? '• มอบหมายแล้ว' : '• ยังไม่มอบหมาย'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                    {complaint.detail}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {complaint.category} • {new Date(complaint.updatedAt).toLocaleDateString('th-TH')}
                  </p>
                </div>
                
                <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            );
          })}
        </div>
        
        {overdueComplaints.length > 3 && !isExpanded && (
          <div className="px-4 pb-3">
            <p className="text-xs text-center text-gray-500">
              และอีก {overdueComplaints.length - 3} เรื่อง...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

