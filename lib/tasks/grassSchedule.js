// lib/tasks/grassSchedule.js
// ตารางคิวตัดหญ้า (มติประชุม: แนบตารางคิวให้เรื่องตัดหญ้า) — ไฟล์กลางไฟล์เดียว (รูป/PDF บน Cloudinary)
// superadmin อัปโหลดครั้งเดียวที่ /admin/superadmin/task-settings → เก็บใน task_settings.grassSchedule
// ใช้ที่: หน้ารายละเอียดงานเจ้าหน้าที่ (เรื่องชนิด 'grass') + หน้า /status สาธารณะ (เฉพาะเรื่องตัดหญ้าที่ยังไม่ปิด — ส่งแค่ url)
// logic ล้วน ไม่มี I/O (เทสต์ด้วย vitest) · ทิศทาง import: settings.js → ไฟล์นี้ → workTypes.js/status.js/format.js

import { detectWorkType } from "./workTypes";
import { isClosedStatus } from "./status";
import { plainDoc, toDate } from "./format";

/** ข้อความบันทึกลงไทม์ไลน์เมื่อเจ้าหน้าที่กด "แจ้งผู้แจ้งว่าอยู่ในคิว" (PATCH action 'progress' ตัวเดิม) */
export const GRASS_QUEUE_NOTE = "อยู่ในคิวตัดหญ้าตามตาราง — ดูตารางคิวได้ที่หน้าติดตามสถานะ";

/** ค่าตั้งต้น = ยังไม่มีตาราง */
export const EMPTY_GRASS_SCHEDULE = Object.freeze({ url: "", fileName: "", updatedAt: null });

const MAX_URL = 2000;
const MAX_FILE_NAME = 200;

/** url ที่ยอมรับ: https:// ที่ parse ได้เท่านั้น (ไม่รับ http / javascript: / data:) */
export function isHttpsUrl(value) {
  if (typeof value !== "string" || value.length > MAX_URL) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * ทำความสะอาดค่า grassSchedule จาก Mongo/body — url ไม่ใช่ https = ไม่มีตาราง (ค่าว่างทั้งชุด)
 * @param {unknown} raw
 * @returns {{ url: string, fileName: string, updatedAt: string | null }} updatedAt เป็น ISO string
 */
export function normalizeGrassSchedule(raw) {
  const src = raw && typeof raw === "object" ? /** @type {any} */ (raw) : {};
  const url = typeof src.url === "string" ? src.url.trim() : "";
  if (!isHttpsUrl(url)) return { ...EMPTY_GRASS_SCHEDULE };
  const fileName = String(src.fileName ?? "").trim().slice(0, MAX_FILE_NAME);
  const updatedAt = toDate(src.updatedAt);
  return { url, fileName, updatedAt: updatedAt ? updatedAt.toISOString() : null };
}

/**
 * ค่าที่จะบันทึกจาก body ของ PUT — updatedAt ประทับฝั่ง server เสมอ (ไม่เชื่อค่าจาก client)
 * ลบตาราง (url ว่าง/ไม่ถูกต้อง) → ค่าว่างทั้งชุด
 * @param {unknown} input
 * @param {Date} [now]
 */
export function grassSchedulePatch(input, now = new Date()) {
  const next = normalizeGrassSchedule({ ...(input && typeof input === "object" ? input : {}), updatedAt: now });
  return next.url ? next : { ...EMPTY_GRASS_SCHEDULE };
}

/**
 * url ตารางคิวที่ควรแสดงกับเรื่องนี้ — เฉพาะชนิดงาน 'grass' ที่ยังไม่ปิด และมีตารางอัปโหลดไว้แล้ว
 * @param {object | null | undefined} complaint ต้องมี status + workType/problems/detail/category (ใช้ detectWorkType)
 * @param {{ grassSchedule?: unknown } | null | undefined} settings
 * @returns {string | null}
 */
export function grassScheduleFor(complaint, settings) {
  const c = plainDoc(complaint);
  if (!c || isClosedStatus(c.status)) return null;
  if (detectWorkType(c) !== "grass") return null;
  const url = normalizeGrassSchedule(settings?.grassSchedule).url;
  return url || null;
}
