// components/education/MapEducationPoints.js
import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { FaMapMarkerAlt, FaSchool, FaUniversity, FaBaby, FaUserGraduate } from 'react-icons/fa';

// ป้องกัน marker icon หายในบางระบบ
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

// สร้าง custom icons สำหรับแต่ละระดับการศึกษา
const createCustomIcon = (level) => {
  const colors = {
    'อนุบาล': '#FF6B9D',
    'ประถม': '#FF6B35',
    'มัธยมต้น': '#6BCF7F',
    'มัธยมปลาย': '#4D96FF',
    'ปวช': '#9B59B6',
    'ปวช.': '#9B59B6',
    'ปวส': '#E67E22',
    'ปวส.': '#E67E22',
    'ปริญญาตรี': '#E74C3C',
    'ไม่ระบุ': '#95A5A6'
  };

  const color = colors[level] || colors['ไม่ระบุ'];

  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: bold;
      ">
        ${level === 'อนุบาล' ? 'อ' : 
          level === 'ประถม' ? 'ป' :
          level === 'มัธยมต้น' ? 'ม' :
          level === 'มัธยมปลาย' ? 'ม' :
          level === 'ปวช' ? 'ช' :
          level === 'ปวช.' ? 'ช' :
          level === 'ปวส' ? 'ส' :
          level === 'ปวส.' ? 'ส' :
          level === 'ปริญญาตรี' ? 'ต' : '?'}
      </div>
    `,
    className: 'custom-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

export default function MapEducationPoints({ data }) {
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [hoveredPoint, setHoveredPoint] = useState(null);



  // จัดกลุ่มข้อมูลตามระดับการศึกษา
  const groupedData = useMemo(() => {
    const groups = {};
    data.forEach(item => {
      const level = item.educationLevel || 'ไม่ระบุ';
      if (!groups[level]) {
        groups[level] = [];
      }
      groups[level].push(item);
    });
    
    // Debug: แสดงข้อมูลที่จัดกลุ่มแล้ว
    console.log('Grouped data:', groups);
    console.log('Available levels:', Object.keys(groups));
    
    return groups;
  }, [data]);

  // คำนวณจุดศูนย์กลางของแผนที่
  const center = useMemo(() => {
    if (data.length === 0) return [15.259, 100.349];
    
    const validPoints = data.filter(item => 
      item.location && 
      typeof item.location.lat === 'number' && 
      typeof item.location.lng === 'number'
    );
    
    if (validPoints.length === 0) return [15.259, 100.349];
    
    const avgLat = validPoints.reduce((sum, item) => sum + item.location.lat, 0) / validPoints.length;
    const avgLng = validPoints.reduce((sum, item) => sum + item.location.lng, 0) / validPoints.length;
    
    return [avgLat, avgLng];
  }, [data]);

  // กรองข้อมูลตามระดับการศึกษาที่เลือก
  const filteredData = useMemo(() => {
    if (selectedLevel === 'all') return data;
    return data.filter(item => (item.educationLevel || 'ไม่ระบุ') === selectedLevel);
  }, [data, selectedLevel]);

  const levelColors = {
    'อนุบาล': '#FF6B9D',
    'ประถม': '#FF6B35',
    'มัธยมต้น': '#6BCF7F',
    'มัธยมปลาย': '#4D96FF',
    'ปวช': '#9B59B6',
    'ปวช.': '#9B59B6',
    'ปวส': '#E67E22',
    'ปวส.': '#E67E22',
    'ปริญญาตรี': '#E74C3C',
    'ไม่ระบุ': '#95A5A6'
  };

  const levelIcons = {
    'อนุบาล': <FaBaby />,
    'ประถม': <FaSchool />,
    'มัธยมต้น': <FaSchool />,
    'มัธยมปลาย': <FaSchool />,
    'ปวช': <FaUserGraduate />,
    'ปวช.': <FaUserGraduate />,
    'ปวส': <FaUserGraduate />,
    'ปวส.': <FaUserGraduate />,
    'ปริญญาตรี': <FaUniversity />,
    'ไม่ระบุ': <FaMapMarkerAlt />
  };


  return (
    <div className="space-y-4">
      {/* ตัวกรองระดับการศึกษา */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">กรองตามระดับการศึกษา</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedLevel('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              selectedLevel === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ทั้งหมด ({data.length})
          </button>
          {Object.entries(groupedData).map(([level, items]) => {
            const icon = levelIcons[level] || <FaMapMarkerAlt />;
            console.log(`Level: ${level}, Icon:`, icon);
            
            return (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
                  selectedLevel === level
                    ? 'text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={{
                  backgroundColor: selectedLevel === level ? levelColors[level] : 'transparent'
                }}
              >
                <span className="text-xs">{icon}</span>
                {level} ({items.length})
              </button>
            );
          })}
        </div>
      </div>

      {/* แผนที่ */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <MapContainer 
          center={center} 
          zoom={12} 
          style={{ height: '600px', width: '100%', zIndex: 0 }}
          className="rounded-lg"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />
          
          {/* แสดงจุดข้อมูลการศึกษา */}
          {filteredData.map((item, i) => {
            if (!item.location || !item.location.lat || !item.location.lng) return null;
            
            const level = item.educationLevel || 'ไม่ระบุ';
            const icon = createCustomIcon(level);
            
            return (
              <Marker
                key={item._id || i}
                position={[item.location.lat, item.location.lng]}
                icon={icon}
                eventHandlers={{
                  mouseover: () => setHoveredPoint(item),
                  mouseout: () => setHoveredPoint(null)
                }}
              >
                <Popup>
                  <div className="min-w-[300px]">
                    {/* Header */}
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">
                        {item.prefix || ''}{item.name}
                      </h3>
                    </div>
                    
                    {/* Information Section */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">📚 ระดับ:</span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium"
                              style={{ backgroundColor: levelColors[level] + '20', color: levelColors[level] }}>
                          {level}
                        </span>
                      </div>
                      
                      {item.phone && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">📞:</span>
                          <span>{item.phone}</span>
                        </div>
                      )}
                      
                      {item.address && (
                        <div className="flex items-start gap-2">
                          <span className="font-medium">🏠:</span>
                          <span className="text-gray-600">{item.address}</span>
                        </div>
                      )}
                      
                      {item.note && (
                        <div className="flex items-start gap-2">
                          <span className="font-medium">📝:</span>
                          <span className="text-gray-600">{item.note}</span>
                        </div>
                      )}
                    </div>

                    {/* Images Section */}
                    {item.imageUrl?.length > 0 && (
                      <div className="mt-3">
                        <div className="flex overflow-x-auto gap-2 pb-2">
                          {item.imageUrl.map((url, index) => (
                            <a
                              key={index}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0"
                            >
                              <Image
                                src={url}
                                alt={`${item.name || 'ผู้เรียน'} - รูปที่ ${index + 1}`}
                                width={80}
                                height={60}
                                className="rounded-md object-cover hover:opacity-80 transition"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* สถิติสรุป */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">สถิติการแสดงผล</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{filteredData.length}</div>
            <div className="text-sm text-gray-600">รายการที่แสดง</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {filteredData.filter(item => item.location && item.location.lat && item.location.lng).length}
            </div>
            <div className="text-sm text-gray-600">มีพิกัด</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {filteredData.filter(item => item.imageUrl?.length > 0).length}
            </div>
            <div className="text-sm text-gray-600">มีรูปภาพ</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {filteredData.filter(item => item.phone).length}
            </div>
            <div className="text-sm text-gray-600">มีเบอร์โทร</div>
          </div>
        </div>
      </div>

      {/* แสดงข้อมูลจุดที่ hover */}
      {hoveredPoint && (
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">
            ข้อมูลที่เลือก: {hoveredPoint.prefix || ''}{hoveredPoint.name}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">ระดับการศึกษา:</span>
              <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: levelColors[hoveredPoint.educationLevel || 'ไม่ระบุ'] + '20', color: levelColors[hoveredPoint.educationLevel || 'ไม่ระบุ'] }}>
                {hoveredPoint.educationLevel || 'ไม่ระบุ'}
              </span>
            </div>
            {hoveredPoint.phone && (
              <div>
                <span className="font-medium">เบอร์โทร:</span>
                <span className="ml-2">{hoveredPoint.phone}</span>
              </div>
            )}
            {hoveredPoint.householdMembers && (
              <div>
                <span className="font-medium">สมาชิกในบ้าน:</span>
                <span className="ml-2">{hoveredPoint.householdMembers} คน</span>
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}