import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import "leaflet/dist/leaflet.css";

// Dynamic import for the map components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

export default function ReporterInfoCard({ reporterInfo, onClose, onSaveCoordinates }) {
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [mapType, setMapType] = useState('street'); // 'street' or 'satellite'

  useEffect(() => {
    // Initialize Leaflet icons
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl: '/leaflet/marker-icon.png',
      shadowUrl: '/leaflet/marker-shadow.png',
    });

    if (reporterInfo?.location) {
      setCurrentLocation(reporterInfo.location);
      setNewLocation(reporterInfo.location);
    }
  }, [reporterInfo]);

  const handleLocationConfirm = (location) => {
    setNewLocation(location);
  };

  const handleSaveCoordinates = () => {
    if (onSaveCoordinates && newLocation) {
      onSaveCoordinates(newLocation);
    }
    setIsEditingLocation(false);
  };

  const handleCancel = () => {
    setNewLocation(currentLocation);
    setIsEditingLocation(false);
  };

  if (!reporterInfo) {
    return <div className="text-gray-500">No reporter information available.</div>;
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">ข้อมูลผู้แจ้ง</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="space-y-3">
          {/* Reporter Details */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">ชื่อ:</span>
                <span className="text-sm text-gray-900 ml-2">{reporterInfo?.fullName}</span>
              </div>
              {reporterInfo?.phone && (
                <button
                  className="btn btn-sm btn-success"
                  onClick={() => window.open(`tel:${reporterInfo.phone}`, '_self')}
                >
                  📞 โทรหา
                </button>
              )}
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">เบอร์โทร:</span>
              <span className="text-sm text-gray-900 ml-2">{reporterInfo?.phone}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">พิกัด:</span>
              <span className="text-sm text-gray-900 ml-2 font-mono">
                {currentLocation?.lat?.toFixed(6)}, {currentLocation?.lng?.toFixed(6)}
              </span>
            </div>
          </div>

          {/* Map Section */}
          {currentLocation && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">แผนที่:</span>
                <button
                  className="btn btn-xs btn-outline btn-info"
                  onClick={() => window.open(`https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}&z=15`, '_blank')}
                >
                  🗺️ เปิดใน Google Maps
                </button>
              </div>
              
              {/* Map Type Selector */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">ประเภทแผนที่:</span>
                <div className="flex gap-1">
                  <button
                    className={`btn btn-xs ${mapType === 'street' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setMapType('street')}
                  >
                    🗺️ ถนน
                  </button>
                  <button
                    className={`btn btn-xs ${mapType === 'satellite' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setMapType('satellite')}
                  >
                    🛰️ ดาวเทียม
                  </button>
                </div>
              </div>

              {/* Interactive Map */}
              <div className="w-full h-48 rounded-lg overflow-hidden border relative">
                <MapContainer 
                  center={[currentLocation.lat, currentLocation.lng]} 
                  zoom={15} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                  attributionControl={false}
                >
                  {mapType === 'street' ? (
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    />
                  ) : (
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="Tiles &copy; Esri"
                    />
                  )}
                  
                  <Marker position={[currentLocation.lat, currentLocation.lng]}>
                    <Popup>
                      พิกัด: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>
          )}

          {/* Coordinate Editing Section - Only show if editing is enabled */}
          {isEditingLocation && (
            <>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">การตั้งค่าพิกัด</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">กดสวิสเพื่อเปิดการใช้เครื่องมือแก้ไข</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-success"
                    checked={isEditingLocation}
                    onChange={(e) => setIsEditingLocation(e.target.checked)}
                  />
                </div>
              </div>

              {/* New Coordinates Display */}
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700">📍 พิกัดใหม่:</span>
                <span className="text-sm text-gray-900 ml-2 font-mono">
                  {newLocation?.lat?.toFixed(5)}, {newLocation?.lng?.toFixed(5)}
                </span>
              </div>

              {/* Interactive Map for Editing */}
              <div className="w-full h-64 rounded-lg overflow-hidden border">
                <MapContainer 
                  center={[newLocation?.lat || 16.79436, newLocation?.lng || 102.81687]} 
                  zoom={15} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                  />
                  
                  {newLocation && (
                    <Marker 
                      position={[newLocation.lat, newLocation.lng]}
                      draggable={true}
                      eventHandlers={{
                        dragend: (e) => {
                          const marker = e.target;
                          const position = marker.getLatLng();
                          handleLocationConfirm(position);
                        },
                      }}
                    >
                      <Popup>
                        พิกัด: {newLocation.lat.toFixed(6)}, {newLocation.lng.toFixed(6)}
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
            </>
          )}

          {/* Toggle for Editing Mode */}
          {!isEditingLocation && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">แก้ไขพิกัด</span>
                <input
                  type="checkbox"
                  className="toggle toggle-success"
                  checked={isEditingLocation}
                  onChange={(e) => setIsEditingLocation(e.target.checked)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="modal-action">
          {isEditingLocation ? (
            <>
              <button className="btn btn-error" onClick={handleCancel}>
                ยกเลิก
              </button>
              <button className="btn btn-success" onClick={handleSaveCoordinates}>
                บันทึกพิกัด
              </button>
            </>
          ) : (
            <button className="btn" onClick={onClose}>
              ปิด
            </button>
          )}
        </div>
      </div>
    </div>
  );
}