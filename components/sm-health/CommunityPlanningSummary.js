import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { MapPin, Users, ArrowRightLeft, FileText, Loader2 } from "lucide-react";
import { COMMUNITIES } from "@/lib/takhliCommunities";

const SmartHealthMap = dynamic(
  () => import("@/components/sm-health/SmartHealthMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[560px] w-full rounded-2xl bg-slate-100 flex flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm">กำลังโหลดแผนที่…</p>
      </div>
    ),
  }
);
import {
  loadGeoJSONFromFile,
  convertGeoJSONToPolygons,
  findPolygonContainingPoint,
} from "@/utils/geojsonUtils";

function inferRequestCommunity(req, polygons) {
  if (!req?.location || req.location.lat == null || req.location.lng == null) return null;
  if (!polygons?.length) return null;
  const poly = findPolygonContainingPoint(
    [Number(req.location.lat), Number(req.location.lng)],
    polygons
  );
  return poly?.name || poly?.boundaryor || null;
}

export default function CommunityPlanningSummary() {
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [requests, setRequests] = useState([]);
  const [polygons, setPolygons] = useState([]);
  const [geoError, setGeoError] = useState(false);
  const [filterCommunity, setFilterCommunity] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadGeoJSONFromFile("/takhli.geojson")
      .then((data) => {
        if (!cancelled) {
          setPolygons(convertGeoJSONToPolygons(data));
          setGeoError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPolygons([]);
          setGeoError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTables = async () => {
    setLoading(true);
    try {
      const [pRes, bRes, rRes] = await Promise.all([
        fetch("/api/smart-health/people"),
        fetch("/api/smart-health/borrow-return"),
        fetch("/api/smart-health/ob-registration"),
      ]);
      const [p, b, r] = await Promise.all([pRes.json(), bRes.json(), rRes.json()]);
      setPeople(Array.isArray(p) ? p : []);
      setBorrows(Array.isArray(b) ? b : []);
      setRequests(Array.isArray(r) ? r : []);
    } catch (e) {
      console.error(e);
      setPeople([]);
      setBorrows([]);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const rows = useMemo(() => {
    const list = filterCommunity ? COMMUNITIES.filter((c) => c === filterCommunity) : COMMUNITIES;
    return list.map((community) => {
      const peopleCount = people.filter((x) => x.community === community).length;
      const borrowCount = borrows.filter(
        (x) => (x.resolvedCommunity || "").trim() === community
      ).length;
      const requestCount = requests.filter((req) => {
        const inferred = inferRequestCommunity(req, polygons);
        return (inferred || "").trim() === community;
      }).length;
      return { community, peopleCount, borrowCount, requestCount };
    });
  }, [people, borrows, requests, polygons, filterCommunity]);

  const unassigned = useMemo(() => {
    const peopleNo = people.filter((x) => !x.community || !COMMUNITIES.includes(x.community)).length;
    const borrowNo = borrows.filter(
      (x) => !x.resolvedCommunity || !COMMUNITIES.includes((x.resolvedCommunity || "").trim())
    ).length;
    const requestNo = requests.filter((req) => {
      const inferred = inferRequestCommunity(req, polygons);
      if (!inferred || !COMMUNITIES.includes(inferred.trim())) return true;
      return false;
    }).length;
    return { peopleNo, borrowNo, requestNo };
  }, [people, borrows, requests, polygons]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <SmartHealthMap
        requests={requests}
        people={people}
        borrows={borrows}
        parentLoading={loading}
      />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            สรุปตามชุมชน (วางแผนงบ / กองสาธารณสุขฯ)
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            นับจากฟิลด์ชุมชนในทะเบียนบุคคล และชุมชนที่ระบุในรายการยืม (รวมถึงจากทะเบียนบุคคลที่ผูกเลขบัตร)
            — ไม่จำเป็นต้องมีพิกัดจึงจะนับได้ คำขออุปกรณ์จะอิงเขตจากพิกัดคำขอเมื่อโหลดขอบเขตแผนที่สำเร็จ
            {geoError && (
              <span className="block text-amber-700 mt-1 text-xs">
                ไม่สามารถโหลด GeoJSON — คอลัมน์คำขอจะนับเฉพาะที่จับเขตจากแผนที่ได้เมื่อโหลดสำเร็จ
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-500">กรองชุมชน</label>
          <select
            className="select select-bordered select-sm min-w-[200px]"
            value={filterCommunity}
            onChange={(e) => setFilterCommunity(e.target.value)}
          >
            <option value="">ทุกชุมชน</option>
            {COMMUNITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-sm btn-outline" onClick={loadTables}>
            รีเฟรช
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
          <p className="text-xs font-medium text-amber-900 uppercase">นอกรายชื่อชุมชนมาตรฐาน</p>
          <p className="text-sm text-amber-800 mt-2">
            บุคคล {unassigned.peopleNo} · ยืม-คืน {unassigned.borrowNo} · คำขอ (ไม่เข้าเขต/ไม่มีพิกัด){" "}
            {unassigned.requestNo}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">กำลังโหลดตารางสรุป…</p>
          </div>
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="py-3 px-4 font-semibold text-gray-600">ชุมชน</th>
              <th className="py-3 px-4 font-semibold text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-4 h-4" /> ข้อมูลบุคคล
                </span>
              </th>
              <th className="py-3 px-4 font-semibold text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <ArrowRightLeft className="w-4 h-4" /> รายการยืม-คืน
                </span>
              </th>
              <th className="py-3 px-4 font-semibold text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <FileText className="w-4 h-4" /> คำขอ (จากพิกัดคำขอ)
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.community} className="hover:bg-gray-50/80">
                <td className="py-3 px-4 font-medium text-gray-900">{row.community}</td>
                <td className="py-3 px-4 tabular-nums">{row.peopleCount}</td>
                <td className="py-3 px-4 tabular-nums">{row.borrowCount}</td>
                <td className="py-3 px-4 tabular-nums">{row.requestCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
