import React, { useState } from 'react';
import Image from 'next/image';
import { FaEdit, FaEye, FaMapMarkerAlt, FaPhone, FaImage, FaGraduationCap } from 'react-icons/fa';
import EducationDetailModal from './EducationDetailModal';

export default function EducationTable({ data, onEdit }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');

  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');



  // กรองข้อมูล
  const filteredData = data.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.phone?.includes(searchTerm);
    const matchesLevel = filterLevel === 'all' || item.educationLevel === filterLevel;
    
    return matchesSearch && matchesLevel;
  });

  // เรียงลำดับข้อมูล
  const sortedData = [...filteredData].sort((a, b) => {
    let aValue = a[sortBy] || '';
    let bValue = b[sortBy] || '';
    
    if (sortBy === 'name') {
      aValue = (a.prefix || '') + (a.name || '');
      bValue = (b.prefix || '') + (b.name || '');
    }
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getLevelColor = (level) => {
    const colors = {
      'อนุบาล': 'bg-pink-100 text-pink-800',
      'ประถม': 'bg-yellow-100 text-yellow-800',
      'มัธยมต้น': 'bg-green-100 text-green-800',
      'มัธยมปลาย': 'bg-blue-100 text-blue-800',
      'ปวช.': 'bg-purple-100 text-purple-800',
      'ปวส.': 'bg-orange-100 text-orange-800',
      'ปริญญาตรี': 'bg-red-100 text-red-800',
      'ไม่ระบุ': 'bg-gray-100 text-gray-800'
    };
    return colors[level] || colors['ไม่ระบุ'];
  };

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-800">ข้อมูลผู้ขอรับสิทธิการศึกษา</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FaGraduationCap />
            <span>ทั้งหมด {data.length} รายการ</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="ค้นหาชื่อ, ที่อยู่, เบอร์โทร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Level Filter */}
          <div className="md:w-48">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทุกระดับการศึกษา</option>
              <option value="อนุบาล">อนุบาล</option>
              <option value="ประถม">ประถม</option>
              <option value="มัธยมต้น">มัธยมต้น</option>
              <option value="มัธยมปลาย">มัธยมปลาย</option>
              <option value="ปวช.">ปวช.</option>
              <option value="ปวส.">ปวส.</option>
              <option value="ปริญญาตรี">ปริญญาตรี</option>
              <option value="ไม่ระบุ">ไม่ระบุ</option>
            </select>
          </div>


        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" style={{ tableLayout: 'fixed', width: '100%' }}>
          <style jsx>{`
            .education-level-cell {
              width: 150px !important;
              min-width: 150px !important;
              max-width: 150px !important;
              white-space: nowrap !important;
              word-break: keep-all !important;
              overflow-wrap: normal !important;
            }
            .education-level-text {
              white-space: nowrap !important;
              word-break: keep-all !important;
              overflow-wrap: normal !important;
              display: inline-flex !important;
              width: fit-content !important;
            }
          `}</style>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ข้อมูล
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 education-level-cell"
                onClick={() => handleSort('educationLevel')}
              >
                ระดับการศึกษา
                {sortBy === 'educationLevel' && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ติดต่อ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                สถานะ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                การดำเนินการ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((item) => (
              <tr 
                key={item._id} 
                className="hover:bg-gray-50 transition cursor-pointer"
                onClick={() => {
                  console.log('Row clicked:', item);
                  setSelectedItem(item);
                  setIsDetailModalOpen(true);
                  console.log('Modal state set to true');
                }}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <Image
                        className="h-12 w-12 rounded-lg object-cover border-2 border-gray-200"
                        src={item.imageUrl?.[0] || '/default-icon.png'}
                        alt={item.name || 'avatar'}
                        width={48}
                        height={48}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.prefix || ''}{item.name}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {item.address}
                      </p>
                      {item.note && (
                        <p className="text-xs text-gray-400 truncate">
                          📝 {item.note}
                        </p>
                      )}

                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 education-level-cell">
                  <div className={`inline-flex px-3 py-2 text-sm font-semibold rounded-full education-level-text ${getLevelColor(item.educationLevel)}`}>
                    {item.educationLevel || 'ไม่ระบุ'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {item.phone ? (
                      <div className="flex items-center gap-1">
                        <FaPhone className="text-green-500" />
                        <span>{item.phone}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">ไม่มีข้อมูล</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm">
                    {item.location && item.location.lat && item.location.lng ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <FaMapMarkerAlt />
                        <span>มีพิกัด</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600">
                        <FaMapMarkerAlt />
                        <span>ไม่มีพิกัด</span>
                      </div>
                    )}
                    {item.imageUrl?.length > 0 ? (
                      <div className="flex items-center gap-1 text-blue-600">
                        <FaImage />
                        <span>{item.imageUrl.length} รูป</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-400">
                        <FaImage />
                        <span>ไม่มีรูป</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Row clicked:', item);
                        setSelectedItem(item);
                        setIsDetailModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition"
                      title="ดูรายละเอียด"
                    >
                      <FaEye />
                    </button>
                    {onEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(item);
                        }}
                        className="text-green-600 hover:text-green-800 p-2 rounded-full hover:bg-green-50 transition"
                        title="แก้ไขข้อมูล"
                      >
                        <FaEdit />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {sortedData.length === 0 && (
        <div className="px-6 py-12 text-center">
          <div className="text-gray-400 mb-4">
            <FaGraduationCap size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่พบข้อมูล</h3>
          <p className="text-gray-500">
            {searchTerm || filterLevel !== 'all'
              ? 'ลองเปลี่ยนเงื่อนไขการค้นหา' 
              : 'ยังไม่มีข้อมูลการศึกษา'
            }
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>แสดง {sortedData.length} จาก {data.length} รายการ</span>
          <span>อัปเดตล่าสุด: {new Date().toLocaleDateString('th-TH')}</span>
        </div>
      </div>

      {/* Detail Modal */}
      {console.log('Modal render state:', { isOpen: isDetailModalOpen, data: selectedItem })}
      <EducationDetailModal
        data={selectedItem}
        isOpen={isDetailModalOpen}
        onClose={() => {
          console.log('Modal closing');
          setIsDetailModalOpen(false);
          setSelectedItem(null);
        }}
      />
    </div>
  );
}