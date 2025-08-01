// pages/admin/education-map.js
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// EditForm Component
function EditForm({ data, onClose, onSave, isSaving }) {
  const [formData, setFormData] = useState({
    _id: data._id,
    prefix: data.prefix || '',
    name: data.name || '',
    educationLevel: data.educationLevel || '',
    phone: data.phone || '',
    address: data.address || '',
    note: data.note || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Prefix and Name */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            คำนำหน้า
          </label>
          <select
            value={formData.prefix}
            onChange={(e) => handleChange('prefix', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">เลือกคำนำหน้า</option>
            <option value="ดช.">ดช.</option>
            <option value="ดญ.">ดญ.</option>
            <option value="นาย">นาย</option>
            <option value="นาง">นาง</option>
            <option value="นางสาว">นางสาว</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ชื่อ-นามสกุล *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="ชื่อ-นามสกุล"
          />
        </div>
      </div>

      {/* Education Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ระดับการศึกษา
        </label>
        <select
          value={formData.educationLevel}
          onChange={(e) => handleChange('educationLevel', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">เลือกระดับการศึกษา</option>
          <option value="อนุบาล">อนุบาล</option>
          <option value="ประถม">ประถม</option>
          <option value="มัธยมต้น">มัธยมต้น</option>
          <option value="มัธยมปลาย">มัธยมปลาย</option>
          <option value="ปวช.">ปวช.</option>
          <option value="ปวส.">ปวส.</option>
          <option value="ปริญญาตรี">ปริญญาตรี</option>
        </select>
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          เบอร์โทรศัพท์
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="เบอร์โทรศัพท์"
          maxLength={10}
        />
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ที่อยู่
        </label>
        <textarea
          value={formData.address}
          onChange={(e) => handleChange('address', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="ที่อยู่"
        />
      </div>

      {/* Note */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          หมายเหตุ
        </label>
        <textarea
          value={formData.note}
          onChange={(e) => handleChange('note', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="หมายเหตุ (ถ้ามี)"
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </form>
  );
}

// โหลด MapEducationPoints แบบ dynamic (เพราะใช้ Leaflet)
const MapEducationPoints = dynamic(() => import('../../components/education/MapEducationPoints'), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="animate-pulse bg-gray-200 h-96 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 text-lg mb-2">🗺️</div>
          <p className="text-gray-500">กำลังโหลดแผนที่...</p>
        </div>
      </div>
    </div>
  )
});

export default function EducationMapPage() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editModal, setEditModal] = useState({ isOpen: false, data: null });
  const [tableFilter, setTableFilter] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/education/all');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      setPoints(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (item) => {
    setEditModal({ isOpen: true, data: item });
  };

  const handleCloseEditModal = () => {
    setEditModal({ isOpen: false, data: null });
  };

  const handleSaveEdit = async (updatedData) => {
    try {
      setIsSaving(true);
      
      const response = await fetch(`/api/education/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error('Failed to update data');
      }

      // Refresh data
      await fetchData();
      
      // Close modal
      handleCloseEditModal();
      
      // Show success message
      alert('บันทึกข้อมูลเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error updating data:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  // ฟังก์ชันสำหรับการเรียงลำดับ
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // ฟังก์ชันสำหรับการกรองและเรียงลำดับข้อมูล
  const getFilteredAndSortedData = () => {
    let filteredData = points;
    
    // กรองตามระดับการศึกษา
    if (tableFilter !== 'all') {
      filteredData = points.filter(item => item.educationLevel === tableFilter);
    }
    
    // เรียงลำดับ
    filteredData.sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';
      
      // สำหรับชื่อ ให้รวม prefix ด้วย
      if (sortField === 'name') {
        aValue = (a.prefix || '') + (a.name || '');
        bValue = (b.prefix || '') + (b.name || '');
      }
      
      // สำหรับวันที่ ให้เรียงจากใหม่ไปเก่า
      if (sortField === 'createdAt') {
        const aDate = new Date(a.createdAt || 0);
        const bDate = new Date(b.createdAt || 0);
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue, 'th');
      } else {
        return bValue.localeCompare(aValue, 'th');
      }
    });
    
    return filteredData;
  };

  // ฟังก์ชันสำหรับสีของระดับการศึกษา
  const getLevelColor = (level) => {
    const colors = {
      'อนุบาล': '#FF6B9D',
      'ประถม': '#FF6B35',
      'มัธยมต้น': '#6BCF7F',
      'มัธยมปลาย': '#4D96FF',
      'ปวช.': '#9B59B6',
      'ปวส.': '#E67E22',
      'ปริญญาตรี': '#E74C3C',
      'ไม่ระบุ': '#95A5A6'
    };
    return colors[level] || colors['ไม่ระบุ'];
  };

  const exportToCSV = () => {
    const headers = ['ชื่อ', 'ระดับการศึกษา', 'ที่อยู่', 'หมายเหตุ'];
    const csvData = points.map(item => [
      `${item.prefix || ''}${item.name || ''}`,
      item.educationLevel || 'ไม่ระบุ',
      item.address || '',
      item.note || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `education-data-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                แผนที่ภาพรวมข้อมูลสำรวจทางการศึกษา
              </h1>
              <p className="text-gray-600 mt-1">
                จัดการและวิเคราะห์ข้อมูลการศึกษาของผู้ขอรับสิทธิ
              </p>
            </div>
            <div className="flex items-center gap-3 mt-4 md:mt-0">
              <button
                onClick={fetchData}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
              >
                <span>🔄</span>
                <span>รีเฟรช</span>
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
              >
                <span>📥</span>
                <span>ส่งออก CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>📊</span>
                <span>แดชบอร์ด</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'map'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>🗺️</span>
                <span>แผนที่</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'table'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>📋</span>
                <span>ตารางข้อมูล</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Summary - Always visible at top */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">ข้อมูลสรุป</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800">รายการทั้งหมด</h3>
              <p className="text-2xl font-bold text-blue-600">{points.length}</p>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800">มีพิกัด</h3>
              <p className="text-2xl font-bold text-green-600">
                {points.filter(item => item.location && item.location.lat && item.location.lng).length}
              </p>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-800">มีรูปภาพ</h3>
              <p className="text-2xl font-bold text-purple-600">
                {points.filter(item => item.imageUrl && item.imageUrl.length > 0).length}
              </p>
            </div>
            <div className="bg-orange-100 p-4 rounded-lg">
              <h3 className="font-semibold text-orange-800">มีเบอร์โทร</h3>
              <p className="text-2xl font-bold text-orange-600">
                {points.filter(item => item.phone).length}
              </p>
            </div>
          </div>
        </div>

        {activeTab === 'map' && (
          <div className="space-y-6">
            <MapEducationPoints data={points} />
          </div>
        )}

        {activeTab === 'table' && (
          <div className="space-y-6">
            {/* Table with Filter and Sort */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <h2 className="text-xl font-semibold text-gray-800">ข้อมูลผู้ขอรับสิทธิการศึกษา</h2>
                  
                  {/* Filter */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">กรองตามระดับการศึกษา:</label>
                    <select
                      value={tableFilter}
                      onChange={(e) => setTableFilter(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">ทั้งหมด ({points.length})</option>
                      {Array.from(new Set(points.map(item => item.educationLevel).filter(Boolean))).map(level => (
                        <option key={level} value={level}>
                          {level} ({points.filter(item => item.educationLevel === level).length})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition w-16"
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="flex items-center gap-1">
                          ลำดับ
                          {sortField === 'createdAt' && (
                            <span className="text-blue-500">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          ชื่อ
                          {sortField === 'name' && (
                            <span className="text-blue-500">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => handleSort('educationLevel')}
                      >
                        <div className="flex items-center gap-1">
                          ระดับการศึกษา
                          {sortField === 'educationLevel' && (
                            <span className="text-blue-500">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ที่อยู่</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">การดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getFilteredAndSortedData().map((item, index) => (
                      <tr key={item._id || index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-500 text-center">
                          {sortField === 'createdAt' ? (
                            <div className="text-xs">
                              <div className="font-medium">{index + 1}</div>
                              <div className="text-gray-400">
                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString('th-TH') : '-'}
                              </div>
                            </div>
                          ) : (
                            index + 1
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.prefix || ''}{item.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <span className="px-2 py-1 text-xs font-medium rounded-full"
                                style={{
                                  backgroundColor: getLevelColor(item.educationLevel) + '20',
                                  color: getLevelColor(item.educationLevel)
                                }}>
                            {item.educationLevel || 'ไม่ระบุ'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.address || 'ไม่มีข้อมูล'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition"
                          >
                            แก้ไข
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Summary */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  แสดง {getFilteredAndSortedData().length} รายการจากทั้งหมด {points.length} รายการ
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Glass Edit Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
              <h2 className="text-xl font-semibold text-gray-800">แก้ไขข้อมูล</h2>
              <button
                onClick={handleCloseEditModal}
                className="text-gray-400 hover:text-gray-600 transition text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              {editModal.data && (
                <EditForm 
                  data={editModal.data} 
                  onClose={handleCloseEditModal}
                  onSave={handleSaveEdit}
                  isSaving={isSaving}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 