import type { Minutes, RouteStop, StopMode, StopTime } from "@/types/garbage";

/** จุดเก็บที่ส่งมาจากฟอร์มแก้สาย — prevSeq = seq เดิม (null ถ้าเป็นจุดใหม่) */
export interface StopDraft {
  prevSeq: number | null;
  name: string;
  mode: StopMode;
  roadId?: string | null;
}

/** ให้เลขลำดับใหม่ 1..n ตามลำดับที่ส่งมา — เซิร์ฟเวอร์เป็นคนกำหนด seq ไม่ใช่ client */
export function assignSeq(drafts: StopDraft[]): RouteStop[] {
  return drafts.map((d, i) => ({
    seq: i + 1,
    name: d.name,
    mode: d.mode,
    roadId: d.roadId ?? null,
  }));
}

/** ตาราง seq เดิม → seq ใหม่ (จุดที่เพิ่มใหม่ไม่มีใน map, จุดที่ถูกลบก็ไม่มี) */
export function buildSeqMap(drafts: StopDraft[]): Map<number, number> {
  const map = new Map<number, number>();
  drafts.forEach((d, i) => {
    if (d.prevSeq != null) map.set(d.prevSeq, i + 1);
  });
  return map;
}

/**
 * ย้ายเวลาของแต่ละจุดไปตาม seq ใหม่ — ยึด "จุดเดิมตัวไหน" ไม่ใช่ "ตำแหน่งที่เท่าไร"
 * จุดที่ถูกลบออกจากสาย เวลาของมันหายไปด้วย
 */
export function remapStopTimes(
  prevToNew: Map<number, number>,
  stopTimes: StopTime[]
): StopTime[] {
  return stopTimes
    .flatMap((st) => {
      const next = prevToNew.get(st.seq);
      return next == null ? [] : [{ seq: next, atMin: st.atMin }];
    })
    .sort((a, b) => a.seq - b.seq);
}

/**
 * กระจายเวลาให้จุดทั้งหมดเท่า ๆ กันในช่วง startMin–endMin
 * ใช้เป็นตัวช่วยกรอก (สาย R1 มี 22 จุด) แล้วเจ้าหน้าที่ปรับรายตัวได้
 */
export function distributeStopTimes(count: number, startMin: Minutes, endMin: Minutes): StopTime[] {
  if (!Number.isInteger(count) || count < 1) return [];
  if (count === 1) return [{ seq: 1, atMin: startMin }];
  const span = endMin - startMin;
  return Array.from({ length: count }, (_, i) => ({
    seq: i + 1,
    atMin: startMin + Math.round((span * i) / (count - 1)),
  }));
}
