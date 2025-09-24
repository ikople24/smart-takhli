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

  const handleExport = async () => {
    setExporting(true);
    
    try {
      const csvContent = convertToCSV(complaints);
      
      if (!csvContent) {
        alert('ไม่มีข้อมูลให้ export');
        return;
      }

      // Create blob and download
      const blob = new Blob(['\ufeff' + csvContent], { 
        type: 'text/csv;charset=utf-8;' 
      });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `complaints_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
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

      const blob = new Blob(['\ufeff' + csvContent], { 
        type: 'text/csv;charset=utf-8;' 
      });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `complaints_${statusText}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert(`Export ${status} สำเร็จ!`);
    } catch (error) {
      console.error('Export error:', error);
      alert('เกิดข้อผิดพลาดในการ export');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Export ข้อมูล</h3>
        <span className="text-sm text-gray-500">
          รวม {complaints.length} เรื่อง
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={handleExport}
          disabled={exporting || complaints.length === 0}
          className="btn btn-primary btn-sm"
        >
          {exporting ? (
            <>
              <span className="loading loading-spinner loading-xs"></span>
              กำลัง Export...
            </>
          ) : (
            <>
              📊 Export ทั้งหมด
            </>
          )}
        </button>

        <button
          onClick={() => handleExportFiltered('รอการมอบหมาย')}
          disabled={exporting || complaints.filter(c => c.status === 'รอการมอบหมาย').length === 0}
          className="btn btn-info btn-sm"
        >
          ⏳ Export รอการมอบหมาย
        </button>

        <button
          onClick={() => handleExportFiltered('อยู่ระหว่างดำเนินการ')}
          disabled={exporting || complaints.filter(c => c.status === 'อยู่ระหว่างดำเนินการ').length === 0}
          className="btn btn-warning btn-sm"
        >
          🔄 Export กำลังดำเนินการ
        </button>

        <button
          onClick={() => handleExportFiltered('ดำเนินการเสร็จสิ้น')}
          disabled={exporting || complaints.filter(c => c.status === 'ดำเนินการเสร็จสิ้น').length === 0}
          className="btn btn-success btn-sm"
        >
          ✅ Export เสร็จสิ้น
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        * ไฟล์ CSV จะถูกดาวน์โหลดในรูปแบบ UTF-8 พร้อม BOM เพื่อรองรับภาษาไทย
      </div>
    </div>
  );
}
