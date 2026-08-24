// components/smart-school/admin/MapPoints.js
// แผนที่ผู้สมัคร — หมุดสีตามกลุ่มเปราะบาง 2 สถานะ (มาก=เขียว · น้อย=แดง)
// + คลัสเตอร์ตามพิกัด (รวมหมุดใกล้กัน ซูมแล้วแตก) + ไฮไลต์กลุ่มที่น่าจะบ้านเดียวกัน (วงสีทอง)
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import { MapContainer, Marker, Popup, GeoJSON, Circle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { FaMapMarkerAlt, FaSchool, FaUniversity, FaBaby, FaUserGraduate } from 'react-icons/fa';
import { cardCls } from '@/components/smart-school/adminTheme';
import { BaseLayersControl } from '@/components/MapBaseTileLayers';
import { vulnerabilityLevel, perCapitaDailyIncome } from '@/lib/smart-school/vulnerability';

// ป้องกัน marker icon หายในบางระบบ
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

// 2 สถานะเปราะบาง: มาก (เขียว) · น้อย (แดง) — ตรงกับสีในตาราง
const VULN_MAP = {
  high: { color: '#16A34A', label: 'เปราะบางมาก' },
  low: { color: '#DC2626', label: 'เปราะบางน้อย' },
};
// high+medium ในตาราง = "เปราะบางมาก" ทั้งคู่ → บนแผนที่รวมเป็นเขียว, low = แดง
const mapKind = (item) => (vulnerabilityLevel(item) === 'low' ? 'low' : 'high');

const HOUSEHOLD_RADIUS_M = 15; // จุดที่อยู่ในรัศมีนี้ = น่าจะบ้านเดียวกัน
const HOME_COLOR = '#D97706';   // วงสีทองไฮไลต์บ้านเดียวกัน
const CLUSTER_COLOR = '#6D28D9'; // วงตัวเลขม่วง (หลายจุดใกล้กัน)

const levelLetter = (level) =>
  ({ 'อนุบาล': 'อ', 'ประถม': 'ป', 'มัธยมต้น': 'ม', 'มัธยมปลาย': 'ม',
     'ปวช': 'ช', 'ปวช.': 'ช', 'ปวส': 'ส', 'ปวส.': 'ส', 'ปริญญาตรี': 'ต' }[level] || '?');

const hasCoords = (it) =>
  it.location && typeof it.location.lat === 'number' && typeof it.location.lng === 'number';

// ระยะเป็นเมตร (equirectangular approx — พอสำหรับระยะสั้นในเขตเทศบาล)
function distM(a, b) {
  const R = 6371000, toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad * Math.cos(((a.lat + b.lat) / 2) * toRad);
  return Math.sqrt(dLat * dLat + dLng * dLng) * R;
}

// หมุดเดี่ยว: สีตามกลุ่มเปราะบาง + ตัวอักษรกลาง = ระดับชั้น
function markerIcon(item) {
  const color = VULN_MAP[mapKind(item)].color;
  return L.divIcon({
    html: `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">${levelLetter(item.educationLevel || 'ไม่ระบุ')}</div>`,
    className: 'custom-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// วงตัวเลข: หลายจุดใกล้กัน (ซูมเพื่อแยก)
function clusterIcon(count) {
  const size = Math.max(34, Math.min(58, 24 + Math.sqrt(count) * 5));
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${CLUSTER_COLOR};border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.3);">${count}</div>`,
    className: 'smart-school-cluster',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function communityPopupHtml(name) {
  const safe = String(name).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<div style="font-weight:700;font-size:13px;color:#3D3653;">🏘️ ${safe}</div>`;
}

// ติดตามระดับซูม + เก็บ instance ของ map ไว้ใช้ flyTo (นิยามนอก component กัน remount)
function MapController({ onZoom, mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    onZoom(map.getZoom());
  }, [map, mapRef, onZoom]);
  useMapEvents({ zoomend: (e) => onZoom(e.target.getZoom()) });
  return null;
}

export default function MapPoints({ data }) {
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [boundaries, setBoundaries] = useState([]);
  const [zoom, setZoom] = useState(12);
  const mapRef = useRef(null);

  // ขอบเขตชุมชนชุดเดียวกับ smart-light (จัดการที่ /admin/settings/geojson-map)
  useEffect(() => {
    fetch('/api/geojson-features')
      .then((r) => r.json())
      .then((d) => { if (d.success && Array.isArray(d.features)) setBoundaries(d.features); })
      .catch(() => {});
  }, []);

  const boundaryCollection = useMemo(() => {
    if (boundaries.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: boundaries.map((b) => ({
        type: 'Feature', geometry: b.geometry,
        properties: { name: b.name, color: b.color || '#3B82F6' },
      })),
    };
  }, [boundaries]);

  const groupedData = useMemo(() => {
    const groups = {};
    data.forEach((item) => {
      const level = item.educationLevel || 'ไม่ระบุ';
      (groups[level] = groups[level] || []).push(item);
    });
    return groups;
  }, [data]);

  const center = useMemo(() => {
    const valid = data.filter(hasCoords);
    if (valid.length === 0) return [15.259, 100.349];
    return [
      valid.reduce((s, i) => s + i.location.lat, 0) / valid.length,
      valid.reduce((s, i) => s + i.location.lng, 0) / valid.length,
    ];
  }, [data]);

  const filteredData = useMemo(() => {
    if (selectedLevel === 'all') return data;
    return data.filter((it) => (it.educationLevel || 'ไม่ระบุ') === selectedLevel);
  }, [data, selectedLevel]);

  const withCoords = useMemo(() => filteredData.filter(hasCoords), [filteredData]);

  // กลุ่มบ้านเดียวกัน (global) — จุดที่อยู่ในรัศมี ~35 ม. เกาะกลุ่มกัน (greedy)
  const householdGroups = useMemo(() => {
    const pts = withCoords;
    const used = new Array(pts.length).fill(false);
    const groups = [];
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue;
      const g = [pts[i]]; used[i] = true;
      for (let j = i + 1; j < pts.length; j++) {
        if (used[j]) continue;
        if (distM(pts[i].location, pts[j].location) <= HOUSEHOLD_RADIUS_M) { g.push(pts[j]); used[j] = true; }
      }
      if (g.length > 1) {
        const lat = g.reduce((s, m) => s + m.location.lat, 0) / g.length;
        const lng = g.reduce((s, m) => s + m.location.lng, 0) / g.length;
        const radius = Math.max(10, ...g.map((m) => distM({ lat, lng }, m.location))) + 6;
        groups.push({ members: g, lat, lng, radius });
      }
    }
    return groups;
  }, [withCoords]);

  // คลัสเตอร์ตามซูม (grid) — เซลล์เล็กลงเมื่อซูมเข้า → คลัสเตอร์แตกเอง
  const clusters = useMemo(() => {
    const cellDeg = 0.0018 * Math.pow(2, 12 - zoom); // ~200 ม. ที่ z12
    const cells = new Map();
    for (const p of withCoords) {
      const key = `${Math.floor(p.location.lat / cellDeg)}:${Math.floor(p.location.lng / cellDeg)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(p);
    }
    return [...cells.entries()].map(([key, members]) => ({
      key,
      members,
      lat: members.reduce((s, m) => s + m.location.lat, 0) / members.length,
      lng: members.reduce((s, m) => s + m.location.lng, 0) / members.length,
    }));
  }, [withCoords, zoom]);

  const LEVEL_COLORS = {
    'อนุบาล': '#FF6B9D', 'ประถม': '#FF6B35', 'มัธยมต้น': '#6BCF7F', 'มัธยมปลาย': '#4D96FF',
    'ปวช': '#9B59B6', 'ปวช.': '#9B59B6', 'ปวส': '#E67E22', 'ปวส.': '#E67E22',
    'ปริญญาตรี': '#E74C3C', 'ไม่ระบุ': '#95A5A6',
  };
  const LEVEL_ICONS = {
    'อนุบาล': <FaBaby />, 'ประถม': <FaSchool />, 'มัธยมต้น': <FaSchool />, 'มัธยมปลาย': <FaSchool />,
    'ปวช': <FaUserGraduate />, 'ปวช.': <FaUserGraduate />, 'ปวส': <FaUserGraduate />, 'ปวส.': <FaUserGraduate />,
    'ปริญญาตรี': <FaUniversity />, 'ไม่ระบุ': <FaMapMarkerAlt />,
  };

  const renderDetailPopup = (item) => {
    const level = item.educationLevel || 'ไม่ระบุ';
    const kind = mapKind(item);
    return (
      <Popup>
        <div className="p-3 min-w-[260px]">
          <h3 className="text-base font-semibold text-gray-800 mb-2">{item.prefix || ''}{item.name}</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">📚 ระดับ:</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: LEVEL_COLORS[level] + '20', color: LEVEL_COLORS[level] }}>{level}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">💠 กลุ่ม:</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: VULN_MAP[kind].color }}>{VULN_MAP[kind].label}</span>
              <span className="text-xs text-gray-500">{Math.round(perCapitaDailyIncome(item)).toLocaleString()} บ./วัน/หัว</span>
            </div>
            {item.phone && <div><span className="font-medium">📞:</span> {item.phone}</div>}
            {item.address && <div className="flex items-start gap-2"><span className="font-medium">🏠:</span> <span className="text-gray-600">{item.address}</span></div>}
            {item.note && <div className="flex items-start gap-2"><span className="font-medium">📝:</span> <span className="text-gray-600">{item.note}</span></div>}
          </div>
          {item.imageUrl?.length > 0 && (
            <div className="mt-3 flex overflow-x-auto gap-2 pb-1">
              {item.imageUrl.map((url, index) => (
                <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                  <Image src={url} alt={`${item.name || 'ผู้เรียน'} ${index + 1}`} width={80} height={60}
                    className="rounded-md object-cover hover:opacity-80 transition"
                    onError={(e) => { e.target.style.display = 'none'; }} />
                </a>
              ))}
            </div>
          )}
        </div>
      </Popup>
    );
  };

  return (
    <div className="space-y-4">
      {/* ตัวกรองระดับการศึกษา */}
      <div className={cardCls + ' p-4'}>
        <h3 className="text-[15px] font-bold text-[#3D3653] mb-3">กรองตามระดับการศึกษา</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelectedLevel('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${selectedLevel === 'all' ? 'bg-[#7C3AED] text-white' : 'bg-[#F1ECFB] text-[#57506A] hover:bg-[#E7DEFB]'}`}>
            ทั้งหมด ({data.length})
          </button>
          {Object.entries(groupedData).map(([level, items]) => (
            <button key={level} onClick={() => setSelectedLevel(level)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${selectedLevel === level ? 'text-white' : 'text-[#57506A] hover:bg-[#F1ECFB]'}`}
              style={{ backgroundColor: selectedLevel === level ? LEVEL_COLORS[level] : 'transparent' }}>
              <span className="text-xs">{LEVEL_ICONS[level] || <FaMapMarkerAlt />}</span>
              {level} ({items.length})
            </button>
          ))}
        </div>
      </div>

      {/* แผนที่ */}
      <div className={cardCls + ' p-4'}>
        <h3 className="text-[15px] font-bold text-[#3D3653] mb-3">
          🗺️ แผนที่ผู้สมัคร
          <span className="ml-2 text-[13px] font-normal text-[#8A8398]">({withCoords.length} จุด · {householdGroups.length} กลุ่มบ้านเดียวกัน)</span>
        </h3>
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <MapContainer center={center} zoom={12} maxZoom={21} style={{ height: '600px', width: '100%', zIndex: 0 }} className="rounded-lg">
            <MapController onZoom={setZoom} mapRef={mapRef} />
            <BaseLayersControl />

            {boundaryCollection && (
              <GeoJSON key={`boundaries-${boundaries.length}`} data={boundaryCollection}
                onEachFeature={(feature, layer) => {
                  const name = feature?.properties?.name;
                  if (name) layer.bindPopup(communityPopupHtml(name), { closeButton: false, className: 'community-popup' });
                }}
                eventHandlers={{ add: (e) => e.target.bringToBack() }}
                style={(feature) => ({
                  color: feature?.properties?.color || '#3B82F6', weight: 2, opacity: 0.55,
                  fillColor: feature?.properties?.color || '#3B82F6', fillOpacity: 0.08,
                })} />
            )}

            {/* ไฮไลต์กลุ่มน่าจะบ้านเดียวกัน (วงสีทอง) — วาดใต้หมุด */}
            {householdGroups.map((g, i) => (
              <Circle key={`hh-${i}`} center={[g.lat, g.lng]} radius={g.radius}
                pathOptions={{ color: HOME_COLOR, weight: 2, fillColor: HOME_COLOR, fillOpacity: 0.1 }}>
                <Popup>
                  <div className="p-3 min-w-[220px] max-w-[300px]">
                    <div className="font-bold text-[#B45309] mb-1.5 pr-6 leading-snug">🏠 น่าจะบ้านเดียวกัน — {g.members.length} ราย</div>
                    <ul className="text-sm list-disc pl-4 space-y-0.5">
                      {g.members.map((m) => (
                        <li key={m._id}>{m.prefix || ''}{m.name} <span className="text-gray-500">({m.educationLevel || '-'})</span></li>
                      ))}
                    </ul>
                    <div className="text-[11px] text-gray-400 mt-2 leading-snug">อยู่ในรัศมี ~{HOUSEHOLD_RADIUS_M} ม. — ควรตรวจสอบว่าเป็นครัวเรือนเดียวกันหรือไม่</div>
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* คลัสเตอร์ตามซูม: จุดเดียว = หมุดสีเปราะบาง · หลายจุด = วงตัวเลข (คลิกเพื่อซูม) */}
            {clusters.map((c) =>
              c.members.length === 1 ? (
                <Marker key={c.key} position={[c.members[0].location.lat, c.members[0].location.lng]} icon={markerIcon(c.members[0])}>
                  {renderDetailPopup(c.members[0])}
                </Marker>
              ) : (
                <Marker key={c.key} position={[c.lat, c.lng]} icon={clusterIcon(c.members.length)}
                  eventHandlers={{
                    click: () => {
                      if (mapRef.current) mapRef.current.flyTo([c.lat, c.lng], Math.min(18, mapRef.current.getZoom() + 2));
                    },
                  }} />
              )
            )}
          </MapContainer>
        </div>

        {/* legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 px-1 text-[12.5px] text-[#57506A]">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: VULN_MAP.high.color }} />เปราะบางมาก</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: VULN_MAP.low.color }} />เปราะบางน้อย</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block border-2" style={{ borderColor: HOME_COLOR }} />🏠 น่าจะบ้านเดียวกัน</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: CLUSTER_COLOR }} />หลายจุดใกล้กัน (คลิกเพื่อซูม)</span>
        </div>
      </div>

      {/* สถิติสรุป */}
      <div className={cardCls + ' p-4'}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#16A34A]">{withCoords.filter((i) => mapKind(i) === 'high').length}</div>
            <div className="text-sm text-gray-600">เปราะบางมาก</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#DC2626]">{withCoords.filter((i) => mapKind(i) === 'low').length}</div>
            <div className="text-sm text-gray-600">เปราะบางน้อย</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#D97706]">{householdGroups.length}</div>
            <div className="text-sm text-gray-600">กลุ่มบ้านเดียวกัน</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#7C3AED]">{withCoords.length}</div>
            <div className="text-sm text-gray-600">มีพิกัด (จาก {filteredData.length})</div>
          </div>
        </div>
      </div>
    </div>
  );
}
