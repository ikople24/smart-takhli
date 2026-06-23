import { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import LayoutAdmin from "@/components/LayoutAdmin";

export default function M10ReviewPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/m10-ingest/transactions?reviewStatus=pending");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลล้มเหลว");
      setItems(data.items);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(id, action) {
    const res = await fetch(`/api/m10-ingest/transactions/${id}/${action}`, { method: "POST" });
    if (res.ok) setItems((prev) => prev.filter((x) => x._id !== id));
    else { const d = await res.json(); setError(d.error || "ทำรายการไม่สำเร็จ"); }
  }

  return (
    <LayoutAdmin>
      <Head><title>ม.10 คิวยืนยัน</title></Head>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">คิวยืนยันการเปลี่ยนแปลง (รอดำเนินการ {items.length})</h1>
        {error && <div className="alert alert-error mb-3">{error}</div>}
        {loading ? <span className="loading loading-spinner" /> : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead><tr><th>วันที่</th><th>ประเภท</th><th>สถานะเดิม</th><th>โฉนด</th><th>recordKey</th><th>เจ้าของ</th><th>เนื้อที่ (ตร.ม.)</th><th></th></tr></thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t._id}>
                    <td>{t.txnDate?.slice(0, 10)}</td>
                    <td><span className="badge">{t.changeType}</span></td>
                    <td>{t.rawStatus}</td>
                    <td>{t.deedNo || "-"}</td>
                    <td className="font-mono text-xs">{t.recordKey || "-"}</td>
                    <td>{t.owner?.fullName}</td>
                    <td>{t.area?.sqm ?? "-"}</td>
                    <td className="flex gap-2">
                      <button className="btn btn-xs btn-success" onClick={() => act(t._id, "confirm")}>ยืนยัน</button>
                      <button className="btn btn-xs btn-error" onClick={() => act(t._id, "reject")}>ปฏิเสธ</button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={8} className="text-center opacity-60">ไม่มีรายการรอยืนยัน</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </LayoutAdmin>
  );
}
