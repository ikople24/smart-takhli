// lib/tasks/pool.js
// logic กองงานรอรับ (README หน้าจอ 2) — คอลัมน์ kanban, ปุ่มตามความสัมพันธ์กับกอง, alert bar, ป้ายบริบท (logic ล้วน)
// รายการเข้ามาผ่าน deriveUnclaimed แล้ว (daysUnclaimed / isStale / isUrgent / agingTone) + department ที่ API resolve ให้
import { DEFAULT_TASK_SETTINGS } from "./settings";
import { departmentShort, UNASSIGNED_DEPARTMENT } from "./departments";

/** คีย์เดียวกับ my-tasks (organization = กอง) เพื่อให้ URL ?groupBy= มีความหมายเดียวกัน */
export const POOL_GROUP_BY = Object.freeze(["organization", "category", "priority"]);
export const UNASSIGNED_KEY = "__unassigned__";

const text = (v) => String(v ?? "").trim();
const collator = new Intl.Collator("th");
const COLUMN_TONES = ["done", "coord", "blue", "road", "due"];

/**
 * ปุ่มบนการ์ด: กองเดียวกัน → claim · กองอื่น → not_yours · ยังไม่ระบุกอง → choose_org
 * เจ้าหน้าที่ที่ไม่ระบุกองในโปรไฟล์ / superadmin รับได้ทุกเรื่องที่ระบุกองแล้ว
 * ("รับเป็นผู้ประสาน" ตั้งจากหน้ารายละเอียด — ไม่เดาจากการ์ด)
 * @param {object} item
 * @param {{ officerDepartment?: string | null, isSuperAdmin?: boolean }} [opts]
 */
export function poolAction(item, { officerDepartment = null, isSuperAdmin = false } = {}) {
  const dept = text(item?.department);
  if (!dept) return "choose_org";
  if (isSuperAdmin || !officerDepartment) return "claim";
  return dept === officerDepartment ? "claim" : "not_yours";
}

// ด่วน → ค้างเกินเกณฑ์ → อายุมากก่อน → คงลำดับเดิม (export ให้หน้ามือถือที่แสดงเป็น flat list ใช้ตัวเดียวกัน)
export function sortPoolItems(items) {
  return sortItems(items);
}

function sortItems(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        Number(!!b.item.isUrgent) - Number(!!a.item.isUrgent) ||
        Number(!!b.item.isStale) - Number(!!a.item.isStale) ||
        (b.item.daysUnclaimed ?? -1) - (a.item.daysUnclaimed ?? -1) ||
        a.index - b.index
    )
    .map((x) => x.item);
}

function maxDaysOf(items, settings) {
  const days = items.map((i) => i.daysUnclaimed).filter((d) => Number.isFinite(d));
  const maxDays = days.length ? Math.max(...days) : null;
  const warn = settings?.unclaimedWarnDays ?? DEFAULT_TASK_SETTINGS.unclaimedWarnDays;
  const alert = settings?.unclaimedAlertDays ?? DEFAULT_TASK_SETTINGS.unclaimedAlertDays;
  const maxDaysTone = maxDays === null ? "neutral" : maxDays > alert ? "overdue" : maxDays >= warn ? "due" : "neutral";
  return { maxDays, maxDaysTone };
}

function column(key, label, list, settings, extra = {}) {
  const items = sortItems(list);
  return { key, label, count: items.length, ...maxDaysOf(items, settings), items, ...extra };
}

/**
 * คอลัมน์ kanban
 * - organization: กองของตัวเองก่อน (มีเสมอแม้ว่าง) → กองอื่นตามจำนวน → "ยังไม่ระบุกอง" ท้ายสุด (dashed)
 * - category: ตามจำนวนมากก่อน
 * - priority: 4 คอลัมน์คงที่ ด่วนมาก / ค้างเกินเกณฑ์ / ใกล้เกณฑ์ / ใหม่
 * @param {object[]} items
 * @param {string} [groupBy]
 * @param {{ officerDepartment?: string | null, settings?: object, activeDepartments?: string[] }} [opts]
 *        activeDepartments = กองที่มีงาน "กำลังดำเนินการ" อยู่ — ให้มีคอลัมน์เสมอแม้ไม่มีเรื่องค้างรับ
 *        (แก้ความงง "กองสาธารณสุขฯ ไม่มี tab" เมื่อเรื่องของกองนั้นถูกรับไปหมดแล้ว)
 */
export function groupPool(items, groupBy = "organization", { officerDepartment = null, settings = DEFAULT_TASK_SETTINGS, activeDepartments = [] } = {}) {
  const mode = POOL_GROUP_BY.includes(groupBy) ? groupBy : "organization";
  const list = Array.isArray(items) ? items : [];
  const own = text(officerDepartment) || null;

  if (mode === "priority") {
    const warn = settings?.unclaimedWarnDays ?? DEFAULT_TASK_SETTINGS.unclaimedWarnDays;
    const alert = settings?.unclaimedAlertDays ?? DEFAULT_TASK_SETTINGS.unclaimedAlertDays;
    const bucket = (i) => (i.isUrgent ? "urgent" : i.isStale ? "stale" : i.agingTone === "due" ? "warn" : "fresh");
    const defs = [
      ["urgent", "ด่วนมาก", "overdue"],
      ["stale", `ค้างเกิน ${alert} วัน`, "overdue"],
      ["warn", `ค้าง ${warn}–${alert} วัน`, "due"],
      ["fresh", "ใหม่", "neutral"],
    ];
    return defs.map(([key, label, tone]) =>
      column(key, label, list.filter((i) => bucket(i) === key), settings, { tone })
    );
  }

  if (mode === "category") {
    const buckets = new Map();
    for (const item of list) {
      const key = text(item.category) || "ไม่ระบุประเภท";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    }
    return [...buckets]
      .map(([key, group], idx) => column(key, key, group, settings, { tone: COLUMN_TONES[idx % COLUMN_TONES.length] }))
      .sort((a, b) => b.count - a.count || collator.compare(a.key, b.key));
  }

  // organization (กอง)
  const buckets = new Map();
  if (own) buckets.set(own, []);
  for (const dept of Array.isArray(activeDepartments) ? activeDepartments : []) {
    const key = text(dept);
    if (key && !buckets.has(key)) buckets.set(key, []);
  }
  for (const item of list) {
    const key = text(item.department) || UNASSIGNED_KEY;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  if (!buckets.has(UNASSIGNED_KEY)) buckets.set(UNASSIGNED_KEY, []);

  let toneIdx = 0;
  const columns = [...buckets].map(([key, group]) => {
    const isUnassigned = key === UNASSIGNED_KEY;
    const isOwn = !isUnassigned && key === own;
    const tone = isUnassigned ? "unclaimed" : isOwn ? "primary" : COLUMN_TONES[toneIdx++ % COLUMN_TONES.length];
    return column(key, isUnassigned ? UNASSIGNED_DEPARTMENT : departmentShort(key), group, settings, {
      fullName: isUnassigned ? UNASSIGNED_DEPARTMENT : key,
      isOwn,
      isUnassigned,
      tone,
    });
  });
  columns.sort(
    (a, b) =>
      Number(a.isUnassigned) - Number(b.isUnassigned) ||
      Number(b.isOwn) - Number(a.isOwn) ||
      b.count - a.count ||
      collator.compare(a.label, b.label)
  );
  return columns;
}

/** alert bar สีแดง: เรื่องค้างเกินเกณฑ์ + ค้างนานสุด (พร้อมชุมชน) + จำนวนด่วน (isStale/isUrgent ถูกตัดสินตอน deriveUnclaimed แล้ว) */
export function staleSummary(items) {
  const list = Array.isArray(items) ? items : [];
  const stale = list.filter((i) => i.isStale);
  let top = null;
  for (const i of stale) if (!top || (i.daysUnclaimed ?? -1) > (top.daysUnclaimed ?? -1)) top = i;
  return {
    count: stale.length,
    maxDays: top ? top.daysUnclaimed : null,
    community: top ? text(top.community) : "",
    urgentCount: list.filter((i) => i.isUrgent).length,
  };
}

// ป้ายบริบทจากข้อความที่ประชาชนพิมพ์ — เป็นแค่ "คำใบ้" ให้เจ้าหน้าที่ ไม่ใช่การตัดสิน
const DANGER_RE = /ไฟช็อต|ไฟรั่ว|ไฟดูด|สายไฟขาด|สายไฟห้อย|สายไฟหลุด|เสาไฟล้ม|เสาไฟเอียง|ต้นไม้ล้ม|กิ่งไม้หัก|หลุมลึก|ถนนทรุด|ถนนยุบ|ท่อแตก|น้ำท่วม|ไฟไหม้|เพลิง|ระเบิด|อันตราย|สุนัขบ้า|สุนัขกัด|งู|แก๊สรั่ว/;
const PEA_RE = /สายไฟ|เสาไฟฟ้า|หม้อแปลง|ไฟฟ้าดับ|ไฟดับทั้ง|มิเตอร์|แรงสูง|การไฟฟ้า/;

export function dangerHint(value) {
  return DANGER_RE.test(text(value));
}

/** งานที่การไฟฟ้าส่วนภูมิภาคต้องเป็นผู้ดำเนินการ → 'กฟภ.' · โคมไฟส่องสว่างเป็นของเทศบาลเอง → null */
export function possibleAgencyFor(category, value) {
  return PEA_RE.test(text(value)) ? "กฟภ." : null;
}
