// lib/citizen/report/consent.js
// logic ล้วนของขั้นข้อตกลงก่อนแจ้งเรื่อง — ไม่แตะ DOM/localStorage/เครือข่าย
// (ตัวห่อ localStorage อยู่ consentStorage.js · เนื้อหา/เลขฉบับอยู่ consentContent.js)
import { CONSENT_VERSION, KNOWN_CONSENT_VERSIONS } from "./consentContent";

/**
 * แปลงค่าดิบจาก localStorage เป็นอ็อบเจกต์ — ค่าพังทุกแบบคืน null (ไม่ throw)
 * @param {unknown} raw
 * @returns {{ version: string, acceptedAt: string, deviceId: string } | null}
 */
export function parseStoredConsent(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const { version, acceptedAt, deviceId } = value;
    if (typeof version !== "string" || version === "") return null;
    if (typeof acceptedAt !== "string" || acceptedAt === "") return null;
    if (typeof deviceId !== "string" || deviceId === "") return null;
    return { version, acceptedAt, deviceId };
  } catch {
    return null;
  }
}

/**
 * ต้องแสดงจอข้อตกลงไหม — ยอมรับคนละฉบับถือว่ายังไม่ยอมรับ
 * @param {{ version: string } | null} stored
 * @param {string} [currentVersion]
 */
export function shouldShowConsent(stored, currentVersion = CONSENT_VERSION) {
  if (!stored) return true;
  return stored.version !== currentVersion;
}

/** รหัสอุปกรณ์ที่ยอมรับ — uuid v4 หรือสตริงสำรองที่ออกโดย consentStorage.js */
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/** เวลาที่ client ส่งมาห่างจากเวลาเซิร์ฟเวอร์ได้ไม่เกิน 2 วัน (กันนาฬิกาเครื่องเพี้ยน/ยิงมั่ว) */
export const ACCEPTED_AT_MAX_SKEW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * ตรวจ body ของ POST /api/complaints/consent-log — เก็บเฉพาะ 3 ฟิลด์ที่ต้องใช้ ทิ้งที่เหลือทั้งหมด
 *
 * คืน "รูปเดียวเสมอ" (ok + error + value) แทน union เพราะฝั่งที่เรียกเป็นไฟล์ .ts
 * การพึ่ง narrowing จาก JSDoc union ทำให้ next build พังง่ายเวลา TS infer ไม่ตรง
 *
 * ทั้งฟังก์ชันห่อด้วย try/catch เพราะนี่คือ endpoint สาธารณะไม่ล็อกอิน — body มาจากใครก็ได้
 * (เช่น อ็อบเจกต์ที่มี getter ที่ throw) ต้องไม่มีทางทำให้ endpoint 500 เอง
 *
 * @param {unknown} body
 * @param {Date} [now]
 * @returns {{ ok: boolean, error: string | null, value: { version: string, acceptedAt: Date, deviceId: string } | null }}
 */
export function validateConsentLog(body, now = new Date()) {
  try {
    if (!body || typeof body !== "object") {
      return { ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง", value: null };
    }
    const { version, acceptedAt, deviceId } = body;

    if (typeof version !== "string" || !KNOWN_CONSENT_VERSIONS.includes(version)) {
      return { ok: false, error: "เลขฉบับข้อตกลงไม่ถูกต้อง", value: null };
    }
    if (typeof deviceId !== "string" || !DEVICE_ID_PATTERN.test(deviceId)) {
      return { ok: false, error: "รหัสอุปกรณ์ไม่ถูกต้อง", value: null };
    }

    // เวลาที่ใช้ไม่ได้ไม่ถือเป็น error — หลักฐานยังมีค่า แค่ใช้เวลาเซิร์ฟเวอร์แทน
    let when = typeof acceptedAt === "string" ? new Date(acceptedAt) : new Date(NaN);
    if (Number.isNaN(when.getTime()) || Math.abs(when.getTime() - now.getTime()) > ACCEPTED_AT_MAX_SKEW_MS) {
      when = new Date(now.getTime());
    }

    return { ok: true, error: null, value: { version, acceptedAt: when, deviceId } };
  } catch {
    return { ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง", value: null };
  }
}
