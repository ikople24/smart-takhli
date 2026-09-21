import { useEffect, useState, useCallback, useMemo } from "react";
import { formatRaiNganWa, formatSqm } from "@/lib/m10-ingest/format";

const PER_PAGE = 20;

export default function ReviewPanel() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
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

  // ค้นหาข้ามหลายช่อง — เจ้าหน้าที่จำได้ทั้งเลขโฉนด ชื่อเจ้าของ และชื่อนิติกรรม
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) =>
      [t.deedNo, t.owner?.fullName, t.recordKey, t.rawStatus, t.changeType, t.docType]
        .some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [items, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  // ยืนยันไปหลายรายการ/ค้นหาใหม่ แล้วหน้าปัจจุบันเกินจำนวนหน้า → ดึงกลับมาหน้าสุดท้าย
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  async function act(id, action) {
    const res = await fetch(`/api/m10-ingest/transactions/${id}/${action}`, { method: "POST" });
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x._id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } else { const d = await res.json(); setError(d.error || "ทำรายการไม่สำเร็จ"); }
  }

  // ติ๊กหัวตาราง = เลือกทุกรายการที่ค้นเจอ (ข้ามหน้าด้วย) ไม่ใช่แค่ 20 แถวที่เห็น
  const allFilteredChecked = filtered.length > 0 && filtered.every((t) => selected.has(t._id));

  function toggleAllFiltered(e) {
    const ids = filtered.map((t) => t._id);
    setSelected((prev) => {
      const n = new Set(prev);
      if (e.target.checked) ids.forEach((id) => n.add(id));
      else ids.forEach((id) => n.delete(id));
      return n;
    });
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
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-xl font-bold">
          คิวยืนยันการเปลี่ยนแปลง (รอดำเนินการ {items.length})
          {query && <span className="text-sm font-normal opacity-70"> · ค้นเจอ {filtered.length}</span>}
        </h2>
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

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          type="search"
          className="input input-bordered input-sm w-full max-w-md"
          placeholder="ค้นหา เลขโฉนด / ชื่อเจ้าของ / นิติกรรม / recordKey"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
        />
        {query && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQuery(""); setPage(1); }}>ล้างคำค้น</button>
        )}
      </div>

      {error && <div className="alert alert-error mb-3">{error}</div>}
      {notice && <div className="alert alert-success mb-3">{notice}</div>}

      {loading ? <span className="loading loading-spinner" /> : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={allFilteredChecked}
                      onChange={toggleAllFiltered}
                      disabled={filtered.length === 0 || busy}
                      title={query ? `เลือกทั้งหมดที่ค้นเจอ (${filtered.length})` : `เลือกทั้งหมด (${filtered.length})`}
                    />
                  </th>
                  <th>วันที่</th><th>ประเภท</th><th>สถานะเดิม</th><th>โฉนด</th>
                  <th>recordKey</th><th>เจ้าของ</th><th>เนื้อที่ (ไร่-งาน-วา)</th><th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
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
                    <td className="whitespace-nowrap tabular-nums">
                      {t.docType === "CONSTRUCTION" ? formatSqm(t.payloadRaw?.AREA) : formatRaiNganWa(t.area)}
                    </td>
                    <td className="flex gap-2">
                      <button className="btn btn-xs btn-success" disabled={busy} onClick={() => act(t._id, "confirm")}>ยืนยัน</button>
                      <button className="btn btn-xs btn-error" disabled={busy} onClick={() => act(t._id, "reject")}>ปฏิเสธ</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center opacity-60">
                      {items.length === 0 ? "ไม่มีรายการรอยืนยัน" : "ไม่พบรายการที่ตรงกับคำค้น"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
              <span className="text-sm opacity-70">
                แสดง {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} จาก {filtered.length} รายการ
              </span>
              <div className="join">
                <button className="join-item btn btn-sm" disabled={page <= 1} onClick={() => setPage(1)}>« หน้าแรก</button>
                <button className="join-item btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</button>
                <span className="join-item btn btn-sm btn-disabled">หน้า {page}/{pageCount}</span>
                <button className="join-item btn btn-sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>ถัดไป</button>
                <button className="join-item btn btn-sm" disabled={page >= pageCount} onClick={() => setPage(pageCount)}>หน้าสุดท้าย »</button>
              </div>
            </div>
          )}
        </>
      )}
      <p className="text-xs opacity-60 mt-3">
        เนื้อที่แสดงแบบ ไร่-งาน-ตารางวา ตามโฉนด · สิ่งปลูกสร้างไม่มีไร่-งาน-วา จึงแสดงเป็นตารางเมตร ·
        ติ๊กหัวตารางเลือกทุกรายการที่ค้นเจอ (ข้ามหน้าด้วย) ไม่ใช่แค่ 20 แถวที่เห็น
      </p>
    </div>
  );
}
