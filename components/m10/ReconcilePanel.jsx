import { useEffect, useState } from "react";

const STATUS_BADGE = { matched: "badge-success", ambiguous: "badge-warning", unmatched: "badge-error" };

export default function ReconcilePanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true); setError("");
      try {
        const url = filter ? `/api/m10-ingest/reconcile?status=${filter}` : "/api/m10-ingest/reconcile";
        const res = await fetch(url);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
        setRows(d.rows);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [filter]);

  const count = (s) => rows.filter((r) => r.status === s).length;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">จับคู่ basemap (Reconcile)</h2>
      {error && <div className="alert alert-error mb-3">{error}</div>}
      <div className="flex gap-2 mb-4">
        {["", "matched", "ambiguous", "unmatched"].map((s) => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(s)}>
            {s === "" ? "ทั้งหมด" : s}{s && ` (${count(s)})`}
          </button>
        ))}
      </div>
      {loading ? <span className="loading loading-spinner" /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead><tr><th>recordKey</th><th>โฉนด</th><th>ประเภท</th><th>สถานะ</th><th>วิธี</th><th>PARCEL_COD</th><th>candidates</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.recordKey}>
                  <td className="font-mono text-xs">{r.recordKey}</td>
                  <td>{r.deedNo || "-"}</td>
                  <td><span className="badge badge-sm">{r.changeType}</span></td>
                  <td><span className={`badge badge-sm ${STATUS_BADGE[r.status] || ""}`}>{r.status || "-"}</span></td>
                  <td className="text-xs">{r.method || "-"}</td>
                  <td className="font-mono">{r.parcelCode || "-"}</td>
                  <td className="text-xs">{r.candidates.map((c) => `${c.parcelCode}(${Math.round(c.overlapPct * 100)}%)`).join(", ") || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="text-center opacity-60">ไม่มีข้อมูล</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs opacity-60 mt-3">read-only — การเลือก candidate/สร้างรหัสใหม่เป็นงานรอบถัดไป (B)</p>
    </div>
  );
}
