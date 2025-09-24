import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

// Import menu store to get category icons
import { useMenuStore } from '@/stores/useMenuStore';

// ฟังก์ชันคำนวณจุดศูนย์กลางของ polygon
const calculatePolygonCenter = (coordinates) => {
  if (!coordinates || coordinates.length === 0) {
    return null;
  }
  
  try {
    // ใช้ centroid algorithm สำหรับ polygon ที่ซับซ้อน
    let area = 0;
    let centerLat = 0;
    let centerLng = 0;
    
    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length;
      const cross = coordinates[i][0] * coordinates[j][1] - coordinates[j][0] * coordinates[i][1];
      area += cross;
      centerLat += (coordinates[i][0] + coordinates[j][0]) * cross;
      centerLng += (coordinates[i][1] + coordinates[j][1]) * cross;
    }
    
    area /= 2;
    
    // ตรวจสอบว่า area ไม่เป็น 0
    if (Math.abs(area) < 0.000001) {
      // Fallback: ใช้ค่าเฉลี่ยแบบง่าย
      let sumLat = 0;
      let sumLng = 0;
      coordinates.forEach(coord => {
        sumLat += coord[0];
        sumLng += coord[1];
      });
      return [sumLat / coordinates.length, sumLng / coordinates.length];
    }
    
    centerLat /= (6 * area);
    centerLng /= (6 * area);
    
    // ตรวจสอบว่าผลลัพธ์ถูกต้อง
    if (isNaN(centerLat) || isNaN(centerLng)) {
      return null;
    }
    
    return [centerLat, centerLng];
  } catch (error) {
    console.error('Error calculating polygon center:', error);
    return null;
  }
};

// ฟังก์ชันย่อชื่อชุมชนที่ยาวเกินไป
const shortenCommunityName = (name, maxLength = 18) => {
  if (name.length <= maxLength) {
    return name;
  }
  
  // ลองหาจุดแบ่งที่เหมาะสม
  const parts = name.split('-');
  if (parts.length > 1) {
    // ถ้ามีเครื่องหมาย - ให้ย่อส่วนหลัง
    const prefix = parts[0];
    
    // ถ้าส่วนแรกสั้นพอ ให้แสดงส่วนแรก + ...
    if (prefix.length <= maxLength - 3) {
      return `${prefix}-...`;
    }
    
    // ถ้าส่วนแรกยาวเกิน ให้ย่อส่วนแรก
    if (prefix.length > maxLength - 3) {
      return prefix.substring(0, maxLength - 3) + '...';
    }
  }
  
  // ถ้าไม่มีเครื่องหมาย - หรือไม่สามารถย่อได้ ให้ย่อท้าย
  return name.substring(0, maxLength - 3) + '...';
};

// Component to handle map instance
const MapController = ({ onMapReady }) => {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      // รอให้ map พร้อมใช้งาน
      const checkMapReady = () => {
        if (map && !map._removed && map._loaded !== false) {
          onMapReady(map);
        } else {
          setTimeout(checkMapReady, 50);
        }
      };
      
      // เริ่มต้นตรวจสอบหลังจาก map initialize
      setTimeout(checkMapReady, 100);
    }
  }, [map, onMapReady]);
  
  return null;
};

const AdminDashboardMap = ({ complaints, polygons = [] }) => {
  const [mapKey, setMapKey] = useState(0);
  const [mapInstance, setMapInstance] = useState(null);
  const [showPolygons, setShowPolygons] = useState(false);
  const { menu, fetchMenu, menuLoading } = useMenuStore();

  // Filter complaints with valid location data
  const complaintsWithLocation = complaints?.filter(complaint => 
    complaint.location && 
    typeof complaint.location.lat === 'number' && 
    typeof complaint.location.lng === 'number' &&
    !isNaN(complaint.location.lat) && 
    !isNaN(complaint.location.lng)
  ) || [];

  // Calculate center point and zoom for map
  const getMapCenter = () => {
    if (complaintsWithLocation.length === 0) {
      return [13.7563, 100.5018]; // Bangkok coordinates as default
    }
    
    // Calculate the center of all markers
    const totalLat = complaintsWithLocation.reduce((sum, complaint) => sum + complaint.location.lat, 0);
    const totalLng = complaintsWithLocation.reduce((sum, complaint) => sum + complaint.location.lng, 0);
    
    return [totalLat / complaintsWithLocation.length, totalLng / complaintsWithLocation.length];
  };

  const getMapZoom = () => {
    if (complaintsWithLocation.length === 0) {
      return 12; // Default zoom (เพิ่มจาก 10 เป็น 12 = +25%)
    }
    
    // Calculate appropriate zoom based on number of markers
    if (complaintsWithLocation.length === 1) {
      return 17; // Close zoom for single marker (เพิ่มจาก 15 เป็น 17 = +25%)
    } else if (complaintsWithLocation.length <= 5) {
      return 14; // Medium zoom for few markers (เพิ่มจาก 12 เป็น 14 = +25%)
    } else {
      return 12; // Wide zoom for many markers (เพิ่มจาก 10 เป็น 12 = +25%)
    }
  };

  const getMarkerColor = (status) => {
    switch (status) {
      case 'in_progress':
      case 'อยู่ระหว่างดำเนินการ':
        return '#3b82f6'; // blue
      case 'completed':
      case 'ดำเนินการเสร็จสิ้น':
        return '#10b981'; // green
      default: return '#3b82f6'; // blue (default to in progress)
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'in_progress':
      case 'อยู่ระหว่างดำเนินการ':
        return '🔄';
      case 'completed':
      case 'ดำเนินการเสร็จสิ้น':
        return '✅';
      default: return '🔄'; // default to in progress
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'in_progress':
      case 'อยู่ระหว่างดำเนินการ':
        return 'อยู่ระหว่างดำเนินการ';
      case 'completed':
      case 'ดำเนินการเสร็จสิ้น':
        return 'ดำเนินการเสร็จสิ้น';
      default: return 'อยู่ระหว่างดำเนินการ'; // default to in progress
    }
  };



  // Create custom icon for each marker
  const createCustomIcon = (complaint) => {
    const markerColor = getMarkerColor(complaint.status);
    
    // Only try to get category icon if menu is loaded and not loading
    if (menu && menu.length > 0 && !menuLoading) {
      const categoryIcon = menu.find(m => m.Prob_name === complaint.category)?.Prob_pic;
      
      if (categoryIcon) {
        // Use category icon if available
        return L.divIcon({
          className: 'custom-marker',
          html: `
            <div class="marker-icon-category" style="background-color: ${markerColor};">
              <img src="${categoryIcon}" alt="${complaint.category}" class="category-icon" />
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
      }
    }
    
    // Fallback to status icon
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="marker-icon" style="background-color: ${markerColor};">
          ${getStatusIcon(complaint.status)}
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  };

  // Fetch menu data on component mount
  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Force re-render when complaints change
  useEffect(() => {
    setMapKey(prev => prev + 1);
  }, [complaints]);

  // Show polygons when data is loaded
  useEffect(() => {
    if (polygons && polygons.length > 0) {
      setShowPolygons(true);
    }
  }, [polygons]);



  // Function to fly to marker position
  const flyToMarker = (lat, lng) => {
    try {
      if (mapInstance && !mapInstance._removed && mapInstance._loaded) {
        // ตรวจสอบว่า map พร้อมใช้งาน
        setTimeout(() => {
          if (mapInstance && !mapInstance._removed) {
            mapInstance.setView([lat, lng], 18, { // เพิ่มจาก 16 เป็น 18 = +25%
              animate: true,
              duration: 1
            });
          }
        }, 100);
      }
    } catch (error) {
      console.warn('Error flying to marker:', error);
    }
  };

  // Handle map ready
  const handleMapReady = (map) => {
    // รอให้ map พร้อมใช้งานก่อน
    setTimeout(() => {
      if (map && !map._removed) {
        map._loaded = true;
        setMapInstance(map);
      }
    }, 100);
  };

  if (!complaints || complaints.length === 0) {
    return (
      <div className="h-96 w-full rounded-lg bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">🗺️</div>
          <p className="text-gray-500">ไม่มีข้อมูลในกรอบเวลาที่เลือก</p>
        </div>
      </div>
    );
  }

  if (complaintsWithLocation.length === 0) {
    return (
      <div className="h-96 w-full rounded-lg bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">📍</div>
          <p className="text-gray-500">ไม่มีข้อมูลตำแหน่งในกรอบเวลาที่เลือก</p>
          <p className="text-gray-400 text-sm mt-2">ลองเปลี่ยนกรอบเวลาหรือตัวกรอง</p>
        </div>
      </div>
    );
  }

  // Show loading state while menu is loading
  if (menuLoading) {
    return (
      <div className="h-96 w-full rounded-lg bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">กำลังโหลดแผนที่...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <MapContainer
        key={mapKey}
        center={getMapCenter()}
        zoom={getMapZoom()}
        className="h-[441px] w-full rounded-lg"
        style={{ zIndex: 1 }}
      >
        <MapController onMapReady={handleMapReady} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        
        {/* Render Polygons */}
        {showPolygons && polygons.map((polygon, index) => {
          // สร้าง unique key ที่ปลอดภัย
          const uniqueKey = `polygon-${polygon.id || polygon.name || `index-${index}`}-${index}`;
          
          // คำนวณจุดศูนย์กลางของ polygon สำหรับแสดงชื่อ
          const centerPoint = calculatePolygonCenter(polygon.coordinates);
          
          // ตรวจสอบว่าจุดศูนย์กลางถูกต้อง
          if (!centerPoint || isNaN(centerPoint[0]) || isNaN(centerPoint[1])) {
            console.warn(`Invalid center point for polygon ${polygon.name}:`, centerPoint);
            return null;
          }
          
          // Debug: แสดงข้อมูลชุมชน
          const shortenedName = shortenCommunityName(polygon.name);
          console.log(`Community ${index + 1}: "${polygon.name}" -> "${shortenedName}" at ${centerPoint[0].toFixed(6)}, ${centerPoint[1].toFixed(6)}`);
          
          return (
            <div key={uniqueKey}>
              <Polygon
                positions={polygon.coordinates}
                pathOptions={{
                  color: polygon.color || '#3b82f6',
                  fillColor: polygon.fillColor || '#3b82f6',
                  fillOpacity: polygon.fillOpacity || 0.2,
                  weight: polygon.weight || 2
                }}
                eventHandlers={{
                  click: () => {
                    if (polygon.onClick) {
                      polygon.onClick(polygon);
                    }
                  }
                }}
              >
                            {polygon.popup && (
              <Popup>
                <div className="popup-content">
                  <h3 className="popup-title">{polygon.popup.title || 'พื้นที่'}</h3>
                  {polygon.popup.description && (
                    <p className="popup-text">{polygon.popup.description}</p>
                  )}
                  {polygon.popup.content && (
                    <div 
                      className="popup-text"
                      dangerouslySetInnerHTML={{ __html: polygon.popup.content }}
                    />
                  )}
                </div>
              </Popup>
            )}
              </Polygon>
              
              {/* แสดงชื่อชุมชนที่จุดศูนย์กลางของ polygon */}
              <Marker
                position={centerPoint}
                icon={L.divIcon({
                  className: 'community-label-marker',
                  html: `
                    <div class="community-label" style="
                      background-color: rgba(255, 255, 255, 0.95);
                      border: 2px solid ${polygon.color || '#3b82f6'};
                      border-radius: 6px;
                      padding: 4px 8px;
                      font-size: 11px;
                      font-weight: 700;
                      color: ${polygon.color || '#3b82f6'};
                      white-space: nowrap;
                      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                      pointer-events: none;
                      text-align: center;
                      min-width: 90px;
                      max-width: 140px;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      z-index: 1000;
                      cursor: help;
                    " title="${polygon.name}">
                      ${shortenedName}
                    </div>
                  `,
                  iconSize: [120, 30],
                  iconAnchor: [60, 15]
                })}
              />
            </div>
          );
        })}
        
        {complaintsWithLocation.map((complaint, index) => (
          <Marker
            key={`marker-${complaint._id || complaint.id || index}`}
            position={[complaint.location.lat, complaint.location.lng]}
            icon={createCustomIcon(complaint)}
            eventHandlers={{
              click: () => {
                // ตรวจสอบว่า map พร้อมใช้งานก่อน
                if (mapInstance && !mapInstance._removed && mapInstance._loaded) {
                  flyToMarker(complaint.location.lat, complaint.location.lng);
                }
              }
            }}
          >
                         <Popup>
               <div className="popup-content">
                 <h3 className="popup-title">
                   {complaint.category || 'ไม่ระบุประเภท'}
                 </h3>
                 <p className="popup-text">
                   <strong>รายละเอียด:</strong> {complaint.detail?.substring(0, 100) || 'ไม่มีรายละเอียด'}...
                 </p>
                 <p className="popup-text">
                   <strong>ผู้แจ้ง:</strong> {complaint.fullName || 'ไม่ระบุ'}
                 </p>
                 <p className="popup-text">
                   <strong>ชุมชน:</strong> {complaint.community || 'ไม่ระบุ'}
                 </p>
                 <p className="popup-text">
                   <strong>สถานะ:</strong> 
                   <span className={`status-badge status-${complaint.status}`}>
                     {getStatusText(complaint.status)}
                   </span>
                 </p>
                 <p className="popup-text">
                   <strong>วันที่:</strong> {new Date(complaint.timestamp || complaint.createdAt).toLocaleDateString('th-TH')}
                 </p>
                 <button
                   onClick={() => flyToMarker(complaint.location.lat, complaint.location.lng)}
                   className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                 >
                   📍 ไปที่ตำแหน่งนี้
                 </button>
               </div>
             </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg z-10 w-64 max-h-96 overflow-y-auto">
        <h4 className="text-sm font-semibold mb-3">คำอธิบายแผนที่</h4>
        
        {/* สรุปข้อมูล */}
        {polygons.length > 0 && (
          <div className="mb-3 p-2 bg-blue-50 rounded text-xs">
            <p className="font-medium text-blue-800">📊 สรุป:</p>
            {polygons.some(p => p.boundaryor) ? (
              <p className="text-blue-700">ชุมชน: {polygons.length} หมู่บ้าน</p>
            ) : (
              <p className="text-blue-700">ปัญหา: {polygons.length} พื้นที่</p>
            )}
            <p className="text-blue-700">หมุด: {complaintsWithLocation.length} จุด</p>
            <p className="text-blue-700">แสดงชื่อ: {polygons.length} ชุมชน</p>
          </div>
        )}
        
        <div className="space-y-3 text-xs">
          <div>
            <p className="font-medium mb-2">สถานะ:</p>
            <div className="space-y-1">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                <span>ดำเนินการ</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                <span>เสร็จสิ้น</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium mb-2">หมุด:</p>
            <p className="text-gray-600">ไอคอนตามประเภทปัญหา</p>
          </div>
          {polygons.length > 0 && (
            <div>
              <p className="font-medium mb-2">
                {polygons.some(p => p.boundaryor) ? 
                  `ชุมชน (${polygons.filter(p => p.boundaryor && p.boundaryor !== 'ไม่ระบุ').length}):` : 
                  `ปัญหา (${polygons.length}):`
                }
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {polygons.map((polygon, index) => (
                  <div key={`legend-polygon-${polygon.id || polygon.name || `index-${index}`}-${index}`} className="flex items-center hover:bg-gray-50 p-1 rounded">
                    <div 
                      className="w-3 h-3 mr-2 flex-shrink-0 rounded-sm" 
                      style={{ 
                        backgroundColor: polygon.color,
                        opacity: polygon.fillOpacity || 0.2 
                      }}
                    ></div>
                    <span className="text-xs truncate">{polygon.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1">
                <button
                  onClick={() => setShowPolygons(!showPolygons)}
                  className="w-full px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                >
                  {showPolygons ? 
                    (polygons.some(p => p.boundaryor) ? '🔽 ซ่อนชุมชน' : '🔽 ซ่อนปัญหา') : 
                    (polygons.some(p => p.boundaryor) ? '🔼 แสดงชุมชน' : '🔼 แสดงปัญหา')
                  }
                </button>
                <div className="text-xs text-gray-500 text-center">
                  คลิกเพื่อดูรายละเอียด
                </div>
              </div>
            </div>
          )}
          <div className="pt-2 border-t border-gray-200">
            <button
              onClick={() => {
                try {
                  if (complaintsWithLocation.length > 0 && mapInstance && !mapInstance._removed && mapInstance._loaded) {
                    // ตรวจสอบว่า map พร้อมใช้งาน
                    setTimeout(() => {
                      if (mapInstance && !mapInstance._removed) {
                        const center = getMapCenter();
                        const zoom = getMapZoom();
                        mapInstance.setView(center, zoom, {
                          animate: true,
                          duration: 1
                        });
                      }
                    }, 100);
                  }
                } catch (error) {
                  console.warn('Error setting view:', error);
                }
              }}
              className="w-full px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
            >
              🗺️ จัดกึ่งกลาง ({complaintsWithLocation.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardMap;

