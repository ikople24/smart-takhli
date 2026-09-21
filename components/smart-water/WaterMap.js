// แผนที่ทะเบียนท่อประปา — มี leaflet ข้างใน ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
import { useEffect } from "react";
import { MapContainer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { BaseLayersControl } from "@/components/MapBaseTileLayers";
import { CODE_COLORS, FALLBACK_COLOR, NODE_STYLE } from "@/lib/smart-water/constants";
import {
  escapeHtml as esc,
  pipeStatusLabel,
  nodeTypeLabel,
  nodeConditionLabel,
} from "@/lib/smart-water/labels";

const TAKHLI_CENTER = [15.2605, 100.3555];

// สีตามรหัสท่อ (ชนิด+ขนาด) ให้ตรงกับแบบที่กองการประปาใช้ — ไม่ใช่ตามชนิดวัสดุ
function colorOf(code) {
  return CODE_COLORS[code] ?? FALLBACK_COLOR;
}

function weightOf(diameterMm) {
  if (diameterMm >= 300) return 6;
  if (diameterMm >= 150) return 4.5;
  if (diameterMm >= 100) return 3.5;
  return 2.5;
}

function pipeStyle(feature) {
  const p = feature.properties;
  return {
    color: colorOf(p.code),
    weight: weightOf(p.diameterMm ?? 50),
    opacity: p.status === "abandoned" ? 0.35 : 0.9,
    dashArray: p.status === "planned" ? "6,6" : undefined,
  };
}

function onEachPipe(feature, layer) {
  const p = feature.properties;
  const conf = p.sourceDoc?.confidence;
  const warn =
    conf === "low"
      ? '<div style="color:#b45309;margin-top:4px">⚠ ข้อมูลความเชื่อมั่นต่ำ ระยะเป็นค่าประมาณ</div>'
      : "";
  layer.bindPopup(`
    <div style="font-family:inherit;min-width:180px">
      <div style="font-weight:600;font-size:14px">${esc(p.code)} — ${esc(p.material)}</div>
      <div>ขนาด ${esc(p.diameter?.value)} ${esc(p.diameter?.unit)}</div>
      <div>ถนน: ${esc(p.roadName ?? "-")}</div>
      <div>ความยาว: <b>${esc(conf === "low" ? Math.round(p.lengthM) : p.lengthM)} ม.</b></div>
      <div>สถานะ: ${esc(pipeStatusLabel(p.status))}</div>
      <div>ปีที่วาง: ${esc(p.installedYear ?? "-")}</div>
      ${warn}
    </div>
  `);
}

function nodeToLayer(feature, latlng) {
  const s = NODE_STYLE[feature.properties.type] ?? { color: "#000", fill: true };
  return L.circleMarker(latlng, {
    radius: feature.properties.type === "hydrant" ? 7 : 5,
    color: s.color,
    weight: 2,
    fillColor: s.fill ? s.color : "#ffffff",
    fillOpacity: 1,
  });
}

function onEachNode(feature, layer) {
  const p = feature.properties;
  layer.bindPopup(`
    <div style="font-family:inherit">
      <div style="font-weight:600">${esc(p.hydrantNo ?? nodeTypeLabel(p.type))}</div>
      <div>ชนิด: ${esc(nodeTypeLabel(p.type))}</div>
      ${p.size ? `<div>ขนาด: ${esc(p.size)}</div>` : ""}
      <div>สภาพ: ${esc(nodeConditionLabel(p.condition))}</div>
      ${p.accessNote ? `<div>หมายเหตุ: ${esc(p.accessNote)}</div>` : ""}
    </div>
  `);
}

// ซูมให้พอดีข้อมูลครั้งแรกที่โหลด (รวมทั้งท่อและอุปกรณ์)
function FitToData({ pipes, nodes }) {
  const map = useMap();
  useEffect(() => {
    const features = [pipes, nodes]
      .filter((d) => d?.features?.length)
      .flatMap((d) => d.features);
    if (!features.length) return;
    const b = L.geoJSON({ type: "FeatureCollection", features }).getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [40, 40] });
  }, [map, pipes, nodes]);
  return null;
}

export default function WaterMap({ pipes, nodes }) {
  return (
    <MapContainer center={TAKHLI_CENTER} zoom={15} className="h-full w-full">
      <BaseLayersControl />
      {/* react-leaflet v5: <GeoJSON> ไม่รีเรนเดอร์เมื่อ data เปลี่ยน — หน้าเพจ mount แผนที่
          หลังโหลดข้อมูลครบแล้วเท่านั้น ถ้าเพิ่มปุ่มรีเฟรช/ฟิลเตอร์ ต้องใส่ key= บังคับ remount */}
      <GeoJSON data={pipes} style={pipeStyle} onEachFeature={onEachPipe} />
      <GeoJSON data={nodes} pointToLayer={nodeToLayer} onEachFeature={onEachNode} />
      <FitToData pipes={pipes} nodes={nodes} />
    </MapContainer>
  );
}
