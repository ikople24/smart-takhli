// lib/flood-relief/statusChange.ts
// แปลง "เปลี่ยนสถานะจาก A → B" เป็นชุด $set/$unset ของ FloodRequest (logic ล้วน — ใช้ใน PATCH requests/[id] ที่เดียว)
// เดินหน้า = ประทับเวลาของสถานะใหม่ · ถอยหลัง/เปิดคำขอที่ยกเลิกกลับมา = ล้างเวลาของขั้นที่ถอยผ่าน
// ให้เวลาในไทม์ไลน์ตรงกับสถานะจริงเสมอ (หน้าสถานะประชาชนอ่านเวลาเหล่านี้ตรง ๆ)

import { STATUS_FLOW, STATUS_META, STATUS_TIMESTAMP_FIELD, statusTransition, type FloodStatus } from "./status";

export type StatusChange =
  | { ok: false; reason: string }
  | { ok: true; set: Record<string, unknown>; unset: string[]; event: string };

export function planStatusChange(
  from: string,
  to: string,
  opts: { canRewind: boolean; now: Date; reason?: string }
): StatusChange {
  const t = statusTransition(from, to, { canRewind: opts.canRewind });
  if (!t.ok) return { ok: false, reason: t.reason ?? "เปลี่ยนสถานะไม่ได้" };
  if (t.direction === "backward" && !String(opts.reason ?? "").trim()) {
    return { ok: false, reason: "ย้อนสถานะต้องระบุเหตุผล" };
  }

  const set: Record<string, unknown> = { status: to };
  const unset: string[] = [];
  const stamp = STATUS_TIMESTAMP_FIELD[to as FloodStatus];
  if (stamp) set[stamp] = opts.now;

  if (t.direction === "backward") {
    if (from === "cancelled") unset.push("cancelledAt");
    const toIdx = STATUS_FLOW.indexOf(to as (typeof STATUS_FLOW)[number]);
    for (const s of STATUS_FLOW.slice(toIdx + 1)) {
      const f = STATUS_TIMESTAMP_FIELD[s];
      if (f) unset.push(f);
    }
  }

  const label = STATUS_META[to as FloodStatus].label;
  const event =
    t.direction === "backward"
      ? `ย้อนสถานะเป็น "${label}" — ${String(opts.reason).trim()}`
      : t.direction === "cancel" && opts.reason?.trim()
        ? `${label} — ${opts.reason.trim()}`
        : label;
  return { ok: true, set, unset: unset.filter((f) => !(f in set)), event };
}
