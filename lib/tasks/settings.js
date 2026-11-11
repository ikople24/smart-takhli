// lib/tasks/settings.js
// การตั้งค่า SLA/เกณฑ์เตือนของงานเจ้าหน้าที่ — logic ล้วน ไม่มี I/O (เทสต์ด้วย vitest)
// ค่าเก็บใน Mongo collection `task_settings` (models/tasks/TaskSettings.js) อ่านผ่าน lib/tasks/loadSettings.js
//
// ทำไมไม่ใส่ใน AdminOption ตามที่ README เสนอ: AdminOption คือ "วิธีแก้ไข" หลายแถวต่อประเภทเรื่อง
// ไม่ใช่ทะเบียนประเภท — ใส่ slaDays ที่นั่นจะซ้ำทุกแถวและไม่มีที่เก็บค่ากลาง (warnBeforeDays ฯลฯ)
//
// มติประชุม 10/11/69: ต้องกดรับเรื่องภายใน 24 ชม. · กำหนดปิดเรื่องตาม "ชนิดงาน" (lib/tasks/workTypes.js)
// ทิศทาง import: settings.js → workTypes.js เท่านั้น (workTypes.js ห้าม import ไฟล์นี้ — กันวงวน)

import { WORK_TYPES, detectWorkType, workTypeOf } from "./workTypes";
import { plainDoc } from "./format";
import { normalizeHolidays } from "./holidays";
import { EMPTY_GRASS_SCHEDULE, normalizeGrassSchedule } from "./grassSchedule";
import { isValidDateKey } from "./businessDays";

/**
 * @typedef {object} TaskSettingsShape
 * @property {number} defaultSlaDays
 * @property {number} warnBeforeDays
 * @property {number} unclaimedWarnDays  เลิกใช้ตัดสินแล้ว (คงไว้ให้เอกสารเก่าอ่านได้)
 * @property {number} unclaimedAlertDays เลิกใช้ตัดสินแล้ว (คงไว้ให้เอกสารเก่าอ่านได้)
 * @property {number} unclaimedWarnHours
 * @property {number} unclaimedAlertHours
 * @property {number} followUpEveryDays
 * @property {Array<{ category: string, slaDays: number }>} slaByCategory
 * @property {Array<{ workType: string, slaDays: number }>} slaByWorkType
 * @property {Array<{ date: string, name: string }>} holidays วันหยุดราชการ (ไม่นับเป็นวันทำการ)
 * @property {{ url: string, fileName: string, updatedAt: string | null }} grassSchedule ตารางคิวตัดหญ้า (lib/tasks/grassSchedule.js)
 * @property {string} claimKpiFrom วันเริ่มใช้กติกา KPI รับเรื่อง 24 ชม. ('YYYY-MM-DD' เวลาไทย, '' = นับทั้งหมด)
 */

/** @type {Readonly<TaskSettingsShape>} */
export const DEFAULT_TASK_SETTINGS = Object.freeze({
  /** SLA (วันทำการ จ.–ศ. ไม่รวมวันหยุด — lib/tasks/businessDays.js) ของ "งานทั่วไป" นับจากวันที่ประชาชนแจ้ง — มติประชุม 10/11/69 = 3 วัน (เดิม 7)
   *  ชนิดงานอื่นใช้ค่าในทะเบียน lib/tasks/workTypes.js (ปะถนน 30 วัน ฯลฯ) */
  defaultSlaDays: 3,
  /** เตือน "ใกล้ครบกำหนด" เมื่อเหลือ ≤ N วันทำการ (0 = เตือนเฉพาะวันครบกำหนด) */
  warnBeforeDays: 2,
  /** (เลิกใช้ — แทนด้วย unclaimedWarnHours) คงไว้เพื่อความเข้ากันได้ของเอกสารเก่า */
  unclaimedWarnDays: 3,
  /** (เลิกใช้ — แทนด้วย unclaimedAlertHours) คงไว้เพื่อความเข้ากันได้ของเอกสารเก่า */
  unclaimedAlertDays: 4,
  /** เรื่องไม่มีคนรับ: ป้าย amber เมื่อรอ ≥ N ชม. */
  unclaimedWarnHours: 12,
  /** เรื่องไม่มีคนรับ: "รอเกิน N ชม." (แดง + นับใน alert bar + แจ้ง LINE) เมื่อรอ > N ชม. — มติประชุม = 24 */
  unclaimedAlertHours: 24,
  /** เตือนติดตามการประสานงาน/รอวัสดุ ทุก N วัน */
  followUpEveryDays: 7,
  /** SLA รายประเภทเรื่อง [{ category, slaDays }] — ใช้กับ "งานทั่วไป" เท่านั้น ประเภทที่ไม่อยู่ในนี้ใช้ defaultSlaDays */
  slaByCategory: [],
  /** SLA รายชนิดงาน [{ workType, slaDays }] — ทับค่าในทะเบียน workTypes.js (ชนะทุกกฎ) */
  slaByWorkType: [],
  /** วันหยุดราชการ [{ date: 'YYYY-MM-DD', name }] — ไม่นับเป็นวันทำการของกำหนดปิดเรื่อง
   *  (เกณฑ์รับเรื่อง 24 ชม. ไม่สนวันหยุด) · ตั้งที่ /admin/superadmin/task-settings */
  holidays: [],
  /** ตารางคิวตัดหญ้า (ไฟล์กลาง รูป/PDF บน Cloudinary) — url ว่าง = ยังไม่มี · แนบให้เรื่องชนิด 'grass'
   *  และแสดงบนหน้า /status (lib/tasks/grassSchedule.js) · อัปโหลดที่ /admin/superadmin/task-settings */
  grassSchedule: EMPTY_GRASS_SCHEDULE,
  /** วันเริ่มใช้กติกาจริง (มติประชุม 10/11/69 → เริ่มจันทร์ 16 พ.ย. 2569) — KPI "รับเรื่องภายใน 24 ชม."
   *  นับเฉพาะเรื่องที่ประชาชนแจ้งตั้งแต่วันนี้ (เวลาไทย) งานเก่าก่อนมีกติกาไม่ดึงเปอร์เซ็นต์ลง · '' = นับทั้งหมด */
  claimKpiFrom: "2026-11-16",
});

// ฟิลด์ตัวเลข: [ชื่อ, ค่าต่ำสุดที่ยอมรับ]
const NUMBER_FIELDS = [
  ["defaultSlaDays", 1],
  ["warnBeforeDays", 0],
  ["unclaimedWarnDays", 0],
  ["unclaimedAlertDays", 0],
  ["unclaimedWarnHours", 0],
  ["unclaimedAlertHours", 1],
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
 * @returns {TaskSettingsShape}
 */
export function normalizeTaskSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  /** @type {any} */
  const out = {};
  for (const [key, min] of NUMBER_FIELDS) {
    out[key] = toIntOrNull(src[key], min) ?? DEFAULT_TASK_SETTINGS[key];
  }

  // amber ต้องมาก่อนแดง — warn เกิน alert = ปรับลงมาเท่า alert
  if (out.unclaimedWarnHours > out.unclaimedAlertHours) out.unclaimedWarnHours = out.unclaimedAlertHours;

  // ชื่อซ้ำ: แถวหลังทับแถวหน้า (Map รักษาลำดับการเจอครั้งแรก แต่ค่าเป็นของครั้งหลัง)
  const byCategory = new Map();
  for (const row of Array.isArray(src.slaByCategory) ? src.slaByCategory : []) {
    const category = String(row?.category ?? "").trim();
    const slaDays = toIntOrNull(row?.slaDays, 1);
    if (!category || slaDays === null) continue;
    byCategory.set(category, slaDays);
  }
  out.slaByCategory = [...byCategory].map(([category, slaDays]) => ({ category, slaDays }));

  // ชนิดงานต้องเป็น key ในทะเบียน — ซ้ำ: แถวหลังทับแถวหน้า
  const validKeys = new Set(WORK_TYPES.map((t) => t.key));
  const byWorkType = new Map();
  for (const row of Array.isArray(src.slaByWorkType) ? src.slaByWorkType : []) {
    const workType = String(row?.workType ?? "").trim();
    const slaDays = toIntOrNull(row?.slaDays, 1);
    if (!validKeys.has(workType) || slaDays === null) continue;
    byWorkType.set(workType, slaDays);
  }
  out.slaByWorkType = [...byWorkType].map(([workType, slaDays]) => ({ workType, slaDays }));
  out.holidays = normalizeHolidays(src.holidays);
  out.grassSchedule = normalizeGrassSchedule(src.grassSchedule);
  const kpiFrom = src.claimKpiFrom === undefined ? DEFAULT_TASK_SETTINGS.claimKpiFrom : String(src.claimKpiFrom ?? "").trim();
  out.claimKpiFrom = kpiFrom === "" || isValidDateKey(kpiFrom) ? kpiFrom : DEFAULT_TASK_SETTINGS.claimKpiFrom;
  return out;
}

/**
 * SLA ของเรื่องหนึ่งเรื่อง — จุดตัดสินเดียวของทั้งระบบ (derived.js / create.js / สคริปต์ recompute เรียกผ่าน dueDateFor)
 * ลำดับ: settings.slaByWorkType → (เฉพาะงานทั่วไป) settings.slaByCategory → defaultSlaDays
 *        → (ชนิดงานอื่น) ค่าในทะเบียน workTypes.js
 * @param {{ workType?: string, problems?: string[], detail?: string, category?: string } | null | undefined} complaint
 * @param {Readonly<TaskSettingsShape>} [settings]
 * @returns {{ slaDays: number, workType: string }}
 */
export function resolveSla(rawComplaint, settings = DEFAULT_TASK_SETTINGS) {
  const complaint = plainDoc(rawComplaint);
  const workType = detectWorkType(complaint);
  const byType = (settings?.slaByWorkType ?? []).find((r) => r?.workType === workType);
  if (byType && Number.isInteger(byType.slaDays) && byType.slaDays >= 1) return { slaDays: byType.slaDays, workType };
  if (workType === "general") return { slaDays: slaDaysFor(complaint?.category, settings), workType };
  return { slaDays: workTypeOf(workType).slaDays, workType };
}

/**
 * SLA (วัน) ของประเภทเรื่องสำหรับ "งานทั่วไป" — ไม่พบ/ไม่ระบุประเภท → defaultSlaDays
 * (ไม่รู้ชนิดงาน — ถ้ามีข้อมูลเรื่องให้ใช้ resolveSla)
 * @param {string | null | undefined} category
 * @param {Readonly<TaskSettingsShape>} [settings]
 */
export function slaDaysFor(category, settings = DEFAULT_TASK_SETTINGS) {
  const key = String(category ?? "").trim();
  if (key) {
    const hit = (settings.slaByCategory ?? []).find((r) => r.category === key);
    if (hit) return hit.slaDays;
  }
  return settings.defaultSlaDays ?? DEFAULT_TASK_SETTINGS.defaultSlaDays;
}
