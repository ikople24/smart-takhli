// lib/citizen/report/consentStorage.js
// ตัวห่อ localStorage ของขั้นข้อตกลง — ทุกทางเข้าออกหุ้ม try/catch
// เบราว์เซอร์โหมดส่วนตัว/ปิด storage จะเห็นจอข้อตกลงทุกครั้ง แต่ต้องแจ้งเรื่องต่อได้ตามปกติ
import { CONSENT_VERSION } from "./consentContent";
import { parseStoredConsent } from "./consent";

export const CONSENT_STORAGE_KEY = "tk.report.consent";

/** คืน localStorage ถ้าใช้ได้จริง ไม่งั้นคืน null (SSR หรือเบราว์เซอร์ที่บล็อก) */
export function getStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** รหัสอุปกรณ์แบบสุ่ม ไม่ผูกกับตัวบุคคล ใช้กันแถว log ซ้ำเท่านั้น */
export function newDeviceId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ตกไปใช้ค่าสำรองด้านล่าง
  }
  return `tk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * @param {Storage | null} [storage]
 * @returns {{ version: string, acceptedAt: string, deviceId: string } | null}
 */
export function readConsent(storage = getStorage()) {
  if (!storage) return null;
  try {
    return parseStoredConsent(storage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * บันทึกการยอมรับลงเครื่อง แล้วคืนค่าที่บันทึก (ใช้ต่อได้แม้เขียนไม่สำเร็จ)
 * @param {{ version?: string, acceptedAt?: string, deviceId?: string }} [input]
 * @param {Storage | null} [storage]
 */
export function writeConsent(input = {}, storage = getStorage()) {
  const value = {
    version: input.version ?? CONSENT_VERSION,
    acceptedAt: input.acceptedAt ?? new Date().toISOString(),
    deviceId: input.deviceId || newDeviceId(),
  };
  if (storage) {
    try {
      storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // เขียนไม่ได้ก็ปล่อย — ผู้ใช้จะเห็นจอข้อตกลงอีกครั้งหน้า แต่แจ้งเรื่องรอบนี้ได้ปกติ
    }
  }
  return value;
}
