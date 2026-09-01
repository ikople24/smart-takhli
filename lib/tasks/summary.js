// lib/tasks/summary.js
// ข้อมูลสรุปของหน้าจอ 1 "งานของฉัน" — การ์ดเตือน 4 ใบ + right rail 3 การ์ด (logic ล้วน, คำนวณจาก OfficerTask ที่ API ส่งมา)
// README หน้าจอ 1 § ② Alert row และ § ④ ขวา — right rail
import { DEFAULT_TASK_SETTINGS } from "./settings";
import { coordinationWaitPill } from "./badges";
import { toDate } from "./format";

const isOpen = (t) => !!t && !t.isCompleted;
const text = (v) => String(v ?? "").trim();
const iso = (v) => {
  const d = toDate(v);
  return d ? d.toISOString() : null;
};
const ts = (v) => {
  const d = toDate(v);
  return d ? d.getTime() : null;
};
const UNKNOWN_AGENCY = "ไม่ระบุหน่วยงาน";
const collator = new Intl.Collator("th");

/** 'กฟภ. 2 · กองสาธารณสุขฯ 1' (สูงสุด 2 หน่วยงาน แล้ว +N) */
function agenciesCaption(items) {
  const counts = new Map();
  for (const t of items) {
    const agency = text(t.agencyName) || UNKNOWN_AGENCY;
    counts.set(agency, (counts.get(agency) ?? 0) + 1);
  }
  if (!counts.size) return "ยังไม่มีเรื่องรอประสาน";
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]));
  const head = sorted
    .slice(0, 2)
    .map(([agency, n]) => `${agency} ${n}`)
    .join(" · ");
  return sorted.length > 2 ? `${head} · +${sorted.length - 2}` : head;
}

/**
 * การ์ดเตือน 4 ใบ — นับจาก alertKinds ของงานที่ยังเปิด (เรื่องเดียวนับได้หลายใบ)
 * @returns {Array<{ key: string, tone: string, label: string, count: number, caption: string }>}
 */
export function alertCards(tasks, settings = DEFAULT_TASK_SETTINGS) {
  const open = (Array.isArray(tasks) ? tasks : []).filter(isOpen);
  const withKind = (kind) => open.filter((t) => Array.isArray(t.alertKinds) && t.alertKinds.includes(kind));
  const coordinating = withKind("coordinating");
  const warn = settings?.warnBeforeDays ?? DEFAULT_TASK_SETTINGS.warnBeforeDays;
  const every = settings?.followUpEveryDays ?? DEFAULT_TASK_SETTINGS.followUpEveryDays;
  return [
    { key: "overdue", tone: "overdue", label: "เกินกำหนด", count: withKind("overdue").length, caption: "ต้องอัปเดตความคืบหน้าวันนี้" },
    { key: "due_soon", tone: "due", label: "ใกล้ครบกำหนด", count: withKind("due_soon").length, caption: `ครบกำหนดภายใน ${warn} วัน` },
    { key: "coordinating", tone: "coord", label: "รอประสานหน่วยงาน", count: coordinating.length, caption: agenciesCaption(coordinating) },
    { key: "blocked", tone: "blocked", label: "รอวัสดุ / งบประมาณ", count: withKind("blocked").length, caption: `พักนับ SLA · ติดตามทุก ${every} วัน` },
  ];
}

/**
 * การ์ด "ต้องประสานงานต่อ" — รวมงานที่รอประสานตามหน่วยงาน เรียงที่ถึงวันติดตามก่อน → รอนานสุดก่อน
 */
export function coordinationRail(tasks, { followUpEveryDays = DEFAULT_TASK_SETTINGS.followUpEveryDays } = {}) {
  const groups = new Map();
  for (const t of (Array.isArray(tasks) ? tasks : []).filter(isOpen)) {
    if (!t.needsCoordination) continue;
    const agency = text(t.agencyName) || UNKNOWN_AGENCY;
    if (!groups.has(agency)) groups.set(agency, []);
    groups.get(agency).push(t);
  }

  const rail = [...groups].map(([agencyName, items]) => {
    const waits = items.map((t) => t.coordinationWaitDays).filter((d) => Number.isFinite(d));
    const maxWaitDays = waits.length ? Math.max(...waits) : null;
    const sent = items.map((t) => ts(t.coordination?.sentAt)).filter((v) => v !== null);
    const next = items.map((t) => ts(t.coordination?.nextFollowUpAt)).filter((v) => v !== null);
    return {
      agencyName,
      count: items.length,
      maxWaitDays,
      waitPill: coordinationWaitPill(maxWaitDays, followUpEveryDays),
      latestSentAt: sent.length ? new Date(Math.max(...sent)).toISOString() : null,
      nextFollowUpAt: next.length ? new Date(Math.min(...next)).toISOString() : null,
      followUpDue: items.some((t) => t.followUpDue === true),
      /** มีเรื่องที่เรารับเป็นผู้ประสาน (role coordinator) อยู่ในกลุ่มนี้ */
      asCoordinator: items.some((t) => t.role === "coordinator"),
      tasks: items.map((t) => ({ _id: t._id, code: t.code ?? null, title: t.title, actionUrl: t.actionUrl ?? null, role: t.role })),
    };
  });

  rail.sort(
    (a, b) =>
      Number(b.followUpDue) - Number(a.followUpDue) ||
      (b.maxWaitDays ?? -1) - (a.maxWaitDays ?? -1) ||
      b.count - a.count
  );
  return rail;
}

/** การ์ด "รอวัสดุ / งบประมาณ" — เรียงวันคาดว่าจะได้รับ (ไม่รู้ไปท้าย) แล้ววันที่เริ่มพัก */
export function blockedRail(tasks) {
  const rows = (Array.isArray(tasks) ? tasks : [])
    .filter((t) => isOpen(t) && t.isBlocked)
    .map((t) => ({
      _id: t._id,
      code: t.code ?? null,
      title: t.title,
      itemName: text(t.blocked?.itemName),
      purchaseRefNo: text(t.blocked?.purchaseRefNo),
      expectedAt: iso(t.blocked?.expectedAt),
      since: iso(t.blocked?.since),
      actionUrl: t.actionUrl ?? null,
    }));
  rows.sort(
    (a, b) =>
      (ts(a.expectedAt) ?? Infinity) - (ts(b.expectedAt) ?? Infinity) ||
      (ts(a.since) ?? Infinity) - (ts(b.since) ?? Infinity)
  );
  return rows;
}

/**
 * การ์ด "ครบกำหนดสัปดาห์นี้" — งานเปิดที่ครบกำหนดภายใน horizonDays วันข้างหน้า รวมที่เลยกำหนดแล้ว
 * tone ของ date chip: เลยกำหนด → overdue · ใกล้ครบ → due · ปกติ → neutral
 */
export function dueThisWeekRail(tasks, { horizonDays = 6 } = {}) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter((t) => isOpen(t) && Number.isFinite(t.daysToDue) && t.daysToDue <= horizonDays)
    .map((t) => ({
      _id: t._id,
      code: t.code ?? null,
      title: t.title,
      dueDate: t.dueDate ?? null,
      daysToDue: t.daysToDue,
      tone: t.daysToDue < 0 ? "overdue" : t.isDueSoon ? "due" : "neutral",
      caption: text(t.community) || text(t.category),
      actionUrl: t.actionUrl ?? null,
    }))
    .sort((a, b) => a.daysToDue - b.daysToDue);
}
