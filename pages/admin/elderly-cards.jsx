import React, { useEffect, useMemo, useState } from "react";
import PermissionGuard, { usePermissions } from "@/components/PermissionGuard";

function getCurrentYearBE() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  return Number.isFinite(y) ? y + 543 : new Date().getFullYear() + 543;
}

function makeCheckinUrl(origin, personId, yearBE) {
  const qs = new URLSearchParams();
  qs.set("personId", personId);
  if (yearBE) qs.set("yearBE", String(yearBE));
  return `${origin}/elderly/checkin?${qs.toString()}`;
}

export default function ElderlyCardsPage() {
  const { isSuperAdmin } = usePermissions();
  const [yearBE, setYearBE] = useState(() => getCurrentYearBE());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [people, setPeople] = useState([]);
  const [qrMap, setQrMap] = useState({}); // personId -> dataURL
  const origin = useMemo(
    () =>
      typeof window !== "undefined"
        ? process.env.NEXT_PUBLIC_SITE_ORIGIN || window.location.origin
        : "",
    []
  );

  const fetchPeople = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/smart-health/elderly/cards?yearBE=${encodeURIComponent(String(yearBE))}`);
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "โหลดรายชื่อไม่สำเร็จ");
      setPeople(Array.isArray(json.people) ? json.people : []);
      setQrMap({});
    } catch (e) {
      setError(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearBE]);

  const generateAll = async () => {
    if (!origin) return;
    setLoading(true);
    setError("");
    try {
      const QRCode = (await import("qrcode")).default;
      const entries = await Promise.all(
        people.map(async (p) => {
          const url = makeCheckinUrl(origin, p.personId, yearBE);
          const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 180 });
          return [p.personId, dataUrl];
        })
      );
      const next = {};
      for (const [k, v] of entries) next[k] = v;
      setQrMap(next);
    } catch (e) {
      setError(e?.message || "สร้าง QR ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PermissionGuard requiredPath="/admin/smart-health">
      <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-gray-900">พิมพ์บัตร QR (โรงเรียนผู้สูงอายุ)</p>
              <p className="text-xs text-gray-500 mt-1">ลิงก์เป็นแบบ public และจะให้ผู้เรียนกรอกเลขบัตร 4 ตัวท้ายก่อนบันทึก</p>
              {!isSuperAdmin && (
                <p className="text-xs text-amber-700 mt-2">* หน้านี้แนะนำให้ใช้เฉพาะ superadmin</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={yearBE}
                onChange={(e) => setYearBE(Number(e.target.value))}
                className="h-10 px-3 text-sm rounded-xl border border-gray-200 bg-white"
              >
                {[getCurrentYearBE() - 1, getCurrentYearBE(), getCurrentYearBE() + 1].map((y) => (
                  <option key={y} value={y}>
                    ปี {y}
                  </option>
                ))}
              </select>
              <button
                onClick={generateAll}
                disabled={loading || people.length === 0}
                className="h-10 px-4 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "กำลังสร้าง..." : "สร้าง QR ทั้งหมด"}
              </button>
              <button
                onClick={() => window.print()}
                disabled={loading || Object.keys(qrMap).length === 0}
                className="h-10 px-4 text-sm rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                พิมพ์
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
              {error}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">รายชื่อ ({people.length})</p>
              <button
                onClick={fetchPeople}
                disabled={loading}
                className="h-9 px-3 text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                รีเฟรชรายชื่อ
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {people.map((p) => {
                const url = origin ? makeCheckinUrl(origin, p.personId, yearBE) : "";
                const qr = qrMap[p.personId];
                return (
                  <div key={p.personId} className="rounded-xl border border-gray-200 p-3 break-inside-avoid">
                    <div className="aspect-square rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden">
                      {qr ? (
                        <img src={qr} alt={`QR ${p.fullName}`} className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-[11px] text-gray-500 text-center px-2">
                          กด “สร้าง QR ทั้งหมด”
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-gray-900 line-clamp-2">{p.fullName || "-"}</p>
                    <p className="mt-1 text-[10px] text-gray-500 break-all">{url}</p>
                  </div>
                );
              })}
              {people.length === 0 && (
                <div className="col-span-full py-6 text-center text-sm text-gray-500">
                  ไม่พบรายชื่อสำหรับปีนี้ (ต้องมี visit ในปีนั้นก่อน)
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </PermissionGuard>
  );
}


