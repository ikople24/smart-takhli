import type { Minutes, ResolvedDaySchedule, TruckColor } from "@/types/garbage";
import { zoneLabel } from "./labels";

/** จุดหนึ่งจุดบนไทม์ไลน์ — atMin เป็น null ได้ (วันนี้เก็บแต่ยังไม่ระบุเวลา เช่นรถยกภาชนะ) */
export interface TimelineStop {
  seq: number;
  name: string;
  atMin: Minutes | null;
}

/** หนึ่งสายที่วิ่งในวันนั้น */
export interface TimelineRun {
  /** รหัสสาย — เป็นคีย์คู่กับ seq ตอนอ้างจุดที่ผู้ใช้ติดตาม (ห้ามโชว์ให้ผู้ใช้เห็น) */
  routeCode: string;
  /** คำที่ใช้เรียกจริง: "โซน 1" · "รถยกภาชนะรองรับ" */
  zoneLabel: string;
  truckNumber: number;
  truckColor: TruckColor;
  stops: TimelineStop[];
}

/** จำนวนจุดก่อน/หลังตัวรถที่ยังเห็นตอนย่อ — ท้ายมากกว่าหน้าเพราะคนอยากรู้ว่า "อีกกี่จุดถึงบ้าน" */
const BEHIND = 2;
const AHEAD = 3;

/**
 * แปลงตารางของวันหนึ่งเป็นไทม์ไลน์รายสาย
 * - เอาเฉพาะจุดที่ `served` = วันนั้นเข้าเก็บจริง (ดู `atMin == null` ตัดสินไม่ได้)
 * - ตัดงานวันหยุดและงานที่ไม่มีจุดเก็บเลย เพราะไม่มีอะไรให้ดูบนเส้นทาง
 * - คงลำดับที่ API ส่งมา (เรียงตามเวลาออกวิ่ง) — หน้าประชาชนสนใจว่ารถคันไหนออกก่อน
 */
export function buildRuns(day: ResolvedDaySchedule): TimelineRun[] {
  return day.assignments
    .filter((a) => a.kind !== "day_off")
    .map((a) => ({
      routeCode: a.routeCode ?? "",
      // ชื่อสายใน DB คือคำเรียกจริงอยู่แล้ว ("โซน 1") — zoneLabel ไว้กันกรณีชื่อว่าง
      // R13 ต้องได้ "รถยกภาชนะรองรับ" ไม่ใช่รหัส จึงเอา routeName มาก่อน
      zoneLabel: a.routeName || zoneLabel(a.routeCode),
      truckNumber: a.truckNumber,
      truckColor: a.truckColor,
      stops: a.stops
        .filter((s) => s.served)
        .map((s) => ({ seq: s.seq, name: s.name, atMin: s.atMin })),
    }))
    .filter((r) => r.stops.length > 0);
}

/**
 * ดัชนีจุดที่รถกำลังอยู่ = จุดท้ายสุดในลิสต์ที่เวลาถึงแล้ว · -1 = ยังไม่ออกวิ่ง
 * ไล่ตามลำดับในลิสต์ ไม่ใช่หาค่ามากสุด เพราะ **ลำดับจุดไม่ใช่ลำดับที่รถวิ่ง**
 * (ตารางจริงมีจุดที่ 11 ถูกเก็บก่อนจุดที่ 7) จุดที่ไม่มีเวลาไม่นับ
 */
export function currentStopIndex(stops: TimelineStop[], nowMin: Minutes): number {
  let cur = -1;
  stops.forEach((s, i) => {
    if (s.atMin != null && s.atMin <= nowMin) cur = i;
  });
  return cur;
}

/**
 * จุดที่แสดงตอนย่อ: ช่วงรอบตัวรถ + จุดที่ผู้ใช้ติดตามไว้ (ต้องเห็นเสมอ ไม่ว่าอยู่ไกลแค่ไหน)
 * คงลำดับเดิมของสายไว้ ไม่จัดใหม่ ไม่งั้นคนอ่านเส้นทางจะสับสน
 */
export function visibleStops(
  stops: TimelineStop[],
  curIdx: number,
  trackedIdx: number,
  expanded: boolean
): TimelineStop[] {
  if (expanded) return stops;
  return stops.filter(
    (_, i) => (i >= curIdx - BEHIND && i <= curIdx + AHEAD) || i === trackedIdx
  );
}
