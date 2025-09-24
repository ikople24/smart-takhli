import { useState, useEffect } from 'react';

export default function ComplaintStats({ complaints, assignments }) {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  });

  useEffect(() => {
    if (!complaints || !assignments) return;

    const total = complaints.length;
    const pending = complaints.filter(c => c.status === "รอการมอบหมาย").length;
    const inProgress = complaints.filter(c => c.status === "อยู่ระหว่างดำเนินการ").length;
    const completed = complaints.filter(c => c.status === "ดำเนินการเสร็จสิ้น").length;

    setStats({
      total,
      pending,
      inProgress,
      completed
    });
  }, [complaints, assignments]);

  const getIcon = (type) => {
    switch (type) {
      case 'total': return '📋';
      case 'pending': return '⏳';
      case 'inProgress': return '🔄';
      case 'completed': return '✅';
      default: return '📊';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Complaints */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">เรื่องร้องเรียนทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="text-3xl">{getIcon('total')}</div>
        </div>
      </div>

      {/* Pending */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">รอการมอบหมาย</p>
            <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
          </div>
          <div className="text-3xl">{getIcon('pending')}</div>
        </div>
      </div>

      {/* In Progress */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">กำลังดำเนินการ</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
          </div>
          <div className="text-3xl">{getIcon('inProgress')}</div>
        </div>
      </div>

      {/* Completed */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">เสร็จสิ้น</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="text-3xl">{getIcon('completed')}</div>
        </div>
      </div>


    </div>
  );
}
