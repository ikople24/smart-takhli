import React, { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { BaseLayersControl } from "@/components/MapBaseTileLayers";

// Fix leaflet default icon issue
const fixLeafletIcon = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    iconUrl: "/leaflet/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
  });
};

// Draggable marker component
function DraggableMarker({ position, onPositionChange }) {
  const draggable = true;
  const markerRef = useRef(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newPos = marker.getLatLng();
          onPositionChange({ lat: newPos.lat, lng: newPos.lng });
        }
      },
    }),
    [onPositionChange]
  );

  return (
    <Marker
      draggable={draggable}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
}

// Click handler component
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function LocationPickerMap({ initialLocation, onLocationChange }) {
  const [position, setPosition] = useState(initialLocation || { lat: 15.253914, lng: 100.351077 });

  useEffect(() => {
    fixLeafletIcon();
  }, []);

  useEffect(() => {
    if (initialLocation?.lat && initialLocation?.lng) {
      setPosition(initialLocation);
    }
  }, [initialLocation]);

  const handlePositionChange = (newPos) => {
    setPosition(newPos);
    if (onLocationChange) {
      onLocationChange(newPos);
    }
  };

  return (
    <div className="space-y-3">
      {/* Coordinates display */}
      <div className="flex items-center justify-center gap-2 p-2 bg-emerald-50 rounded-xl">
        <span className="text-sm font-medium text-emerald-700">
          📍 {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
        </span>
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: "350px" }}>
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={16}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <BaseLayersControl />

          <DraggableMarker position={[position.lat, position.lng]} onPositionChange={handlePositionChange} />
          <MapClickHandler onMapClick={handlePositionChange} />
        </MapContainer>
      </div>

      {/* Instructions */}
      <div className="text-center text-xs text-gray-500 space-y-1">
        <p>💡 <strong>คลิก</strong>บนแผนที่เพื่อเลือกตำแหน่ง หรือ<strong>ลากหมุด</strong>เพื่อปรับตำแหน่ง</p>
        <p>สามารถเลือกมุมมองแผนที่ได้ที่มุมขวาบน</p>
      </div>
    </div>
  );
}
