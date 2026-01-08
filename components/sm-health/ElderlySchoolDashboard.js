import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Activity, HeartPulse, RefreshCw } from "lucide-react";
import { usePermissions } from "@/components/PermissionGuard";

function getCurrentYearBE() {
  // Use Bangkok timezone to avoid edge cases around midnight
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  return Number.isFinite(y) ? y + 543 : new Date().getFullYear() + 543;
}

function StatCard({ title, icon: Icon, normal, risk, extra, loading }) {
  return (
    <div className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-100 flex items-center justify-center">
            <Icon className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">สรุปจาก “ครั้งล่าสุด” ของแต่ละคน</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-50/70 to-white ring-1 ring-emerald-100">
          <p className="text-xs text-emerald-700">ปกติ</p>
          <p className="text-3xl font-bold text-emerald-700 mt-1">
            {loading ? "-" : normal ?? 0}
          </p>
        </div>
        <div className="rounded-2xl p-4 bg-gradient-to-br from-amber-50/70 to-white ring-1 ring-amber-100">
          <p className="text-xs text-amber-700">เสี่ยง/ผิดปกติ</p>
          <p className="text-3xl font-bold text-amber-700 mt-1">
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
    case "underweight":
      return { label: "ผอม", className: "bg-sky-50 text-sky-700 border-sky-200" };
    case "normal":
      return { label: "ปกติ", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "overweight":
      return { label: "ท้วม", className: "bg-amber-50 text-amber-800 border-amber-200" };
    case "obese1":
      return { label: "อ้วน 1", className: "bg-orange-50 text-orange-800 border-orange-200" };
    case "obese2":
      return { label: "อ้วน 2", className: "bg-red-50 text-red-700 border-red-200" };
    case "unknown":
      return { label: "ไม่ระบุ", className: "bg-gray-50 text-gray-600 border-gray-200" };
    default:
      return { label: "ไม่ระบุ", className: "bg-gray-50 text-gray-600 border-gray-200" };
  }
}

function bpCategoryLabel(cat) {
  switch (cat) {
    case "normal":
      return { label: "ปกติ", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "low":
      return { label: "ต่ำ", className: "bg-sky-50 text-sky-700 border-sky-200" };
    case "high":
      return { label: "สูง", className: "bg-red-50 text-red-700 border-red-200" };
    case "risk":
      return { label: "เสี่ยง", className: "bg-amber-50 text-amber-800 border-amber-200" };
    default:
      return { label: "ไม่ระบุ", className: "bg-gray-50 text-gray-600 border-gray-200" };
  }
}

export default function ElderlySchoolDashboard() {
  const { isSuperAdmin } = usePermissions();
  const [yearBE, setYearBE] = useState(() => getCurrentYearBE());
  const [visit, setVisit] = useState("latest"); // default: latest
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [riskOnly, setRiskOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [bmiFilter, setBmiFilter] = useState("all"); // all|underweight|normal|overweight|obese1|obese2|unknown
  const [bpFilter, setBpFilter] = useState("all"); // all|normal|low|risk|high|unknown

  // Import UI
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);

  // Edit UI
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editPerson, setEditPerson] = useState(null);
  const [editVisits, setEditVisits] = useState([]);
  const [editForm, setEditForm] = useState({
    fullName: "",
    heightCm: "",
    baselineWeightKg: "",
    phone: "",
    address: "",
  });
  const [baselineHint, setBaselineHint] = useState("");
  const [visitEditOpen, setVisitEditOpen] = useState(false);
  const [visitEditNo, setVisitEditNo] = useState(null);
  const [visitEditForm, setVisitEditForm] = useState({
    weightKg: "",
    waistCm: "",
    pulseBpm: "",
    bp1: "",
    bp2: "",
  });

  const fetchSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const visitParam = visit === "latest" ? "latest" : String(visit);
      const qs = new URLSearchParams();
      qs.set("yearBE", String(yearBE));
      qs.set("visit", visitParam);
      qs.set("includePeople", "1");
      const res = await fetch(`/api/smart-health/elderly/dashboard?${qs.toString()}`);
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
  }, [visit, yearBE]);

  const metaText = useMemo(() => {
    if (!data) return "";
    const ppl = data?.totals?.peopleCounted ?? 0;
    const mode = data?.totals?.countMode || "unique";
    const visitText = data?.visit ? ` | ครั้ง: ${data.visit}` : "";
    // Mongo dashboard returns totals.peopleCounted only
    return `ปี ${yearBE} | นับเป็นคน ${ppl} (${mode})${visitText}`;
  }, [data, yearBE]);

  const peopleFiltered = useMemo(() => {
    const people = Array.isArray(data?.people) ? data.people : [];
    const q = search.trim().toLowerCase();
    const filtered = people.filter((p) => {
      if (!p) return false;
      if (riskOnly && !p.overallRisk) return false;
      if (bmiFilter !== "all" && (p.bmiCategory || "unknown") !== bmiFilter) return false;
      if (bpFilter !== "all" && (p?.bp?.category || "unknown") !== bpFilter) return false;
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
  }, [data, riskOnly, search, bmiFilter, bpFilter]);

  const yearOptions = useMemo(() => {
    const y = getCurrentYearBE();
    return [y - 1, y, y + 1];
  }, []);

  const openEdit = async (personId) => {
    setEditOpen(true);
    setEditLoading(true);
    setError("");
    try {
      const [pRes, vRes] = await Promise.all([
        fetch(`/api/smart-health/elderly/people?id=${encodeURIComponent(personId)}`),
        fetch(`/api/smart-health/elderly/visits?personId=${encodeURIComponent(personId)}&yearBE=${encodeURIComponent(String(yearBE))}`),
      ]);
      const pJson = await pRes.json();
      const vJson = await vRes.json();
      if (!pRes.ok || !pJson?.success) throw new Error(pJson?.message || "โหลดข้อมูลคนไม่สำเร็จ");
      if (!vRes.ok || !vJson?.success) throw new Error(vJson?.message || "โหลดข้อมูลครั้งไม่สำเร็จ");
      setEditPerson(pJson.person);
      const visits = Array.isArray(vJson.visits) ? vJson.visits : [];
      setEditVisits(visits);
      setEditForm({
        fullName: pJson.person.fullName || "",
        heightCm: pJson.person.heightCm ?? "",
        baselineWeightKg: pJson.person.baselineWeightKg ?? "",
        phone: pJson.person.phone || "",
        address: pJson.person.address || "",
      });

      // If baseline weight missing, infer from earliest visit with weight for convenience
      if (pJson.person.baselineWeightKg === null || pJson.person.baselineWeightKg === undefined) {
        const firstWithWeight = visits
          .filter((x) => typeof x?.weightKg === "number")
          .sort((a, b) => (a.visitNo || 0) - (b.visitNo || 0))[0];
        if (firstWithWeight?.weightKg !== undefined) {
          setEditForm((s) => ({ ...s, baselineWeightKg: firstWithWeight.weightKg }));
          setBaselineHint(
            `เดาค่าจากน้ำหนักครั้งที่ ${firstWithWeight.visitNo} (กด “บันทึกข้อมูลคน” เพื่อเก็บเป็นค่าน้ำหนักตั้งต้น)`
          );
        } else {
          setBaselineHint(
            "ยังไม่มีน้ำหนักตั้งต้นใน DB (ลอง Import ซ้ำปีนี้เพื่อดึงค่าน้ำหนักตั้งต้นจากชีต)"
          );
        }
      } else {
        setBaselineHint("");
      }
    } catch (e) {
      setError(e?.message || "เกิดข้อผิดพลาด");
      setEditOpen(false);
    } finally {
      setEditLoading(false);
    }
  };

  const savePerson = async () => {
    if (!editPerson?._id) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/smart-health/elderly/people?id=${encodeURIComponent(editPerson._id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editForm.fullName,
          heightCm: editForm.heightCm === "" ? null : Number(editForm.heightCm),
          baselineWeightKg:
            editForm.baselineWeightKg === "" ? null : Number(editForm.baselineWeightKg),
          phone: editForm.phone || null,
          address: editForm.address || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.message || "บันทึกข้อมูลคนไม่สำเร็จ");
      await fetchSummary();
    } catch (e) {
      setError(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setEditLoading(false);
    }
  };

  const saveVisit = async (visitNo, patch) => {
    if (!editPerson?._id) return;
    setEditLoading(true);
    try {
      const existing = editVisits.find((v) => v.visitNo === visitNo);
      const endpoint = existing?._id
        ? `/api/smart-health/elderly/visits?id=${encodeURIComponent(existing._id)}`
        : `/api/smart-health/elderly/visits`;
      const method = existing?._id ? "PUT" : "POST";
      const body =
        method === "PUT"
          ? patch
          : { personId: editPerson._id, yearBE, visitNo, ...patch };
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.message || "บันทึกข้อมูลครั้งไม่สำเร็จ");

      // refresh visits list
      const vRes = await fetch(`/api/smart-health/elderly/visits?personId=${encodeURIComponent(editPerson._id)}&yearBE=${encodeURIComponent(String(yearBE))}`);
      const vJson = await vRes.json();
      if (vRes.ok && vJson?.success) setEditVisits(Array.isArray(vJson.visits) ? vJson.visits : []);
      await fetchSummary();
    } catch (e) {
      setError(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setEditLoading(false);
    }
  };

  const openVisitEdit = (no) => {
    const v = editVisits.find((x) => x.visitNo === no) || {};
    setVisitEditNo(no);
    setVisitEditForm({
      weightKg: v.weightKg ?? "",
      waistCm: v.waistCm ?? "",
      pulseBpm: v.pulseBpm ?? "",
      bp1: v.bp1Sys && v.bp1Dia ? `${v.bp1Sys}/${v.bp1Dia}` : "",
      bp2: v.bp2Sys && v.bp2Dia ? `${v.bp2Sys}/${v.bp2Dia}` : "",
    });
    setVisitEditOpen(true);
  };

  const saveVisitFromForm = async () => {
    if (!visitEditNo) return;
    const parse = (s) => {
      const m = String(s || "").trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})/);
      return m ? { sys: Number(m[1]), dia: Number(m[2]) } : { sys: null, dia: null };
    };
    const b1 = parse(visitEditForm.bp1);
    const b2 = parse(visitEditForm.bp2);

    await saveVisit(visitEditNo, {
      weightKg: visitEditForm.weightKg === "" ? null : Number(visitEditForm.weightKg),
      waistCm: visitEditForm.waistCm === "" ? null : Number(visitEditForm.waistCm),
      pulseBpm: visitEditForm.pulseBpm === "" ? null : Number(visitEditForm.pulseBpm),
      bp1Sys: b1.sys,
      bp1Dia: b1.dia,
      bp2Sys: b2.sys,
      bp2Dia: b2.dia,
    });

    setVisitEditOpen(false);
    setVisitEditNo(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-white to-gray-50 ring-1 ring-gray-200/60 shadow-sm p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            โรงเรียนผู้สูงอายุ (Dashboard)
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            ข้อมูลบันทึกสุขภาพโรงเรียนผู้สูงอายุ ของเทศบาลเมืองตาคลี
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={yearBE}
            onChange={(e) => setYearBE(Number(e.target.value))}
            className="h-10 px-3 text-sm rounded-2xl bg-white/80 backdrop-blur border border-gray-200/70 shadow-sm hover:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            title="เลือกปี (พ.ศ.)"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                ปี {y}
              </option>
            ))}
          </select>
          <select
            value={visit}
            onChange={(e) => {
              const v = e.target.value;
              setVisit(v === "latest" ? "latest" : Number(v));
            }}
            className="h-10 px-3 text-sm rounded-2xl bg-white/80 backdrop-blur border border-gray-200/70 shadow-sm hover:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
            className="h-10 inline-flex items-center gap-2 px-4 text-sm rounded-2xl border border-gray-200/70 bg-white/80 backdrop-blur shadow-sm hover:bg-white explain transition-colors"
            title="รีเฟรช"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            รีเฟรช
          </button>
        </div>
      </div>
      <div className="mt-4 text-sm text-gray-600">{metaText}</div>
      </div>

      {/* Import section (superadmin only) */}
      {isSuperAdmin && (
        <div className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm p-5">
          <p className="text-base font-semibold text-gray-900">นำเข้าข้อมูลจาก Google Sheet (รายปี)</p>
          <p className="text-xs text-gray-500 mt-1">เฉพาะ superadmin</p>
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <input
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="วางลิงก์ CSV (output=csv) ที่ Publish แล้ว"
              className="flex-1 h-10 px-3 text-sm rounded-2xl bg-white border border-gray-200/70 shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setImporting(true);
                  setError("");
                  try {
                    const res = await fetch("/api/smart-health/elderly/import", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ yearBE, csvUrl: importUrl, dryRun: true }),
                    });
                    const json = await res.json();
                    if (!res.ok || !json?.success) throw new Error(json?.message || "Preview ไม่สำเร็จ");
                    setImportPreview(json);
                  } catch (e) {
                    setImportPreview(null);
                    setError(e?.message || "เกิดข้อผิดพลาด");
                  } finally {
                    setImporting(false);
                  }
                }}
                disabled={importing || !importUrl.trim()}
                className="h-10 px-4 text-sm rounded-2xl border border-gray-200/70 bg-white hover:bg-gray-50 disabled:opacity-50 shadow-sm"
              >
                {importing ? "กำลังตรวจ..." : "Preview"}
              </button>
              <button
                onClick={async () => {
                  setImporting(true);
                  setError("");
                  try {
                    const res = await fetch("/api/smart-health/elderly/import", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ yearBE, csvUrl: importUrl, dryRun: false }),
                    });
                    const json = await res.json();
                    if (!res.ok || !json?.success) throw new Error(json?.message || "Import ไม่สำเร็จ");
                    setImportPreview(json);
                    await fetchSummary();
                  } catch (e) {
                    setError(e?.message || "เกิดข้อผิดพลาด");
                  } finally {
                    setImporting(false);
                  }
                }}
                disabled={importing || !importUrl.trim()}
                className="h-10 px-4 text-sm rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-sm"
              >
                {importing ? "กำลังนำเข้า..." : "Import"}
              </button>
            </div>
          </div>
          {importPreview && (
            <details className="mt-3">
              <summary className="text-xs text-gray-500 cursor-pointer">
                ดูผล Preview/Import (debug)
              </summary>
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-3 overflow-auto">
                <pre>{JSON.stringify(importPreview.totals, null, 2)}</pre>
              </div>
            </details>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-3xl bg-amber-50/80 backdrop-blur ring-1 ring-amber-200 shadow-sm p-4 flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center ring-1 ring-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900">โหลดข้อมูลไม่ได้</p>
            <p className="text-sm text-amber-800 mt-1">{error}</p>
            <p className="text-xs text-amber-700 mt-2">
              ถ้าเพิ่ง Import: ตรวจว่าลิงก์เป็น CSV จริง (output=csv) และเลือกปีถูกต้อง
            </p>
          </div>
        </div>
      )}

      {/* Criteria / thresholds (collapsible) */}
      <details className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm p-5">
        <summary className="text-sm font-semibold text-gray-900 cursor-pointer select-none">
          เกณฑ์การประเมินสถานะ (กดเพื่อเปิด/ปิด)
        </summary>
        <div className="mt-4">
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
              <p><span className="font-medium">ต่ำ</span>: ตัวบน &lt; 90 หรือ ตัวล่าง &lt; 60</p>
              <p><span className="font-medium">ปกติ</span>: ตัวบน &lt; 120 และตัวล่าง &lt; 80</p>
              <p><span className="font-medium">สูง</span>: ตัวบน ≥ 140 หรือ ตัวล่าง ≥ 90</p>
              <p><span className="font-medium">เสี่ยง</span>: อื่น ๆ (เช่น 120–139 หรือ 80–89)</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ในสรุป BP: <span className="font-medium">“เสี่ยง/ผิดปกติ”</span> = เสี่ยง + สูง
            </p>
            <p className="text-xs text-gray-500 mt-1">
              คะแนนสถานะ (เพื่อหา “ค่าเฉลี่ยความดัน”): ต่ำ=-1, ปกติ=0, เสี่ยง=1, สูง=2
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          หมายเหตุ: ถ้าไม่มีน้ำหนัก/ส่วนสูง หรือ BP ไม่ครบ ระบบจะแสดงเป็น <span className="font-medium">“ไม่ระบุ”</span> และจะไม่นับเป็น “เสี่ยง”
        </p>
        </div>
      </details>

      {/* Extra summary (averages) */}
      {data?.averages && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-900">BMI เฉลี่ย (ทั้งห้อง)</p>
            <p className="text-3xl font-bold text-gray-900 mt-2 tracking-tight">
              {typeof data.averages.bmiAvg === "number" ? data.averages.bmiAvg.toFixed(1) : "-"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              คำนวณจาก {data.averages.bmiN ?? 0} คน (ไม่นับค่าว่าง)
            </p>
          </div>

          <div className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-900">ความดันเฉลี่ย (ทั้งห้อง)</p>
            <p className="text-3xl font-bold text-gray-900 mt-2 tracking-tight">
              {typeof data.averages.bpAvgSys === "number" && typeof data.averages.bpAvgDia === "number"
                ? `${data.averages.bpAvgSys.toFixed(0)}/${data.averages.bpAvgDia.toFixed(0)}`
                : "-"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              คำนวณจาก {data.averages.bpN ?? 0} คน (มี sys/dia ครบ)
            </p>
          </div>

          <div className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-900">คะแนนสถานะความดันเฉลี่ย</p>
            <p className="text-3xl font-bold text-gray-900 mt-2 tracking-tight">
              {typeof data.averages.bpStatusScoreAvg === "number"
                ? data.averages.bpStatusScoreAvg.toFixed(2)
                : "-"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ปกติ=0, เสี่ยง=1, สูง=2 | จาก {data.averages.bpStatusScoreN ?? 0} คน
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatCard
          title="BMI"
          icon={Activity}
          normal={data?.bmi?.normal}
          risk={data?.bmi?.risk}
          loading={loading}
          extra={
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                  <p className="text-gray-500">ผอม</p>
                  <p className="font-semibold text-gray-900">
                    {loading ? "-" : data?.bmiBreakdown?.underweight ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                  <p className="text-emerald-700">ปกติ</p>
                  <p className="font-semibold text-emerald-800">
                    {loading ? "-" : data?.bmiBreakdown?.normal ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <p className="text-amber-700">ท้วม</p>
                  <p className="font-semibold text-amber-800">
                    {loading ? "-" : data?.bmiBreakdown?.overweight ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <p className="text-amber-700">อ้วน 1</p>
                  <p className="font-semibold text-amber-800">
                    {loading ? "-" : data?.bmiBreakdown?.obese1 ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                  <p className="text-red-700">อ้วน 2</p>
                  <p className="font-semibold text-red-800">
                    {loading ? "-" : data?.bmiBreakdown?.obese2 ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                  <p className="text-gray-500">ไม่ระบุ</p>
                  <p className="font-semibold text-gray-900">
                    {loading ? "-" : data?.bmiBreakdown?.unknown ?? 0}
                  </p>
                </div>
              </div>
            </div>
          }
        />

        <StatCard
          title="ความดันโลหิต (BP)"
          icon={HeartPulse}
          normal={data?.bp?.normal}
          risk={data?.bp?.riskTotal}
          loading={loading}
          extra={
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-2">
                  <p className="text-sky-700">ต่ำ</p>
                  <p className="font-semibold text-sky-800">
                    {loading ? "-" : data?.bp?.low ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                  <p className="text-emerald-700">ปกติ</p>
                  <p className="font-semibold text-emerald-800">
                    {loading ? "-" : data?.bp?.normal ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <p className="text-amber-700">เสี่ยง</p>
                  <p className="font-semibold text-amber-800">
                    {loading ? "-" : data?.bp?.risk ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                  <p className="text-red-700">สูง</p>
                  <p className="font-semibold text-red-800">
                    {loading ? "-" : data?.bp?.high ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                  <p className="text-gray-500">ไม่ระบุ</p>
                  <p className="font-semibold text-gray-900">
                    {loading ? "-" : data?.bp?.unknown ?? 0}
                  </p>
                </div>
              </div>
            </div>
          }
        />
      </div>

      {/* Summary moved into header card */}

      {/* People table */}
      {data && (
        <div className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-200/50 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-gray-900">รายชื่อผู้สูงอายุ</p>
              <p className="text-xs text-gray-500 mt-1">
                แสดง {peopleFiltered.length} คน {riskOnly ? "(เฉพาะเสี่ยง)" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 bg-white px-3 h-10 rounded-2xl border border-gray-200/70 shadow-sm">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={riskOnly}
                  onChange={(e) => setRiskOnly(e.target.checked)}
                />
                เฉพาะคนเสี่ยง
              </label>
              <select
                value={bmiFilter}
                onChange={(e) => setBmiFilter(e.target.value)}
                className="h-10 px-3 text-sm rounded-2xl bg-white border border-gray-200/70 shadow-sm"
                title="กรองตามสถานะ BMI"
              >
                <option value="all">BMI: ทั้งหมด</option>
                <option value="underweight">BMI: ผอม</option>
                <option value="normal">BMI: ปกติ</option>
                <option value="overweight">BMI: ท้วม</option>
                <option value="obese1">BMI: อ้วน 1</option>
                <option value="obese2">BMI: อ้วน 2</option>
                <option value="unknown">BMI: ไม่ระบุ</option>
              </select>
              <select
                value={bpFilter}
                onChange={(e) => setBpFilter(e.target.value)}
                className="h-10 px-3 text-sm rounded-2xl bg-white border border-gray-200/70 shadow-sm"
                title="กรองตามสถานะความดัน"
              >
                <option value="all">BP: ทั้งหมด</option>
                <option value="normal">BP: ปกติ</option>
                <option value="low">BP: ต่ำ</option>
                <option value="risk">BP: เสี่ยง</option>
                <option value="high">BP: สูง</option>
                <option value="unknown">BP: ไม่ระบุ</option>
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ/เลขบัตร(ท้าย 4)"
                className="h-10 px-3 text-sm rounded-2xl bg-white border border-gray-200/70 shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[880px] w-full">
              <thead>
                <tr className="bg-white/70 backdrop-blur border-b border-gray-200/50 sticky top-0">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-12">
                    #
                  </th>
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
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/50">
                {peopleFiltered.map((p, idx) => {
                  const bmiInfo = bmiCategoryLabel(p?.bmiCategory);
                  const bpInfo = bpCategoryLabel(p?.bp?.category);
                  const bpText =
                    p?.bp?.systolic && p?.bp?.diastolic
                      ? `${p.bp.systolic}/${p.bp.diastolic}`
                      : "-";
                  return (
                    <tr key={`${p?.citizenIdMasked || p?.fullName || idx}`} className="hover:bg-gray-50/60">
                      <td className="py-3 px-4 text-sm text-gray-500">{idx + 1}</td>
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
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openEdit(p.personId)}
                          className="px-3 py-2 text-xs rounded-xl border border-gray-200/70 bg-white hover:bg-gray-50 shadow-sm"
                        >
                          ดู/แก้ไข
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {peopleFiltered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-sm text-gray-500">
                      ไม่พบรายการ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col ring-1 ring-gray-200/60">
            <div className="p-4 sm:p-5 border-b border-gray-200/60 bg-gradient-to-r from-white to-gray-50 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">แก้ไขข้อมูลบุคคล</p>
                <p className="text-xs text-gray-500">
                  ปี {yearBE} | {editPerson?.citizenId ? `เลขบัตร: ${editPerson.citizenId}` : ""}
                </p>
              </div>
              <button
                onClick={() => setEditOpen(false)}
                className="h-10 px-4 text-sm rounded-2xl border border-gray-200/70 bg-white hover:bg-gray-50 shadow-sm"
              >
                ปิด
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-5 space-y-5">
              {editLoading ? (
                <p className="text-sm text-gray-500">กำลังโหลด/บันทึก...</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ชื่อ-นามสกุล</label>
                      <input
                        value={editForm.fullName}
                        onChange={(e) => setEditForm((s) => ({ ...s, fullName: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ส่วนสูง (ซม.)</label>
                      <input
                        value={editForm.heightCm}
                        onChange={(e) => setEditForm((s) => ({ ...s, heightCm: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">น้ำหนักตั้งต้น (กก.)</label>
                      <input
                        value={editForm.baselineWeightKg}
                        onChange={(e) =>
                          setEditForm((s) => ({ ...s, baselineWeightKg: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        ใช้ตรวจเทียบกับคอลัมน์น้ำหนักตั้งต้นในชีต (เช่น F)
                      </p>
                      {baselineHint && (
                        <p className="text-[11px] text-amber-700 mt-1">{baselineHint}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">เบอร์โทร</label>
                      <input
                        value={editForm.phone}
                        onChange={(e) => setEditForm((s) => ({ ...s, phone: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ที่อยู่</label>
                      <input
                        value={editForm.address}
                        onChange={(e) => setEditForm((s) => ({ ...s, address: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={savePerson}
                      className="h-10 px-5 text-sm rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-sm"
                    >
                      บันทึกข้อมูลคน
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl border border-gray-200/60 overflow-hidden">
                    <div className="p-4 border-b border-gray-200/60 bg-gray-50/50">
                      <p className="text-sm font-semibold text-gray-900">ข้อมูลการมาเรียน (1–16 ครั้ง)</p>
                      <p className="text-xs text-gray-500">แก้ไขครั้งไหนกด “บันทึก” ที่แถวนั้น</p>
                    </div>
                    <div className="overflow-auto">
                      <table className="min-w-[1000px] w-full">
                        <thead>
                          <tr className="bg-white/70 backdrop-blur border-b border-gray-200/60 sticky top-0">
                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">ครั้ง</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">นน.(กก.)</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">รอบเอว</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">ชีพจร</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">BP1</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">BP2</th>
                            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">บันทึก</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200/50">
                          {Array.from({ length: 16 }, (_, i) => i + 1).map((no) => {
                            const v = editVisits.find((x) => x.visitNo === no) || {};
                            // We avoid state per row; use prompt-like minimal editing via window.prompt to keep code small
                            return (
                              <tr key={no} className="hover:bg-gray-50/60">
                                <td className="py-2 px-3 text-sm font-medium">{no}</td>
                                <td className="py-2 px-3 text-sm">{v.weightKg ?? "-"}</td>
                                <td className="py-2 px-3 text-sm">{v.waistCm ?? "-"}</td>
                                <td className="py-2 px-3 text-sm">{v.pulseBpm ?? "-"}</td>
                                <td className="py-2 px-3 text-sm">
                                  {v.bp1Sys && v.bp1Dia ? `${v.bp1Sys}/${v.bp1Dia}` : "-"}
                                </td>
                                <td className="py-2 px-3 text-sm">
                                  {v.bp2Sys && v.bp2Dia ? `${v.bp2Sys}/${v.bp2Dia}` : "-"}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    onClick={() => openVisitEdit(no)}
                                    className="px-3 py-2 text-xs rounded-xl bg-white border border-gray-200/70 hover:bg-gray-50 shadow-sm"
                                  >
                                    แก้ไข
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visit Edit Modal */}
      {visitEditOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden ring-1 ring-gray-200/60">
            <div className="p-4 sm:p-5 border-b border-gray-200/60 bg-gradient-to-r from-white to-gray-50 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">แก้ไขข้อมูลครั้งที่ {visitEditNo}</p>
                <p className="text-xs text-gray-500">ปี {yearBE}</p>
              </div>
              <button
                onClick={() => setVisitEditOpen(false)}
                className="h-10 px-4 text-sm rounded-2xl border border-gray-200/70 bg-white hover:bg-gray-50 shadow-sm"
              >
                ปิด
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">น้ำหนัก (กก.)</label>
                  <input
                    value={visitEditForm.weightKg}
                    onChange={(e) => setVisitEditForm((s) => ({ ...s, weightKg: e.target.value }))}
                    className="w-full h-10 px-3 text-sm border border-gray-200/70 rounded-2xl bg-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">รอบเอว (ซม.)</label>
                  <input
                    value={visitEditForm.waistCm}
                    onChange={(e) => setVisitEditForm((s) => ({ ...s, waistCm: e.target.value }))}
                    className="w-full h-10 px-3 text-sm border border-gray-200/70 rounded-2xl bg-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ชีพจร</label>
                  <input
                    value={visitEditForm.pulseBpm}
                    onChange={(e) => setVisitEditForm((s) => ({ ...s, pulseBpm: e.target.value }))}
                    className="w-full h-10 px-3 text-sm border border-gray-200/70 rounded-2xl bg-white shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">BP ครั้งที่ 1 (120/80)</label>
                  <input
                    value={visitEditForm.bp1}
                    onChange={(e) => setVisitEditForm((s) => ({ ...s, bp1: e.target.value }))}
                    className="w-full h-10 px-3 text-sm border border-gray-200/70 rounded-2xl bg-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">BP ครั้งที่ 2 (120/80)</label>
                  <input
                    value={visitEditForm.bp2}
                    onChange={(e) => setVisitEditForm((s) => ({ ...s, bp2: e.target.value }))}
                    className="w-full h-10 px-3 text-sm border border-gray-200/70 rounded-2xl bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-200/60 flex justify-end gap-2 bg-gray-50/60">
              <button
                onClick={() => setVisitEditOpen(false)}
                className="h-10 px-4 text-sm rounded-2xl border border-gray-200/70 bg-white hover:bg-gray-50 shadow-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveVisitFromForm}
                disabled={editLoading}
                className="h-10 px-4 text-sm rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-sm"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


