import type { AssignmentKind, LiveStatus, Weekday } from "@/types/garbage";

/** ชื่อวันในสัปดาห์ index ตรงกับ Weekday 0..6 */
export const WEEKDAY_TH: string[] = [
  "อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์",
];

export function weekdayName(weekday: Weekday | number): string {
  return WEEKDAY_TH[weekday] ?? "";
}

/** ป้ายชนิดงานมอบหมาย — "normal" ไม่ต้องแสดงป้าย จึงคืนค่าว่าง */
export const KIND_LABEL_TH: Record<AssignmentKind, string> = {
  normal: "",
  // ต่อท้ายด้วย zoneLabel(coverForRouteCode) ได้เลย → "แทนโซน 5"
  substitute: "แทน",
  day_off: "วันหยุด",
  special: "พิเศษ",
};

/** โซน 1–7 เท่านั้นที่กองสาธารณสุขเรียกว่า "โซน" — R13 คือรถยกภาชนะรองรับ ไม่ใช่โซน */
const ZONE_CODE_RE = /^R([1-7])$/u;

/**
 * "R1" → "โซน 1" — รหัสสายเป็นคีย์ในฐานข้อมูล/URL เท่านั้น ผู้ใช้ต้องเห็นเป็น "โซน"
 * รหัสที่ไม่ใช่โซน 1–7 (เช่น R13 รถยกภาชนะรองรับ) คืนค่าเดิม ให้ผู้เรียกใช้ชื่อสายแทน
 */
export function zoneLabel(routeCode: string | null | undefined): string {
  if (!routeCode) return "";
  const m = ZONE_CODE_RE.exec(routeCode);
  return m ? `โซน ${m[1]}` : routeCode;
}

/** รหัสสายรูปแบบ R + ตัวเลข ใช้จัดลำดับสายที่ไม่ใช่โซน (R13) ให้คงที่ */
const NUMBERED_CODE_RE = /^R(\d+)$/u;

/**
 * คีย์สำหรับเรียงสาย: โซน 1–7 มาก่อนตามเลขโซน แล้วค่อยสายที่ไม่ใช่โซน (R13 รถยกภาชนะรองรับ)
 * เรียงตามรหัสตรง ๆ ไม่ได้ เพราะเป็นสตริง — "R13" จะแทรกระหว่าง "R1" กับ "R2"
 * งานที่ไม่ผูกสาย (วันหยุด) ไม่มีรหัส จึงไปท้ายสุด
 */
export function zoneOrder(routeCode: string | null | undefined): number {
  if (!routeCode) return 900;
  const zone = ZONE_CODE_RE.exec(routeCode);
  if (zone) return Number(zone[1]);
  const numbered = NUMBERED_CODE_RE.exec(routeCode);
  return numbered ? 100 + Number(numbered[1]) : 800;
}

/** 1 → "รถเบอร์ 1" — คำที่กองสาธารณสุขใช้เรียกรถแต่ละคัน */
export function truckLabel(truckNumber: number | null | undefined): string {
  if (truckNumber == null) return "";
  return `รถเบอร์ ${truckNumber}`;
}

export const LIVE_STATUS_TH: Record<LiveStatus, string> = {
  running: "กำลังวิ่ง",
  upcoming: "ยังไม่เริ่ม",
  finished: "เสร็จแล้ว",
  unknown: "ไม่มีข้อมูล",
};
