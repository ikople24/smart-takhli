import { useState } from 'react';

export default function ExportComplaints({ complaints, assignments }) {
  const [exporting, setExporting] = useState(false);

  const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';

    const headers = [
      'ลำดับ',
      'สถานะ',
      'หมวดหมู่',
      'หัวข้อ',
      'ชื่อผู้แจ้ง',
      'เบอร์โทร',
      'วันที่สร้าง',
      'อัปเดตล่าสุด',
      'มอบหมายแล้ว',
      'วันที่มอบหมาย',
      'หมายเหตุ',
      'วิธีการแก้ไข',
      'วันที่เสร็จสิ้น'
    ];

    const csvData = data.map((complaint, index) => {
      const assignment = assignments?.find(a => a.complaintId === complaint._id);
      
      return [
        index + 1,
        complaint.status || '',
        complaint.category || '',
        complaint.detail || '',
        complaint.fullName || '',
        complaint.phone || '',
        complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString('th-TH') : '',
        complaint.updatedAt ? new Date(complaint.updatedAt).toLocaleDateString('th-TH') : '',
        assignment ? 'ใช่' : 'ไม่',
        assignment?.assignedAt ? new Date(assignment.assignedAt).toLocaleDateString('th-TH') : '',
        assignment?.note || '',
        assignment?.solution ? assignment.solution.join(', ') : '',
        assignment?.completedAt ? new Date(assignment.completedAt).toLocaleDateString('th-TH') : ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  };

  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob(['\ufeff' + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExporting(true);
    
    try {
      const csvContent = convertToCSV(complaints);
      
      if (!csvContent) {
        alert('ไม่มีข้อมูลให้ export');
        return;
      }

      downloadCSV(csvContent, `complaints_${new Date().toISOString().split('T')[0]}.csv`);
      alert('Export สำเร็จ!');
    } catch (error) {
      console.error('Export error:', error);
      alert('เกิดข้อผิดพลาดในการ export');
    } finally {
      setExporting(false);
    }
  };

  const handleExportFiltered = async (status) => {
    setExporting(true);
    
    try {
      const filteredComplaints = complaints.filter(c => c.status === status);
      const csvContent = convertToCSV(filteredComplaints);
      
      if (!csvContent) {
        alert('ไม่มีข้อมูลให้ export');
        return;
      }

      const statusText = {
        'รอการมอบหมาย': 'pending',
        'อยู่ระหว่างดำเนินการ': 'in_progress',
        'ดำเนินการเสร็จสิ้น': 'completed'
      }[status] || 'all';

      downloadCSV(csvContent, `complaints_${statusText}_${new Date().toISOString().split('T')[0]}.csv`);
      alert(`Export ${status} สำเร็จ!`);
    } catch (error) {
      console.error('Export error:', error);
      alert('เกิดข้อผิดพลาดในการ export');
    } finally {
      setExporting(false);
    }
  };

  const countByStatus = (status) => complaints.filter(c => c.status === status).length;

  const exportOptions = [
    {
      id: 'all',
      label: 'Export ทั้งหมด',
      icon: '📊',
      count: complaints.length,
      onClick: handleExport,
      disabled: complaints.length === 0,
    },
    {
      id: 'pending',
      label: 'Export รอการมอบหมาย',
      icon: '⏳',
      count: countByStatus('รอการมอบหมาย'),
      onClick: () => handleExportFiltered('รอการมอบหมาย'),
      disabled: countByStatus('รอการมอบหมาย') === 0,
    },
    {
      id: 'in_progress',
      label: 'Export กำลังดำเนินการ',
      icon: '🔄',
      count: countByStatus('อยู่ระหว่างดำเนินการ'),
      onClick: () => handleExportFiltered('อยู่ระหว่างดำเนินการ'),
      disabled: countByStatus('อยู่ระหว่างดำเนินการ') === 0,
    },
    {
      id: 'completed',
      label: 'Export เสร็จสิ้น',
      icon: '✅',
      count: countByStatus('ดำเนินการเสร็จสิ้น'),
      onClick: () => handleExportFiltered('ดำเนินการเสร็จสิ้น'),
      disabled: countByStatus('ดำเนินการเสร็จสิ้น') === 0,
    },
  ];

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm btn-ghost gap-2"
        disabled={exporting}
      >
        {exporting ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        )}
        Export
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu z-[100] mt-2 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
      >
        <li className="pointer-events-none px-3 py-2">
          <span className="text-sm font-semibold text-gray-800">Export ข้อมูล</span>
          <span className="mt-0.5 block text-xs text-gray-500">รวม {complaints.length} เรื่อง</span>
        </li>
        <li className="my-1 border-t border-gray-100" />
        {exportOptions.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              onClick={option.onClick}
              disabled={exporting || option.disabled}
              className="flex w-full items-center justify-between gap-2 rounded-lg disabled:opacity-40"
            >
              <span className="flex items-center gap-2">
                <span>{option.icon}</span>
                <span>{option.label}</span>
              </span>
              <span className="badge badge-ghost badge-sm">{option.count}</span>
            </button>
          </li>
        ))}
        <li className="pointer-events-none mt-1 border-t border-gray-100 px-3 pt-2">
          <span className="text-[11px] leading-snug text-gray-400">
            ไฟล์ CSV รูปแบบ UTF-8 พร้อม BOM รองรับภาษาไทย
          </span>
        </li>
      </ul>
    </div>
  );
}
