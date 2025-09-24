import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from 'leaflet';

export default function SmallMap({ location, height = "128px" }) {
  useEffect(() => {
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
    <div className="w-full bg-gray-100 rounded-lg border overflow-hidden" style={{ height }}>
      <MapContainer 
        center={[location.lat, location.lng]} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        touchZoom={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={[location.lat, location.lng]}>
          <Popup>
            พิกัด: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
