import { useEffect, useState, useCallback, useRef } from "react";
import { formatRaiNganWa, formatSqm } from "@/lib/m10-ingest/format";
import { docTypeLabel, changeTypeLabel, periodLabel } from "@/lib/m10-ingest/print/labels";

const MIN_Q = 2;

const REVIEW_LABEL = {
  pending: "รอยืนยัน", confirmed: "ยืนยันแล้ว", rejected: "ปฏิเสธ", auto: "อัตโนมัติ",
};
const LTAX_LABEL = { pending: "ค้างคีย์", keyed: "คีย์แล้ว", skipped: "ข้าม" };

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // กันผลลัพธ์ของคำค้นเก่ามาทับคำค้นใหม่ (พิมพ์เร็ว ๆ แล้ว response สลับคิวกัน)
  const reqIdRef = useRef(0);
  const loadedQueryRef = useRef(""); // คำค้นที่เป็นเจ้าของแถวที่แสดงอยู่ตอนนี้
  const detailReqRef = useRef(0);

  const runSearch = useCallback(async (q, skip) => {
    const myReq = ++reqIdRef.current;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/m10-ingest/search?q=${encodeURIComponent(q)}&skip=${skip}`);
      const data = await res.json();
      if (myReq !== reqIdRef.current) return; // มีคำค้นใหม่แซงแล้ว ทิ้งผลเก่า
      if (!res.ok) throw new Error(data.error || "ค้นหาไม่สำเร็จ");
      if (skip === 0) loadedQueryRef.current = q;
      setRows((prev) => (skip === 0 ? data.rows : [...prev, ...data.rows]));
      setHasMore(data.hasMore);
      setSearched(true);
    } catch (e) {
      if (myReq === reqIdRef.current) setError(e.message);
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, []);

  // หน่วงก่อนยิง เพื่อไม่ให้ query ทุกตัวอักษรที่พิมพ์
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_Q) {
      reqIdRef.current += 1; // ทิ้งผลของคำค้นก่อนหน้าที่ยังค้างอยู่ ไม่ให้เด้งกลับมาหลังล้างช่องค้นหา
      setRows([]); setHasMore(false); setSearched(false); setError(""); setLoading(false);
      return;
    }
    const timer = setTimeout(() => runSearch(q, 0), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  async function openDetail(txnId) {
    const myReq = ++detailReqRef.current;
    setDetailLoading(true); setDetail(null); setError("");
    try {
      const res = await fetch(`/api/m10-ingest/search/${txnId}`);
      const data = await res.json();
      if (myReq !== detailReqRef.current) return; // มีคลิกใหม่แซงแล้ว ทิ้งผลเก่า
      if (!res.ok) throw new Error(data.error || "โหลดรายละเอียดไม่สำเร็จ");
      setDetail(data);
    } catch (e) {
      if (myReq === detailReqRef.current) setError(e.message);
    } finally {
      if (myReq === detailReqRef.current) setDetailLoading(false);
    }
  }

  function closeDetail() {
    detailReqRef.current += 1; // ทิ้งผลที่ยังค้าง ไม่ให้ modal เด้งกลับมาหลังปิด
    setDetail(null);
    setDetailLoading(false);
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">ค้นหานิติกรรมย้อนหลัง</h2>
      <p className="text-sm opacity-70 mb-3">ค้นข้ามทุกงวดที่นำเข้าแล้ว — เห็นทุกสถานะรวมรายการที่ยังรอยืนยัน</p>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          type="search"
          className="input input-bordered input-sm w-full max-w-md"
          placeholder="ค้นหา เลขโฉนด / เลขที่ดิน / ชื่อเจ้าของ / รหัสแปลง LTAX"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && <button className="btn btn-ghost btn-sm" onClick={() => setQuery("")}>ล้างคำค้น</button>}
      </div>

      {query.trim().length > 0 && query.trim().length < MIN_Q && (
        <p className="text-sm opacity-60 mb-3">พิมพ์อย่างน้อย {MIN_Q} ตัวอักษร</p>
      )}
      {error && <div className="alert alert-error mb-3">{error}</div>}

      {searched && (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>งวด</th><th>วันที่</th><th>ประเภท</th><th>นิติกรรม</th>
                <th>โฉนด</th><th>เลขที่ดิน</th><th>เจ้าของ</th>
                <th>เนื้อที่ (ไร่-งาน-วา)</th><th>รหัสแปลง</th><th>สถานะ</th><th>LTAX</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.txnId}
                  className="cursor-pointer hover"
                  tabIndex={0}
                  role="button"
                  onClick={() => openDetail(r.txnId)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(r.txnId); } }}
                >
                  <td className="whitespace-nowrap">{periodLabel(r.period)}</td>
                  <td className="whitespace-nowrap">{String(r.txnDate).slice(0, 10)}</td>
                  <td>{docTypeLabel(r.docType)}</td>
                  <td>{changeTypeLabel(r.changeType)}</td>
                  <td>{r.deedNo || "-"}</td>
                  <td>{r.landNo || "-"}</td>
                  <td>{r.ownerName || "-"}</td>
                  <td className="whitespace-nowrap tabular-nums">
                    {r.docType === "CONSTRUCTION" ? formatSqm(r.constructionArea) : formatRaiNganWa(r.area)}
                  </td>
                  <td className="font-mono text-xs">{r.parcelCode || "-"}</td>
                  <td><span className="badge badge-sm">{REVIEW_LABEL[r.reviewStatus] || r.reviewStatus}</span></td>
                  <td>{LTAX_LABEL[r.ltaxStatus] || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={11} className="text-center opacity-60">ไม่พบรายการที่ตรงกับคำค้น</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {loading && <div className="mt-3"><span className="loading loading-spinner" /></div>}

      {hasMore && !loading && (
        <button className="btn btn-sm mt-3" onClick={() => runSearch(loadedQueryRef.current, rows.length)}>
          โหลดเพิ่ม
        </button>
      )}

      {searched && rows.length > 0 && (
        <p className="text-xs opacity-60 mt-3">แสดง {rows.length} รายการ · คลิกแถวเพื่อดูรายละเอียดเต็ม</p>
      )}

      {(detail || detailLoading) && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-3xl">
            {detailLoading ? <span className="loading loading-spinner" /> : detail && (
              <>
                <h3 className="font-bold text-lg mb-1">
                  {docTypeLabel(detail.docType)} · {changeTypeLabel(detail.changeType)}
                </h3>
                <p className="text-sm opacity-70 mb-3">
                  งวด {periodLabel(detail.period)} · วันที่ {String(detail.txnDate).slice(0, 10)} · สถานะเดิมในไฟล์: {detail.rawStatus || "-"}
                </p>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
                  <div><span className="opacity-60">โฉนด:</span> {detail.deedNo || "-"}</div>
                  <div><span className="opacity-60">รหัสแปลง:</span> {detail.parcelCode || "-"}</div>
                  <div><span className="opacity-60">เจ้าของ:</span> {detail.ownerName || "-"}</div>
                  <div><span className="opacity-60">เนื้อที่:</span> {detail.docType === "CONSTRUCTION" ? formatSqm(detail.payloadRaw?.AREA) : formatRaiNganWa(detail.area)}</div>
                  <div><span className="opacity-60">recordKey:</span> <span className="font-mono text-xs">{detail.recordKey || "-"}</span></div>
                  <div><span className="opacity-60">ราคาประเมิน:</span> {detail.regAmount ?? "-"}</div>
                  <div><span className="opacity-60">สถานะยืนยัน:</span> {REVIEW_LABEL[detail.reviewStatus] || detail.reviewStatus}
                    {detail.reviewedBy ? ` (${detail.reviewedBy} ${String(detail.reviewedAt || "").slice(0, 10)})` : ""}</div>
                  <div><span className="opacity-60">คีย์ LTAX:</span> {LTAX_LABEL[detail.ltaxStatus] || "-"}
                    {detail.ltaxKeyedBy ? ` (${detail.ltaxKeyedBy} ${String(detail.ltaxKeyedAt || "").slice(0, 10)})` : ""}</div>
                </div>

                {detail.ltaxNote && <p className="text-sm mb-3"><span className="opacity-60">หมายเหตุ:</span> {detail.ltaxNote}</p>}

                {detail.coOwnerRows?.length > 0 && (
                  <>
                    <h4 className="font-semibold text-sm mt-3 mb-1">เจ้าของร่วม ({detail.coOwnerRows.length})</h4>
                    <ul className="text-sm list-disc ms-5">
                      {detail.coOwnerRows.map((c, i) => (
                        <li key={i}>{[c.OWN_TITLE, c.OWN_FNAME, c.OWN_LNAME].filter(Boolean).join(" ")}</li>
                      ))}
                    </ul>
                  </>
                )}

                <h4 className="font-semibold text-sm mt-4 mb-1">ข้อมูลดิบจากไฟล์กรมที่ดิน</h4>
                <div className="overflow-x-auto max-h-80">
                  <table className="table table-xs">
                    <tbody>
                      {Object.entries(detail.payloadRaw || {}).map(([k, v]) => (
                        <tr key={k}>
                          <td className="font-mono text-xs opacity-70 w-1/3">{k}</td>
                          <td className="text-xs">{String(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="modal-action">
              <button className="btn btn-sm" onClick={closeDetail}>ปิด</button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closeDetail} aria-label="ปิด" />
        </dialog>
      )}
    </div>
  );
}
