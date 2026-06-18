import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import "leaflet/dist/leaflet.css";

// Dynamic import for the map components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

export default function ReporterInfoMap({ location }) {
  const [mapType, setMapType] = useState('street'); // 'street' or 'satellite'

  useEffect(() => {
    // Initialize Leaflet icons
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl: '/leaflet/marker-icon.png',
      shadowUrl: '/leaflet/marker-shadow.png',
    });
  }, []);

  if (!location || !location.lat || !location.lng) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 rounded-lg border text-gray-500">
        <div className="text-center">
          <div className="text-2xl mb-1">🗺️</div>
          <div className="text-xs">ไม่มีข้อมูลพิกัด</div>
        </div>
      </div>
    );
  }

  // Validate coordinates
  if (isNaN(location.lat) || isNaN(location.lng) || 
      location.lat < -90 || location.lat > 90 || 
      location.lng < -180 || location.lng > 180) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 rounded-lg border text-gray-500">
        <div className="text-center">
          <div className="text-2xl mb-1">⚠️</div>
          <div className="text-xs">พิกัดไม่ถูกต้อง</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
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
      <div className="w-full h-62 rounded-lg overflow-hidden border bg-gray-100">
        <MapContainer 
          center={[location.lat, location.lng]} 
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
          
          <Marker position={[location.lat, location.lng]}>
            <Popup>
              📍พิกัด: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}
