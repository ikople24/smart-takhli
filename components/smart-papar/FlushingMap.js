// แผนที่จุดโบตะกอน — มี leaflet ข้างใน ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
// หมุดเขียว = ใสแล้ว, ส้ม = ยังขุ่น · popup ใช้ <Popup> แบบ React (escape ให้เอง) — ห้ามเปลี่ยนเป็น bindPopup(raw HTML)
// ชั้นขอบเขตชุมชน (geojsonfeatures ของแอปพี่น้อง อ่านอย่างเดียว) อยู่ pane ล่างสุด ใต้หมุดเสมอ
// ชั้นหัวโบล์ (ทะเบียน FlushPoint) อยู่เหนือชุมชนแต่ใต้หมุดบันทึกโบ — หมุดโปร่ง = ยังไม่เคยบันทึกโบที่หัวนี้
import { useEffect, useMemo, useState } from "react";
import { MapContainer, CircleMarker, GeoJSON, Pane, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { BaseLayersControl } from "@/components/MapBaseTileLayers";
import { FLUSHING_RESULT_LABELS } from "@/lib/smart-papar/flushing";
import { FLUSH_POINT_KIND_LABELS } from "@/lib/smart-papar/flushPoints";
import { cloudinaryThumb } from "@/lib/smart-papar/cloudinaryThumb";

const TAKHLI_CENTER = [15.2605, 100.3555];
const COLORS = { clear: "#10b981", still_turbid: "#f97316" };
const KIND_COLORS = {
  tee_large: "#4f46e5",
  tee_medium: "#7c3aed",
  tee_small: "#a855f7",
  garland: "#0891b2",
  unknown: "#64748b",
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });

const COMMUNITY_STYLE = {
  color: "#2F80FF",
  weight: 2,
  dashArray: "6 4",
  fillColor: "#2F80FF",
  fillOpacity: 0.04,
};

// tooltip ของ leaflet รับ string เป็น HTML — ชื่อชุมชนมาจาก DB ต้อง escape
const escapeHtml = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

function bindCommunityTooltip(feature, layer) {
  layer.bindTooltip(escapeHtml(feature.properties?.name), { sticky: true });
}

// ขยับกล้องเฉพาะตอนชุดจุดเปลี่ยนจริง (เทียบด้วย key) — ไม่ใช่ทุกครั้งที่ parent re-render
// ไม่มีจุดในช่วงที่เลือก → ซูมให้เห็นทั้งเขตเทศบาล (ขอบชุมชน) แทน
function FitBounds({ points, communities }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (points.length === 0) {
      if (communities?.features?.length) {
        map.fitBounds(L.geoJSON(communities).getBounds(), { padding: [10, 10] });
      }
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, communities]);
  return null;
}

export default function FlushingMap({ logs, onSelect }) {
  const [communities, setCommunities] = useState(null);
  const [flushPoints, setFlushPoints] = useState([]);
  // โหลดหัวโบล์ใหม่ทุกครั้งที่รายการบันทึกเปลี่ยน — "โบล่าสุด" ของแต่ละหัวจะได้ตรงหลังบันทึกงานใหม่
  useEffect(() => {
    let cancelled = false;
    fetch("/api/smart-papar/flush-points")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.data)) setFlushPoints(d.data);
      })
      .catch(() => {}); // ชั้นเสริม — โหลดไม่ได้ก็ยังใช้แผนที่ได้
    return () => {
      cancelled = true;
    };
  }, [logs]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/smart-papar/communities")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.type === "FeatureCollection") setCommunities(d);
      })
      .catch(() => {}); // ชั้นเสริม — โหลดไม่ได้ก็ยังใช้แผนที่ได้ตามปกติ
    return () => {
      cancelled = true;
    };
  }, []);

  const withCoords = useMemo(
    () => logs.filter((l) => Array.isArray(l.location?.coordinates)),
    [logs]
  );
  const points = useMemo(
    () => withCoords.map((l) => [l.location.coordinates[1], l.location.coordinates[0]]),
    [withCoords]
  );

  return (
    <>
    <MapContainer center={TAKHLI_CENTER} zoom={14} className="h-[360px] w-full rounded-2xl" scrollWheelZoom={false}>
      <BaseLayersControl />
      <FitBounds points={points} communities={communities} />
      <Pane name="flushing-communities" style={{ zIndex: 350 }}>
        {communities && (
          <GeoJSON data={communities} style={COMMUNITY_STYLE} onEachFeature={bindCommunityTooltip} />
        )}
      </Pane>
      <Pane name="flushing-points" style={{ zIndex: 390 }}>
        {flushPoints.map((p) => {
          const color = KIND_COLORS[p.kind] || KIND_COLORS.unknown;
          return (
            <CircleMarker
              key={p._id}
              pane="flushing-points"
              center={[p.location.coordinates[1], p.location.coordinates[0]]}
              radius={5}
              pathOptions={{
                color,
                weight: 2,
                fillColor: p.lastFlushedAt ? color : "#ffffff",
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 600 }}>หัวโบล์ {p.code}</div>
                  <div>{FLUSH_POINT_KIND_LABELS[p.kind] || "-"}</div>
                  <div>{[p.name, p.roadName].filter(Boolean).join(" · ") || "-"}</div>
                  <div style={{ marginTop: 2 }}>
                    {p.lastFlushedAt
                      ? `โบล่าสุด ${fmtDate(p.lastFlushedAt)} (${p.flushCount} ครั้ง)`
                      : "ยังไม่มีบันทึกโบในระบบ"}
                  </div>
                  {p.photoUrl && (
                    <a href={p.photoUrl} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cloudinaryThumb(p.photoUrl, 400)}
                        alt=""
                        style={{ marginTop: 6, width: 180, height: 120, objectFit: "cover", borderRadius: 8 }}
                      />
                    </a>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </Pane>
      {withCoords.map((l, i) => (
        <CircleMarker
          key={l._id}
          center={points[i]}
          radius={9}
          pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS[l.result] || "#64748b", fillOpacity: 0.95 }}
        >
          {/* Popup เป็น React (ไม่ใช่ raw HTML) — React escape ข้อความให้เอง */}
          <Popup>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontWeight: 600 }}>{l.locationName}</div>
              <div>ผล: {FLUSHING_RESULT_LABELS[l.result] || "-"}</div>
              <button
                type="button"
                onClick={() => onSelect(l)}
                style={{ marginTop: 4, color: "#0369a1", textDecoration: "underline" }}
              >
                ดูรายละเอียด
              </button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
    {flushPoints.length > 0 && (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full border-2 border-white" style={{ background: COLORS.clear }} /> โบแล้ว ใส
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full border-2 border-white" style={{ background: COLORS.still_turbid }} /> โบแล้ว ยังขุ่น
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: KIND_COLORS.tee_large, background: KIND_COLORS.tee_large }} /> หัวโบล์ (เคยโบ)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full border-2 bg-white" style={{ borderColor: KIND_COLORS.tee_large }} /> หัวโบล์ (ยังไม่เคยโบ)
        </span>
        <span>· หัวโบล์ {flushPoints.length} หัว</span>
      </div>
    )}
    </>
  );
}
