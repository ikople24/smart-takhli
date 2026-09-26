// lib/flood-relief/status.ts
// ประเภทคำขอ · ความเร่งด่วน · สถานะ ของศูนย์ช่วยเหลือผู้ประสบภัยน้ำท่วม — ค่าคงที่และกฎการเปลี่ยนสถานะ (logic ล้วน)
//
// ทำไมไม่ใส่ Mongoose enum ให้ FloodRequest.status: ตามกติกาเดียวกับโมดูล tasks — คุมค่าที่ชั้น API
// ด้วยไฟล์นี้ที่เดียว เพิ่ม/เปลี่ยนสถานะภายหลังจะไม่ทำให้ save เอกสารเก่าล้ม

// ─── ประเภทคำขอ ───────────────────────────────────────────────

export const REQUEST_TYPES = ["evac", "drain", "sand", "other"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_TYPE_META: Readonly<Record<RequestType, { label: string; shortLabel: string; description: string }>> =
  Object.freeze({
    evac: { label: "อพยพผู้ป่วย", shortLabel: "อพยพ", description: "ผู้ป่วย ผู้สูงอายุ ผู้พิการ" },
    drain: { label: "การระบายน้ำ", shortLabel: "ระบายน้ำ", description: "น้ำท่วมขัง ท่ออุดตัน" },
    sand: { label: "ขอกระสอบทราย", shortLabel: "กระสอบทราย", description: "กั้นน้ำเข้าบ้าน" },
    other: { label: "ผลกระทบอื่น ๆ", shortLabel: "อื่น ๆ", description: "อาหาร น้ำดื่ม ไฟฟ้า" },
  });

export function isRequestType(v: unknown): v is RequestType {
  return typeof v === "string" && (REQUEST_TYPES as readonly string[]).includes(v);
}

// ─── ความเร่งด่วน ─────────────────────────────────────────────

/** เรียงจากด่วนที่สุด — ลำดับนี้ใช้เรียงรายการด้วย */
export const URGENCIES = ["critical", "urgent", "normal"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const URGENCY_META: Readonly<Record<Urgency, { label: string; description: string; pin: string }>> = Object.freeze({
  critical: { label: "ด่วนมาก", description: "มีผู้ป่วย / อันตราย", pin: "#C62839" },
  urgent: { label: "ด่วน", description: "น้ำกำลังขึ้น", pin: "#E8891D" },
  normal: { label: "ทั่วไป", description: "รอตามลำดับคิวได้", pin: "#6B6880" },
});

/** สีหมุดคำขอที่ปิดแล้ว (ทับสีความเร่งด่วน) */
export const DONE_PIN_COLOR = "#1B935A";

export function isUrgency(v: unknown): v is Urgency {
  return typeof v === "string" && (URGENCIES as readonly string[]).includes(v);
}

export function urgencyRank(u: string | null | undefined): number {
  const i = (URGENCIES as readonly string[]).indexOf(String(u));
  return i < 0 ? URGENCIES.length : i;
}

/** ค่าเริ่มต้นในฟอร์ม: อพยพผู้ป่วย = ด่วนมาก, อื่น ๆ = ด่วน */
export function defaultUrgencyForType(type: string | null | undefined): Urgency {
  return type === "evac" ? "critical" : "urgent";
}

// ─── สถานะ ────────────────────────────────────────────────────

/** ลำดับงานหลัก — เดินหน้าได้ทีละขั้น */
export const STATUS_FLOW = ["received", "assigning", "dispatched", "on_site", "done"] as const;
export const STATUSES = [...STATUS_FLOW, "cancelled"] as const;
export type FloodStatus = (typeof STATUSES)[number];

export const STATUS_META: Readonly<Record<FloodStatus, { label: string; ink: string }>> = Object.freeze({
  received: { label: "รอมอบหมาย", ink: "#B92544" },
  assigning: { label: "กำลังจัดทีม", ink: "#9E6206" },
  dispatched: { label: "ทีมออกเดินทาง", ink: "#1D4299" },
  on_site: { label: "ทีมถึงจุดแล้ว", ink: "#0A656E" },
  done: { label: "เสร็จสิ้น", ink: "#14714A" },
  cancelled: { label: "ยกเลิก (ติดต่อไม่ได้/ซ้ำ)", ink: "#6B6880" },
});

export const CLOSED_STATUSES: readonly FloodStatus[] = Object.freeze(["done", "cancelled"]);
export const OPEN_STATUSES: readonly FloodStatus[] = Object.freeze(
  STATUSES.filter((s) => !CLOSED_STATUSES.includes(s))
);

export function isStatus(v: unknown): v is FloodStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

export function isClosedStatus(s: string | null | undefined): boolean {
  return CLOSED_STATUSES.includes(s as FloodStatus);
}

/** ยังไม่มีทีมออกเดินทาง — ใช้ตัดสิน isOverdue */
export function isBeforeDispatch(s: string | null | undefined): boolean {
  return s === "received" || s === "assigning";
}

/** ฟิลด์เวลาที่ต้องประทับเมื่อเข้าสถานะนั้น (ใช้ใน PATCH ที่เดียว) */
export const STATUS_TIMESTAMP_FIELD: Readonly<Partial<Record<FloodStatus, string>>> = Object.freeze({
  dispatched: "dispatchedAt",
  on_site: "onSiteAt",
  done: "doneAt",
  cancelled: "cancelledAt",
});

export type TransitionResult = {
  ok: boolean;
  direction: "forward" | "backward" | "cancel" | "same" | "invalid";
  reason?: string;
};

/**
 * กฎการกดอัปเดตสถานะ (README หน้าจอ 4 ข้อ 6):
 * - เดินหน้าได้ทีละ 1 ขั้นตาม STATUS_FLOW (ห้ามข้าม)
 * - ยกเลิกได้จากสถานะที่ยังไม่ปิด
 * - ถอยหลัง / เปิดคำขอที่ยกเลิกกลับมา ได้เฉพาะหัวหน้ากอง/superadmin (canRewind)
 */
export function statusTransition(from: string, to: string, opts: { canRewind?: boolean } = {}): TransitionResult {
  const { canRewind = false } = opts;
  if (!isStatus(from) || !isStatus(to)) return { ok: false, direction: "invalid", reason: "สถานะไม่ถูกต้อง" };
  if (from === to) return { ok: false, direction: "same", reason: "อยู่สถานะนี้อยู่แล้ว" };

  if (to === "cancelled") {
    if (isClosedStatus(from)) return { ok: false, direction: "cancel", reason: "คำขอนี้ปิดไปแล้ว" };
    return { ok: true, direction: "cancel" };
  }

  if (from === "cancelled") {
    return canRewind
      ? { ok: true, direction: "backward" }
      : { ok: false, direction: "backward", reason: "เปิดคำขอที่ยกเลิกแล้วได้เฉพาะหัวหน้ากอง/superadmin" };
  }

  const a = STATUS_FLOW.indexOf(from as (typeof STATUS_FLOW)[number]);
  const b = STATUS_FLOW.indexOf(to as (typeof STATUS_FLOW)[number]);
  if (b < a) {
    return canRewind
      ? { ok: true, direction: "backward" }
      : { ok: false, direction: "backward", reason: "ย้อนสถานะได้เฉพาะหัวหน้ากอง/superadmin" };
  }
  if (b - a > 1) return { ok: false, direction: "forward", reason: "ห้ามข้ามขั้น — เลื่อนได้ทีละขั้น" };
  return { ok: true, direction: "forward" };
}

// ─── ไทม์ไลน์ฝั่งประชาชน 4 ขั้น ────────────────────────────────

export const CITIZEN_STEPS = Object.freeze(["รับเรื่องแล้ว", "กำลังจัดทีม", "เจ้าหน้าที่ถึงจุด", "ช่วยเหลือเสร็จสิ้น"]);

/**
 * สถานะ → ขั้นที่ประชาชนเห็น (0–3) · assigning+dispatched รวมเป็นขั้น "กำลังจัดทีม"
 * cancelled → -1 (หน้าสถานะแสดงข้อความยกเลิกแทนไทม์ไลน์)
 */
export function citizenStepIndex(status: string | null | undefined): number {
  switch (status) {
    case "received":
      return 0;
    case "assigning":
    case "dispatched":
      return 1;
    case "on_site":
      return 2;
    case "done":
      return 3;
    case "cancelled":
      return -1;
    default:
      return 0;
  }
}
