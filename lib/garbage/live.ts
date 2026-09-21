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

  // เรียงตามเวลาจริงเสมอ — อย่าไว้ใจลำดับจากต้นทาง (seq กับเวลาอาจไม่ตรงกัน)
  // จุดที่วันนี้ไม่เก็บต้องไม่ถูกนับ แม้จะมีเวลาค้างอยู่ในข้อมูล
  const timed = a.stops
    .filter((s): s is TimedStop & { atMin: Minutes } => s.served && s.atMin != null)
    .sort((x, y) => x.atMin - y.atMin);

  let currentStop: (TimedStop & { atMin: Minutes }) | null = null;
  let nextStop: (TimedStop & { atMin: Minutes }) | null = null;

  // จุดปัจจุบัน = จุดสุดท้ายที่เวลาถึงแล้ว, จุดถัดไป = จุดแรกที่เวลายังมาไม่ถึง
  for (const s of timed) {
    if (s.atMin <= nowMin) currentStop = s;
    else if (nextStop === null) nextStop = s;
  }

  // นาทีที่คาบเกี่ยวสองหน้าต่าง (endMin หน้าต่างแรก = startMin หน้าต่างถัดไป) ให้หน้าต่างแรกชนะ
  const currentWindow =
    a.communityWindows.find((w) => nowMin >= w.startMin && nowMin <= w.endMin) ?? null;

  return {
    status: "running",
    startsInMin: null,
    currentStop,
    nextStop,
    etaNextMin: nextStop === null ? null : nextStop.atMin - nowMin,
    currentWindow,
    progress,
  };
}
