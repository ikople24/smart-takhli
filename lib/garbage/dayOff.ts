import type { ResolvedAssignment } from "@/types/garbage";

/** สรุปว่าวันนั้นรถคันไหนวิ่ง คันไหนหยุด — นับเป็น "คัน" ไม่ใช่ "รอบ" */
export interface DayOffSummary {
  workingNumbers: number[];
  dayOffNumbers: number[];
}

const uniqueSorted = (list: ResolvedAssignment[]): number[] =>
  [...new Set(list.map((t) => t.truckNumber))].sort((x, y) => x - y);

/**
 * รถคันเดียววิ่งได้หลายรอบต่อวัน (รอบตัวเอง + รอบวิ่งแทนคันที่หยุด) จึงต้องยุบเป็นเลขคัน
 * ถ้านับรอบ วันอังคารจะกลายเป็น "หยุด 4 แถว ต่อวิ่ง 7 แถว" ทั้งที่ความจริงคือหยุด 4 คันจาก 8 คัน
 * คันที่มีทั้งงานหยุดและงานวิ่งในวันเดียวกันถือว่า "วิ่ง" ไม่งั้นชื่อรถจะขึ้นซ้ำสองฝั่ง
 */
export function summarizeDayOff(assignments: ResolvedAssignment[]): DayOffSummary {
  const workingNumbers = uniqueSorted(assignments.filter((t) => t.kind !== "day_off"));
  const dayOffNumbers = uniqueSorted(assignments.filter((t) => t.kind === "day_off")).filter(
    (n) => !workingNumbers.includes(n)
  );
  return { workingNumbers, dayOffNumbers };
}
