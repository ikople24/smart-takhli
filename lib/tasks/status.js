// lib/tasks/status.js
// สถานะเรื่องร้องเรียน + ขั้น (stage) ของงานเจ้าหน้าที่ — ค่าคงที่และกฎการเปลี่ยนขั้น (logic ล้วน)
//
// ทำไมไม่ใส่ Mongoose enum ให้ Complaint.status: schema ทั้งสองไฟล์ (models/Complaint.js,
// models/SubmittedReport.js) เก็บ status เป็น String เปล่า และข้อมูลเก่ามีค่าที่ไม่อยู่ในชุดนี้
// (เช่น "รอการตรวจสอบ") — ใส่ enum จะทำให้ save เอกสารเก่าล้มเหลว จึงคุมค่าที่ชั้น API ด้วยไฟล์นี้แทน

export const COMPLAINT_STATUS = Object.freeze({
  IN_PROGRESS: "อยู่ระหว่างดำเนินการ",
  /** ใหม่ (README หน้าจอ 3): เรื่องติดอยู่ที่หน่วยงานภายนอก เช่น กฟภ. */
  COORDINATING: "รอประสานหน่วยงานภายนอก",
  DONE: "ดำเนินการเสร็จสิ้น",
});

export const OPEN_STATUSES = Object.freeze([COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.COORDINATING]);

/** ขั้นของ stepper หน้าจอ 3 — เรียงตามลำดับการทำงานจริง */
export const STAGES = Object.freeze(["received", "site_visit", "coordinating", "awaiting_review", "closed"]);

export const STAGE_LABELS = Object.freeze({
  received: "รับเรื่อง",
  site_visit: "ลงพื้นที่",
  coordinating: "ประสานงาน",
  awaiting_review: "รอตรวจรับ",
  closed: "ปิดเรื่อง",
});

export function isClosedStatus(status) {
  return status === COMPLAINT_STATUS.DONE;
}

export function stageIndex(stage) {
  return STAGES.indexOf(stage);
}

/**
 * เอกสาร assignment เก่าไม่มี stage — ถือเป็น "รับเรื่อง" ยกเว้นปิดงานแล้ว (completedAt) → "ปิดเรื่อง"
 * @param {string | undefined | null} stage
 * @param {{ completed?: boolean }} [opts]
 */
export function normalizeStage(stage, { completed = false } = {}) {
  if (completed) return "closed";
  return stageIndex(stage) >= 0 ? stage : "received";
}

/**
 * กฎการคลิก stepper: เดินหน้าได้ทีละ 1 ขั้น (ห้ามข้าม) · ถอยหลังได้แต่ต้องใส่เหตุผล
 * @returns {{ ok: boolean, direction: 'forward'|'backward'|'same'|'invalid', needsReason: boolean, reason?: string }}
 */
export function stageTransition(from, to) {
  const a = stageIndex(from);
  const b = stageIndex(to);
  if (a < 0 || b < 0) return { ok: false, direction: "invalid", needsReason: false, reason: "ขั้นไม่ถูกต้อง" };
  if (a === b) return { ok: false, direction: "same", needsReason: false, reason: "อยู่ขั้นนี้อยู่แล้ว" };
  if (b < a) return { ok: true, direction: "backward", needsReason: true };
  if (b - a > 1) {
    return { ok: false, direction: "forward", needsReason: false, reason: "ห้ามข้ามขั้น — เลื่อนได้ทีละขั้น" };
  }
  return { ok: true, direction: "forward", needsReason: false };
}

/** stage ของ assignment → status ของเรื่อง (ให้หน้า /status ประชาชนและ LINE เห็นตรงกัน) */
export function statusForStage(stage) {
  if (stage === "closed") return COMPLAINT_STATUS.DONE;
  if (stage === "coordinating") return COMPLAINT_STATUS.COORDINATING;
  return COMPLAINT_STATUS.IN_PROGRESS;
}
