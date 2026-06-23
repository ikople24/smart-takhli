import { useState } from "react";
import Head from "next/head";
import LayoutAdmin from "@/components/LayoutAdmin";

export default function M10IngestPage() {
  const [file, setFile] = useState(null);
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    e.preventDefault();
    setError(""); setResult(null);
    if (!file) { setError("กรุณาเลือกไฟล์ ZIP"); return; }
    if (!/^\d{4}-\d{2}$/.test(period)) { setError("period ต้องเป็นรูปแบบ พ.ศ.-เดือน เช่น 2569-01"); return; }
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
    <LayoutAdmin>
      <Head><title>ม.10 นำเข้าข้อมูล</title></Head>
      <div className="p-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">นำเข้าข้อมูลมาตรา 10 (รายเดือน)</h1>
        <form onSubmit={handleUpload} className="card bg-base-100 shadow p-4 space-y-4">
          <div>
            <label className="label"><span className="label-text">เดือน (พ.ศ.-เดือน)</span></label>
            <input className="input input-bordered w-40" placeholder="2569-01" value={period} onChange={(e) => setPeriod(e.target.value)} />
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
            <p className="text-sm opacity-70">รายการที่กระทบกรรมสิทธิ์รอการยืนยันที่หน้า &quot;ม.10 คิวยืนยัน&quot;</p>
          </div>
        )}
      </div>
    </LayoutAdmin>
  );
}
