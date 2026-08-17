// lib/satisfaction/lineRating.js
// logic ล้วนของแบบประเมินความพึงพอใจผ่าน LINE — ห้ามมี I/O ในไฟล์นี้ (เทสด้วย vitest)

/** ช่วงเวลาที่ยังรับ "ข้อความถัดไป" เป็นความเห็นของคะแนนที่เพิ่งกด */
export const RATING_COMMENT_WINDOW_MS = 10 * 60 * 1000;

/** ความยาวความเห็นสูงสุดที่เก็บ (ส่วนเกินตัดทิ้ง) */
export const MAX_COMMENT_LENGTH = 500;

const COMPLAINT_CODE_RE = /^TKC-\d{4,}$/;

/** สร้าง postback data ของปุ่มดาว — รูปแบบ query string อ่านออกและตรวจสอบได้ */
export function buildRatingPostbackData(complaintCode, score) {
  return `action=sat_rate&cid=${complaintCode}&score=${score}`;
}

/**
 * แกะ postback data — คืน null ถ้าไม่ใช่ของแบบประเมินหรือค่าไม่ถูกต้อง
 * (payload ปลอมต้องไม่สร้างแถวขยะในฐานข้อมูล)
 */
export function parseRatingPostback(data) {
  if (typeof data !== 'string' || !data) return null;

  const params = new URLSearchParams(data);
  if (params.get('action') !== 'sat_rate') return null;

  const complaintCode = (params.get('cid') || '').toUpperCase();
  if (!COMPLAINT_CODE_RE.test(complaintCode)) return null;

  const rawScore = params.get('score') || '';
  if (!/^[1-5]$/.test(rawScore)) return null;

  return { complaintCode, score: Number(rawScore) };
}

/** ขอบล่างของช่วงเวลารับความเห็น — ใช้เป็น $gte ใน query */
export function commentWindowStart(now = new Date()) {
  return new Date(new Date(now).getTime() - RATING_COMMENT_WINDOW_MS);
}

/** ตัดแต่งความเห็นก่อนบันทึก — คืน null ถ้าไม่มีเนื้อความ */
export function sanitizeComment(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_COMMENT_LENGTH);
}

/** 3 → "⭐⭐⭐" */
export function starText(score) {
  return '⭐'.repeat(score);
}
