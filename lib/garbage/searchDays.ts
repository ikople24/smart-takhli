import type { Minutes } from "@/types/garbage";
import { WEEKDAY_SHORT_TH } from "./labels";
import { findNextPickup, type PickupSlot } from "./nextPickup";

/**
 * แถบชิป 7 วันของผลค้นหา — ค้นชุมชนหนึ่งได้ผลเฉลี่ย 27 แถว สูงสุด 90 แถว
 * (ตาคลีใหญ่ 19 จุด × 7 วัน) การไล่ลิสต์ทุกวันพร้อมกันจึงล้นจอมือถือ
 * แบ่งเป็นชิปวันแล้วดูทีละวันแทน
 */
export interface SearchDayChip {
  /** 0 = อาทิตย์ ตาม index ของ WEEKDAY_TH */
  weekday: number;
  shortName: string;
  /** จำนวนจุดที่เก็บในวันนั้น — 0 = วันนั้นรถไม่เข้า (ชิปถูกปิด) */
  count: number;
}

/** ลำดับที่คนไทยอ่านปฏิทิน — จันทร์ก่อน อาทิตย์ท้าย (ไม่ใช่ 0..6 ดิบ) */
const CHIP_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function buildDayChips(hits: Array<{ weekday: number }>): SearchDayChip[] {
  const counts = new Map<number, number>();
  for (const h of hits) counts.set(h.weekday, (counts.get(h.weekday) ?? 0) + 1);

  // คืนครบ 7 วันเสมอแม้วันนั้นไม่มีเก็บ — แถบชิปจะได้ไม่ยืดหดตอนเปลี่ยนคำค้น
  return CHIP_ORDER.map((weekday) => ({
    weekday,
    shortName: WEEKDAY_SHORT_TH[weekday],
    count: counts.get(weekday) ?? 0,
  }));
}

/**
 * วันที่ควรเปิดให้ดูก่อน = วันของรอบเก็บถัดไป
 * ใช้ findNextPickup ตัวเดียวกับข้อความ "รอบเก็บถัดไป" ด้านบน — วันที่ถูกเลือก
 * จึงตรงกับวันที่ข้อความนั้นพูดถึงเสมอ ไม่ต้องมีกฎวันคนละชุด
 */
export function pickDefaultWeekday(
  slots: PickupSlot[],
  todayWeekday: number,
  nowMin: Minutes
): number | null {
  return findNextPickup(slots, todayWeekday, nowMin)?.weekday ?? null;
}
