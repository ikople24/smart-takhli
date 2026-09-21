// เทสต์ข้อความป้ายเตือน / aging pill / status pill — ชุดเดียวใช้ทุกหน้าจอ (README § ป้ายเตือน)
import { describe, it, expect } from "vitest";
import { badgesForAssignment, agingPill, contextBadges, statusPillFor, coordinationWaitPill } from "../badges";

const derived = (over = {}) => ({
  isCompleted: false,
  isOverdue: false,
  overdueDays: 0,
  isDueSoon: false,
  daysToDue: 5,
  needsCoordination: false,
  coordinationWaitDays: null,
  followUpDue: false,
  isBlocked: false,
  stage: "received",
  ...over,
});

describe("badgesForAssignment — เรียงตามความรุนแรง, ข้อความมีตัวเลข", () => {
  it("เกินกำหนด + ต้องประสาน → 2 ป้าย เรียง overdue ก่อน", () => {
    const b = badgesForAssignment(derived({ isOverdue: true, overdueDays: 4, needsCoordination: true }), { agencyName: "กฟภ." });
    expect(b).toEqual([
      { kind: "overdue", tone: "overdue", label: "เกินกำหนด 4 วัน" },
      { kind: "coordinating", tone: "coord", label: "ต้องประสาน กฟภ." },
    ]);
  });
  it("ใกล้ครบกำหนด: ครบวันนี้ / ใน N วัน; ผู้ประสานแสดงเป็นป้ายเสริม", () => {
    expect(badgesForAssignment(derived({ isDueSoon: true, daysToDue: 0 }))[0].label).toBe("ครบกำหนดวันนี้");
    const b = badgesForAssignment(derived({ isDueSoon: true, daysToDue: 2, needsCoordination: true }), { coordinatorName: "กองช่าง" });
    expect(b.map((x) => x.label)).toEqual(["ครบกำหนดใน 2 วัน", "ต้องประสานหน่วยงาน", "กองช่างเป็นผู้ประสาน"]);
    expect(b[2].tone).toBe("coord");
  });
  it("รอวัสดุ/งบ → ป้ายม่วง; ไม่มีอะไร → []; เสร็จแล้ว → []", () => {
    expect(badgesForAssignment(derived({ isBlocked: true }))).toEqual([{ kind: "blocked", tone: "blocked", label: "รอวัสดุ / งบประมาณ" }]);
    expect(badgesForAssignment(derived())).toEqual([]);
    expect(badgesForAssignment(derived({ isCompleted: true, isOverdue: true }))).toEqual([]);
  });
});

describe("agingPill — การ์ดกองงานรอรับ", () => {
  it("ค้าง N วัน สีตาม tone; วันเดียวกัน → 'ใหม่วันนี้'; เลย SLA → 'ด่วนมาก'", () => {
    expect(agingPill({ daysUnclaimed: 6, agingTone: "overdue", isUrgent: false })).toEqual({ kind: "aging", tone: "overdue", label: "ค้าง 6 วัน" });
    expect(agingPill({ daysUnclaimed: 3, agingTone: "due", isUrgent: false })).toEqual({ kind: "aging", tone: "due", label: "ค้าง 3 วัน" });
    expect(agingPill({ daysUnclaimed: 1, agingTone: "neutral", isUrgent: false })).toEqual({ kind: "aging", tone: "unclaimed", label: "ค้าง 1 วัน" });
    expect(agingPill({ daysUnclaimed: 0, agingTone: "neutral", isUrgent: false }).label).toBe("ใหม่วันนี้");
    expect(agingPill({ daysUnclaimed: 2, agingTone: "neutral", isUrgent: true })).toEqual({ kind: "urgent", tone: "overdue", label: "ด่วนมาก" });
    expect(agingPill({ daysUnclaimed: null, agingTone: "neutral", isUrgent: false })).toBeNull();
  });
});

describe("contextBadges — ป้ายบริบทบนการ์ดรอรับ", () => {
  it("รูป/แผนที่ รวมเป็นป้ายเดียว; ร้องซ้ำ; เสี่ยงอันตราย; หน่วยงานภายนอก", () => {
    expect(contextBadges({ imageCount: 3, hasLocation: true }).map((b) => b.label)).toEqual(["รูป 3 · แผนที่"]);
    expect(contextBadges({ imageCount: 0, hasLocation: true }).map((b) => b.label)).toEqual(["แผนที่"]);
    expect(contextBadges({ imageCount: 2 }).map((b) => b.label)).toEqual(["รูป 2"]);
    expect(contextBadges({})).toEqual([]);

    const all = contextBadges({ isDangerous: true, imageCount: 1, possibleAgency: "กฟภ.", repeatCount: 3, agencyMustAct: "กฟภ.", weCoordinate: true });
    expect(all.map((b) => [b.label, b.tone])).toEqual([
      ["เสี่ยงอันตราย", "overdue"],
      ["รูป 1", "unclaimed"],
      ["อาจต้องประสาน กฟภ.", "coord"],
      ["ร้องซ้ำ 3 ครั้ง", "unclaimed"],
      ["กฟภ. ต้องดำเนินการ", "coord"],
      ["เราเป็นผู้ประสาน", "coord"],
    ]);
  });
  it("ร้องซ้ำ 1 ครั้ง (= ครั้งแรก) ไม่แสดง", () => {
    expect(contextBadges({ repeatCount: 1 })).toEqual([]);
  });
});

describe("statusPillFor — pill สถานะของ task row / header", () => {
  it("เสร็จ → เขียว; รอวัสดุ → ม่วง", () => {
    expect(statusPillFor(derived({ isCompleted: true }))).toEqual({ label: "เสร็จสิ้น", tone: "done" });
    expect(statusPillFor(derived({ isBlocked: true }))).toEqual({ label: "รอวัสดุ / งบ", tone: "blocked" });
  });
  it("ประสานงาน: รอตอบกลับ (amber) เมื่อส่งไปแล้ว, 'ประสานงาน' (teal) เมื่อยังไม่ส่ง", () => {
    expect(statusPillFor(derived({ needsCoordination: true, coordinationWaitDays: 6 }), { agencyName: "กฟภ." })).toEqual({ label: "รอตอบกลับ กฟภ.", tone: "due" });
    expect(statusPillFor(derived({ needsCoordination: true, coordinationWaitDays: 0 }))).toEqual({ label: "ส่งหนังสือแล้ว", tone: "coord" });
    expect(statusPillFor(derived({ needsCoordination: true, coordinationWaitDays: null }))).toEqual({ label: "ประสานงาน", tone: "coord" });
  });
  it("ตาม stage: รับเรื่องแล้ว / ลงพื้นที่แล้ว / รอตรวจรับ", () => {
    expect(statusPillFor(derived({ stage: "received" }))).toEqual({ label: "รับเรื่องแล้ว", tone: "neutral" });
    expect(statusPillFor(derived({ stage: "site_visit" }))).toEqual({ label: "ลงพื้นที่แล้ว", tone: "info" });
    expect(statusPillFor(derived({ stage: "awaiting_review" }))).toEqual({ label: "รอตรวจรับ", tone: "due" });
    expect(statusPillFor(derived({ stage: "coordinating" }))).toEqual({ label: "ประสานงาน", tone: "coord" });
  });
});

describe("coordinationWaitPill — 'รอตอบกลับ N วัน' (แดงเมื่อเกินรอบติดตาม)", () => {
  it("ไม่ถึงรอบ → teal, ถึง/เกินรอบ followUpEveryDays → แดง, ไม่มีข้อมูล → null", () => {
    expect(coordinationWaitPill(2, 7)).toEqual({ kind: "wait", tone: "coord", label: "รอตอบกลับ 2 วัน" });
    expect(coordinationWaitPill(7, 7)).toEqual({ kind: "wait", tone: "overdue", label: "รอตอบกลับ 7 วัน" });
    expect(coordinationWaitPill(null, 7)).toBeNull();
  });
});
