import type { Minutes } from "@/types/garbage";

const TIME_RE = /^(\d{1,2})[:.](\d{2})(?:\s*น\.?)?$/u;

/**
 * แปลงเวลาไทยเป็นนาทีจากเที่ยงคืน
 * รับทั้ง "4:00 น." (JSON เดิม) และ "4.00น." (โปสเตอร์)
 * ถือว่าเป็นระบบ 24 ชั่วโมงเสมอ — 12.30 น. คือเที่ยงครึ่ง ไม่ใช่เที่ยงคืนครึ่ง
 */
export function parseThaiTime(input: string | null | undefined): Minutes | null {
  if (input == null) return null;
  const m = TIME_RE.exec(String(input).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
