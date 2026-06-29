import { useState } from "react";

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const now = new Date();
const CUR_BE = now.getFullYear() + 543;
const CUR_MONTH = now.getMonth() + 1; // 1-12
// ปีย้อนหลัง 4 ปี ถึงปีปัจจุบัน (พ.ศ.)
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CUR_BE - i);

export default function IngestPanel() {
  const [file, setFile] = useState(null);
  const [year, setYear] = useState(CUR_BE);
  const [month, setMonth] = useState(CUR_MONTH);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const period = `${year}-${String(month).padStart(2, "0")}`;

  async function handleUpload(e) {
    e.preventDefault();
    setError(""); setResult(null);
    if (!file) { setError("กรุณาเลือกไฟล์ ZIP"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("period", period);
      const res = await fetch("/api/m10-ingest/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "อัปโหลดล้มเหลว");
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold mb-4">นำเข้าข้อมูลมาตรา 10 (รายเดือน)</h2>
      <form onSubmit={handleUpload} className="card bg-base-100 shadow p-4 space-y-4">
        <div>
          <label className="label"><span className="label-text">เดือนของข้อมูล</span></label>
          <div className="flex gap-2 items-center">
            <select className="select select-bordered" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {TH_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="select select-bordered w-32" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>พ.ศ. {y}</option>)}
            </select>
            <span className="text-xs opacity-50 font-mono">({period})</span>
          </div>
        </div>
        <div>
          <label className="label"><span className="label-text">ไฟล์ ZIP จากกรมที่ดิน</span></label>
          <input type="file" accept=".zip" className="file-input file-input-bordered w-full" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "กำลังประมวลผล..." : "อัปโหลดและประมวลผล"}</button>
      </form>
      {error && <div className="alert alert-error mt-4">{error}</div>}
      {result && result.skipped && (
        <div className="alert alert-info mt-4">เดือนนี้ (ไฟล์นี้) นำเข้าแล้ว — ไม่มีการเปลี่ยนแปลง</div>
      )}
      {result && !result.skipped && (
        <div className="mt-4 space-y-3">
          <div className="stats shadow w-full">
            <div className="stat"><div className="stat-title">Transactions</div><div className="stat-value text-primary">{result.counts.transactions}</div></div>
            <div className="stat"><div className="stat-title">Geometry matched</div><div className="stat-value">{result.counts.geometryMatched}</div></div>
            <div className="stat"><div className="stat-title">Quarantine</div><div className="stat-value text-warning">{result.counts.rejects}</div></div>
          </div>
          <p className="text-sm opacity-70">รายการที่กระทบกรรมสิทธิ์รอการยืนยันที่แท็บ &quot;คิวยืนยัน&quot;</p>
        </div>
      )}
    </div>
  );
}
