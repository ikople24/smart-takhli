// lib/tasks/groupBy.js
// จัดกลุ่ม "กลุ่มงานของฉัน" (ตามประเภทเรื่อง / ตามกอง / ตามความเร่งด่วน) + ตัวกรองจากการ์ดเตือน
// ใช้ได้ทั้งฝั่ง server (my-kpi?groupBy=) และ client (regroup โดยไม่ refetch) — logic ล้วน
import { SEVERITY_ORDER } from "./derived";

export const GROUP_BY = Object.freeze(["category", "organization", "priority"]);

export const SEVERITY_LABELS = Object.freeze({
  overdue: "เกินกำหนด",
  due_soon: "ใกล้ครบกำหนด",
  coordinating: "รอประสานหน่วยงาน",
  blocked: "รอวัสดุ / งบประมาณ",
  normal: "ปกติ",
  done: "เสร็จแล้ว",
});

const UNCATEGORIZED = "อื่น ๆ";
const NO_ORG = "ยังไม่ระบุกอง";
const collator = new Intl.Collator("th");

const severityKey = (item) => (SEVERITY_ORDER.includes(item?.severity) ? item.severity : "normal");
const severityIndex = (s) => SEVERITY_ORDER.indexOf(s);
const emptyCounts = () => Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0]));

// เร่งด่วนก่อน → ใกล้ครบกำหนดก่อน (ไม่รู้วันครบไปท้าย) → คงลำดับเดิม
function sortItems(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((x, y) => {
      const bySeverity = severityIndex(severityKey(x.item)) - severityIndex(severityKey(y.item));
      if (bySeverity) return bySeverity;
      const dx = Number.isFinite(x.item?.daysToDue) ? x.item.daysToDue : Infinity;
      const dy = Number.isFinite(y.item?.daysToDue) ? y.item.daysToDue : Infinity;
      if (dx !== dy) return dx - dy;
      return x.index - y.index;
    })
    .map((x) => x.item);
}

// 'ก · ข · ค · +2' — sub-label ของแถวกลุ่ม
function uniqueJoin(values, max = 3) {
  const uniq = [...new Set(values.filter(Boolean))];
  const head = uniq.slice(0, max).join(" · ");
  return uniq.length > max ? `${head} · +${uniq.length - max}` : head;
}

const text = (v) => String(v ?? "").trim();

/**
 * @param {Array<object>} items รายการที่มี category / department / severity / daysToDue / alertKinds
 * @param {'category'|'organization'|'priority'} [groupBy]
 * @returns {Array<{ key: string, label: string, sub: string, count: number, counts: Record<string, number>, topSeverity: string, items: object[] }>}
 */
export function groupTasks(items, groupBy = "category") {
  const mode = GROUP_BY.includes(groupBy) ? groupBy : "category";
  const list = Array.isArray(items) ? items : [];

  const buckets = new Map();
  for (const item of list) {
    let key;
    if (mode === "category") key = text(item?.category) || UNCATEGORIZED;
    else if (mode === "organization") key = text(item?.department) || NO_ORG;
    else key = severityKey(item);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }

  const groups = [...buckets].map(([key, groupItems]) => {
    const counts = emptyCounts();
    for (const item of groupItems) counts[severityKey(item)] += 1;
    const sorted = sortItems(groupItems);
    let label = key;
    let sub = "";
    if (mode === "category") sub = uniqueJoin(groupItems.map((i) => text(i?.department)));
    else if (mode === "organization") sub = uniqueJoin(groupItems.map((i) => text(i?.category)));
    else label = SEVERITY_LABELS[key];
    return {
      key,
      label,
      sub,
      count: groupItems.length,
      counts,
      topSeverity: sorted.length ? severityKey(sorted[0]) : "normal",
      items: sorted,
    };
  });

  if (mode === "priority") {
    groups.sort((a, b) => severityIndex(a.key) - severityIndex(b.key));
  } else {
    groups.sort(
      (a, b) =>
        severityIndex(a.topSeverity) - severityIndex(b.topSeverity) ||
        b.count - a.count ||
        collator.compare(a.label, b.label)
    );
  }
  return groups;
}

/** การ์ดเตือนคลิก → เหลือเฉพาะเรื่องที่มีป้ายนั้น (null = ทั้งหมด) */
export function filterByAlert(items, alert) {
  const list = Array.isArray(items) ? items : [];
  if (!alert) return list;
  return list.filter((i) => Array.isArray(i?.alertKinds) && i.alertKinds.includes(alert));
}
