import { useEffect, useState } from "react";

const TH_MONTH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// "2569-01" → "ม.ค. 2569"
function fmtPeriod(p) {
  const m = /^(\d{4})-(\d{2})$/.exec(p || "");
  if (!m) return p || "-";
  return `${TH_MONTH[Number(m[2])] || m[2]} ${m[1]}`;
}

function Progress({ done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <progress className="progress progress-success w-24" value={done} max={total || 1} />
      <span className="text-xs tabular-nums whitespace-nowrap">{done}/{total} ({pct}%)</span>
    </div>
  );
}

export default function SummaryPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true); setError("");
      try {
        const res = await fetch("/api/m10-ingest/summary");
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
        setRows(d.rows);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  // ยอดรวมทุกเดือน
  const tot = rows.reduce((a, r) => ({
    total: a.total + r.total, reviewPending: a.reviewPending + r.reviewPending,
    wlEligible: a.wlEligible + r.wlEligible, wlKeyed: a.wlKeyed + r.wlKeyed,
    wlPending: a.wlPending + r.wlPending, wlSkipped: a.wlSkipped + r.wlSkipped,
    deferred: a.deferred + r.deferred,
  }), { total: 0, reviewPending: 0, wlEligible: 0, wlKeyed: 0, wlPending: 0, wlSkipped: 0, deferred: 0 });

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">สรุปสถานะรายเดือน</h2>
      {error && <div className="alert alert-error mb-3">{error}</div>}

      {!loading && rows.length > 0 && (
        <div className="stats shadow w-full mb-4">
          <div className="stat"><div className="stat-title">นำเข้าทั้งหมด</div><div className="stat-value text-primary">{tot.total}</div><div className="stat-desc">{rows.length} เดือน</div></div>
          <div className="stat"><div className="stat-title">รอยืนยัน</div><div className="stat-value text-warning">{tot.reviewPending}</div></div>
          <div className="stat"><div className="stat-title">คีย์ LTAX แล้ว</div><div className="stat-value text-success">{tot.wlKeyed}</div><div className="stat-desc">จาก {tot.wlEligible} รายการที่ต้องคีย์</div></div>
          <div className="stat"><div className="stat-title">ค้างคีย์</div><div className="stat-value text-error">{tot.wlPending}</div></div>
          <div className="stat"><div className="stat-title">รอรอบหน้า</div><div className="stat-value">{tot.deferred}</div><div className="stat-desc">SPLIT/MERGE/NEW</div></div>
        </div>
      )}

      {loading ? <span className="loading loading-spinner" /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>เดือน</th>
                <th className="text-right">นำเข้า</th>
                <th className="text-right">รอยืนยัน</th>
                <th>คืบหน้าคีย์ LTAX</th>
                <th className="text-right">ค้างคีย์</th>
                <th className="text-right">ข้าม</th>
                <th className="text-right">รอรอบหน้า</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.period}>
                  <td className="font-medium whitespace-nowrap">{fmtPeriod(r.period)}</td>
                  <td className="text-right tabular-nums">{r.total}</td>
                  <td className="text-right tabular-nums">{r.reviewPending > 0 ? <span className="badge badge-warning badge-sm">{r.reviewPending}</span> : "-"}</td>
                  <td><Progress done={r.wlKeyed} total={r.wlEligible} /></td>
                  <td className="text-right tabular-nums">{r.wlPending > 0 ? <span className="badge badge-error badge-sm">{r.wlPending}</span> : "-"}</td>
                  <td className="text-right tabular-nums">{r.wlSkipped || "-"}</td>
                  <td className="text-right tabular-nums opacity-70">{r.deferred || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="text-center opacity-60">ยังไม่มีข้อมูลนำเข้า</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs opacity-60 mt-3">&quot;รอรอบหน้า&quot; = SPLIT/MERGE/NEW ที่ต้องคำนวณรหัสแปลง (Parcel Code) จาก basemap ก่อน — ยังคีย์เข้า LTAX ไม่ได้ในรอบนี้</p>
    </div>
  );
}
