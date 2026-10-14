// แผนที่จุดโบตะกอน — มี leaflet ข้างใน ต้อง import ผ่าน dynamic(..., { ssr: false }) เท่านั้น
// หมุดเขียวน้ำทะเล = ใสแล้ว, อำพัน = ยังขุ่น · คลิกหมุด = เปิดแผงรายละเอียด (ไม่ใช้ popup) · tooltip ชุมชนต้อง escape HTML
// ชั้นขอบเขตชุมชน (geojsonfeatures ของแอปพี่น้อง อ่านอย่างเดียว) อยู่ pane ล่างสุด ใต้หมุดเสมอ
// ชั้นหัวโบล์ (ทะเบียน FlushPoint) อยู่เหนือชุมชนแต่ใต้หมุดบันทึกโบ — หมุดโปร่ง = ยังไม่เคยบันทึกโบที่หัวนี้
// คลิกหมุดหัวโบล์ → แผงข้อมูลด้านขวา (FlushPointPanel) ไม่ใช้ popup เพราะ popup ใน pane ของหมุดถูกหมุดอื่นทับ
import { useEffect, useMemo, useState } from "react";
import { MapContainer, CircleMarker, GeoJSON, Pane, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { BaseLayersControl } from "@/components/MapBaseTileLayers";
import { FLUSH_POINT_KIND_COLORS } from "@/lib/smart-papar/flushPoints";
import FlushPointPanel from "./FlushPointPanel";
import FlushPointSummary from "./FlushPointSummary";
import { communityTurbidStatus, latestByPoint } from "@/lib/smart-papar/communityStatus";

const TAKHLI_CENTER = [15.2605, 100.3555];
// ตรงกับโทเคน pp-clear / pp-turbid ใน globals.css
const COLORS = { clear: "#0B6E75", still_turbid: "#B45309" };
const KIND_COLORS = FLUSH_POINT_KIND_COLORS;
// ชุมชนที่โบแล้วใสทั้งหมด = ฟ้าทึบ (เจ้าของขอ 2026-10-14) — ต่างจาก "ไม่มีบันทึก" ที่เป็นเส้นประฟ้าจาง
const CLEAR_AREA = "#0284C7";

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

// ระบายสีชุมชนตามผลล่าสุดของจุดโบในช่วงที่เลือก: ยังขุ่น = อำพัน (เข้มขึ้นตามจำนวนจุด) · ใสทั้งหมด = ฟ้า
// ไม่มีบันทึก = เส้นประฟ้าแบบเดิม
function communityStyle(stat) {
  if (stat?.status === "turbid") {
    return {
      color: COLORS.still_turbid,
      weight: 2.5,
      dashArray: null,
      fillColor: COLORS.still_turbid,
      fillOpacity: Math.min(0.18 + (stat.turbid - 1) * 0.08, 0.45),
    };
  }
  if (stat?.status === "clear") {
    return { color: CLEAR_AREA, weight: 2, dashArray: null, fillColor: CLEAR_AREA, fillOpacity: 0.2 };
  }
  return COMMUNITY_STYLE;
}

function communityTooltip(name, stat) {
  const parts = [`<b>${escapeHtml(name)}</b>`];
  if (stat?.status === "turbid") parts.push(`ยังขุ่น ${stat.turbid} จุด${stat.clear ? ` · ใสแล้ว ${stat.clear} จุด` : ""}`);
  else if (stat?.status === "clear") parts.push(`ใสแล้วทั้งหมด ${stat.clear} จุด`);
  return parts.join("<br>");
}

// ขยับกล้องเฉพาะตอนชุดจุดเปลี่ยนจริง (เทียบด้วย key) — ไม่ใช่ทุกครั้งที่ parent re-render
// ไม่มีจุดในช่วงที่เลือก → ซูมให้เห็นหัวโบล์ทั้งหมด (ถ้ายังไม่มี ใช้ขอบชุมชนแทน)
function FitBounds({ points, communities, fallbackPoints }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  const hasFallback = fallbackPoints.length > 0;
  useEffect(() => {
    if (points.length === 0) {
      if (hasFallback) {
        map.fitBounds(L.latLngBounds(fallbackPoints), { padding: [20, 20] });
      } else if (communities?.features?.length) {
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
  }, [map, key, communities, hasFallback]);
  return null;
}

// คลิกพื้นแผนที่ว่าง ๆ → ปิดแผงหัวโบล์
function ClearOnMapClick({ onClear }) {
  useMapEvents({ click: onClear });
  return null;
}

// statusLogs = บันทึกทั้งหมดในช่วงวัน (ไม่ผ่านตัวกรองผล/ค้นหา) ใช้ระบายสีชุมชน — ไม่ส่งมาใช้ logs แทน
export default function FlushingMap({ logs, statusLogs, onSelect }) {
  const [selectedPointId, setSelectedPointId] = useState(null);
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

  const flushPointLatLngs = useMemo(
    () => flushPoints.map((p) => [p.location.coordinates[1], p.location.coordinates[0]]),
    [flushPoints]
  );
  // สถานะชุมชน — ใช้บันทึกล่าสุดของแต่ละจุดในช่วงที่แสดง (โบซ้ำแล้วใส = นับเป็นใส)
  const communityStats = useMemo(
    () => communityTurbidStatus(communities?.features || [], latestByPoint(statusLogs || logs)),
    [communities, statusLogs, logs]
  );
  // react-leaflet <GeoJSON> ไม่อัปเดต style/tooltip เองเมื่อข้อมูลเปลี่ยน — ใช้ key บังคับวาดใหม่
  const communityKey = [...communityStats.entries()].map(([n, v]) => `${n}:${v.turbid}/${v.clear}`).join("|");
  const turbidCommunities = [...communityStats.entries()]
    .filter(([, v]) => v.status === "turbid")
    .sort((a, b) => b[1].turbid - a[1].turbid);

  const selectedPoint = flushPoints.find((p) => String(p._id) === selectedPointId) || null;

  // เดสก์ท็อป: 3 คอลัมน์ [สรุปหัวโบล์ | แผนที่ | ข้อมูลหัวที่เลือก] — คอลัมน์ข้างกว้างคงที่ แผนที่จึงไม่เปลี่ยนขนาด
  // (Leaflet ไม่ต้อง invalidateSize) · มือถือ: แผนที่ก่อน สรุปตามหลัง ข้อมูลหัวเป็นแผ่นล่างทับแผนที่
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
    <div className="order-2 space-y-3 lg:order-1">
      {turbidCommunities.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="text-sm font-semibold text-pp-turbid-ink">ชุมชนที่ยังขุ่น</div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {turbidCommunities.map(([name, v]) => (
              <li key={name} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: COLORS.still_turbid }} />
                  <span className="truncate">{name}</span>
                </span>
                <span className="flex-none font-semibold tabular-nums text-pp-turbid-ink">{v.turbid} จุด</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <FlushPointSummary points={flushPoints} kindColors={KIND_COLORS} />
    </div>
    <div className="order-1 min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 lg:order-2">
    <div className="relative">
    <MapContainer center={TAKHLI_CENTER} zoom={14} className="flushing-map h-[380px] w-full lg:h-[520px]" scrollWheelZoom={false}>
      <BaseLayersControl />
      <ClearOnMapClick onClear={() => setSelectedPointId(null)} />
      <FitBounds points={points} communities={communities} fallbackPoints={flushPointLatLngs} />
      <Pane name="flushing-communities" style={{ zIndex: 350 }}>
        {communities && (
          <GeoJSON
            key={communityKey}
            data={communities}
            style={(f) => communityStyle(communityStats.get(String(f.properties?.name ?? "")))}
            onEachFeature={(f, layer) => {
              const name = String(f.properties?.name ?? "");
              layer.bindTooltip(communityTooltip(name, communityStats.get(name)), { sticky: true });
            }}
          />
        )}
      </Pane>
      <Pane name="flushing-points" style={{ zIndex: 390 }}>
        {flushPoints.map((p) => {
          const color = KIND_COLORS[p.kind] || KIND_COLORS.unknown;
          const damaged = p.lastResult === "still_turbid" && p.lastTurbidCause === "damaged";
          const selected = String(p._id) === selectedPointId;
          return (
            <CircleMarker
              key={p._id}
              pane="flushing-points"
              center={[p.location.coordinates[1], p.location.coordinates[0]]}
              radius={selected ? 9 : 5}
              bubblingMouseEvents={false}
              eventHandlers={{ click: () => setSelectedPointId(String(p._id)) }}
              pathOptions={{
                // ล่าสุดแจ้งว่าหัวโบล์ชำรุด/ฝืด → ขอบแดงหนา เห็นได้ทันทีว่าต้องส่งซ่อม
                color: selected ? "#0f172a" : damaged ? "#B42318" : color,
                weight: selected ? 3 : damaged ? 3 : 2,
                fillColor: p.lastFlushedAt ? color : "#ffffff",
                fillOpacity: 1,
              }}
            />
          );
        })}
      </Pane>
      {/* หมุดบันทึกโบ: คลิกแล้วเปิดแผงรายละเอียดด้านขวาทันที — ไม่มี popup คั่น (เจ้าของขอ 2026-10-14) */}
      {withCoords.map((l, i) => (
        <CircleMarker
          key={l._id}
          center={points[i]}
          radius={9}
          bubblingMouseEvents={false}
          eventHandlers={{
            click: () => {
              setSelectedPointId(null);
              onSelect(l);
            },
          }}
          pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS[l.result] || "#64748b", fillOpacity: 0.95 }}
        />
      ))}
    </MapContainer>
    <div className="lg:hidden">
      <FlushPointPanel
        point={selectedPoint}
        color={KIND_COLORS[selectedPoint?.kind] || KIND_COLORS.unknown}
        onClose={() => setSelectedPointId(null)}
      />
    </div>
    </div>
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
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full border-[3px] bg-white" style={{ borderColor: "#B42318" }} /> หัวโบล์แจ้งชำรุด
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-4 rounded-sm border-2" style={{ borderColor: COLORS.still_turbid, background: `${COLORS.still_turbid}55` }} /> ชุมชนยังขุ่น
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-4 rounded-sm border-2" style={{ borderColor: CLEAR_AREA, background: `${CLEAR_AREA}33` }} /> ชุมชนใสแล้ว
        </span>
      </div>
    )}
    </div>
    <div className="order-3 hidden lg:block">
      <FlushPointPanel
        docked
        point={selectedPoint}
        color={KIND_COLORS[selectedPoint?.kind] || KIND_COLORS.unknown}
        onClose={() => setSelectedPointId(null)}
      />
    </div>
    </div>
  );
}
