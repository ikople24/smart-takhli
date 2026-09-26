// lib/flood-relief/accessKey.ts
// กุญแจดูรายละเอียดคำขอ — เลขที่ FL-#### วิ่งเรียงกันจึงไล่เดาได้ ถ้าเปิดรายละเอียดด้วยเลขที่อย่างเดียว
// ใครก็ไล่อ่านจุดสังเกต (บ้านเลขที่) ของบ้านที่มีผู้ป่วยติดเตียงได้ทั้งเมือง
// ผู้แจ้งได้กุญแจตอนส่ง (เก็บใน localStorage + ลิงก์แชร์ให้ญาติ) · ไม่มีกุญแจ = เห็นแค่สถานะ

import { randomBytes, timingSafeEqual } from "node:crypto";

export function newAccessKey(): string {
  return randomBytes(12).toString("base64url"); // 16 ตัวอักษร ใส่ URL ได้ตรง ๆ
}

const KEY_RE = /^[A-Za-z0-9_-]{16}$/;

export function isAccessKeyShape(v: unknown): v is string {
  return typeof v === "string" && KEY_RE.test(v);
}

/** เทียบแบบเวลาคงที่ · รูปแบบผิด/ไม่มีค่า = false */
export function accessKeyMatches(given: unknown, stored: unknown): boolean {
  if (!isAccessKeyShape(given) || !isAccessKeyShape(stored)) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(stored));
}
