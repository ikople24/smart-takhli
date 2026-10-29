// แท็บรายงาน "งานที่ต้องจัดการ" — แบ่งคิวโบตะกอน (buildQueue) เป็นกลุ่มงานตามสิ่งที่ต้องทำ (logic ล้วน, เทสต์: __tests__/flushingWork.test.js)
// ยังขุ่น → กลุ่มตามสาเหตุ (followUpGroupOf: โบซ้ำ / เคลียร์พื้นที่ / ส่งซ่อม / ตรวจสอบ) ไม่ว่าครบกำหนดหรือยัง
// ใสแล้ว → "ครบรอบประจำ" เฉพาะที่เลยกำหนด/ครบวันนี้/ภายใน 7 วัน · ที่เหลือ = ใสอยู่ในรอบ · ยังไม่เคยโบ = ไม่อยู่ในกลุ่มงาน
import { followUpGroupOf } from "./flushing";
import { addDaysYmd, daysBetweenYmd } from "./flushingSchedule";

export const WORK_GROUPS = [
  { key: "reflush", label: "โบซ้ำ", hint: "ยังขุ่นเล็กน้อย กลับไปโบให้นานขึ้น", color: "#B45309", tint: "#FDF6EA", sort: "due" },
  { key: "repair", label: "ส่งซ่อม", hint: "หัวโบล์ชำรุด/ฝืด เปิดไม่ได้", color: "#B42318", tint: "#FDF0EF", sort: "age" },
  { key: "clear_site", label: "เคลียร์พื้นที่", hint: "มีสิ่งกีดขวาง ต้องประสานก่อนโบ", color: "#6D28D9", tint: "#F7F3FE", sort: "age" },
  { key: "inspect", label: "ตรวจสอบ", hint: "ยังขุ่นด้วยสาเหตุอื่น หรือไม่ระบุสาเหตุ", color: "#4A5D6B", tint: "#F3F6F8", sort: "age" },
  { key: "routine", label: "ครบรอบประจำ", hint: "ใสแล้ว ครบรอบโบประจำ", color: "#0E6E86", tint: "#F2F9FB", sort: "due" },
];

const ROUTINE_BUCKETS = new Set(["overdue", "today", "upcoming"]);

export function workGroupOf(item) {
  if (!item || item.bucket === "never" || !item.lastResult) return null;
  if (item.lastResult === "still_turbid") return followUpGroupOf(item.lastTurbidCause);
  return ROUTINE_BUCKETS.has(item.bucket) ? "routine" : null;
}

// items = รายการคิว (API /flushing/queue) · today = "YYYY-MM-DD" วันไทย
export function groupWork(items, today) {
  const out = Object.fromEntries(WORK_GROUPS.map((g) => [g.key, []]));
  const overview = { inCycle: 0, routine: 0, followUp: 0, never: 0, total: 0 };
  for (const raw of items || []) {
    overview.total += 1;
    const ageDays = raw.lastYmd ? daysBetweenYmd(raw.lastYmd, today) : null;
    const i = { ...raw, ageDays };
    const g = workGroupOf(i);
    if (raw.bucket === "never") overview.never += 1;
    else if (g === "routine") overview.routine += 1;
    else if (g) overview.followUp += 1;
    else overview.inCycle += 1;
    if (g) out[g].push(i);
  }
  const counts = {};
  const overdue = {};
  const oldestDays = {};
  for (const w of WORK_GROUPS) {
    const list = out[w.key];
    list.sort((a, b) =>
      w.sort === "due"
        ? String(a.dueYmd ?? "9999").localeCompare(String(b.dueYmd ?? "9999")) || String(a.code).localeCompare(String(b.code))
        : (b.ageDays ?? 0) - (a.ageDays ?? 0) || String(a.code).localeCompare(String(b.code))
    );
    counts[w.key] = list.length;
    overdue[w.key] = list.filter((i) => i.bucket === "overdue").length;
    oldestDays[w.key] = list.reduce((m, i) => Math.max(m, i.ageDays ?? 0), 0);
  }
  return { items: out, counts, overdue, oldestDays, overview };
}

// ปฏิทินงานตามรอบ (แท็บรายงาน → ครบรอบประจำ มุมมองปฏิทิน) — 3 สัปดาห์ เริ่มวันอาทิตย์ของสัปดาห์นี้
// ครอบรอบใสแล้ว 15 วันได้ทั้งหมด · เลยกำหนดแยกไว้ใน overdue (ต้องไปก่อน) · ครบหลังช่วง = นับใน after
// includeReflush = ใส่งานโบซ้ำ (ยังขุ่นเล็กน้อย รอบ 5 วัน) ด้วย · งานที่รอแก้ไข (blocked) / ยังไม่เคยโบ ไม่มีวันครบ ไม่ลงปฏิทิน
export const CALENDAR_WEEKS = 3;
export function buildDueCalendar(items, today, { includeReflush = false, weeks = CALENDAR_WEEKS } = {}) {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = อาทิตย์
  const start = addDaysYmd(today, -dow);
  const end = addDaysYmd(start, weeks * 7 - 1);
  const byDay = new Map();
  const overdue = [];
  let after = 0;
  for (const i of items || []) {
    if (!i?.dueYmd || i.bucket === "blocked" || i.bucket === "never") continue;
    const work = i.lastResult === "clear" ? "routine" : followUpGroupOf(i.lastTurbidCause);
    if (work !== "routine" && !(includeReflush && work === "reflush")) continue;
    const it = { ...i, work };
    if (i.dueYmd < today) overdue.push(it);
    else if (i.dueYmd > end) after += 1;
    else {
      if (!byDay.has(i.dueYmd)) byDay.set(i.dueYmd, []);
      byDay.get(i.dueYmd).push(it);
    }
  }
  const byCode = (a, b) => String(a.code).localeCompare(String(b.code));
  overdue.sort((a, b) => String(a.dueYmd).localeCompare(String(b.dueYmd)) || byCode(a, b));
  const grid = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const ymd = addDaysYmd(start, w * 7 + d);
      return { ymd, isToday: ymd === today, isPast: ymd < today, items: (byDay.get(ymd) || []).sort(byCode) };
    })
  );
  return { start, end, weeks: grid, overdue, after };
}

// งานของเจ้าหน้าที่ภาคสนาม (คิวทีมของฉัน) — field API ส่งเฉพาะ overdue/today/upcoming (ไม่มี blocked)
export function fieldTaskOf(item) {
  if (item?.lastResult === "clear") return "routine";
  const g = followUpGroupOf(item?.lastTurbidCause);
  return g === "reflush" ? "reflush" : "inspect";
}
