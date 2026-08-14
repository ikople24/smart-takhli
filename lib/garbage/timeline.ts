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
  /** เวลาเริ่ม–สิ้นสุดงานของวันนั้น — null ได้ (รถยกภาชนะที่ยังไม่กรอกเวลา) */
  startMin: Minutes | null;
  endMin: Minutes | null;
  stops: TimelineStop[];
}

/** สถานะของสายในวันนั้น ณ เวลาหนึ่ง */
export type RunStatus = "upcoming" | "running" | "finished" | "unknown";

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
      startMin: a.startMin,
      endMin: a.endMin,
      stops: a.stops
        .filter((s) => s.served)
        .map((s) => ({ seq: s.seq, name: s.name, atMin: s.atMin })),
    }))
    .filter((r) => r.stops.length > 0);
}

/**
 * สถานะของสาย ณ เวลาหนึ่ง — ต้องรู้ก่อนว่า "เลิกงานหรือยัง" ถึงจะบอกตำแหน่งรถได้
 * ถ้าดูแต่ `currentStopIndex` จุดสุดท้ายจะค้างเป็น "รถกำลังอยู่จุดนี้" ไปทั้งเย็นทั้งคืน
 * ไม่มีเวลาเริ่ม/สิ้นสุดให้อนุมานจากเวลารายจุด · ไม่มีเวลาเลยคือ "ไม่รู้" ไม่ใช่เดาว่าเสร็จแล้ว
 */
export function runStatus(run: TimelineRun, nowMin: Minutes): RunStatus {
  const times = run.stops.map((s) => s.atMin).filter((t): t is Minutes => t != null);
  const start = run.startMin ?? (times.length > 0 ? Math.min(...times) : null);
  const end = run.endMin ?? (times.length > 0 ? Math.max(...times) : null);
  if (start == null || end == null) return "unknown";
  if (nowMin < start) return "upcoming";
  if (nowMin > end) return "finished";
  return "running";
}

/**
 * ดัชนีจุดที่รถกำลังอยู่ = จุดท้ายสุดในลิสต์ที่เวลาถึงแล้ว · -1 = ยังไม่ออกวิ่ง
 * **ใช้ได้เฉพาะตอน `runStatus` เป็น "running"** — เลิกงานแล้วค่านี้จะค้างชี้จุดสุดท้ายเสมอ
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
 * ดัชนีจุดที่รถไปถึง "ช้าที่สุด" ของวัน = จุดสุดท้ายที่รถแวะจริง · -1 เมื่อไม่มีจุดไหนมีเวลา
 * ไม่ใช่จุดท้ายลิสต์ เพราะลำดับจุดไม่ใช่ลำดับที่รถวิ่ง — ของจริงโซน 3 วันศุกร์
 * จุดท้ายลิสต์เก็บ 6.00 น. แต่รถเลิกงานจริง 11.15 น. ที่จุดกลางลิสต์
 */
export function lastTimedStopIndex(stops: TimelineStop[]): number {
  let best = -1;
  stops.forEach((s, i) => {
    if (s.atMin == null) return;
    const bestAt = best < 0 ? null : stops[best].atMin;
    if (bestAt == null || s.atMin >= bestAt) best = i;
  });
  return best;
}

/**
 * จุดที่แสดงตอนย่อ: ช่วงรอบจุดที่ยึด + จุดที่ผู้ใช้ติดตามไว้ (ต้องเห็นเสมอ ไม่ว่าอยู่ไกลแค่ไหน)
 * คงลำดับเดิมของสายไว้ ไม่จัดใหม่ ไม่งั้นคนอ่านเส้นทางจะสับสน
 *
 * `window` ปรับได้เพราะ **สายที่เลิกงานแล้วไม่มี "จุดถัดไป"** — ถ้ายังโชว์จุดที่อยู่หลังในลิสต์
 * จะได้แถวที่รถแวะไปตั้งแต่เช้า (ลำดับจุดไม่ใช่ลำดับวิ่ง) มาต่อท้ายจุดสุดท้ายของวัน อ่านแล้วงง
 */
export function visibleStops(
  stops: TimelineStop[],
  curIdx: number,
  trackedIdx: number,
  expanded: boolean,
  window: { behind: number; ahead: number } = { behind: BEHIND, ahead: AHEAD }
): TimelineStop[] {
  if (expanded) return stops;
  return stops.filter(
    (_, i) => (i >= curIdx - window.behind && i <= curIdx + window.ahead) || i === trackedIdx
  );
}
