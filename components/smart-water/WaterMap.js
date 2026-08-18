// แผนที่ทะเบียนท่อประปา — มี leaflet ข้างใน ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
import { useEffect } from "react";
import { MapContainer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { BaseLayersControl } from "@/components/MapBaseTileLayers";
import { CODE_COLORS, FALLBACK_COLOR } from "@/lib/smart-water/constants";
import { NODE_STYLE } from "./PipeLegend";

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
      <div style="font-weight:600;font-size:14px">${p.code} — ${p.material}</div>
      <div>ขนาด ${p.diameter?.value} ${p.diameter?.unit}</div>
      <div>ถนน: ${p.roadName ?? "-"}</div>
      <div>ความยาว: <b>${conf === "low" ? Math.round(p.lengthM) : p.lengthM} ม.</b></div>
      <div>สถานะ: ${p.status}</div>
      <div>ปีที่วาง: ${p.installedYear ?? "-"}</div>
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
      <div style="font-weight:600">${p.hydrantNo ?? p.type}</div>
      <div>ชนิด: ${p.type}</div>
      ${p.size ? `<div>ขนาด: ${p.size}</div>` : ""}
      <div>สภาพ: ${p.condition ?? "-"}</div>
      ${p.accessNote ? `<div>หมายเหตุ: ${p.accessNote}</div>` : ""}
    </div>
  `);
}

// ซูมให้พอดีข้อมูลครั้งแรกที่โหลด
function FitToData({ data }) {
  const map = useMap();
  useEffect(() => {
    if (!data?.features?.length) return;
    const b = L.geoJSON(data).getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [40, 40] });
  }, [map, data]);
  return null;
}

export default function WaterMap({ pipes, nodes }) {
  return (
    <MapContainer center={TAKHLI_CENTER} zoom={15} className="h-full w-full">
      <BaseLayersControl />
      <GeoJSON data={pipes} style={pipeStyle} onEachFeature={onEachPipe} />
      <GeoJSON data={nodes} pointToLayer={nodeToLayer} onEachFeature={onEachNode} />
      <FitToData data={pipes} />
    </MapContainer>
  );
}
