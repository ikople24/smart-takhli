import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

// Component to handle map instance
const MapController = ({ onMapReady }) => {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      onMapReady(map);
    }
  }, [map, onMapReady]);
  
  return null;
};

const AdminDashboardMap = ({ complaints }) => {
  const [mapKey, setMapKey] = useState(0);
  const [mapInstance, setMapInstance] = useState(null);
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
      return 10; // Default zoom
    }
    
    // Calculate appropriate zoom based on number of markers
    if (complaintsWithLocation.length === 1) {
      return 15; // Close zoom for single marker
    } else if (complaintsWithLocation.length <= 5) {
      return 12; // Medium zoom for few markers
    } else {
      return 10; // Wide zoom for many markers
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



  // Function to fly to marker position
  const flyToMarker = (lat, lng) => {
    try {
      if (mapInstance && !mapInstance._removed) {
        mapInstance.setView([lat, lng], 16, {
          animate: true,
          duration: 1
        });
      }
    } catch (error) {
      console.warn('Error flying to marker:', error);
    }
  };

  // Handle map ready
  const handleMapReady = (map) => {
    setMapInstance(map);
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
        className="h-96 w-full rounded-lg"
        style={{ zIndex: 1 }}
      >
        <MapController onMapReady={handleMapReady} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        
        {complaintsWithLocation.map((complaint, index) => (
          <Marker
            key={`${complaint._id}-${index}`}
            position={[complaint.location.lat, complaint.location.lng]}
            icon={createCustomIcon(complaint)}
            eventHandlers={{
              click: () => {
                flyToMarker(complaint.location.lat, complaint.location.lng);
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
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg z-10">
        <h4 className="text-sm font-semibold mb-2">คำอธิบาย</h4>
        <div className="space-y-2 text-xs">
          <div>
            <p className="font-medium mb-1">สถานะ:</p>
            <div className="space-y-1">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                <span>อยู่ระหว่างดำเนินการ</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                <span>ดำเนินการเสร็จสิ้น</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium mb-1">หมุดพิกัด:</p>
            <p className="text-gray-600">แสดงไอคอนตามประเภทปัญหา</p>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <button
              onClick={() => {
                try {
                  if (complaintsWithLocation.length > 0 && mapInstance && !mapInstance._removed) {
                    // Use setView instead of fitBounds for better compatibility
                    const center = getMapCenter();
                    const zoom = getMapZoom();
                    mapInstance.setView(center, zoom, {
                      animate: true,
                      duration: 1
                    });
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
