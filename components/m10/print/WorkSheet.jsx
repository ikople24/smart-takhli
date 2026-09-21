// แผ่นงานรายแปลง 5 บล็อก
function FieldRows({ fields }) {
  return (
    <dl className="m10p-fields">
      {fields.map((f, i) => (
        <div key={i} className="m10p-field">
          <dt>{f.label}</dt>
          <dd>{f.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function WorkSheet({ sheet, sectionLabel }) {
  return (
    <section className="m10p-sheet">
      <header className="m10p-sheet-head">
        <div>
          <strong className="m10p-sheet-status">{sheet.rawStatus}</strong>
          <span className="m10p-sheet-sub">
            {sheet.docTypeLabel} · {sectionLabel} · จดทะเบียน {sheet.txnDateLabel}
          </span>
        </div>
        <div className="m10p-sheet-seq">
          <span>{sheet.seqInSection}/{sheet.sectionTotal} ในหมวด</span>
          <span>แผ่นที่ {sheet.sheetNo}</span>
          <span className="m10p-badge">{sheet.reviewLabel}</span>
        </div>
      </header>

      <h4>ข้อมูลยืนยันแปลง</h4>
      <dl className="m10p-keyvals">
        <div className="m10p-field"><dt>เลขโฉนด</dt><dd>{sheet.deedNo}</dd></div>
        <div className="m10p-field"><dt>รหัสแปลง (PARCEL_COD)</dt><dd>{sheet.parcelCode}</dd></div>
      </dl>
      <FieldRows fields={sheet.identify} />

      <h4>เจ้าของ</h4>
      <FieldRows fields={sheet.owner} />
      {sheet.previousOwner && (
        <p className="m10p-note">เจ้าของเดิมที่ต้องลบออกจาก LTAX: <strong>{sheet.previousOwner}</strong></p>
      )}
      {sheet.regAmountLabel && <p className="m10p-note">ราคาจดทะเบียน: {sheet.regAmountLabel}</p>}

      <h4>{sheet.blankResultBox ? "ผลการดำเนินการ" : "ขั้นตอนคีย์ LTAX"}</h4>
      {sheet.blankResultBox ? (
        <div className="m10p-blank" />
      ) : (
        <ol className="m10p-steps">
          {sheet.steps.map((s, i) =>
            s.copyable
              ? <li key={i} className="m10p-step-field"><span>{s.label}</span><b>{s.value || "—"}</b></li>
              : <li key={i} className="m10p-step-note">{s.label}</li>
          )}
        </ol>
      )}

      <footer className="m10p-sheet-foot">
        <span>☐ คีย์ LTAX แล้ว</span>
        <span>ผู้คีย์ <span className="m10p-line-sm" /></span>
        <span>วันที่ <span className="m10p-line-sm" /></span>
        <span>หมายเหตุ <span className="m10p-line-sm" /></span>
        <em>เอกสารใช้ในราชการ — มีข้อมูลส่วนบุคคล</em>
      </footer>
    </section>
  );
}
