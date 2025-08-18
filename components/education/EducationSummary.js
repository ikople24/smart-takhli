// components/education/EducationSummary.js
import React from 'react';
import { FaBaby, FaSchool, FaUniversity, FaUserGraduate, FaQuestion, FaMapMarkerAlt, FaPhone, FaImage, FaGraduationCap, FaChartBar } from 'react-icons/fa';

export default function EducationSummary({ data }) {
  const summary = data.reduce((acc, curr) => {
    const level = curr.educationLevel || 'ไม่ระบุ';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});

  const levelInfo = {
    'อนุบาล': { 
      icon: <FaBaby className="text-pink-500 text-xl" />, 
      order: 1, 
      color: 'bg-pink-500',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-700'
    },
    'ประถม': { 
      icon: <FaSchool className="text-yellow-500 text-xl" />, 
      order: 2, 
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700'
    },
    'มัธยมต้น': { 
      icon: <FaSchool className="text-green-500 text-xl" />, 
      order: 3, 
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700'
    },
    'มัธยมปลาย': { 
      icon: <FaSchool className="text-blue-500 text-xl" />, 
      order: 4, 
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    'ปวช': { 
      icon: <FaUserGraduate className="text-indigo-500 text-xl" />, 
      order: 5, 
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700'
    },
    'ปวช.': { 
      icon: <FaUserGraduate className="text-indigo-500 text-xl" />, 
      order: 5, 
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700'
    },
    'ปวส': { 
      icon: <FaUserGraduate className="text-purple-500 text-xl" />, 
      order: 6, 
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700'
    },
    'ปวส.': { 
      icon: <FaUserGraduate className="text-purple-500 text-xl" />, 
      order: 6, 
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700'
    },
    'ปริญญาตรี': { 
      icon: <FaUniversity className="text-red-500 text-xl" />, 
      order: 7, 
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700'
    },
    'ไม่ระบุ': { 
      icon: <FaQuestion className="text-gray-500 text-xl" />, 
      order: 8, 
      color: 'bg-gray-500',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-700'
    },
  };

  const sortedLevels = Object.entries(summary).sort(
    ([a], [b]) => (levelInfo[a]?.order || 99) - (levelInfo[b]?.order || 99)
  );

  // คำนวณสถิติเพิ่มเติม
  const totalRecords = data.length;
  const hasLocation = data.filter(item => item.location && item.location.lat && item.location.lng).length;
  const hasPhone = data.filter(item => item.phone).length;
  const hasImages = data.filter(item => item.imageUrl && item.imageUrl.length > 0).length;
  const completeRecords = data.filter(item => 
    item.name && 
    item.address && 
    item.phone && 
    item.location && 
    item.imageUrl?.length > 0
  ).length;

  const completionRate = totalRecords > 0 ? Math.round((completeRecords / totalRecords) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">รายการทั้งหมด</p>
              <p className="text-3xl font-bold">{totalRecords}</p>
            </div>
            <FaGraduationCap className="text-4xl opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">มีพิกัด</p>
              <p className="text-3xl font-bold">{hasLocation}</p>
            </div>
            <FaMapMarkerAlt className="text-4xl opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">มีรูปภาพ</p>
              <p className="text-3xl font-bold">{hasImages}</p>
            </div>
            <FaImage className="text-4xl opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">ความสมบูรณ์</p>
              <p className="text-3xl font-bold">{completionRate}%</p>
            </div>
            <FaChartBar className="text-4xl opacity-80" />
          </div>
        </div>
      </div>

      {/* Education Level Breakdown */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-800">สรุปตามระดับการศึกษา</h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FaGraduationCap />
            <span>รวม {totalRecords} รายการ</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {sortedLevels.map(([level, count], index) => {
            const info = levelInfo[level];
            const percentage = totalRecords > 0 ? Math.round((count / totalRecords) * 100) : 0;
            
            return (
              <div
                key={index}
                className={`${info.bgColor} rounded-xl p-4 text-center transition-transform hover:scale-105 hover:shadow-md`}
              >
                <div className="flex justify-center mb-2">
                  {info.icon}
                </div>
                <div className={`text-sm font-medium ${info.textColor} mb-1`}>
                  {level}
                </div>
                <div className={`text-2xl font-bold ${info.textColor}`}>
                  {count}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {percentage}%
                </div>
                <div className="mt-2">
                  <div className={`h-1 ${info.color} rounded-full`} style={{ width: `${percentage}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Additional Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-800">ข้อมูลติดต่อ</h4>
            <FaPhone className="text-blue-500" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">มีเบอร์โทร</span>
              <span className="font-semibold text-green-600">{hasPhone}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">ไม่มีเบอร์โทร</span>
              <span className="font-semibold text-red-600">{totalRecords - hasPhone}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">อัตราการมีข้อมูล</span>
                <span className="font-semibold text-blue-600">
                  {totalRecords > 0 ? Math.round((hasPhone / totalRecords) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-800">ข้อมูลรูปภาพ</h4>
            <FaImage className="text-purple-500" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">มีรูปภาพ</span>
              <span className="font-semibold text-green-600">{hasImages}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">ไม่มีรูปภาพ</span>
              <span className="font-semibold text-red-600">{totalRecords - hasImages}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">อัตราการมีรูปภาพ</span>
                <span className="font-semibold text-purple-600">
                  {totalRecords > 0 ? Math.round((hasImages / totalRecords) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-800">ข้อมูลพิกัด</h4>
            <FaMapMarkerAlt className="text-orange-500" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">มีพิกัด</span>
              <span className="font-semibold text-green-600">{hasLocation}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">ไม่มีพิกัด</span>
              <span className="font-semibold text-red-600">{totalRecords - hasLocation}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">อัตราการมีพิกัด</span>
                <span className="font-semibold text-orange-600">
                  {totalRecords > 0 ? Math.round((hasLocation / totalRecords) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}