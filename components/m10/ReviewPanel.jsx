import { useEffect, useState, useCallback } from "react";

export default function ReviewPanel() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/m10-ingest/transactions?reviewStatus=pending");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลล้มเหลว");
      setItems(data.items);
      setSelected(new Set());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(id, action) {
    const res = await fetch(`/api/m10-ingest/transactions/${id}/${action}`, { method: "POST" });
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x._id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } else { const d = await res.json(); setError(d.error || "ทำรายการไม่สำเร็จ"); }
  }

  const allChecked = items.length > 0 && selected.size === items.length;

  function toggleAll(e) {
    setSelected(e.target.checked ? new Set(items.map((t) => t._id)) : new Set());
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function confirmSelected() {
    const ids = items.filter((t) => selected.has(t._id)).map((t) => t._id);
    if (ids.length === 0) return;
    // ยืนยันแล้วระบบจะสร้างทะเบียนตามรายการ — ย้อนกลับเองไม่ได้ จึงถามก่อน
    if (!window.confirm(`ยืนยัน ${ids.length} รายการ และสร้างทะเบียนตามนี้?`)) return;

    setBusy(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/m10-ingest/transactions/bulk-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ยืนยันไม่สำเร็จ");

      const done = new Set(data.confirmed);
      setItems((prev) => prev.filter((x) => !done.has(x._id)));
      setSelected(new Set());
      setNotice(`ยืนยันแล้ว ${data.confirmed.length} รายการ`);
      if (data.failed?.length) {
        setError(`มี ${data.failed.length} รายการที่ยืนยันไม่สำเร็จ: ${data.failed[0].error}`);
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xl font-bold">คิวยืนยันการเปลี่ยนแปลง (รอดำเนินการ {items.length})</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-70">เลือกแล้ว {selected.size}</span>
          <button
            className="btn btn-sm btn-success"
            disabled={selected.size === 0 || busy}
            onClick={confirmSelected}
          >
            {busy ? "กำลังยืนยัน..." : `ยืนยันที่เลือก (${selected.size})`}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error mb-3">{error}</div>}
      {notice && <div className="alert alert-success mb-3">{notice}</div>}

      {loading ? <span className="loading loading-spinner" /> : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allChecked}
                    onChange={toggleAll}
                    disabled={items.length === 0 || busy}
                    title="เลือกทั้งหมด"
                  />
                </th>
                <th>วันที่</th><th>ประเภท</th><th>สถานะเดิม</th><th>โฉนด</th>
                <th>recordKey</th><th>เจ้าของ</th><th>เนื้อที่ (ตร.ม.)</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t._id} className={selected.has(t._id) ? "bg-base-200" : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={selected.has(t._id)}
                      onChange={() => toggleOne(t._id)}
                      disabled={busy}
                    />
                  </td>
                  <td>{t.txnDate?.slice(0, 10)}</td>
                  <td><span className="badge">{t.changeType}</span></td>
                  <td>{t.rawStatus}</td>
                  <td>{t.deedNo || "-"}</td>
                  <td className="font-mono text-xs">{t.recordKey || "-"}</td>
                  <td>{t.owner?.fullName}</td>
                  <td>{t.area?.sqm ?? "-"}</td>
                  <td className="flex gap-2">
                    <button className="btn btn-xs btn-success" disabled={busy} onClick={() => act(t._id, "confirm")}>ยืนยัน</button>
                    <button className="btn btn-xs btn-error" disabled={busy} onClick={() => act(t._id, "reject")}>ปฏิเสธ</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={9} className="text-center opacity-60">ไม่มีรายการรอยืนยัน</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
