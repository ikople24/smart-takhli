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
  substitute: "แทนเบอร์",
  day_off: "วันหยุด",
  special: "พิเศษ",
};

export const LIVE_STATUS_TH: Record<LiveStatus, string> = {
  running: "กำลังวิ่ง",
  upcoming: "ยังไม่เริ่ม",
  finished: "เสร็จแล้ว",
  unknown: "ไม่มีข้อมูล",
};
