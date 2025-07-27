// components/education/MapEducationPoints.js
import Image from 'next/image';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// ป้องกัน marker icon หายในบางระบบ
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

export default function MapEducationPoints({ data }) {
  const center = data.length > 0 ? [data[0].location.lat, data[0].location.lng] : [15.2, 100.2];
  
  return (
    <MapContainer center={center} zoom={12} style={{ height: '500px', width: '100%', zIndex: 0, position: 'relative' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />
      {data.map((item, i) => {
        console.log(item);
        return (
          <Marker
            key={i}
            position={[item.location.lat, item.location.lng]}
          >
            <Popup>
              <div>
                <strong>{item.prefix || ''}{item.name}</strong><br />
                📚 ระดับ: {item.educationLevel || 'ไม่ระบุ'}<br />
                📞 {item.phone}<br />
                🏠 {item.address}<br />
                {item.imageUrl?.length > 0 ? (
                  <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingTop: '8px' }}>
                    {item.imageUrl.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-block', flex: '0 0 auto' }}
                      >
                        <Image
                          src={url}
                          alt={`${item.name || 'สถานศึกษา'} - รูปที่ ${index + 1}`}
                          width={160}
                          height={120}
                          style={{ borderRadius: '6px' }}
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <Image
                    src="public/default-icon.png"
                    alt="ไม่พบรูปภาพ"
                    width={200}
                    height={120}
                    style={{ borderRadius: '6px', marginTop: '8px' }}
                  />
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}