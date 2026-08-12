import type { ResolvedAssignment, LivePosition, Minutes } from "@/types/garbage";

/** จุดจอดพร้อมเวลาจริง — ชนิดเดียวกับสมาชิกใน ResolvedAssignment.stops */
type TimedStop = ResolvedAssignment["stops"][number];

/**
 * คำนวณสถานะรถ ณ เวลาหนึ่ง
 * ใช้เวลาจริงของแต่ละจุด (atMin) ไม่ใช่สัดส่วนของช่วงเวลารวม
 * เพราะจุดต่าง ๆ ใช้เวลาไม่เท่ากัน — สาย R5 ใช้ 20 นาทีต่อจุดช่วงเช้า แต่ 2.5 ชั่วโมงช่วงสาย
 * (ระบบเก่าใช้ Math.floor(progress * stops.length) ทำให้ตำแหน่งเพี้ยน)
 */
export function getLivePosition(a: ResolvedAssignment, nowMin: Minutes): LivePosition {
  const empty: LivePosition = {
    status: "unknown", startsInMin: null, currentStop: null, nextStop: null,
    etaNextMin: null, currentWindow: null, progress: 0,
  };

  if (a.startMin == null || a.endMin == null) return empty;

  if (nowMin < a.startMin) {
    return { ...empty, status: "upcoming", startsInMin: a.startMin - nowMin };
  }
  if (nowMin > a.endMin) {
    return { ...empty, status: "finished", progress: 1 };
  }

  const span = a.endMin - a.startMin;
  const progress = span > 0 ? Math.min((nowMin - a.startMin) / span, 1) : 1;

  const timed = a.stops.filter((s) => s.atMin != null);
  let currentStop: TimedStop | null = null;
  let nextStop: TimedStop | null = null;

  if (timed.length > 0) {
    // จุดปัจจุบัน = จุดสุดท้ายที่เวลาถึงแล้ว
    for (const s of timed) {
      if ((s.atMin as number) <= nowMin) currentStop = s;
      else if (nextStop === null) nextStop = s;
    }
    // ถ้ายังไม่ถึงจุดแรกเลย ให้จุดแรกเป็นจุดถัดไป
    if (currentStop === null) nextStop = timed[0];
  }

  const currentWindow =
    a.communityWindows.find((w) => nowMin >= w.startMin && nowMin <= w.endMin) ?? null;

  return {
    status: "running",
    startsInMin: null,
    currentStop,
    nextStop,
    etaNextMin: nextStop?.atMin != null ? nextStop.atMin - nowMin : null,
    currentWindow,
    progress,
  };
}
