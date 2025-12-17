import { useState, useEffect } from 'react';

export default function OverdueComplaintsAlert({ complaints, assignments, onComplaintClick }) {
  const [overdueComplaints, setOverdueComplaints] = useState([]);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (!complaints || !assignments) return;

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const overdue = complaints
      .filter(complaint => {
        const assignment = assignments.find(a => a.complaintId === complaint._id);
        const lastUpdate = new Date(complaint.updatedAt);
        
        // Check if complaint is in progress and hasn't been updated recently
        if (complaint.status === "อยู่ระหว่างดำเนินการ" && assignment) {
          return lastUpdate < threeDaysAgo;
        }
        
        // Check if complaint is pending for too long
        if (complaint.status === "รอการมอบหมาย") {
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
    setShowAlert(overdue.length > 0);
  }, [complaints, assignments]);

  if (!showAlert || overdueComplaints.length === 0) {
    return null;
  }

  const getSeverityColor = (days) => {
    if (days >= 7) return 'border-red-500 bg-red-50';
    if (days >= 5) return 'border-orange-500 bg-orange-50';
    return 'border-yellow-500 bg-yellow-50';
  };

  const getSeverityText = (days) => {
    if (days >= 7) return '🚨 วิกฤต';
    if (days >= 5) return '⚠️ ควรเร่งดำเนินการ';
    return '📋 ต้องติดตาม';
  };

  return (
    <div className="mb-6">
      <div className={`border-l-4 p-4 rounded-r-lg ${getSeverityColor(overdueComplaints[0]?.daysSinceUpdate || 0)}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            {getSeverityText(overdueComplaints[0]?.daysSinceUpdate || 0)} - เรื่องที่ต้องติดตาม
          </h3>
          <span className="badge badge-warning">{overdueComplaints.length} เรื่อง</span>
        </div>
        
        <p className="text-sm text-gray-600 mb-3">
          มีเรื่องร้องเรียนที่ยังไม่ได้รับการอัปเดตหรือดำเนินการมานานแล้ว
          <br />
          <span className="text-xs text-blue-600">💡 คลิกที่เรื่องเพื่อดูรายละเอียด</span>
        </p>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {overdueComplaints.slice(0, 5).map((complaint) => (
            <div 
              key={complaint._id} 
              className="flex items-center justify-between p-2 bg-white rounded border hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all duration-200"
              onClick={() => onComplaintClick && onComplaintClick(complaint)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    {complaint.isAssigned ? 'มอบหมายแล้ว' : 'ยังไม่มอบหมาย'}
                  </span>
                  <span className={`badge badge-xs ${
                    complaint.daysSinceUpdate >= 7 ? 'badge-error' : 
                    complaint.daysSinceUpdate >= 5 ? 'badge-warning' : 'badge-info'
                  }`}>
                    {complaint.daysSinceUpdate} วัน
                  </span>
                </div>
                <p className="text-sm font-medium truncate" title={complaint.detail}>
                  {complaint.detail}
                </p>
                <p className="text-xs text-gray-500">
                  {complaint.category} • อัปเดตล่าสุด: {new Date(complaint.updatedAt).toLocaleDateString('th-TH')}
                </p>
              </div>
              <div className="text-blue-500 text-xs ml-2 font-medium">
                คลิกดูรายละเอียด →
              </div>
            </div>
          ))}
        </div>

        {overdueComplaints.length > 5 && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            และอีก {overdueComplaints.length - 5} เรื่อง...
          </p>
        )}
      </div>
    </div>
  );
}
