import React, { useEffect, useMemo, useState } from "react";
import { Activity, HeartPulse, Droplets, RefreshCw, Info, AlertTriangle } from "lucide-react";
import { usePermissions } from "@/components/PermissionGuard";

function StatCard({ title, icon: Icon, normal, risk, loading, info, onOpenInfo, onClickNormal, onClickRisk }) {
  return (
    <div className={`rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm hover:shadow-md transition-shadow p-5 relative ${info ? "pb-12" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-100 flex items-center justify-center">
            <Icon className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">สรุปจากข้อมูลที่นำเข้า (Sheet)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onClickNormal}
          className={`rounded-2xl p-4 bg-gradient-to-br from-emerald-50/70 to-white ring-1 ring-emerald-100 text-left min-h-[88px] flex flex-col items-start ${onClickNormal ? "hover:shadow-sm transition-shadow cursor-pointer" : ""}`}
          title={onClickNormal ? "กดเพื่อกรอง: ปกติ" : undefined}
        >
          <p className="text-xs text-emerald-700 leading-none">ปกติ</p>
          <p className="text-3xl font-bold text-emerald-700 mt-auto leading-none">{loading ? "-" : normal ?? 0}</p>
        </button>
        <button
          type="button"
          onClick={onClickRisk}
          className={`rounded-2xl p-4 bg-gradient-to-br from-amber-50/70 to-white ring-1 ring-amber-100 text-left min-h-[88px] flex flex-col items-start ${onClickRisk ? "hover:shadow-sm transition-shadow cursor-pointer" : ""}`}
          title={onClickRisk ? "กดเพื่อกรอง: เสี่ยง/ผิดปกติ" : undefined}
        >
          <p className="text-xs text-amber-700 leading-none">เสี่ยง/ผิดปกติ</p>
          <p className="text-3xl font-bold text-amber-700 mt-auto leading-none">{loading ? "-" : risk ?? 0}</p>
        </button>
      </div>

      {info && (
        <button
          type="button"
          onClick={() => onOpenInfo?.(info)}
          className="absolute bottom-4 right-4 h-9 w-9 rounded-2xl border border-gray-200/70 bg-white/80 backdrop-blur shadow-sm hover:bg-white hover:shadow transition"
          title="ข้อมูลเพิ่มเติม"
        >
          <Info className="w-4 h-4 text-gray-600 mx-auto" />
        </button>
      )}
    </div>
  );
}

function bmiLabel(cat) {
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
    default:
      return { label: "ไม่ระบุ", className: "bg-gray-50 text-gray-600 border-gray-200" };
  }
}

function bpLabel(cat) {
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

function sugarLabel(cat) {
  switch (cat) {
    case "normal":
      return { label: "ปกติ", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "low":
      return { label: "ต่ำ", className: "bg-sky-50 text-sky-700 border-sky-200" };
    case "risk":
      return { label: "เสี่ยง", className: "bg-amber-50 text-amber-800 border-amber-200" };
    case "high":
      return { label: "สูง", className: "bg-red-50 text-red-700 border-red-200" };
    default:
      return { label: "ไม่ระบุ", className: "bg-gray-50 text-gray-600 border-gray-200" };
  }
}

export default function EmployeeHealthDashboard() {
  const { isSuperAdmin, loading: permissionLoading } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const [sheetUrl, setSheetUrl] = useState(
    "https://docs.google.com/spreadsheets/d/1LntpGNRJNwuUbxoq5MXtutBs2q-PUdBrBZRDzTOeGgk/edit?gid=0#gid=0"
  );
  const [gids, setGids] = useState("0");
  const [deptLabels, setDeptLabels] = useState(""); // comma-separated labels aligned with gids
  const [tab, setTab] = useState("all");

  const [riskOnly, setRiskOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [bmiFilter, setBmiFilter] = useState("all");
  const [bpFilter, setBpFilter] = useState("all");
  const [sugarFilter, setSugarFilter] = useState("all");
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoPayload, setInfoPayload] = useState(null);

  const resetFilters = () => {
    setRiskOnly(false);
    setBmiFilter("all");
    setBpFilter("all");
    setSugarFilter("all");
  };

  const mappingStatus = useMemo(() => {
    const gidArr = gids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const labelArr = deptLabels
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    return {
      gidsCount: gidArr.length,
      labelsCount: labelArr.length,
      ok: gidArr.length > 0 && labelArr.length === gidArr.length,
    };
  }, [gids, deptLabels]);

  const fetchDbSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (tab !== "all") qs.set("department", tab);
      qs.set("includePeople", "1");
      const res = await fetch(`/api/smart-health/employee-health/dashboard-db?${qs.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.message || "โหลดข้อมูลไม่สำเร็จ");
      setData(json);
    } catch (e) {
      setData(null);
      setError(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const deptOptions = useMemo(() => {
    const arr = Array.isArray(data?.departments) ? data.departments : [];
    return arr
      .map((d) => ({
        department: String(d?.department || "").trim(),
        peopleCount: typeof d?.peopleCount === "number" ? d.peopleCount : 0,
      }))
      .filter((d) => d.department);
  }, [data]);

  useEffect(() => {
    fetchDbSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // refetch when switching department tab
    fetchDbSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const syncFromSheetToDb = async () => {
    setSyncing(true);
    setError("");
    setSyncMsg("");
    try {
      const res = await fetch("/api/smart-health/employee-health/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl, gids, deptLabels }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.message || "ซิงค์ไม่สำเร็จ");
      setSyncMsg(`ซิงค์สำเร็จ (${json?.measurementDate || ""})`);
      await fetchDbSummary();
    } catch (e) {
      setError(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setSyncing(false);
    }
  };

  const peopleFiltered = useMemo(() => {
    const people = Array.isArray(data?.people) ? data.people : [];
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      if (!p) return false;
      if (riskOnly && !p.overallRisk) return false;
      if (bmiFilter !== "all" && (p.bmiCategory || "unknown") !== bmiFilter) return false;
      if (bpFilter !== "all" && (p?.bp?.category || "unknown") !== bpFilter) return false;
      if (sugarFilter !== "all" && (p?.sugarCategory || "unknown") !== sugarFilter) return false;
      if (!q) return true;
      return String(p.name || "").toLowerCase().includes(q);
    });
  }, [data, riskOnly, search, bmiFilter, bpFilter, sugarFilter]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-white to-gray-50 ring-1 ring-gray-200/60 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">สุขภาพพนักงาน (Dashboard)</h2>
            <p className="text-sm text-gray-500 mt-1">สรุปจาก Google Sheet (3 ชีต)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchDbSummary}
              className="h-10 inline-flex items-center gap-2 px-4 text-sm rounded-2xl border border-gray-200/70 bg-white/80 backdrop-blur shadow-sm hover:bg-white transition-colors"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              รีเฟรช
            </button>
          </div>
        </div>

        {/* Department tabs (from DB) */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTab("all");
            }}
            className={`h-10 px-4 text-sm rounded-2xl border shadow-sm ${
              tab === "all"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-white border-gray-200/70 text-gray-700 hover:bg-gray-50"
            }`}
            title="ดูรวมทุกแผนก"
          >
            ทั้งหมด
          </button>
          {deptOptions.map((d) => (
            <button
              key={d.department}
              type="button"
              onClick={() => {
                setTab(d.department);
              }}
              className={`h-10 px-4 text-sm rounded-2xl border shadow-sm ${
                tab === d.department
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-white border-gray-200/70 text-gray-700 hover:bg-gray-50"
              }`}
              title={`ดูเฉพาะ: ${d.department}`}
            >
              {d.department}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <input
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="วางลิงก์ Google Sheet (/edit...)"
            className="h-10 px-3 text-sm rounded-2xl bg-white border border-gray-200/70 shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <input
            value={gids}
            onChange={(e) => setGids(e.target.value)}
            placeholder="gid ของชีต (คั่นด้วย ,) เช่น 0,123,456"
            className="h-10 px-3 text-sm rounded-2xl bg-white border border-gray-200/70 shadow-sm"
          />
          <input
            value={deptLabels}
            onChange={(e) => setDeptLabels(e.target.value)}
            placeholder="ชื่อแผนก (คั่นด้วย ,) ให้ตรงกับ gid เช่น กองสาธารณสุข,กองช่าง,กองประปา"
            className="h-10 px-3 text-sm rounded-2xl bg-white border border-gray-200/70 shadow-sm"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={syncFromSheetToDb}
              disabled={syncing || !sheetUrl.trim() || !mappingStatus.ok || (!permissionLoading && !isSuperAdmin)}
              className="h-10 px-4 text-sm rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-sm"
            >
              {syncing ? "กำลังซิงค์..." : "ซิงค์เข้า DB"}
            </button>
            {syncMsg && <span className="text-xs text-emerald-700">{syncMsg}</span>}
          </div>
        </div>
        {!permissionLoading && !isSuperAdmin && (
          <p className="text-xs text-amber-700 mt-2">
            * เฉพาะ superadmin เท่านั้นที่ซิงค์เข้า DB ได้
          </p>
        )}
        {!mappingStatus.ok && (
          <p className="text-xs text-amber-700 mt-2">
            * กรุณากรอกชื่อแผนกให้ครบทุก gid (ตอนนี้ gid {mappingStatus.gidsCount} ค่า, ชื่อแผนก {mappingStatus.labelsCount} ค่า)
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          ถ้าไม่แน่ใจ gid ของชีต: เปิดแต่ละชีตใน Google Sheet แล้วดูเลขหลัง `#gid=` ใน URL
        </p>
      </div>

      {error && (
        <div className="rounded-3xl bg-amber-50/80 backdrop-blur ring-1 ring-amber-200 shadow-sm p-4 flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center ring-1 ring-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900">โหลดข้อมูลไม่ได้</p>
            <p className="text-sm text-amber-800 mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard
          title="BMI"
          icon={Activity}
          normal={data?.bmi?.normal}
          risk={data?.bmi?.risk}
          loading={loading}
          info={{
            title: "BMI คืออะไร",
            body: ["BMI = น้ำหนัก(กก.) / (ส่วนสูง(ม.)²)", "ใช้คัดกรองผอม/น้ำหนักเกิน/อ้วน"],
          }}
          onOpenInfo={(p) => {
            setInfoPayload(p);
            setInfoOpen(true);
          }}
          onClickNormal={() => {
            resetFilters();
            setBmiFilter("normal");
          }}
          onClickRisk={() => {
            resetFilters();
            setBmiFilter("all");
          }}
        />
        <StatCard
          title="ความดัน (BP)"
          icon={HeartPulse}
          normal={data?.bp?.normal}
          risk={data?.bp?.riskTotal}
          loading={loading}
          info={{
            title: "ความดัน (BP) คืออะไร",
            body: ["ตัวบน/ตัวล่าง เช่น 120/80", "สรุป “เสี่ยง/ผิดปกติ” = ต่ำ + เสี่ยง + สูง"],
          }}
          onOpenInfo={(p) => {
            setInfoPayload(p);
            setInfoOpen(true);
          }}
          onClickNormal={() => {
            resetFilters();
            setBpFilter("normal");
          }}
          onClickRisk={() => {
            resetFilters();
            setBpFilter("all");
          }}
        />
        <StatCard
          title="ค่าน้ำตาลในเลือด"
          icon={Droplets}
          normal={data?.sugar?.normal}
          risk={(data?.sugar?.risk ?? 0) + (data?.sugar?.high ?? 0) + (data?.sugar?.low ?? 0)}
          loading={loading}
          info={{
            title: "ค่าน้ำตาลในเลือด (mg/dL)",
            body: [
              "ในระบบนี้ใช้เกณฑ์คัดกรองแบบทั่วไป: <70 ต่ำ, 70–99 ปกติ, 100–125 เสี่ยง, ≥126 สูง",
              "ถ้าเป็นน้ำตาลปลายนิ้ว/หลังอาหาร ควรตีความตามบริบทหน่วยงาน",
            ],
          }}
          onOpenInfo={(p) => {
            setInfoPayload(p);
            setInfoOpen(true);
          }}
          onClickNormal={() => {
            resetFilters();
            setSugarFilter("normal");
          }}
          onClickRisk={() => {
            resetFilters();
            setSugarFilter("risk");
          }}
        />
      </div>

      {/* Filters + table */}
      <div className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-200/50 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-gray-900">รายชื่อพนักงาน</p>
            <p className="text-xs text-gray-500 mt-1">แสดง {peopleFiltered.length} คน {riskOnly ? "(เฉพาะเสี่ยง)" : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 bg-white px-3 h-10 rounded-2xl border border-gray-200/70 shadow-sm">
              <input type="checkbox" className="checkbox checkbox-sm" checked={riskOnly} onChange={(e) => setRiskOnly(e.target.checked)} />
              เฉพาะคนเสี่ยง
            </label>
            <select value={bmiFilter} onChange={(e) => setBmiFilter(e.target.value)} className="h-10 px-3 text-sm rounded-2xl bg-white border border-gray-200/70 shadow-sm">
              <option value="all">BMI: ทั้งหมด</option>
              <option value="underweight">BMI: ผอม</option>
              <option value="normal">BMI: ปกติ</option>
              <option value="overweight">BMI: ท้วม</option>
              <option value="obese1">BMI: อ้วน 1</option>
              <option value="obese2">BMI: อ้วน 2</option>
              <option value="unknown">BMI: ไม่ระบุ</option>
            </select>
            <select value={bpFilter} onChange={(e) => setBpFilter(e.target.value)} className="h-10 px-3 text-sm rounded-2xl bg-white border border-gray-200/70 shadow-sm">
              <option value="all">BP: ทั้งหมด</option>
              <option value="normal">BP: ปกติ</option>
              <option value="low">BP: ต่ำ</option>
              <option value="risk">BP: เสี่ยง</option>
              <option value="high">BP: สูง</option>
              <option value="unknown">BP: ไม่ระบุ</option>
            </select>
            <select value={sugarFilter} onChange={(e) => setSugarFilter(e.target.value)} className="h-10 px-3 text-sm rounded-2xl bg-white border border-gray-200/70 shadow-sm">
              <option value="all">น้ำตาล: ทั้งหมด</option>
              <option value="low">น้ำตาล: ต่ำ</option>
              <option value="normal">น้ำตาล: ปกติ</option>
              <option value="risk">น้ำตาล: เสี่ยง</option>
              <option value="high">น้ำตาล: สูง</option>
              <option value="unknown">น้ำตาล: ไม่ระบุ</option>
            </select>
            <button type="button" onClick={resetFilters} className="h-10 px-4 text-sm rounded-2xl border border-gray-200/70 bg-white hover:bg-gray-50 shadow-sm">
              ล้างตัวกรอง
            </button>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ" className="h-10 px-3 text-sm rounded-2xl bg-white border border-gray-200/70 shadow-sm" />
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[980px] w-full">
            <thead>
              <tr className="bg-white/70 backdrop-blur border-b border-gray-200/50 sticky top-0">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-12">#</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">แผนก</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">ชื่อ</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">BMI</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">สถานะ BMI</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">BP</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">สถานะ BP</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">น้ำตาล</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">สถานะน้ำตาล</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">สรุป</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/50">
              {peopleFiltered.map((p, idx) => {
                const bmiInfo = bmiLabel(p?.bmiCategory);
                const bpInfo = bpLabel(p?.bp?.category);
                const sugarInfo = sugarLabel(p?.sugarCategory);
                const bpText = p?.bp?.systolic && p?.bp?.diastolic ? `${p.bp.systolic}/${p.bp.diastolic}` : "-";
                const dept = String(p?.department || "-");
                return (
                  <tr key={`${p?.personId || p?.name || "x"}:${p?.department || "d"}:${idx}`} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4 text-sm text-gray-500">{idx + 1}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{dept}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{p?.name || "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{typeof p?.bmi === "number" ? p.bmi.toFixed(1) : "-"}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${bmiInfo.className}`}>{bmiInfo.label}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{bpText}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${bpInfo.className}`}>{bpInfo.label}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{typeof p?.sugarMgDl === "number" ? p.sugarMgDl : "-"}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${sugarInfo.className}`}>{sugarInfo.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      {p?.overallRisk ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-amber-50 text-amber-800 border-amber-200">เสี่ยง</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-emerald-50 text-emerald-700 border-emerald-200">ปกติ</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {peopleFiltered.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-gray-500">
                    ไม่พบรายการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info modal */}
      {infoOpen && infoPayload && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden ring-1 ring-gray-200/60">
            <div className="p-4 sm:p-5 border-b border-gray-200/60 bg-gradient-to-r from-white to-gray-50 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{infoPayload.title || "ข้อมูลเพิ่มเติม"}</p>
                <p className="text-xs text-gray-500 mt-0.5">สำหรับทำความเข้าใจและการสื่อสารกับทีม</p>
              </div>
              <button
                onClick={() => {
                  setInfoOpen(false);
                  setInfoPayload(null);
                }}
                className="h-10 px-4 text-sm rounded-2xl border border-gray-200/70 bg-white hover:bg-gray-50 shadow-sm"
              >
                ปิด
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              {Array.isArray(infoPayload.body) && infoPayload.body.length > 0 && (
                <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                  {infoPayload.body.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

