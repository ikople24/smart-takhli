// lib/tasks/timeline.js
// logic หน้าจอ 3 (README): ไทม์ไลน์การดำเนินงาน, เงื่อนไขปิดเรื่อง, แผนเปลี่ยนขั้น stepper, พัก/เลิกพัก SLA — logic ล้วน
import { toDate, formatThaiDate, calendarDaysBetween } from "./format";
import { STAGE_LABELS, stageTransition, statusForStage } from "./status";

const text = (v) => String(v ?? "").trim();
const iso = (v) => {
  const d = toDate(v);
  return d ? d.toISOString() : null;
};

// kind ใน assignment.timeline → โทนสี dot
const KIND_TONE = {
  created: "done",
  note: "done",
  stage: "done",
  coordination: "coord",
  follow_up: "coord",
  blocked: "blocked",
  unblocked: "done",
  transfer: "neutral",
  closed: "done",
};
const DEFAULT_TITLE = {
  created: "มอบหมายงาน",
  note: "บันทึกการดำเนินงาน",
  stage: "เลื่อนขั้น",
  coordination: "ประสานหน่วยงาน",
  follow_up: "ติดตามการประสานงาน",
  blocked: "พักงาน — รอวัสดุ / งบประมาณ",
  unblocked: "กลับมาดำเนินการต่อ",
  transfer: "โอนงาน",
  closed: "ปิดเรื่อง",
};

/**
 * ไทม์ไลน์ของงาน = รับเรื่อง → (มอบหมาย) → รายการใน assignment.timeline → (ปิดเรื่อง) → รายการ "รออยู่" ท้ายสุด
 * เอกสารเก่าที่ไม่มี timeline: สังเคราะห์ "มอบหมาย" จาก assignedAt และ "บันทึกการดำเนินงาน" จาก note/solution เดิม
 * @returns {Array<{ key: string, kind: string, tone: string, title: string, detail?: string, at: string|null, by?: string, images?: string[], pending: boolean }>}
 */
export function buildTimeline({ complaint, assignment, derived, officerName } = {}) {
  const c = complaint ?? {};
  const a = assignment ?? {};
  const d = derived ?? {};
  const raw = Array.isArray(a.timeline) ? a.timeline : [];
  const entries = [];

  entries.push({ key: "received", kind: "received", tone: "done", title: "รับเรื่องเข้าระบบ", at: iso(c.createdAt), pending: false });

  if (!raw.some((e) => e?.kind === "created")) {
    entries.push({
      key: "assigned",
      kind: "assigned",
      tone: "done",
      title: text(officerName) ? `มอบหมายให้ ${text(officerName)}` : "มอบหมายเจ้าหน้าที่",
      at: iso(a.assignedAt),
      pending: false,
    });
  }

  raw.forEach((e, i) => {
    const kind = KIND_TONE[e?.kind] ? e.kind : "note";
    let title = text(e?.text) || DEFAULT_TITLE[kind];
    let detail;
    if (kind === "stage") {
      title = `เลื่อนขั้นเป็น "${STAGE_LABELS[e?.stage] ?? text(e?.stage) ?? "-"}"`;
      detail = text(e?.text) || undefined;
    }
    const images = Array.isArray(e?.images) && e.images.length ? e.images : undefined;
    entries.push({
      key: String(e?._id ?? `t${i}`),
      kind,
      tone: KIND_TONE[kind],
      title,
      ...(detail ? { detail } : {}),
      at: iso(e?.at),
      ...(text(e?.byName) ? { by: text(e.byName) } : {}),
      ...(images ? { images } : {}),
      pending: false,
    });
  });

  // note/solution แบบเก่า (ก่อนมี timeline)
  const legacyNote = text(a.note);
  const legacySolution = Array.isArray(a.solution) ? a.solution.filter(Boolean) : [];
  if (!raw.some((e) => e?.kind === "note") && (legacyNote || legacySolution.length)) {
    const legacyImages = Array.isArray(a.solutionImages) ? a.solutionImages.filter(Boolean) : [];
    entries.push({
      key: "legacy-note",
      kind: "note",
      tone: "done",
      title: "บันทึกการดำเนินงาน",
      detail: [legacyNote, legacySolution.length ? `วิธีแก้ไข: ${legacySolution.join(", ")}` : ""].filter(Boolean).join(" · "),
      at: iso(a.completedAt ?? a.updatedAt ?? a.assignedAt),
      ...(legacyImages.length ? { images: legacyImages } : {}),
      pending: false,
    });
  }

  if (d.isCompleted && !raw.some((e) => e?.kind === "closed")) {
    entries.push({ key: "closed", kind: "closed", tone: "done", title: "ปิดเรื่อง", at: iso(a.completedAt ?? c.updatedAt), pending: false });
  }

  // เรียงเชิงตรรกะก่อน แล้วค่อยตามเวลา: รับเรื่อง → มอบหมาย → ระหว่างทาง → ปิดเรื่อง
  // (ข้อมูลเก่า completedAt เป็นวันที่ล้วน 00:00 อาจ "ก่อน" assignedAt — เรียงตามเวลาอย่างเดียวจะได้ปิดเรื่องก่อนมอบหมาย)
  const rank = (e) => (e.key === "received" ? 0 : e.key === "assigned" || e.kind === "created" ? 1 : e.kind === "closed" ? 3 : 2);
  const ts = (e) => (e.at ? new Date(e.at).getTime() : Infinity);
  const sorted = entries
    .map((e, index) => ({ e, index }))
    .sort((x, y) => rank(x.e) - rank(y.e) || ts(x.e) - ts(y.e) || x.index - y.index)
    .map((x) => x.e);

  if (!d.isCompleted) {
    let pendingEntry;
    if (d.needsCoordination) {
      const wait = Number.isFinite(d.coordinationWaitDays) ? ` — ${d.coordinationWaitDays} วัน` : "";
      pendingEntry = { tone: "overdue", title: `รอตอบกลับจาก ${text(d.agencyName) || "หน่วยงาน"}${wait}` };
    } else if (d.isBlocked) {
      const days = Number.isFinite(d.blockedDays) ? ` ${d.blockedDays} วัน` : "";
      pendingEntry = { tone: "blocked", title: `รอวัสดุ / งบประมาณ — พัก SLA${days}` };
    } else {
      pendingEntry = { tone: "neutral", title: `กำลังดำเนินการ — ขั้น "${STAGE_LABELS[d.stage] ?? STAGE_LABELS.received}"` };
    }
    sorted.push({ key: "pending", kind: "pending", at: null, pending: true, ...pendingEntry });
  }
  return sorted;
}

/**
 * เงื่อนไขปิดเรื่อง: บันทึกสรุปบังคับเสมอ · ภาพผลงาน ≥1 หรือติ๊กยืนยันปิดโดยไม่มีภาพ
 * (`confirmNoImages` — บางเรื่องเป็นแค่การสอบถามข้อมูล ไม่มีงานภาคสนามให้ถ่าย, 2026-09-09)
 */
export function closeChecklist({ note, images, confirmNoImages } = {}) {
  const errors = [];
  const imageCount = Array.isArray(images) ? images.filter(Boolean).length : 0;
  if (imageCount === 0 && confirmNoImages !== true)
    errors.push("ยังไม่ได้แนบภาพผลงาน — ติ๊กยืนยันหากเรื่องนี้ไม่จำเป็นต้องมีภาพ (เช่น เป็นการสอบถามข้อมูล)");
  if (!text(note)) errors.push("ต้องเขียนบันทึกสรุปการดำเนินงาน");
  return { ok: errors.length === 0, errors };
}

/** กด stepper แล้วต้องเกิดอะไร — รวมกฎ stageTransition + status ของเรื่องที่ต้องตามไป */
export function stageChangePlan(from, to) {
  const t = stageTransition(from, to);
  return {
    ok: t.ok,
    needsReason: t.needsReason,
    closes: to === "closed",
    complaintStatus: statusForStage(to),
    ...(t.reason ? { reason: t.reason } : {}),
  };
}

/**
 * เปิด/ปิด "รอวัสดุ / งบประมาณ" → ฟิลด์ที่ต้อง $set + รายการ timeline
 * เปิด: พัก SLA (slaPausedAt = now ถ้ายังไม่พัก) · ปิด: รวมเวลาที่พักเข้า slaPausedMs แล้วล้าง slaPausedAt
 * @param {object} assignment plain object (lean / toObject)
 * @param {{ on: boolean, itemName?: string, purchaseRefNo?: string, expectedAt?: any, reason?: string, now?: Date }} opts
 */
export function blockedUpdate(assignment, { on, itemName, purchaseRefNo, expectedAt, reason, now = new Date() } = {}) {
  const a = assignment ?? {};
  const pausedAt = toDate(a.slaPausedAt);
  const pausedMs = Number.isFinite(Number(a.slaPausedMs)) ? Number(a.slaPausedMs) : 0;

  if (on) {
    const item = text(itemName);
    const ref = text(purchaseRefNo);
    const expected = toDate(expectedAt);
    const parts = [
      `พักงาน — รอวัสดุ / งบประมาณ: ${item || text(reason) || "-"}`,
      ref ? `(เสนอจัดซื้อ ${ref})` : "",
      expected ? `คาดได้รับ ${formatThaiDate(expected)}` : "",
    ].filter(Boolean);
    return {
      set: {
        blocked: { isBlocked: true, itemName: item, purchaseRefNo: ref, expectedAt: expected ?? null, reason: text(reason), since: now },
        slaPausedAt: pausedAt ?? now,
        slaPausedMs: pausedMs,
      },
      timelineEntry: { at: now, kind: "blocked", text: parts.join(" ") },
    };
  }

  const extra = pausedAt ? Math.max(0, now.getTime() - pausedAt.getTime()) : 0;
  const days = pausedAt ? calendarDaysBetween(pausedAt, now) : 0;
  return {
    set: {
      blocked: { ...(a.blocked ?? {}), isBlocked: false, since: null },
      slaPausedAt: null,
      slaPausedMs: pausedMs + extra,
    },
    timelineEntry: { at: now, kind: "unblocked", text: `กลับมาดำเนินการต่อ — พัก SLA ไป ${days} วัน` },
  };
}
