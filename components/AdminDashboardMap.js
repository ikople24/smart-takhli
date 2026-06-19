import { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Image from 'next/image';

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
import CardModalDetail from '@/components/complaints/CardModalDetail';

const { BaseLayer } = LayersControl;

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

// ฟังก์ชันย่อ–ที่ยาวเกินไป
const shortenCommunityName = (name, maxLength = 15) => {
  if (!name || name.length <= maxLength) {
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

// ฟังก์ชันปรับตำแหน่งชื่อชุมชนให้ไม่ซ้อนทับ
const adjustLabelPositions = (polygons) => {
  const adjustedPolygons = [];
  const usedPositions = new Set();
  
  polygons.forEach((polygon, index) => {
    const centerPoint = calculatePolygonCenter(polygon.coordinates);
    if (!centerPoint) return;
    
    let adjustedPosition = [...centerPoint];
    let offset = 0;
    const maxOffset = 0.01; // ระยะสูงสุดที่ย้ายได้
    const offsetStep = 0.002; // ขั้นตอนการย้าย
    
    // ตรวจสอบว่าตำแหน่งซ้อนทับหรือไม่
    while (offset <= maxOffset) {
      const positionKey = `${adjustedPosition[0].toFixed(4)},${adjustedPosition[1].toFixed(4)}`;
      
      if (!usedPositions.has(positionKey)) {
        usedPositions.add(positionKey);
        break;
      }
      
      // ย้ายตำแหน่งในรูปแบบวงกลม
      const angle = (index * 45 + offset * 100) * (Math.PI / 180);
      adjustedPosition = [
        centerPoint[0] + Math.cos(angle) * offset,
        centerPoint[1] + Math.sin(angle) * offset
      ];
      
      offset += offsetStep;
    }
    
    adjustedPolygons.push({
      ...polygon,
      adjustedCenter: adjustedPosition
    });
  });
  
  return adjustedPolygons;
};

// Component to handle map instance
const MapController = ({ onMapReady }) => {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      // รอให้ map พร้อมใช้งาน
      const checkMapReady = () => {
        if (map && !map._removed && map._loaded && map._mapPane && map._mapPane._leaflet_pos) {
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
  const [fullscreenMapInstance, setFullscreenMapInstance] = useState(null);
  const [showPolygons, setShowPolygons] = useState(false);
  const [showCommunityLabels, setShowCommunityLabels] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const { menu, fetchMenu, menuLoading } = useMenuStore();

  // Handle opening detail modal
  const handleOpenDetail = useCallback((complaint) => {
    setSelectedComplaint(complaint);
  }, []);

  // Handle closing detail modal
  const handleCloseDetail = useCallback(() => {
    setSelectedComplaint(null);
  }, []);

  // Filter complaints with valid location data
  const complaintsWithLocation = useMemo(() => {
    return complaints?.filter(complaint => 
      complaint.location && 
      typeof complaint.location.lat === 'number' && 
      typeof complaint.location.lng === 'number' &&
      !isNaN(complaint.location.lat) && 
      !isNaN(complaint.location.lng)
    ) || [];
  }, [complaints]);

  // Calculate center point and zoom for map
  const getMapCenter = useCallback(() => {
    // ถ้ามี polygon ให้ใช้จุดศูนย์กลางของ polygon ทั้งหมด
    if (polygons && polygons.length > 0) {
      let totalLat = 0;
      let totalLng = 0;
      let validPolygons = 0;
      
      polygons.forEach(polygon => {
        if (polygon.coordinates && polygon.coordinates.length > 0) {
          const centerPoint = calculatePolygonCenter(polygon.coordinates);
          if (centerPoint && !isNaN(centerPoint[0]) && !isNaN(centerPoint[1])) {
            totalLat += centerPoint[0];
            totalLng += centerPoint[1];
            validPolygons++;
          }
        }
      });
      
      if (validPolygons > 0) {
        return [totalLat / validPolygons, totalLng / validPolygons];
      }
    }
    
    // Fallback: ใช้พิกัดของ complaints
    if (complaintsWithLocation.length === 0) {
      return [18.7883, 99.0000]; // พิกัดกลางของจังหวัดเชียงใหม่
    }
    
    // Calculate the center of all markers
    const totalLat = complaintsWithLocation.reduce((sum, complaint) => sum + complaint.location.lat, 0);
    const totalLng = complaintsWithLocation.reduce((sum, complaint) => sum + complaint.location.lng, 0);
    
    return [totalLat / complaintsWithLocation.length, totalLng / complaintsWithLocation.length];
  }, [polygons, complaintsWithLocation]);

  const getMapZoom = useCallback(() => {
    // ถ้ามี polygon ให้ปรับ zoom ให้เหมาะสมกับ polygon
    if (polygons && polygons.length > 0) {
      if (polygons.length === 1) {
        return 17; // Zoom เข้าใกล้สำหรับ polygon เดียว (ลดจาก 18 เป็น 17 = -1 ระดับ)
      } else if (polygons.length <= 5) {
        return 15; // Zoom ปานกลางสำหรับ polygon น้อย (ลดจาก 16 เป็น 15 = -1 ระดับ)
      } else {
        return 14; // Zoom ออกสำหรับ polygon หลายตัว (ลดจาก 15 เป็น 14 = -1 ระดับ)
      }
    }
    
    // Fallback: ใช้ zoom ตาม complaints
    if (complaintsWithLocation.length === 0) {
      return 14; // Default zoom สำหรับจังหวัดเชียงใหม่ (ลดจาก 15 เป็น 14 = -1 ระดับ)
    }
    
    // Calculate appropriate zoom based on number of markers
    if (complaintsWithLocation.length === 1) {
      return 18; // Close zoom for single marker (ลดจาก 19 เป็น 18 = -1 ระดับ)
    } else if (complaintsWithLocation.length <= 5) {
      return 16; // Medium zoom for few markers (ลดจาก 17 เป็น 16 = -1 ระดับ)
    } else {
      return 14; // Wide zoom for many markers (ลดจาก 15 เป็น 14 = -1 ระดับ)
    }
  }, [polygons, complaintsWithLocation]);

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
          iconSize: [32, 32],
          iconAnchor: [16, 16]
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
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  };

  // Fetch menu data on component mount
  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);



  // Force re-render when complaints change (but not for fullscreen)
  useEffect(() => {
    if (!isFullscreen) {
      setMapKey(prev => prev + 1);
    }
  }, [complaints, isFullscreen]);

  // Show polygons when data is loaded
  useEffect(() => {
    if (polygons && polygons.length > 0) {
      setShowPolygons(true);
      
      // ปรับแผนที่ให้อยู่กึ่งกลางของ polygon เมื่อโหลดครั้งแรก
      // รอให้ map พร้อมใช้งานอย่างสมบูรณ์
      const adjustMapView = () => {
        if (mapInstance && !mapInstance._removed && mapInstance._loaded && mapInstance._mapPane) {
          try {
            const center = getMapCenter();
            const zoom = getMapZoom();
            mapInstance.setView(center, zoom, {
              animate: true,
              duration: 1
            });
          } catch (error) {
            console.warn('Error adjusting map view:', error);
            // ลองใหม่อีกครั้งหลังจากรอสักครู่
            setTimeout(adjustMapView, 500);
          }
        } else {
          // ถ้า map ยังไม่พร้อม ให้ลองใหม่อีกครั้ง
          setTimeout(adjustMapView, 200);
        }
      };
      
      // เริ่มต้นการปรับแผนที่หลังจากรอให้ map พร้อม
      setTimeout(adjustMapView, 1000);
    }
  }, [polygons, mapInstance, getMapCenter, getMapZoom]);

  // Update fullscreen map when polygons change (but don't force center)
  useEffect(() => {
    if (isFullscreen && fullscreenMapInstance && polygons && polygons.length > 0) {
      // ไม่บังคับให้แผนที่เต็มจอกลับไปตำแหน่งเดิม
      // ให้ผู้ใช้สามารถเลื่อนและซูมได้อย่างอิสระ
      console.log('Fullscreen map polygons updated, but keeping current view');
    }
  }, [polygons, isFullscreen, fullscreenMapInstance]);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      // กำลังจะเข้าสู่โหมดเต็มจอ - บันทึกตำแหน่งปัจจุบันของแผนที่ปกติ
      if (mapInstance && !mapInstance._removed && mapInstance._loaded) {
        const currentCenter = mapInstance.getCenter();
        const currentZoom = mapInstance.getZoom();
        // เก็บตำแหน่งปัจจุบันไว้ใน localStorage
        localStorage.setItem('mapCenter', JSON.stringify([currentCenter.lat, currentCenter.lng]));
        localStorage.setItem('mapZoom', currentZoom.toString());
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isFullscreen]);

  // Handle fullscreen map ready
  const handleFullscreenMapReady = (map) => {
    const checkMapReady = () => {
      if (map && !map._removed && map._loaded && map._mapPane && map._mapPane._leaflet_pos) {
        setFullscreenMapInstance(map);
        
        // ใช้ตำแหน่งที่บันทึกไว้ หรือใช้ตำแหน่งเริ่มต้น
        const savedCenter = localStorage.getItem('mapCenter');
        const savedZoom = localStorage.getItem('mapZoom');
        
        if (savedCenter && savedZoom) {
          try {
            const center = JSON.parse(savedCenter);
            const zoom = parseInt(savedZoom);
            map.setView(center, zoom, { animate: false });
          } catch (error) {
            console.warn('Error loading saved map position:', error);
            // ใช้ตำแหน่งเริ่มต้น
            const center = getMapCenter();
            const zoom = getMapZoom();
            map.setView(center, zoom, { animate: false });
          }
        } else {
          // ใช้ตำแหน่งเริ่มต้น
          const center = getMapCenter();
          const zoom = getMapZoom();
          map.setView(center, zoom, { animate: false });
        }
      } else {
        setTimeout(checkMapReady, 100);
      }
    };
    
    setTimeout(checkMapReady, 200);
  };



  // Function to fly to marker position
  const flyToMarker = (lat, lng) => {
    try {
      if (mapInstance && !mapInstance._removed && mapInstance._loaded && mapInstance._mapPane) {
        // ตรวจสอบว่า map พร้อมใช้งาน
        const flyToPosition = () => {
          if (mapInstance && !mapInstance._removed && mapInstance._mapPane && mapInstance._mapPane._leaflet_pos) {
            try {
              mapInstance.setView([lat, lng], 19, { // ลดจาก 20 เป็น 19 = -1 ระดับ
                animate: true,
                duration: 1
              });
            } catch (error) {
              console.warn('Error flying to marker:', error);
            }
          } else {
            // ถ้า map ยังไม่พร้อม ให้ลองใหม่อีกครั้ง
            setTimeout(flyToPosition, 100);
          }
        };
        
        setTimeout(flyToPosition, 100);
      }
    } catch (error) {
      console.warn('Error flying to marker:', error);
    }
  };

  // Handle map ready
  const handleMapReady = (map) => {
    // รอให้ map พร้อมใช้งานก่อน
    const checkMapReady = () => {
      if (map && !map._removed && map._loaded && map._mapPane && map._mapPane._leaflet_pos) {
        map._loaded = true;
        setMapInstance(map);
      } else {
        // ถ้า map ยังไม่พร้อม ให้ลองใหม่อีกครั้ง
        setTimeout(checkMapReady, 100);
      }
    };
    
    // เริ่มต้นตรวจสอบหลังจาก map initialize
    setTimeout(checkMapReady, 200);
  };

  if (!complaints || complaints.length === 0) {
    return (
      <div className="h-[600px] w-full rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-2xl shadow-lg flex items-center justify-center">
            <span className="text-4xl">🗺️</span>
          </div>
          <p className="text-slate-600 font-medium">ไม่มีข้อมูลในกรอบเวลาที่เลือก</p>
          <p className="text-slate-400 text-sm mt-1">ลองเปลี่ยนช่วงเวลาหรือตัวกรอง</p>
        </div>
      </div>
    );
  }

  if (complaintsWithLocation.length === 0) {
    return (
      <div className="h-[600px] w-full rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-2xl shadow-lg flex items-center justify-center">
            <span className="text-4xl">📍</span>
          </div>
          <p className="text-slate-600 font-medium">ไม่มีข้อมูลตำแหน่งในกรอบเวลาที่เลือก</p>
          <p className="text-slate-400 text-sm mt-1">ลองเปลี่ยนช่วงเวลาหรือตัวกรอง</p>
        </div>
      </div>
    );
  }

  // Show loading state while menu is loading
  if (menuLoading) {
    return (
      <div className="h-[600px] w-full rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">กำลังโหลดแผนที่...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fullscreen Map */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <div className="relative w-full h-full">
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 z-10 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              <span>✕</span>
              <span>ปิดเต็มจอ</span>
            </button>
            <MapContainer
              key={`fullscreen-${mapKey}`}
              center={getMapCenter()}
              zoom={getMapZoom()}
              className="w-full h-full"
              style={{ zIndex: 1 }}
            >
              <MapController onMapReady={handleFullscreenMapReady} />
              <LayersControl
                position="bottomleft"
                className="custom-layers-control"
              >
                <BaseLayer checked name="🗺️ แผนที่ถนน">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                </BaseLayer>
                <BaseLayer name="🛰️ แผนที่ดาวเทียม">
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri"
                  />
                </BaseLayer>
              </LayersControl>
              
              {/* Render Polygons for Fullscreen */}
              {showPolygons && (() => {
                const adjustedPolygons = adjustLabelPositions(polygons);
                return adjustedPolygons.map((polygon, index) => {
                  const uniqueKey = `fullscreen-polygon-${polygon.id || polygon.name || `index-${index}`}-${index}`;
                  const centerPoint = calculatePolygonCenter(polygon.coordinates);
                  
                  if (!centerPoint || isNaN(centerPoint[0]) || isNaN(centerPoint[1])) {
                    return null;
                  }
                  
                  const labelPosition = polygon.adjustedCenter || centerPoint;
                  const shortenedName = shortenCommunityName(polygon.name);
                  
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
                      />
                      
                      {showCommunityLabels && (
                        <Marker
                          position={labelPosition}
                          icon={L.divIcon({
                            className: 'community-label-marker',
                            html: `
                              <div class="community-label" style="
                                background-color: rgba(255, 255, 255, 0.95);
                                border: 2px solid ${polygon.color || '#3b82f6'};
                                border-radius: 6px;
                                padding: 4px 8px;
                                font-size: 11px;
                                font-weight: 600;
                                color: ${polygon.color || '#3b82f6'};
                                white-space: nowrap;
                                box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                                pointer-events: none;
                                text-align: center;
                                min-width: 80px;
                                max-width: 120px;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                z-index: 1000;
                                cursor: help;
                                user-select: none;
                                line-height: 1.2;
                              " title="${polygon.name}">
                                ${shortenedName}
                              </div>
                            `,
                            iconSize: [120, 30],
                            iconAnchor: [60, 15]
                          })}
                        />
                      )}
                    </div>
                  );
                });
              })()}
              
              {complaintsWithLocation.map((complaint, index) => (
                <Marker
                  key={`fullscreen-marker-${complaint._id || complaint.id || index}`}
                  position={[complaint.location.lat, complaint.location.lng]}
                  icon={createCustomIcon(complaint)}
                >
                  <Popup className="custom-popup">
                    <div className="popup-modern">
                      {/* Header */}
                      <div 
                        className="popup-modern-header"
                        style={{
                          '--popup-color': getMarkerColor(complaint.status),
                          '--popup-color-dark': complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น' ? '#059669' : '#1d4ed8'
                        }}
                      >
                        <div className="popup-modern-title">
                          <div className="popup-modern-title-icon">
                            {(() => {
                              const categoryIcon = menu?.find(m => m.Prob_name === complaint.category)?.Prob_pic;
                              return categoryIcon ? (
                                <Image src={categoryIcon} alt={complaint.category || ''} width={24} height={24} unoptimized />
                              ) : (
                                <span>{getStatusIcon(complaint.status)}</span>
                              );
                            })()}
                          </div>
                          <span>{complaint.category || 'ไม่ระบุประเภท'}</span>
                        </div>
                      </div>
                      
                      {/* Body */}
                      <div className="popup-modern-body">
                        <div className="popup-modern-row">
                          <div className="popup-modern-row-icon" style={{ background: '#f1f5f9' }}>📝</div>
                          <div className="popup-modern-row-content">
                            <div className="popup-modern-row-label">รายละเอียด</div>
                            <div className="popup-modern-row-value">{complaint.detail?.substring(0, 80) || 'ไม่มีรายละเอียด'}...</div>
                          </div>
                        </div>
                        <div className="popup-modern-row">
                          <div className="popup-modern-row-icon" style={{ background: '#e0e7ff' }}>🏘️</div>
                          <div className="popup-modern-row-content">
                            <div className="popup-modern-row-label">ชุมชน</div>
                            <div className="popup-modern-row-value">{complaint.community || 'ไม่ระบุ'}</div>
                          </div>
                        </div>
                        <div className="popup-modern-row">
                          <div className="popup-modern-row-icon" style={{ background: '#fef3c7' }}>👤</div>
                          <div className="popup-modern-row-content">
                            <div className="popup-modern-row-label">ผู้แจ้ง</div>
                            <div className="popup-modern-row-value">
                              {(() => {
                                const name = complaint.fullName || 'ไม่ระบุ';
                                if (name === 'ไม่ระบุ') return name;
                                const parts = name.trim().split(/\s+/);
                                if (parts.length >= 2) {
                                  return `${parts[0]} XXXXX`;
                                }
                                return name;
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="popup-modern-row">
                          <div className="popup-modern-row-icon" style={{ background: complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น' ? '#dcfce7' : '#dbeafe' }}>
                            {complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น' ? '✅' : '🔄'}
                          </div>
                          <div className="popup-modern-row-content">
                            <div className="popup-modern-row-label">สถานะ • {new Date(complaint.timestamp || complaint.createdAt).toLocaleDateString('th-TH')}</div>
                            <div className="popup-modern-row-value">
                              <span className={`popup-modern-status ${complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น' ? 'completed' : 'in_progress'}`}>
                                <span>{complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น' ? '✓' : '●'}</span>
                                {getStatusText(complaint.status)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Normal Map */}
      <div className="relative">
        <MapContainer
          key={mapKey}
          center={getMapCenter()}
          zoom={getMapZoom()}
          className="h-[600px] w-full rounded-2xl"
          style={{ zIndex: 1 }}
        >
        <MapController onMapReady={handleMapReady} />
        <LayersControl
          position="bottomleft"
          className="custom-layers-control"
          onAdd={() => {
            // console.log('🗺️ LayersControl added at bottomleft');
            // Force positioning after component is added
            setTimeout(() => {
              const layersControl = document.querySelector('.leaflet-control-layers');
              if (layersControl) {
                layersControl.style.bottom = '10px';
                layersControl.style.left = '10px';
                layersControl.style.top = 'auto';
                layersControl.style.right = 'auto';
                // console.log('🗺️ Forced LayersControl positioning');
              }
            }, 100);
          }}
        >
          {/* 🗺️ แผนที่ถนน */}
          <BaseLayer checked name="🗺️ แผนที่ถนน">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
          </BaseLayer>

          {/* 🛰️ แผนที่ดาวเทียม */}
          <BaseLayer name="🛰️ แผนที่ดาวเทียม">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
            />
          </BaseLayer>
        </LayersControl>
        
        {/* Render Polygons */}
        {showPolygons && (() => {
          // ปรับตำแหน่งชื่อชุมชนให้ไม่ซ้อนทับ
          const adjustedPolygons = adjustLabelPositions(polygons);
          
          return adjustedPolygons.map((polygon, index) => {
            // สร้าง unique key ที่ปลอดภัย
            const uniqueKey = `polygon-${polygon.id || polygon.name || `index-${index}`}-${index}`;
            
            // คำนวณจุดศูนย์กลางของ polygon สำหรับแสดงชื่อ
            const centerPoint = calculatePolygonCenter(polygon.coordinates);
            
            // ตรวจสอบว่าจุดศูนย์กลางถูกต้อง
            if (!centerPoint || isNaN(centerPoint[0]) || isNaN(centerPoint[1])) {
              console.warn(`Invalid center point for polygon ${polygon.name}:`, centerPoint);
              return null;
            }
            
            // ใช้ตำแหน่งที่ปรับแล้วสำหรับชื่อชุมชน
            const labelPosition = polygon.adjustedCenter || centerPoint;
            const shortenedName = shortenCommunityName(polygon.name);
            
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
                    {polygon.popup.content ? (
                      <div 
                        dangerouslySetInnerHTML={{ __html: polygon.popup.content }}
                      />
                    ) : (
                      <>
                        {polygon.popup.title && <h3 className="popup-title">{polygon.popup.title}</h3>}
                        {polygon.popup.description && (
                          <p className="popup-text">{polygon.popup.description}</p>
                        )}
                      </>
                    )}
                  </div>
                </Popup>
              )}
                </Polygon>
                
                {/* แสดงชื่อชุมชนที่ตำแหน่งที่ปรับแล้ว */}
                {showCommunityLabels && (
                  <Marker
                    position={labelPosition}
                    icon={L.divIcon({
                      className: 'community-label-marker',
                      html: `
                        <div class="community-label" style="
                          background-color: rgba(255, 255, 255, 0.95);
                          border: 2px solid ${polygon.color || '#3b82f6'};
                          border-radius: 6px;
                          padding: 4px 8px;
                          font-size: 11px;
                          font-weight: 600;
                          color: ${polygon.color || '#3b82f6'};
                          white-space: nowrap;
                          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                          pointer-events: none;
                          text-align: center;
                          min-width: 80px;
                          max-width: 120px;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          z-index: 1000;
                          cursor: help;
                          user-select: none;
                          line-height: 1.2;
                        " title="${polygon.name}">
                          ${shortenedName}
                        </div>
                      `,
                      iconSize: [120, 30],
                      iconAnchor: [60, 15]
                    })}
                  />
                )}
              </div>
            );
          });
        })()}
        
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
            <Popup className="custom-popup">
              <div className="popup-modern">
                {/* Header with gradient */}
                <div 
                  className="popup-modern-header"
                  style={{
                    '--popup-color': getMarkerColor(complaint.status),
                    '--popup-color-dark': complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น' ? '#059669' : '#1d4ed8'
                  }}
                >
                  <div className="popup-modern-title">
                    <div className="popup-modern-title-icon">
                      {(() => {
                        const categoryIcon = menu?.find(m => m.Prob_name === complaint.category)?.Prob_pic;
                        return categoryIcon ? (
                          <Image src={categoryIcon} alt={complaint.category || ''} width={24} height={24} unoptimized />
                        ) : (
                          <span>{getStatusIcon(complaint.status)}</span>
                        );
                      })()}
                    </div>
                    <span>{complaint.category || 'ไม่ระบุประเภท'}</span>
                  </div>
                </div>
                
                {/* Body content */}
                <div className="popup-modern-body">
                  {/* Detail */}
                  <div className="popup-modern-row">
                    <div className="popup-modern-row-icon" style={{ background: '#f1f5f9' }}>
                      📝
                    </div>
                    <div className="popup-modern-row-content">
                      <div className="popup-modern-row-label">รายละเอียด</div>
                      <div className="popup-modern-row-value">
                        {complaint.detail?.substring(0, 80) || 'ไม่มีรายละเอียด'}...
                      </div>
                    </div>
                  </div>
                  
                  {/* Community - First */}
                  <div className="popup-modern-row">
                    <div className="popup-modern-row-icon" style={{ background: '#e0e7ff' }}>
                      🏘️
                    </div>
                    <div className="popup-modern-row-content">
                      <div className="popup-modern-row-label">ชุมชน</div>
                      <div className="popup-modern-row-value">{complaint.community || 'ไม่ระบุ'}</div>
                    </div>
                  </div>
                  
                  {/* Reporter - Second (Censored last name) */}
                  <div className="popup-modern-row">
                    <div className="popup-modern-row-icon" style={{ background: '#fef3c7' }}>
                      👤
                    </div>
                    <div className="popup-modern-row-content">
                      <div className="popup-modern-row-label">ผู้แจ้ง</div>
                      <div className="popup-modern-row-value">
                        {(() => {
                          const name = complaint.fullName || 'ไม่ระบุ';
                          if (name === 'ไม่ระบุ') return name;
                          const parts = name.trim().split(/\s+/);
                          if (parts.length >= 2) {
                            return `${parts[0]} XXXXX`;
                          }
                          return name;
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Status & Date - Moved from Community position */}
                  <div className="popup-modern-row">
                    <div className="popup-modern-row-icon" style={{ background: complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น' ? '#dcfce7' : '#dbeafe' }}>
                      {complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น' ? '✅' : '🔄'}
                    </div>
                    <div className="popup-modern-row-content">
                      <div className="popup-modern-row-label">สถานะ • {new Date(complaint.timestamp || complaint.createdAt).toLocaleDateString('th-TH')}</div>
                      <div className="popup-modern-row-value">
                        <span className={`popup-modern-status ${complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น' ? 'completed' : 'in_progress'}`}>
                          <span>{complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น' ? '✓' : '●'}</span>
                          {getStatusText(complaint.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Footer with action button */}
                <div className="popup-modern-footer">
                  <button
                    onClick={() => handleOpenDetail(complaint)}
                    className="popup-modern-btn"
                  >
                    <span>📋</span>
                    <span>ดูรายละเอียด</span>
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Legend - Modern Design */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl z-10 w-72 max-h-[500px] overflow-y-auto border border-slate-200/50">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-800">คำอธิบายแผนที่</h4>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all flex items-center gap-1.5 shadow-md"
            title="ขยายเต็มจอ"
          >
            <span>⛶</span>
            <span>เต็มจอ</span>
          </button>
        </div>
        
        {/* สรุปข้อมูล */}
        {polygons.length > 0 && (
          <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl text-xs border border-blue-100">
            <p className="font-semibold text-blue-800 mb-2">📊 สรุปข้อมูล</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/80 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-blue-600">{polygons.length}</div>
                <div className="text-blue-700 text-xs">ชุมชน</div>
              </div>
              <div className="bg-white/80 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-emerald-600">{complaintsWithLocation.length}</div>
                <div className="text-emerald-700 text-xs">หมุด</div>
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-4 text-xs">
          <div>
            <p className="font-semibold text-slate-700 mb-2">สถานะหมุด</p>
            <div className="flex gap-4">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 mr-2 shadow-sm"></div>
                <span className="text-slate-600">ดำเนินการ</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 mr-2 shadow-sm"></div>
                <span className="text-slate-600">เสร็จสิ้น</span>
              </div>
            </div>
          </div>
          
          {polygons.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-slate-700">
                  {polygons.some(p => p.boundaryor) ? 'ชุมชน' : 'พื้นที่ปัญหา'}
                </p>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{polygons.length}</span>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                {polygons.map((polygon, index) => (
                  <div key={`legend-polygon-${polygon.id || polygon.name || `index-${index}`}-${index}`} className="flex items-center hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
                    <div 
                      className="w-3 h-3 mr-2 flex-shrink-0 rounded" 
                      style={{ 
                        backgroundColor: polygon.color,
                        boxShadow: `0 0 0 1px ${polygon.color}20`
                      }}
                    ></div>
                    <span className="text-xs text-slate-600 truncate">{polygon.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => setShowPolygons(!showPolygons)}
                  className={`w-full px-3 py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    showPolygons 
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' 
                      : 'bg-gradient-to-r from-slate-600 to-slate-700 text-white'
                  }`}
                >
                  {showPolygons ? '🔽 ซ่อนพื้นที่ชุมชน' : '🔼 แสดงพื้นที่ชุมชน'}
                </button>
                <button
                  onClick={() => setShowCommunityLabels(!showCommunityLabels)}
                  className={`w-full px-3 py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    showCommunityLabels
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {showCommunityLabels ? '✓ ชื่อชุมชน: เปิด' : '○ ชื่อชุมชน: ปิด'}
                </button>
              </div>
            </div>
          )}
          
          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                try {
                  if (complaintsWithLocation.length > 0 && mapInstance && !mapInstance._removed && mapInstance._loaded && mapInstance._mapPane) {
                    const centerMap = () => {
                      if (mapInstance && !mapInstance._removed && mapInstance._mapPane && mapInstance._mapPane._leaflet_pos) {
                        try {
                          const center = getMapCenter();
                          const zoom = getMapZoom();
                          mapInstance.setView(center, zoom, { animate: true, duration: 1 });
                        } catch (error) {
                          console.warn('Error centering map:', error);
                        }
                      } else {
                        setTimeout(centerMap, 100);
                      }
                    };
                    setTimeout(centerMap, 100);
                  }
                } catch (error) {
                  console.warn('Error setting view:', error);
                }
              }}
              className="w-full px-3 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>🗺️</span>
              <span>จัดกึ่งกลาง ({complaintsWithLocation.length} ตำแหน่ง)</span>
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* CardModalDetail for viewing complaint details */}
      <CardModalDetail 
        modalData={selectedComplaint} 
        onClose={handleCloseDetail} 
      />
    </>
  );
};

export default AdminDashboardMap;


