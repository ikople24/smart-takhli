// การแสดงเนื้อที่แบบไทย — ใช้ร่วมกันทุกหน้าของโมดูล เพื่อให้ตัวเลขที่เจ้าหน้าที่เห็นตรงกันหมด

export interface AreaLike {
  rai?: number | null;
  ngan?: number | null;
  wa?: number | null;
  sqm?: number | null;
}

/** ตัดศูนย์ท้ายทศนิยมออก: 24.00 → "24" · 24.50 → "24.5" */
function trimNum(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/**
 * "0-2-24" ตามธรรมเนียมโฉนด (ไร่-งาน-ตารางวา) — รูปแบบที่เจ้าหน้าที่เทียบกับโฉนดได้ตรง
 * ไม่มีข้อมูลเนื้อที่ → "-" (สิ่งปลูกสร้างไม่มี ไร่-งาน-วา ใช้ ตร.ม. แทน)
 */
export function formatRaiNganWa(area: AreaLike | null | undefined): string {
  if (!area) return "-";
  const { rai, ngan, wa } = area;
  if (rai == null && ngan == null && wa == null) return "-";
  return `${trimNum(Number(rai ?? 0))}-${trimNum(Number(ngan ?? 0))}-${trimNum(Number(wa ?? 0))}`;
}

/** ตร.ม. สำหรับสิ่งปลูกสร้าง (ไฟล์กรมที่ดินส่งคอลัมน์ AREA มาเป็นตารางเมตร) */
export function formatSqm(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${trimNum(n)} ตร.ม.`;
}
