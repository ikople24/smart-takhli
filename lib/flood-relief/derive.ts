// lib/flood-relief/derive.ts
// Derived fields ของคำขอ — คำนวณฝั่ง server ใน API response เท่านั้น client ห้ามคำนวณซ้ำ (กติกาเดียวกับโมดูล tasks)
// + projection สาธารณะ (หน้าสถานะ) ที่ต้องไม่หลุดเบอร์เต็ม / lineUserId / บันทึกภายใน

import { fromGeoPoint, haversineKm, type LatLng } from "./geo";
import { maskPhone } from "./phone";
import { citizenStepIndex, isBeforeDispatch, isClosedStatus, urgencyRank } from "./status";
import { zoneLabel } from "./zones";

const MINUTE_MS = 60 * 1000;

/** เกณฑ์ "เลยเวลา": ยังไม่มีทีมออกเดินทางเกินกี่นาที · ทั่วไปไม่มีเกณฑ์ */
export const OVERDUE_AFTER_MIN: Readonly<Record<string, number>> = Object.freeze({ critical: 15, urgent: 60 });

type DateLike = Date | string | number | null | undefined;

function toMs(v: DateLike): number | null {
  if (v === null || v === undefined || v === "") return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

export type RequestLike = {
  status?: string | null;
  urgency?: string | null;
  createdAt?: DateLike;
  assignedAt?: DateLike;
  doneAt?: DateLike;
  cancelledAt?: DateLike;
  zoneName?: string | null;
  communityName?: string | null;
};

/**
 * นาทีที่ผู้แจ้งรอ: ตั้งแต่รับเรื่องจนมอบหมายทีม · ยังไม่มอบหมาย = จนถึงตอนนี้
 * ปิดไปโดยไม่เคยมอบหมาย (เช่น ยกเลิก) = จนถึงเวลาที่ปิด ตัวเลขจะได้ไม่วิ่งต่อ
 */
export function waitingMinutes(req: RequestLike, now: Date = new Date()): number {
  const start = toMs(req.createdAt);
  if (start === null) return 0;
  const end =
    toMs(req.assignedAt) ??
    (isClosedStatus(req.status) ? toMs(req.doneAt) ?? toMs(req.cancelledAt) : null) ??
    now.getTime();
  return Math.max(0, Math.floor((end - start) / MINUTE_MS));
}

/** ด่วนมาก > 15 นาที / ด่วน > 60 นาที ยังไม่มีทีมออกเดินทาง */
export function isOverdue(req: RequestLike, now: Date = new Date()): boolean {
  if (!isBeforeDispatch(req.status)) return false;
  const limit = OVERDUE_AFTER_MIN[String(req.urgency)];
  if (limit === undefined) return false;
  const start = toMs(req.createdAt);
  if (start === null) return false;
  return now.getTime() - start > limit * MINUTE_MS;
}

export function deriveRequest<T extends RequestLike>(req: T, now: Date = new Date()) {
  return {
    ...req,
    waitingMinutes: waitingMinutes(req, now),
    isOverdue: isOverdue(req, now),
    zoneLabel: zoneLabel(req.zoneName),
    communityName: req.communityName ?? null,
  };
}

/**
 * ลำดับรายการแอดมิน: คำขอที่ยังเปิดก่อนคำขอที่ปิดแล้ว → ความเร่งด่วน (ด่วนมากก่อนเสมอ) → ล่าสุดก่อน
 * คืน array ใหม่ ไม่แก้ของเดิม
 */
export function sortRequests<T extends RequestLike>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    const closed = Number(isClosedStatus(a.status)) - Number(isClosedStatus(b.status));
    if (closed !== 0) return closed;
    const u = urgencyRank(a.urgency) - urgencyRank(b.urgency);
    if (u !== 0) return u;
    return (toMs(b.createdAt) ?? 0) - (toMs(a.createdAt) ?? 0);
  });
}

/** ระยะจากตำแหน่งล่าสุดของทีมถึงจุดคำขอ (กม. ทศนิยม 1) · ทีมยังไม่มีตำแหน่ง = null */
export function teamDistanceKm(
  team: { lastLocation?: { coordinates?: unknown } | null },
  requestPoint: LatLng | null
): number | null {
  const t = fromGeoPoint(team.lastLocation);
  if (!t || !requestPoint) return null;
  return Math.round(haversineKm(t, requestPoint) * 10) / 10;
}

// ─── หน้าสถานะสาธารณะ ─────────────────────────────────────────

/**
 * ฟิลด์ที่ GET public/requests/[ticket] ใช้ใน .select() — ต้องไม่มี lineUserId / notes / reporterName / location
 * (phone ดึงมาเพื่อ mask เท่านั้น ไม่ส่งออกตรง ๆ — publicRequest ตัดทิ้ง)
 */
export const PUBLIC_REQUEST_SELECT =
  "ticket type urgency status landmark peopleCount communityName zoneName createdAt assignedAt dispatchedAt onSiteAt doneAt cancelledAt phone";

type PublicSource = RequestLike & {
  ticket?: string;
  type?: string;
  landmark?: string;
  peopleCount?: number | null;
  phone?: string;
  dispatchedAt?: DateLike;
  onSiteAt?: DateLike;
};

/**
 * แปลงเอกสารเป็นข้อมูลหน้าสถานะ — whitelist ทีละฟิลด์ ไม่ spread เอกสารเดิม
 * full = มีกุญแจถูกต้อง (ผู้แจ้ง/ญาติที่ได้ลิงก์) → เห็นจุดสังเกต ชุมชน จำนวนคน เบอร์ที่ปิดบางส่วน
 * ไม่มีกุญแจ → เห็นแค่ประเภท ความเร่งด่วน และความคืบหน้า (เลขที่เรียงกัน ไล่เดาได้)
 */
export function publicRequest(doc: PublicSource, full = false) {
  const base = {
    ticket: doc.ticket ?? "",
    type: doc.type ?? "",
    urgency: doc.urgency ?? "",
    status: doc.status ?? "received",
    citizenStep: citizenStepIndex(doc.status),
    createdAt: doc.createdAt ?? null,
    assignedAt: doc.assignedAt ?? null,
    dispatchedAt: doc.dispatchedAt ?? null,
    onSiteAt: doc.onSiteAt ?? null,
    doneAt: doc.doneAt ?? null,
    cancelledAt: doc.cancelledAt ?? null,
    full,
  };
  if (!full) return base;
  return {
    ...base,
    landmark: doc.landmark ?? "",
    peopleCount: doc.peopleCount ?? null,
    communityName: doc.communityName ?? null,
    zoneLabel: zoneLabel(doc.zoneName),
    phoneMasked: maskPhone(doc.phone),
  };
}
