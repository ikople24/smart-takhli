// lib/tasks/settings.js
// การตั้งค่า SLA/เกณฑ์เตือนของงานเจ้าหน้าที่ — logic ล้วน ไม่มี I/O (เทสต์ด้วย vitest)
// ค่าเก็บใน Mongo collection `task_settings` (models/tasks/TaskSettings.js) อ่านผ่าน lib/tasks/loadSettings.js
//
// ทำไมไม่ใส่ใน AdminOption ตามที่ README เสนอ: AdminOption คือ "วิธีแก้ไข" หลายแถวต่อประเภทเรื่อง
// ไม่ใช่ทะเบียนประเภท — ใส่ slaDays ที่นั่นจะซ้ำทุกแถวและไม่มีที่เก็บค่ากลาง (warnBeforeDays ฯลฯ)

export const DEFAULT_TASK_SETTINGS = Object.freeze({
  /** SLA (วัน) นับจากวันที่ประชาชนแจ้ง — ตรงกับ 7 วันที่เคย hardcode ใน my-kpi/pending */
  defaultSlaDays: 7,
  /** เตือน "ใกล้ครบกำหนด" เมื่อเหลือ ≤ N วัน (0 = เตือนเฉพาะวันครบกำหนด) */
  warnBeforeDays: 2,
  /** เรื่องไม่มีคนรับ: ป้าย amber ตั้งแต่วันที่ N */
  unclaimedWarnDays: 3,
  /** เรื่องไม่มีคนรับ: "ค้างเกิน N วัน" (แดง + นับใน alert bar) เมื่อค้าง > N */
  unclaimedAlertDays: 4,
  /** เตือนติดตามการประสานงาน/รอวัสดุ ทุก N วัน */
  followUpEveryDays: 7,
  /** SLA รายประเภทเรื่อง [{ category, slaDays }] — ประเภทที่ไม่อยู่ในนี้ใช้ defaultSlaDays */
  slaByCategory: [],
});

// ฟิลด์ตัวเลข: [ชื่อ, ค่าต่ำสุดที่ยอมรับ]
const NUMBER_FIELDS = [
  ["defaultSlaDays", 1],
  ["warnBeforeDays", 0],
  ["unclaimedWarnDays", 0],
  ["unclaimedAlertDays", 0],
  ["followUpEveryDays", 1],
];

function toIntOrNull(value, min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i >= min ? i : null;
}

/**
 * ทำความสะอาดเอกสารจาก Mongo (หรือ body จาก API) ให้เป็นชุดค่าที่ใช้ได้เสมอ
 * — ค่าเพี้ยนกลับไปใช้ default รายฟิลด์ ไม่โยน error (endpoint ที่เรียกอยู่บนทุกหน้าเจ้าหน้าที่)
 * @param {object | null | undefined} raw
 */
export function normalizeTaskSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const [key, min] of NUMBER_FIELDS) {
    out[key] = toIntOrNull(src[key], min) ?? DEFAULT_TASK_SETTINGS[key];
  }

  // ชื่อซ้ำ: แถวหลังทับแถวหน้า (Map รักษาลำดับการเจอครั้งแรก แต่ค่าเป็นของครั้งหลัง)
  const byCategory = new Map();
  for (const row of Array.isArray(src.slaByCategory) ? src.slaByCategory : []) {
    const category = String(row?.category ?? "").trim();
    const slaDays = toIntOrNull(row?.slaDays, 1);
    if (!category || slaDays === null) continue;
    byCategory.set(category, slaDays);
  }
  out.slaByCategory = [...byCategory].map(([category, slaDays]) => ({ category, slaDays }));
  return out;
}

/**
 * SLA (วัน) ของประเภทเรื่อง — ไม่พบ/ไม่ระบุประเภท → defaultSlaDays
 * @param {string | null | undefined} category
 * @param {ReturnType<typeof normalizeTaskSettings>} [settings]
 */
export function slaDaysFor(category, settings = DEFAULT_TASK_SETTINGS) {
  const key = String(category ?? "").trim();
  if (key) {
    const hit = (settings.slaByCategory ?? []).find((r) => r.category === key);
    if (hit) return hit.slaDays;
  }
  return settings.defaultSlaDays ?? DEFAULT_TASK_SETTINGS.defaultSlaDays;
}
