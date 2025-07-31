import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

L.Icon.Default.mergeOptions({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

export default function MapDisplay({ lat, lng, showPopup = false }) {
  const defaultPosition = [13.736717, 100.523186];
  const [position, setPosition] = useState(
    lat != null && lng != null ? [lat, lng] : defaultPosition
  );

  useEffect(() => {
    if (lat != null && lng != null) {
      setPosition([lat, lng]);
    }
  }, [lat, lng]);

  return (
    <MapContainer center={position} zoom={17} style={{ height: '100%', width: '100%' }}>
      <ClickHandler onClick={(latlng) => setPosition([latlng.lat, latlng.lng])} />
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="แผนที่ถนน">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="แผนที่ดาวเทียม">
          <TileLayer
            url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            maxZoom={20}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            attribution="Google Satellite"
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      {position && (
        <Marker position={position}>
          {showPopup && (
            <Popup>
              📍 ตำแหน่งของคุณ<br />
              ละติจูด: {position[0]}<br />
              ลองจิจูด: {position[1]}
            </Popup>
          )}
        </Marker>
      )}
    </MapContainer>
  );
}
