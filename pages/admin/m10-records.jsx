import { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import LayoutAdmin from "@/components/LayoutAdmin";

export default function M10RecordsPage() {
  const [asOf, setAsOf] = useState(""); // "" = ปัจจุบัน
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (cutoff) => {
    setLoading(true); setError("");
    try {
      const qs = cutoff ? `?asOf=${cutoff}` : "";
      const res = await fetch(`/api/m10-ingest/records${qs}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
      setData(d);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(""); }, [load]);

  return (
    <LayoutAdmin>
      <Head><title>ม.10 ทะเบียน (as-of)</title></Head>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">ทะเบียนกรรมสิทธิ์ (as-of)</h1>
        <div className="flex gap-2 items-end mb-4 flex-wrap">
          <div>
            <label className="label"><span className="label-text">ดู ณ วันที่ (ว่าง = ปัจจุบัน)</span></label>
            <input type="date" className="input input-bordered" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => load(asOf)}>ดูสถานะ</button>
          <button className="btn" onClick={() => { setAsOf(""); load(""); }}>ปัจจุบัน</button>
        </div>
        {error && <div className="alert alert-error mb-3">{error}</div>}
        {loading ? <span className="loading loading-spinner" /> : data && (
          <>
            <p className="mb-2 text-sm opacity-70">สถานะ ณ {data.asOf} · {data.count} รายการ</p>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead><tr><th>recordKey</th><th>โฉนด</th><th>เจ้าของ</th><th>เนื้อที่ (ตร.ม.)</th><th>เปลี่ยนแปลงล่าสุด</th><th>geom</th><th>สถานะ</th></tr></thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.recordKey}>
                      <td className="font-mono text-xs">{r.recordKey}</td>
                      <td>{r.deedNo || "-"}</td>
                      <td>{r.owners?.[0]?.fullName}</td>
                      <td>{r.area?.sqm ?? "-"}</td>
                      <td>{r.lastChangeType} ({String(r.lastTxnDate).slice(0, 10)})</td>
                      <td>{r.hasGeometry ? "✓" : "-"}</td>
                      <td><span className={`badge ${r.status === "retired" ? "badge-ghost" : "badge-success"}`}>{r.status}</span></td>
                    </tr>
                  ))}
                  {data.records.length === 0 && <tr><td colSpan={7} className="text-center opacity-60">ไม่มีทะเบียน ณ วันที่นี้</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </LayoutAdmin>
  );
}
