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

export { CONSENT_VERSION, KNOWN_CONSENT_VERSIONS };
