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
