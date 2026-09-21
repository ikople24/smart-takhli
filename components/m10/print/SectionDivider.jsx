// ใบคั่นหมวด — ตัวใหญ่ให้เห็นตอนแยกกองกระดาษ
export default function SectionDivider({ section, firstSheetNo, lastSheetNo }) {
  return (
    <section className="m10p-divider">
      <p className="m10p-divider-doc">{section.docTypeLabel}</p>
      <h2 className="m10p-divider-title">{section.changeTypeLabel}</h2>
      <p className="m10p-divider-count">{section.count} รายการ</p>
      <p className="m10p-divider-range">แผ่นที่ {firstSheetNo}–{lastSheetNo} ของเล่ม</p>
    </section>
  );
}
