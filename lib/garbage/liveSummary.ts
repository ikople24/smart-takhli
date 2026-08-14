import type { TruckColor } from "@/types/garbage";

/** รถหนึ่งรายการจาก GET /api/garbage/live — เอาเฉพาะฟิลด์ที่หน้าจอสาธารณะใช้ */
export interface LiveTruckLite {
  truckNumber: number;
  truckColor: TruckColor;
  kind: string;
  live?: { status: string } | null;
}

export interface LiveSummary {
  /** จำนวนรถที่กำลังวิ่ง นับเป็นคัน (รถคันเดียววิ่งได้หลายรอบต่อวัน) */
  runningCount: number;
  /** จำนวนรถที่มีงานวันนี้ (ไม่นับวันหยุด) */
  workingCount: number;
  /** ข้อความสถานะบนป้ายเล็ก — ใช้ทั้งการ์ดหน้าแรกและหัวหน้า /garbage ให้พูดตรงกัน */
  statusText: string;
  /** ให้ภาพรถวิ่งบนจอหรือไม่ — จริงเฉพาะตอนมีรถวิ่งจริง */
  moving: boolean;
  /** รถที่เอาไปโชว์รูปบนการ์ด — null = วันนี้ไม่มีรถออกเลย ต้องซ่อนรูปรถ */
  spriteTruck: { truckNumber: number; truckColor: TruckColor } | null;
}

const uniqueCount = (list: LiveTruckLite[]): number =>
  new Set(list.map((t) => t.truckNumber)).size;

/**
 * สรุปสถานะรถของวันนี้จากผล /live ให้หน้าจอสาธารณะใช้ร่วมกัน
 *
 * ลำดับการตัดสินข้อความ: ไม่มีตาราง → กำลังวิ่ง → ยังไม่ออก → เก็บครบ
 * **รถที่ยังไม่ระบุเวลาได้สถานะ `unknown` ตลอดวัน** (รถยกภาชนะรองรับ) ถ้าบังคับว่าทุกคัน
 * ต้อง `finished` การ์ดจะไม่มีวันขึ้นว่าเก็บครบเลย จึงตัดสินจากคันที่มีเวลาแล้วเท่านั้น
 * แต่ถ้าไม่มีคันที่มีเวลาเลยก็ยังสรุปว่าเก็บครบไม่ได้
 */
export function summarizeLive(trucks: LiveTruckLite[] | null | undefined): LiveSummary {
  if (trucks == null) {
    return { runningCount: 0, workingCount: 0, statusText: "ตารางรถเก็บขยะ", moving: false, spriteTruck: null };
  }

  const working = trucks.filter((t) => t.kind !== "day_off");
  const running = working.filter((t) => t.live?.status === "running");
  const upcoming = working.filter((t) => t.live?.status === "upcoming");
  const timed = working.filter((t) => t.live?.status != null && t.live.status !== "unknown");

  const runningCount = uniqueCount(running);
  const workingCount = uniqueCount(working);

  const statusText =
    workingCount === 0
      ? "วันนี้ยังไม่มีตารางในระบบ"
      : runningCount > 0
        ? `รถกำลังวิ่ง ${runningCount} คัน`
        : upcoming.length > 0
          ? `วันนี้มีรถออก ${workingCount} คัน`
          : timed.length > 0
            ? "วันนี้รถเก็บครบแล้ว"
            : `วันนี้มีรถออก ${workingCount} คัน`;

  const pick = running[0] ?? working[0] ?? null;

  return {
    runningCount,
    workingCount,
    statusText,
    moving: runningCount > 0,
    spriteTruck: pick ? { truckNumber: pick.truckNumber, truckColor: pick.truckColor } : null,
  };
}
