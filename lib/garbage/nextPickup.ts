import type { Minutes } from "@/types/garbage";

/** วันและเวลาที่จุดหนึ่งถูกเก็บ — atMin เป็น null คือเก็บแต่ยังไม่ระบุเวลา */
export interface PickupSlot {
  weekday: number;
  atMin: Minutes | null;
}

export interface NextPickup {
  weekday: number;
  atMin: Minutes | null;
  /** 0 = วันนี้ · 1 = พรุ่งนี้ · 7 = อีกสัปดาห์ (เก็บสัปดาห์ละครั้งและรอบวันนี้ผ่านไปแล้ว) */
  daysAhead: number;
}

/**
 * หารอบเก็บถัดไปของจุดหนึ่ง นับจากวันและเวลาปัจจุบัน
 * ไล่ไปข้างหน้าทีละวันจนครบ 7 วัน แล้ววนกลับมาวันเดิม (daysAhead = 7)
 * รอบของวันนี้ที่เวลาผ่านไปแล้วไม่นับ — แต่ถ้ายังไม่ระบุเวลา ถือว่ายังมาได้
 */
export function findNextPickup(
  slots: PickupSlot[],
  fromWeekday: number,
  fromMin: Minutes
): NextPickup | null {
  if (slots.length === 0) return null;
  for (let ahead = 0; ahead <= 7; ahead++) {
    const wd = (fromWeekday + ahead) % 7;
    const candidates = slots
      .filter((s) => s.weekday === wd)
      .filter((s) => ahead > 0 || s.atMin == null || s.atMin >= fromMin)
      .sort((a, b) => (a.atMin ?? -1) - (b.atMin ?? -1));
    if (candidates.length > 0) {
      return { weekday: wd, atMin: candidates[0].atMin, daysAhead: ahead };
    }
  }
  return null;
}
