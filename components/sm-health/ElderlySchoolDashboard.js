import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Activity, HeartPulse, RefreshCw } from "lucide-react";

function StatCard({ title, icon: Icon, normal, risk, extra, loading }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Icon className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">สรุปจาก “ครั้งล่าสุด” ของแต่ละคน</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
          <p className="text-xs text-emerald-700 mb-1">ปกติ</p>
          <p className="text-2xl font-bold text-emerald-700">
            {loading ? "-" : normal ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
          <p className="text-xs text-amber-700 mb-1">เสี่ยง/ผิดปกติ</p>
          <p className="text-2xl font-bold text-amber-700">
            {loading ? "-" : risk ?? 0}
          </p>
        </div>
      </div>

      {extra}
    </div>
  );
}

function bmiCategoryLabel(cat) {
  switch (cat) {
    case "normal":
      return { label: "ปกติ", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "unknown":
      return { label: "ไม่ระบุ", className: "bg-gray-50 text-gray-600 border-gray-200" };
    default:
      return { label: "เสี่ยง", className: "bg-amber-50 text-amber-800 border-amber-200" };
  }
}

function bpCategoryLabel(cat) {
  switch (cat) {
    case "normal":
      return { label: "ปกติ", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "high":
      return { label: "สูง", className: "bg-red-50 text-red-700 border-red-200" };
    case "risk":
      return { label: "เสี่ยง", className: "bg-amber-50 text-amber-800 border-amber-200" };
    default:
      return { label: "ไม่ระบุ", className: "bg-gray-50 text-gray-600 border-gray-200" };
  }
}

export default function ElderlySchoolDashboard() {
  const [visit, setVisit] = useState("latest"); // default: latest
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [riskOnly, setRiskOnly] = useState(true);
  const [search, setSearch] = useState("");

  const fetchSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const visitParam = visit === "latest" ? "latest" : String(visit);
      const qs = new URLSearchParams();
      qs.set("visit", visitParam);
      qs.set("includePeople", "1");
      const res = await fetch(`/api/smart-health/elderly-school-dashboard?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "โหลดข้อมูลไม่สำเร็จ");
      }
      setData(json);
    } catch (e) {
      setData(null);
      setError(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit]);

  const metaText = useMemo(() => {
    if (!data) return "";
    const rows = data?.totals?.rowsMatchedDate ?? 0;
    const ppl = data?.totals?.peopleCounted ?? 0;
    const mode = data?.totals?.countMode || "unique";
    const visitText = data?.visit ? ` | ครั้ง: ${data.visit}` : "";
    return `พบข้อมูลทั้งหมด ${rows} แถว | นับเป็นคน ${ppl} (${mode})${visitText}`;
  }, [data]);

  const peopleFiltered = useMemo(() => {
    const people = Array.isArray(data?.people) ? data.people : [];
    const q = search.trim().toLowerCase();
    const filtered = people.filter((p) => {
      if (!p) return false;
      if (riskOnly && !p.overallRisk) return false;
      if (!q) return true;
      return (
        (p.fullName || "").toLowerCase().includes(q) ||
        (p.citizenIdMasked || "").toLowerCase().includes(q)
      );
    });

    // Sort: overallRisk first, then bp high, then name
    filtered.sort((a, b) => {
      const ar = a.overallRisk ? 1 : 0;
      const br = b.overallRisk ? 1 : 0;
      if (ar !== br) return br - ar;
      const ah = a?.bp?.category === "high" ? 1 : 0;
      const bh = b?.bp?.category === "high" ? 1 : 0;
      if (ah !== bh) return bh - ah;
      return String(a.fullName || "").localeCompare(String(b.fullName || ""), "th");
    });

    return filtered;
  }, [data, riskOnly, search]);

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            โรงเรียนผู้สูงอายุ (Dashboard)
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            สรุป BMI/ความดันโลหิตจาก “ครั้งล่าสุด” ของแต่ละคน
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={visit}
            onChange={(e) => {
              const v = e.target.value;
              setVisit(v === "latest" ? "latest" : Number(v));
            }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
            title="เลือกครั้งที่"
          >
            <option value="latest">ครั้งล่าสุด</option>
            {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                ครั้งที่ {n}
              </option>
            ))}
          </select>
          <button
            onClick={fetchSummary}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
            title="รีเฟรช"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            รีเฟรช
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900">โหลดข้อมูลไม่ได้</p>
            <p className="text-sm text-amber-800 mt-1">{error}</p>
            <p className="text-xs text-amber-700 mt-2">
              ถ้า sheet ยังไม่ public: ให้ Publish to the web (CSV) แล้วตั้งค่า
              `ELDERLY_SCHOOL_SHEET_CSV_URL` ในไฟล์ environment ของโปรเจกต์
            </p>
          </div>
        </div>
      )}

      {/* Criteria / thresholds */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <p className="text-sm font-semibold text-gray-900 mb-2">เกณฑ์การประเมินสถานะ</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
            <p className="text-sm font-semibold text-gray-900 mb-1">BMI</p>
            <p className="text-xs text-gray-600 mb-2">
              สูตร: BMI = น้ำหนัก(กก.) / (ส่วนสูง(เมตร)²)
            </p>
            <div className="text-xs text-gray-700 space-y-1">
              <p><span className="font-medium">ผอม</span>: &lt; 18.5</p>
              <p><span className="font-medium">ปกติ</span>: 18.5 – 22.9</p>
              <p><span className="font-medium">ท้วม</span>: 23.0 – 24.9</p>
              <p><span className="font-medium">อ้วนระดับ 1</span>: 25.0 – 29.9</p>
              <p><span className="font-medium">อ้วนระดับ 2</span>: ≥ 30.0</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ใน dashboard นี้: <span className="font-medium">“เสี่ยง/ผิดปกติ”</span> = ทุกสถานะที่ไม่ใช่ “ปกติ” (ยกเว้นค่าว่าง)
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
            <p className="text-sm font-semibold text-gray-900 mb-1">ความดันโลหิต (BP)</p>
            <div className="text-xs text-gray-700 space-y-1">
              <p><span className="font-medium">ปกติ</span>: ตัวบน &lt; 120 และตัวล่าง &lt; 80</p>
              <p><span className="font-medium">สูง</span>: ตัวบน ≥ 140 หรือ ตัวล่าง ≥ 90</p>
              <p><span className="font-medium">เสี่ยง</span>: อื่น ๆ (เช่น 120–139 หรือ 80–89)</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ในสรุป BP: <span className="font-medium">“เสี่ยง/ผิดปกติ”</span> = เสี่ยง + สูง
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          หมายเหตุ: ถ้าไม่มีน้ำหนัก/ส่วนสูง หรือ BP ไม่ครบ ระบบจะแสดงเป็น <span className="font-medium">“ไม่ระบุ”</span> และจะไม่นับเป็น “เสี่ยง”
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatCard
          title="BMI"
          icon={Activity}
          normal={data?.bmi?.normal}
          risk={data?.bmi?.risk}
          loading={loading}
          extra={
            <p className="text-xs text-gray-500 mt-3">
              ไม่ระบุค่า (คำนวณไม่ได้): {loading ? "-" : data?.bmi?.unknown ?? 0}
            </p>
          }
        />

        <StatCard
          title="ความดันโลหิต (BP)"
          icon={HeartPulse}
          normal={data?.bp?.normal}
          risk={data?.bp?.riskTotal}
          loading={loading}
          extra={
            <div className="text-xs text-gray-500 mt-3 space-y-1">
              <p>แยก: เสี่ยง {loading ? "-" : data?.bp?.risk ?? 0} | สูง {loading ? "-" : data?.bp?.high ?? 0}</p>
              <p>ไม่ระบุค่า: {loading ? "-" : data?.bp?.unknown ?? 0}</p>
            </div>
          }
        />
      </div>

      {data && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">สรุป</p>
          <p className="text-sm text-gray-600">{metaText}</p>
          <details className="mt-3">
            <summary className="text-xs text-gray-500 cursor-pointer">
              ดูคอลัมน์ที่ระบบตรวจจับ (debug)
            </summary>
            <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded-xl p-3 overflow-auto">
              {JSON.stringify(data?.detectedColumns, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* People table */}
      {data && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">รายชื่อผู้สูงอายุ</p>
              <p className="text-xs text-gray-500">
                แสดง {peopleFiltered.length} คน {riskOnly ? "(เฉพาะเสี่ยง)" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={riskOnly}
                  onChange={(e) => setRiskOnly(e.target.checked)}
                />
                เฉพาะคนเสี่ยง
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ/เลขบัตร(ท้าย 4)"
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[880px] w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    ชื่อ-นามสกุล
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    เลขบัตร (ปิดบางส่วน)
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    BMI
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    สถานะ BMI
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    BP
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    สถานะ BP
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    สรุป
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {peopleFiltered.map((p, idx) => {
                  const bmiInfo = bmiCategoryLabel(p?.bmiCategory);
                  const bpInfo = bpCategoryLabel(p?.bp?.category);
                  const bpText =
                    p?.bp?.systolic && p?.bp?.diastolic
                      ? `${p.bp.systolic}/${p.bp.diastolic}`
                      : "-";
                  return (
                    <tr key={`${p?.citizenIdMasked || p?.fullName || idx}`} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-sm text-gray-900">{p?.fullName || "-"}</td>
                      <td className="py-3 px-4 text-sm font-mono text-gray-700">{p?.citizenIdMasked || "-"}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {typeof p?.bmi === "number" ? p.bmi.toFixed(1) : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${bmiInfo.className}`}>
                          {bmiInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">{bpText}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${bpInfo.className}`}>
                          {bpInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {p?.overallRisk ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-amber-50 text-amber-800 border-amber-200">
                            เสี่ยง
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-emerald-50 text-emerald-700 border-emerald-200">
                            ปกติ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {peopleFiltered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-gray-500">
                      ไม่พบรายการ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


