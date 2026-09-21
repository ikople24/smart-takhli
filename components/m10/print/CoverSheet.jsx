// ใบปก = บัญชีคุมนิติกรรมรายเดือน
// หมายเหตุ: ไม่พิมพ์คอลัมน์ "คีย์แล้ว/ค้างคีย์" — สถานะคีย์เปลี่ยนทุกวัน กระดาษที่พิมพ์แล้วจะล้าสมัยทันที
// (API ยังคืน keyed/pendingKey อยู่ ถ้าต้องการเอากลับมาแสดง)
export default function CoverSheet({ book }) {
  const { cover, periodLabel, batchCount, printedAt, printedBy } = book;
  const printedLabel = printedAt
    ? new Date(printedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "long", timeStyle: "short" })
    : "-";

  return (
    <section className="m10p-cover">
      <header className="m10p-head">
        <h1>เทศบาลเมืองตาคลี</h1>
        <h2>บัญชีคุมนิติกรรมที่ดินและสิ่งปลูกสร้าง</h2>
        <h3>ประจำเดือน {periodLabel}</h3>
        <p className="m10p-meta">
          งวดข้อมูล {book.period} · นำเข้า {batchCount} ครั้ง · พิมพ์เมื่อ {printedLabel}
          {printedBy ? ` · โดย ${printedBy}` : ""}
        </p>
      </header>

      <table className="m10p-table">
        <thead>
          <tr>
            <th>ชนิดเอกสาร</th>
            <th>นิติกรรม</th>
            <th>หมวด</th>
            <th>กระทบภาษี</th>
            <th className="m10p-num">จำนวน</th>
          </tr>
        </thead>
        <tbody>
          {cover.rows.map((r, i) => (
            <tr key={`${r.docType}-${r.rawStatus}-${i}`}>
              <td>{r.docTypeLabel}</td>
              <td>{r.rawStatus}</td>
              <td className={`m10p-cat-cell m10p-ct-${r.changeType}`}>{r.changeTypeLabel}</td>
              <td className="m10p-center">{r.taxRelevant ? "✓" : "—"}</td>
              <td className="m10p-num">{r.count}</td>
            </tr>
          ))}
          {cover.rows.length === 0 && (
            <tr><td colSpan={5} className="m10p-center">ไม่มีรายการในงวดนี้</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4}>รวม</th>
            <th className="m10p-num">{cover.totals.all}</th>
          </tr>
          <tr>
            <th colSpan={5} className="m10p-foot-note">
              กระทบภาษี {cover.totals.taxRelevant} · ไม่กระทบภาษี {cover.totals.nonTaxRelevant} ·
              แผ่นงานในเล่ม {cover.totals.sheets} แผ่น
            </th>
          </tr>
        </tfoot>
      </table>

      <div className="m10p-signs">
        <div><span className="m10p-line" />ผู้จัดทำ</div>
        <div><span className="m10p-line" />หัวหน้าฝ่ายแผนที่ภาษีและทะเบียนทรัพย์สิน</div>
        <div><span className="m10p-line" />ผู้อำนวยการกองคลัง</div>
      </div>
    </section>
  );
}
