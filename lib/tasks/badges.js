// lib/tasks/badges.js
// ข้อความ + โทนสีของป้ายเตือน / aging pill / status pill — ชุดเดียวใช้ทุกหน้าจอ (README § ป้ายเตือน)
// tone → โทเคนสี tk-* ใน styles/globals.css (overdue · due · coord · blocked · unclaimed · done · info · neutral)
// ฝั่ง UI (components/tasks/AlertBadge.tsx) แค่ map tone → class ห้ามแต่งข้อความเอง

const text = (v) => String(v ?? "").trim();

/**
 * ป้ายเตือนของงานที่ถืออยู่ — เรียงตามความรุนแรง
 * @param {object} d ผลจาก deriveAssignment
 * @param {{ agencyName?: string, coordinatorName?: string }} [opts]
 * @returns {Array<{ kind: string, tone: string, label: string }>}
 */
export function badgesForAssignment(d, { agencyName, coordinatorName } = {}) {
  if (!d || d.isCompleted) return [];
  const out = [];
  if (d.isOverdue) out.push({ kind: "overdue", tone: "overdue", label: `เกินกำหนด ${d.overdueDays} วัน` });
  if (d.isDueSoon) {
    out.push({
      kind: "due_soon",
      tone: "due",
      label: d.daysToDue === 0 ? "ครบกำหนดวันนี้" : `ครบกำหนดใน ${d.daysToDue} วัน`,
    });
  }
  if (d.needsCoordination) {
    const agency = text(agencyName ?? d.agencyName);
    out.push({ kind: "coordinating", tone: "coord", label: agency ? `ต้องประสาน ${agency}` : "ต้องประสานหน่วยงาน" });
    const coordinator = text(coordinatorName);
    if (coordinator) out.push({ kind: "coordinator", tone: "coord", label: `${coordinator}เป็นผู้ประสาน` });
  }
  if (d.isBlocked) out.push({ kind: "blocked", tone: "blocked", label: "รอวัสดุ / งบประมาณ" });
  return out;
}

/**
 * pill อายุเรื่องบนการ์ดกองงานรอรับ — 'ค้าง N วัน' / 'ใหม่วันนี้' / 'ด่วนมาก' (เลย SLA)
 * @param {object} u ผลจาก deriveUnclaimed
 */
export function agingPill(u) {
  if (!u || u.daysUnclaimed === null || u.daysUnclaimed === undefined) return null;
  if (u.isUrgent) return { kind: "urgent", tone: "overdue", label: "ด่วนมาก" };
  const tone = u.agingTone === "overdue" ? "overdue" : u.agingTone === "due" ? "due" : "unclaimed";
  return { kind: "aging", tone, label: u.daysUnclaimed <= 0 ? "ใหม่วันนี้" : `ค้าง ${u.daysUnclaimed} วัน` };
}

/**
 * ป้ายบริบทบนการ์ดกองงานรอรับ (เสี่ยงอันตราย · รูป/แผนที่ · อาจต้องประสาน · ร้องซ้ำ · หน่วยงานต้องดำเนินการ · เราเป็นผู้ประสาน)
 */
export function contextBadges({
  isDangerous = false,
  imageCount = 0,
  hasLocation = false,
  possibleAgency,
  repeatCount = 0,
  agencyMustAct,
  weCoordinate = false,
} = {}) {
  const out = [];
  if (isDangerous) out.push({ kind: "danger", tone: "overdue", label: "เสี่ยงอันตราย" });

  const images = Number(imageCount) || 0;
  const media = [images > 0 ? `รูป ${images}` : null, hasLocation ? "แผนที่" : null].filter(Boolean).join(" · ");
  if (media) out.push({ kind: "media", tone: "unclaimed", label: media });

  const possible = text(possibleAgency);
  if (possible) out.push({ kind: "possible_agency", tone: "coord", label: `อาจต้องประสาน ${possible}` });

  const repeats = Number(repeatCount) || 0;
  if (repeats > 1) out.push({ kind: "repeat", tone: "unclaimed", label: `ร้องซ้ำ ${repeats} ครั้ง` });

  const mustAct = text(agencyMustAct);
  if (mustAct) out.push({ kind: "agency", tone: "coord", label: `${mustAct} ต้องดำเนินการ` });

  if (weCoordinate) out.push({ kind: "we_coordinate", tone: "coord", label: "เราเป็นผู้ประสาน" });
  return out;
}

/**
 * pill สถานะของ task row / header — บอก "ตอนนี้งานอยู่ตรงไหน"
 * @param {object} d ผลจาก deriveAssignment
 * @param {{ agencyName?: string }} [opts]
 * @returns {{ label: string, tone: string }}
 */
export function statusPillFor(d, { agencyName } = {}) {
  if (!d) return { label: "-", tone: "neutral" };
  if (d.isCompleted) return { label: "เสร็จสิ้น", tone: "done" };
  if (d.isBlocked) return { label: "รอวัสดุ / งบ", tone: "blocked" };
  if (d.needsCoordination) {
    if (d.coordinationWaitDays === null || d.coordinationWaitDays === undefined) return { label: "ประสานงาน", tone: "coord" };
    if (d.coordinationWaitDays > 0) {
      const agency = text(agencyName ?? d.agencyName);
      return { label: agency ? `รอตอบกลับ ${agency}` : "รอตอบกลับหน่วยงาน", tone: "due" };
    }
    return { label: "ส่งหนังสือแล้ว", tone: "coord" };
  }
  switch (d.stage) {
    case "site_visit":
      return { label: "ลงพื้นที่แล้ว", tone: "info" };
    case "awaiting_review":
      return { label: "รอตรวจรับ", tone: "due" };
    case "coordinating":
      return { label: "ประสานงาน", tone: "coord" };
    default:
      return { label: "รับเรื่องแล้ว", tone: "neutral" };
  }
}

/** 'รอตอบกลับ N วัน' — แดงเมื่อถึง/เกินรอบติดตาม (followUpEveryDays) */
export function coordinationWaitPill(days, followUpEveryDays = 7) {
  if (days === null || days === undefined || !Number.isFinite(Number(days))) return null;
  const n = Math.max(0, Math.floor(Number(days)));
  return { kind: "wait", tone: n >= followUpEveryDays ? "overdue" : "coord", label: `รอตอบกลับ ${n} วัน` };
}
