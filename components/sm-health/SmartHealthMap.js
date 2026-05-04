import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  LayersControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Filter } from "lucide-react";
import { useHealthMenuStore } from "@/stores/useHealthMenuStore";
import {
  loadGeoJSONFromFile,
  createCommunityPolygonsFromGeoJSON,
  convertGeoJSONToPolygons,
  findPolygonContainingPoint,
} from "@/utils/geojsonUtils";
import {
  calculatePolygonCenter,
  shortenCommunityName,
  adjustLabelPositions,
} from "@/utils/communityMapLabels";
import { getPersonDataGroupLabel } from "@/lib/personDataGroupLabels";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

const { BaseLayer } = LayersControl;

const REQUEST_DONE = "ส่งมอบอุปกรณ์";

function MapController({ onMapReady }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const check = () => {
      if (map && !map._removed && map._loaded && map._mapPane) onMapReady(map);
      else setTimeout(check, 50);
    };
    const t = setTimeout(check, 100);
    return () => clearTimeout(t);
  }, [map, onMapReady]);
  return null;
}

const isBorrowing = (item) =>
  !item.date_return || item.date_return === "-" || item.date_return === "";

function validLocation(loc) {
  return (
    loc &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    !isNaN(loc.lat) &&
    !isNaN(loc.lng)
  );
}

function matchesFilterStatus(kind, item, filterStatus) {
  if (filterStatus === "all") return true;
  if (kind === "request") {
    const done = item.status === REQUEST_DONE;
    return filterStatus === "done" ? done : !done;
  }
  if (kind === "borrow") {
    const done = !isBorrowing(item);
    return filterStatus === "done" ? done : !done;
  }
  if (kind === "person") {
    return filterStatus !== "done";
  }
  return true;
}

function buildPolygonPopupHtml(polygonName, requests, people, borrows, hitPolys) {
  const ppl = people.filter((p) => p.community === polygonName).length;
  const brw = borrows.filter((b) => (b.resolvedCommunity || "").trim() === polygonName).length;
  const req = requests.filter((r) => {
    if (!validLocation(r.location)) return false;
    const poly = findPolygonContainingPoint([r.location.lat, r.location.lng], hitPolys);
    const n = poly?.name || poly?.boundaryor;
    return n === polygonName;
  }).length;
  return `
    <div class="text-sm p-1">
      <p class="font-bold text-slate-800 mb-2">${polygonName}</p>
      <ul class="space-y-1 text-xs text-slate-600">
        <li>ข้อมูลบุคคล: <strong>${ppl}</strong></li>
        <li>รายการยืม-คืน (ตามเขต): <strong>${brw}</strong></li>
        <li>คำขอ (มีพิกัดในเขต): <strong>${req}</strong></li>
      </ul>
    </div>
  `;
}

/**
 * แผนที่ความต้องการกายอุปกรณ์ — สไตล์เดียวกับแผนที่แจ้งเหตุ (polygon + หมุด + legend)
 */
export default function SmartHealthMap({
  requests = [],
  people = [],
  borrows = [],
  parentLoading = false,
}) {
  const { menu, fetchMenu, loading: menuLoading } = useHealthMenuStore();
  const [geojsonData, setGeojsonData] = useState(null);
  const [geojsonLoading, setGeojsonLoading] = useState(true);
  const [mapInstance, setMapInstance] = useState(null);
  const [showPolygons, setShowPolygons] = useState(true);
  const [showCommunityLabels, setShowCommunityLabels] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [filterEquipment, setFilterEquipment] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    let cancelled = false;
    loadGeoJSONFromFile("/takhli.geojson")
      .then((d) => {
        if (!cancelled) setGeojsonData(d);
      })
      .catch(() => {
        if (!cancelled) setGeojsonData(null);
      })
      .finally(() => {
        if (!cancelled) setGeojsonLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hitPolys = useMemo(() => {
    if (!geojsonData) return [];
    return convertGeoJSONToPolygons(geojsonData);
  }, [geojsonData]);

  const polygons = useMemo(() => {
    if (!geojsonData) return [];
    return createCommunityPolygonsFromGeoJSON(geojsonData, {
      fillOpacity: 0.15,
      weight: 2,
      customPopupContent: (poly) =>
        buildPolygonPopupHtml(poly.name, requests, people, borrows, hitPolys),
    });
  }, [geojsonData, requests, people, borrows, hitPolys]);

  const mapPoints = useMemo(() => {
    const out = [];
    const eq = filterEquipment;
    const src = filterSource;
    const st = filterStatus;

    if (src === "all" || src === "request") {
      requests.forEach((r) => {
        if (!validLocation(r.location)) return;
        if (eq && r.equipment !== eq) return;
        if (!matchesFilterStatus("request", r, st)) return;
        const done = r.status === REQUEST_DONE;
        const iconUrl = menu.find((m) => m.label === r.equipment)?.image_icon;
        const poly = findPolygonContainingPoint([r.location.lat, r.location.lng], hitPolys);
        out.push({
          key: `req-${r._id}`,
          kind: "request",
          lat: r.location.lat,
          lng: r.location.lng,
          title: r.equipment || "คำขออุปกรณ์",
          subtitle: r.name || "",
          statusText: r.status || "รับคำร้อง",
          community: poly?.name || poly?.boundaryor || "—",
          done,
          iconUrl,
        });
      });
    }

    if (src === "all" || src === "person") {
      people.forEach((p) => {
        if (eq) return;
        if (!validLocation(p.location)) return;
        if (!matchesFilterStatus("person", p, st)) return;
        const poly = findPolygonContainingPoint([p.location.lat, p.location.lng], hitPolys);
        out.push({
          key: `per-${p._id}`,
          kind: "person",
          lat: p.location.lat,
          lng: p.location.lng,
          title: "ทะเบียนบุคคล",
          subtitle: p.fullName || "",
          statusText: "",
          dataGroupLabel: getPersonDataGroupLabel(p.dataGroup),
          community: p.community || poly?.name || "—",
          done: false,
          iconUrl: null,
        });
      });
    }

    if (src === "all" || src === "borrow") {
      borrows.forEach((b) => {
        if (!validLocation(b.resolvedLocation)) return;
        if (eq && b.shot_name !== eq) return;
        if (!matchesFilterStatus("borrow", b, st)) return;
        const done = !isBorrowing(b);
        const title = b.shot_name || "การยืมอุปกรณ์";
        const iconUrl = b.image_icon || null;
        const poly = findPolygonContainingPoint(
          [b.resolvedLocation.lat, b.resolvedLocation.lng],
          hitPolys
        );
        out.push({
          key: `brw-${b._id || b.id_use_object}`,
          kind: "borrow",
          lat: b.resolvedLocation.lat,
          lng: b.resolvedLocation.lng,
          title,
          subtitle: b.personFullName || b.id_use_object || "",
          statusText: done ? "คืนแล้ว" : "กำลังยืม",
          community: (b.resolvedCommunity || poly?.name || "—").trim(),
          done,
          iconUrl,
        });
      });
    }

    return out;
  }, [requests, people, borrows, filterEquipment, filterSource, filterStatus, menu, hitPolys]);

  const getMarkerColor = (pt) => {
    if (pt.kind === "person") return "#6366f1";
    return pt.done ? "#10b981" : "#3b82f6";
  };

  const createIcon = (pt) => {
    const color = getMarkerColor(pt);
    if (pt.iconUrl) {
      return L.divIcon({
        className: "custom-marker",
        html: `<div class="marker-icon-category" style="background-color:${color};"><img src="${pt.iconUrl}" alt="" class="category-icon" /></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
    }
    const emoji = pt.kind === "person" ? "👤" : pt.done ? "✅" : "🔄";
    return L.divIcon({
      className: "custom-marker",
      html: `<div class="marker-icon" style="background-color:${color}">${emoji}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  const getMapCenter = useCallback(() => {
    if (polygons.length > 0) {
      let totalLat = 0;
      let totalLng = 0;
      let n = 0;
      polygons.forEach((polygon) => {
        const c = calculatePolygonCenter(polygon.coordinates);
        if (c && !isNaN(c[0]) && !isNaN(c[1])) {
          totalLat += c[0];
          totalLng += c[1];
          n++;
        }
      });
      if (n > 0) return [totalLat / n, totalLng / n];
    }
    if (mapPoints.length > 0) {
      const tLat = mapPoints.reduce((s, p) => s + p.lat, 0);
      const tLng = mapPoints.reduce((s, p) => s + p.lng, 0);
      return [tLat / mapPoints.length, tLng / mapPoints.length];
    }
    return [15.253914, 100.351077];
  }, [polygons, mapPoints]);

  const getMapZoom = useCallback(() => {
    if (polygons.length > 1) return 14;
    if (polygons.length === 1) return 16;
    if (mapPoints.length <= 1) return 16;
    if (mapPoints.length <= 8) return 15;
    return 14;
  }, [polygons.length, mapPoints.length]);

  const handleMapReady = useCallback((map) => {
    setMapInstance(map);
  }, []);

  useEffect(() => {
    if (!mapInstance || mapInstance._removed) return;
    const t = setTimeout(() => {
      try {
        mapInstance.invalidateSize();
        if (isFullscreen) {
          mapInstance.setView(getMapCenter(), getMapZoom(), { animate: true });
        }
      } catch {
        /* ignore */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [isFullscreen, mapInstance, getMapCenter, getMapZoom, mapPoints.length, polygons.length]);

  const flyToMarker = (lat, lng) => {
    if (mapInstance && !mapInstance._removed) {
      mapInstance.flyTo([lat, lng], 17, { duration: 0.6 });
    }
  };

  const loading = parentLoading || geojsonLoading || menuLoading;
  const totalWithCoords =
    requests.filter((r) => validLocation(r.location)).length +
    people.filter((p) => validLocation(p.location)).length +
    borrows.filter((b) => validLocation(b.resolvedLocation)).length;

  if (loading) {
    return (
      <div className="h-[560px] w-full rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-600 font-medium">กำลังโหลดแผนที่…</p>
        </div>
      </div>
    );
  }

  if (!geojsonData && mapPoints.length === 0) {
    return (
      <div className="h-[400px] w-full rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 text-sm px-4 text-center">
        ไม่สามารถโหลดขอบเขตชุมชน และยังไม่มีหมุดจากพิกัดในข้อมูลสุขภาพ
      </div>
    );
  }

  const mapHeightClass = isFullscreen
    ? "h-[calc(100vh-3.75rem)] w-full min-h-[280px]"
    : "h-[560px] w-full rounded-2xl";

  const mapInner = (
    <MapContainer
      center={getMapCenter()}
      zoom={getMapZoom()}
      className={`${mapHeightClass} z-[1]`}
      style={{ zIndex: 1 }}
    >
      <MapController onMapReady={handleMapReady} />
      <LayersControl position="bottomleft">
        <BaseLayer checked name="🗺️ แผนที่ถนน">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
        </BaseLayer>
        <BaseLayer name="🛰️ แผนที่ดาวเทียม">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
          />
        </BaseLayer>
      </LayersControl>

      {showPolygons &&
        adjustLabelPositions(polygons).map((polygon, index) => {
          const centerPoint = calculatePolygonCenter(polygon.coordinates);
          if (!centerPoint) return null;
          const labelPosition = polygon.adjustedCenter || centerPoint;
          const uniqueKey = `sh-poly-${polygon.id || polygon.name}-${index}`;
          return (
            <React.Fragment key={uniqueKey}>
              <Polygon
                positions={polygon.coordinates}
                pathOptions={{
                  color: polygon.color || "#3b82f6",
                  fillColor: polygon.fillColor || "#3b82f6",
                  fillOpacity: polygon.fillOpacity ?? 0.2,
                  weight: polygon.weight ?? 2,
                }}
              >
                {polygon.popup?.content && (
                  <Popup>
                    <div dangerouslySetInnerHTML={{ __html: polygon.popup.content }} />
                  </Popup>
                )}
              </Polygon>
              {showCommunityLabels && (
                <Marker
                  position={labelPosition}
                  icon={L.divIcon({
                    className: "community-label-marker",
                    html: `<div class="community-label" style="background-color:rgba(255,255,255,0.95);border:2px solid ${polygon.color || "#3b82f6"};border-radius:6px;padding:4px 8px;font-size:11px;font-weight:600;color:${polygon.color || "#3b82f6"};white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);pointer-events:none;">${shortenCommunityName(polygon.name)}</div>`,
                    iconSize: [120, 30],
                    iconAnchor: [60, 15],
                  })}
                />
              )}
            </React.Fragment>
          );
        })}

      {mapPoints.map((pt, index) => (
        <Marker
          key={pt.key || index}
          position={[pt.lat, pt.lng]}
          icon={createIcon(pt)}
          eventHandlers={{
            click: () => flyToMarker(pt.lat, pt.lng),
          }}
        >
          <Popup className="custom-popup">
            <div className="popup-modern min-w-[220px]">
              <div
                className="popup-modern-header"
                style={{
                  "--popup-color": getMarkerColor(pt),
                  "--popup-color-dark": pt.done ? "#059669" : "#1d4ed8",
                }}
              >
                <div className="popup-modern-title">
                  <div className="popup-modern-title-icon">
                    {pt.iconUrl ? (
                      <Image src={pt.iconUrl} alt="" width={24} height={24} unoptimized />
                    ) : (
                      <span>{pt.kind === "person" ? "👤" : pt.done ? "✅" : "🔄"}</span>
                    )}
                  </div>
                  <span className="text-sm">{pt.title}</span>
                </div>
              </div>
              <div className="popup-modern-body text-xs">
                {pt.subtitle && (
                  <div className="popup-modern-row">
                    <div className="popup-modern-row-content">
                      <div className="popup-modern-row-label">รายการ</div>
                      <div className="popup-modern-row-value">{pt.subtitle}</div>
                    </div>
                  </div>
                )}
                <div className="popup-modern-row">
                  <div className="popup-modern-row-content">
                    <div className="popup-modern-row-label">ชุมชน (โดยประมาณ)</div>
                    <div className="popup-modern-row-value">{pt.community}</div>
                  </div>
                </div>
                <div className="popup-modern-row">
                  <div className="popup-modern-row-content">
                    <div className="popup-modern-row-label">
                      {pt.kind === "person" ? "กลุ่มข้อมูล" : "สถานะ"}
                    </div>
                    <div className="popup-modern-row-value">
                      {pt.kind === "person"
                        ? pt.dataGroupLabel || "ไม่ระบุกลุ่ม"
                        : pt.statusText}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">แผนที่ความต้องการกายอุปกรณ์</h3>
          <p className="text-sm text-slate-500">
            แสดง {mapPoints.length} ตำแหน่ง (กรองแล้ว) · ข้อมูลมีพิกัดทั้งหมด {totalWithCoords} รายการ ·{" "}
            {polygons.length} ชุมชน
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-slate-500">
            <Filter className="w-4 h-4" />
          </div>
          <select
            className="select select-bordered select-sm"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
          >
            <option value="all">แหล่ง: ทั้งหมด</option>
            <option value="request">คำขอ</option>
            <option value="person">บุคคล</option>
            <option value="borrow">ยืม-คืน</option>
          </select>
          <select
            className="select select-bordered select-sm"
            value={filterEquipment}
            onChange={(e) => setFilterEquipment(e.target.value)}
          >
            <option value="">ประเภท: ทั้งหมด</option>
            {menu.map((m) => (
              <option key={m.label} value={m.label}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            className="select select-bordered select-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">สถานะ: ทั้งหมด</option>
            <option value="open">ดำเนินการ / กำลังยืม</option>
            <option value="done">เสร็จสิ้น / คืนแล้ว</option>
          </select>
        </div>
      </div>

      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-50 bg-white flex flex-col p-2"
            : "relative rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm"
        }
      >
        {isFullscreen && (
          <div className="flex justify-end pb-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="btn btn-sm btn-error text-white gap-1"
            >
              ปิดเต็มจอ
            </button>
          </div>
        )}
        <div className={isFullscreen ? "flex-1 min-h-0 relative" : "relative"}>
          {mapInner}
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xl p-3 rounded-2xl shadow-xl z-[400] w-64 max-h-[480px] overflow-y-auto border border-slate-200/50 text-xs">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-800">คำอธิบายแผนที่</h4>
              {!isFullscreen ? (
                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[10px] hover:bg-blue-700"
                >
                  เต็มจอ
                </button>
              ) : (
                <span className="text-[10px] text-slate-400">โหมดเต็มจอ</span>
              )}
            </div>
            {polygons.length > 0 && (
              <div className="mb-3 p-2 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-100">
                <p className="font-semibold text-teal-900 mb-1">สรุปข้อมูล</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/80 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-teal-600">{polygons.length}</div>
                    <div className="text-teal-800">ชุมชน</div>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-emerald-600">{mapPoints.length}</div>
                    <div className="text-emerald-800">หมุด</div>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2 mb-3">
              <p className="font-semibold text-slate-700">สถานะหมุด</p>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500" /> ดำเนินการ
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" /> เสร็จสิ้น
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-indigo-500" /> บุคคล
                </span>
              </div>
            </div>
            {polygons.length > 0 && (
              <>
                <p className="font-semibold text-slate-700 mb-1">ชุมชน</p>
                <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
                  {polygons.map((polygon, index) => (
                    <div key={`leg-${polygon.id || index}`} className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded shrink-0"
                        style={{ backgroundColor: polygon.color }}
                      />
                      <span className="text-slate-600 truncate">{polygon.name}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPolygons(!showPolygons)}
                  className={`w-full px-2 py-2 rounded-lg mb-1 ${
                    showPolygons ? "bg-slate-100 text-slate-700" : "bg-slate-700 text-white"
                  }`}
                >
                  {showPolygons ? "ซ่อนพื้นที่ชุมชน" : "แสดงพื้นที่ชุมชน"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCommunityLabels(!showCommunityLabels)}
                  className={`w-full px-2 py-2 rounded-lg ${
                    showCommunityLabels ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {showCommunityLabels ? "ชื่อชุมชน: เปิด" : "ชื่อชุมชน: ปิด"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                try {
                  mapInstance?.setView?.(getMapCenter(), getMapZoom(), { animate: true });
                } catch {
                  /* ignore */
                }
              }}
              className="w-full mt-3 px-2 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg"
            >
              จัดกึ่งกลาง ({mapPoints.length} ตำแหน่ง)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
