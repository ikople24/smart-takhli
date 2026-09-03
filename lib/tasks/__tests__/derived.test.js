// เทสต์ derived fields ของงาน (README § Derived fields) — logic ล้วน, เวลาอิง Asia/Bangkok, รัน TZ=UTC
import { describe, it, expect, beforeAll } from "vitest";
import { normalizeTaskSettings } from "../settings";
import {
  SEVERITY_ORDER,
  severityOf,
  dueDateFor,
  effectiveDueDate,
  deriveAssignment,
  deriveUnclaimed,
} from "../derived";

beforeAll(() => {
  process.env.TZ = "UTC";
});

// "ตอนนี้" = 31 ส.ค. 2569 12:00 น. (เวลาไทย) = 05:00Z
const NOW = new Date("2026-08-31T05:00:00Z");
// 10:00 น. เวลาไทยของวันที่กำหนด (03:00Z)
const bkk10 = (d) => `2026-${d}T03:00:00Z`;
const DAY = 24 * 60 * 60 * 1000;

const settings = normalizeTaskSettings({
  defaultSlaDays: 7,
  warnBeforeDays: 2,
  slaByCategory: [{ category: "ไฟฟ้าส่องสว่าง", slaDays: 3 }],
});

describe("severityOf — overdue > due_soon > coordinating > blocked > normal", () => {
  it("เลือกระดับสูงสุดที่เป็นจริง", () => {
    expect(SEVERITY_ORDER).toEqual(["overdue", "due_soon", "coordinating", "blocked", "normal", "done"]);
    expect(severityOf({ isOverdue: true, isDueSoon: false, needsCoordination: true, isBlocked: true })).toBe("overdue");
    expect(severityOf({ isDueSoon: true, needsCoordination: true })).toBe("due_soon");
    expect(severityOf({ needsCoordination: true, isBlocked: true })).toBe("coordinating");
    expect(severityOf({ isBlocked: true })).toBe("blocked");
    expect(severityOf({})).toBe("normal");
    expect(severityOf({ isCompleted: true, isOverdue: true })).toBe("done");
  });
});

describe("dueDateFor — ลำดับแหล่งที่มาของวันครบกำหนด", () => {
  it("ค่าที่บันทึกไว้บน assignment มาก่อน", () => {
    const r = dueDateFor({
      storedDueDate: "2026-09-10T00:00:00Z",
      complaintCreatedAt: bkk10("08-20"),
      category: "ไฟฟ้าส่องสว่าง",
      settings,
    });
    expect(r.dueDate.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(r.basis).toBe("stored");
    expect(r.slaDays).toBe(3);
  });
  it("ไม่มีค่าเก็บ → วันที่แจ้ง + SLA ของประเภท", () => {
    const r = dueDateFor({ complaintCreatedAt: bkk10("08-20"), category: "ไฟฟ้าส่องสว่าง", settings });
    expect(r.dueDate.toISOString()).toBe("2026-08-23T03:00:00.000Z");
    expect(r.basis).toBe("complaint");
  });
  it("ไม่มีวันที่แจ้ง → วันที่รับงาน + SLA default", () => {
    const r = dueDateFor({ assignedAt: bkk10("08-20"), category: "ขยะ", settings });
    expect(r.dueDate.toISOString()).toBe("2026-08-27T03:00:00.000Z");
    expect(r.basis).toBe("assignment");
    expect(r.slaDays).toBe(7);
  });
  it("ไม่มีอะไรเลย → null", () => {
    expect(dueDateFor({ settings })).toEqual({ dueDate: null, basis: null, slaDays: 7 });
  });
});

describe("effectiveDueDate — เลื่อนตามเวลาที่พัก SLA", () => {
  it("บวกช่วงพักที่จบแล้ว (slaPausedMs) และช่วงที่ยังพักอยู่ (slaPausedAt → now)", () => {
    const due = new Date("2026-08-27T03:00:00Z");
    expect(effectiveDueDate(due, { slaPausedMs: 2 * DAY, now: NOW }).toISOString()).toBe("2026-08-29T03:00:00.000Z");
    expect(
      effectiveDueDate(due, { slaPausedAt: "2026-08-30T05:00:00Z", now: NOW }).toISOString()
    ).toBe("2026-08-28T03:00:00.000Z");
    expect(effectiveDueDate(null, { now: NOW })).toBeNull();
  });
});

describe("deriveAssignment — เกินกำหนด / ใกล้ครบกำหนด", () => {
  const base = { assignedAt: bkk10("08-21") };

  it("แจ้ง 20 ส.ค. SLA 7 → ครบ 27 ส.ค. → วันนี้ 31 ส.ค. เกิน 4 วัน", () => {
    const d = deriveAssignment({ assignment: base, complaint: { createdAt: bkk10("08-20"), category: "ขยะ" }, settings, now: NOW });
    expect(d.slaDays).toBe(7);
    expect(d.dueDate).toBe("2026-08-27T03:00:00.000Z");
    expect(d.daysToDue).toBe(-4);
    expect(d.isOverdue).toBe(true);
    expect(d.overdueDays).toBe(4);
    expect(d.isDueSoon).toBe(false);
    expect(d.severity).toBe("overdue");
    expect(d.alertKinds).toEqual(["overdue"]);
  });

  it("ครบกำหนดใน 2 วัน → ใกล้ครบกำหนด; 5 วัน → ปกติ; ครบวันนี้ → ใกล้ครบ ไม่ใช่เกิน", () => {
    const in2 = deriveAssignment({ assignment: base, complaint: { createdAt: bkk10("08-26") }, settings, now: NOW });
    expect(in2.daysToDue).toBe(2);
    expect(in2.isDueSoon).toBe(true);
    expect(in2.severity).toBe("due_soon");

    const in5 = deriveAssignment({ assignment: base, complaint: { createdAt: bkk10("08-29") }, settings, now: NOW });
    expect(in5.isDueSoon).toBe(false);
    expect(in5.severity).toBe("normal");
    expect(in5.alertKinds).toEqual([]);

    // ครบกำหนด 31 ส.ค. 10:00 ไทย แต่ตอนนี้ 12:00 — ยังนับว่า "ครบวันนี้" (เส้นตาย = สิ้นวันไทย)
    const today = deriveAssignment({ assignment: base, complaint: { createdAt: bkk10("08-24") }, settings, now: NOW });
    expect(today.daysToDue).toBe(0);
    expect(today.isOverdue).toBe(false);
    expect(today.isDueSoon).toBe(true);
  });

  it("ไม่มีวันครบกำหนด (ไม่มีทั้ง createdAt/assignedAt) → ไม่เกิน ไม่ใกล้ครบ daysToDue null", () => {
    const d = deriveAssignment({ assignment: {}, complaint: {}, settings, now: NOW });
    expect(d.dueDate).toBeNull();
    expect(d.daysToDue).toBeNull();
    expect(d.isOverdue).toBe(false);
    expect(d.isDueSoon).toBe(false);
  });
});

describe("deriveAssignment — พัก SLA (รอวัสดุ/งบประมาณ)", () => {
  it("พักอยู่ → ไม่นับเกินกำหนด, isBlocked, severity blocked, blockedDays นับจากวันที่พัก", () => {
    const d = deriveAssignment({
      assignment: {
        assignedAt: bkk10("08-21"),
        slaPausedAt: bkk10("08-28"),
        blocked: { isBlocked: true, itemName: "โคมไฟ LED 24 ชุด" },
      },
      complaint: { createdAt: bkk10("08-20") },
      settings,
      now: NOW,
    });
    expect(d.isPaused).toBe(true);
    expect(d.isBlocked).toBe(true);
    expect(d.isOverdue).toBe(false);
    expect(d.blockedDays).toBe(3);
    expect(d.severity).toBe("blocked");
    expect(d.alertKinds).toEqual(["blocked"]);
  });

  it("เคยพักแล้วกลับมาทำต่อ (slaPausedMs 3 วัน) → วันครบกำหนดเลื่อนออกไป 3 วัน", () => {
    const d = deriveAssignment({
      assignment: { assignedAt: bkk10("08-21"), slaPausedMs: 3 * DAY },
      complaint: { createdAt: bkk10("08-20") },
      settings,
      now: NOW,
    });
    expect(d.dueDate).toBe("2026-08-30T03:00:00.000Z");
    expect(d.overdueDays).toBe(1);
    expect(d.isPaused).toBe(false);
  });
});

describe("deriveAssignment — ประสานหน่วยงานภายนอก", () => {
  it("มี agencyName → needsCoordination, นับวันรอจากวันส่งหนังสือ, followUpDue เมื่อถึงวันติดตาม", () => {
    const d = deriveAssignment({
      assignment: {
        assignedAt: bkk10("08-21"),
        coordination: { agencyName: "การไฟฟ้าส่วนภูมิภาค สาขาตาคลี", sentAt: bkk10("08-25"), nextFollowUpAt: bkk10("08-30") },
      },
      complaint: { createdAt: bkk10("08-28") },
      settings,
      now: NOW,
    });
    expect(d.needsCoordination).toBe(true);
    expect(d.coordinationWaitDays).toBe(6);
    expect(d.followUpDue).toBe(true);
    expect(d.severity).toBe("coordinating");
    expect(d.alertKinds).toEqual(["coordinating"]);
  });

  it("บันทึกติดตามล่าสุดรีเซ็ตวันรอ; วันติดตามถัดไปยังไม่ถึง → followUpDue false", () => {
    const d = deriveAssignment({
      assignment: {
        assignedAt: bkk10("08-21"),
        coordination: {
          agencyName: "กฟภ.",
          sentAt: bkk10("08-20"),
          nextFollowUpAt: bkk10("09-02"),
          followUps: [{ at: bkk10("08-26"), channel: "phone" }, { at: bkk10("08-28"), channel: "line" }],
        },
      },
      complaint: { createdAt: bkk10("08-28") },
      settings,
      now: NOW,
    });
    expect(d.coordinationWaitDays).toBe(3);
    expect(d.followUpDue).toBe(false);
  });

  it("เกินกำหนดและต้องประสานพร้อมกัน → severity overdue แต่ alertKinds มีทั้งคู่", () => {
    const d = deriveAssignment({
      assignment: { assignedAt: bkk10("08-21"), coordination: { agencyName: "กฟภ." } },
      complaint: { createdAt: bkk10("08-20") },
      settings,
      now: NOW,
    });
    expect(d.severity).toBe("overdue");
    expect(d.alertKinds).toEqual(["overdue", "coordinating"]);
    expect(d.coordinationWaitDays).toBeNull(); // ยังไม่ส่งหนังสือ/ไม่เคยติดตาม
  });

  it("agencyName ว่าง/ช่องว่าง → ไม่ถือว่าต้องประสาน", () => {
    const d = deriveAssignment({
      assignment: { assignedAt: bkk10("08-21"), coordination: { agencyName: "  " } },
      complaint: { createdAt: bkk10("08-29") },
      settings,
      now: NOW,
    });
    expect(d.needsCoordination).toBe(false);
  });
});

describe("deriveAssignment — งานที่เสร็จแล้ว", () => {
  it("มี completedAt → isCompleted, ไม่เกินกำหนด, severity done, resolutionDays แบบ floor, completedLate", () => {
    const onTime = deriveAssignment({
      assignment: { assignedAt: bkk10("08-21"), completedAt: bkk10("08-25") },
      complaint: { createdAt: bkk10("08-20"), status: "ดำเนินการเสร็จสิ้น" },
      settings,
      now: NOW,
    });
    expect(onTime.isCompleted).toBe(true);
    expect(onTime.isOverdue).toBe(false);
    expect(onTime.isDueSoon).toBe(false);
    expect(onTime.severity).toBe("done");
    expect(onTime.resolutionDays).toBe(4);
    expect(onTime.completedLate).toBe(false);
    expect(onTime.stage).toBe("closed");

    const late = deriveAssignment({
      assignment: { assignedAt: bkk10("08-21"), completedAt: bkk10("08-29") },
      complaint: { createdAt: bkk10("08-20") },
      settings,
      now: NOW,
    });
    expect(late.completedLate).toBe(true);
  });

  it("เรื่องปิดด้วย status แม้ assignment ไม่มี completedAt → ถือว่าเสร็จ แต่ resolutionDays/completedLate เป็น null", () => {
    const d = deriveAssignment({
      assignment: { assignedAt: bkk10("08-21") },
      complaint: { createdAt: bkk10("08-20"), status: "ดำเนินการเสร็จสิ้น" },
      settings,
      now: NOW,
    });
    expect(d.isCompleted).toBe(true);
    expect(d.resolutionDays).toBeNull();
    expect(d.completedLate).toBeNull();
    expect(d.severity).toBe("done");
  });
});

describe("deriveAssignment — ฟิลด์ประกอบอื่น", () => {
  it("daysSinceUpdate ใช้เวลาล่าสุดจาก updatedAt / timeline / assignedAt", () => {
    const viaTimeline = deriveAssignment({
      assignment: { assignedAt: bkk10("08-21"), updatedAt: bkk10("08-22"), timeline: [{ at: bkk10("08-23") }, { at: bkk10("08-29") }] },
      complaint: { createdAt: bkk10("08-28") },
      settings,
      now: NOW,
    });
    expect(viaTimeline.daysSinceUpdate).toBe(2);
    const viaAssigned = deriveAssignment({ assignment: { assignedAt: bkk10("08-25") }, complaint: { createdAt: bkk10("08-28") }, settings, now: NOW });
    expect(viaAssigned.daysSinceUpdate).toBe(6);
  });

  it("stage/role: เอกสารเก่าไม่มี → received / assignee; daysAssigned แบบ floor", () => {
    const d = deriveAssignment({ assignment: { assignedAt: bkk10("08-25") }, complaint: { createdAt: bkk10("08-28") }, settings, now: NOW });
    expect(d.stage).toBe("received");
    expect(d.role).toBe("assignee");
    expect(d.daysAssigned).toBe(6);
    const c = deriveAssignment({ assignment: { assignedAt: bkk10("08-25"), stage: "site_visit", role: "coordinator" }, complaint: {}, settings, now: NOW });
    expect(c.stage).toBe("site_visit");
    expect(c.role).toBe("coordinator");
  });

  it("ไม่ส่ง settings/now → ใช้ default และเวลาปัจจุบัน (ไม่โยน error)", () => {
    const d = deriveAssignment({ assignment: { assignedAt: new Date() }, complaint: {} });
    expect(d.slaDays).toBe(7);
    expect(d.isOverdue).toBe(false);
  });
});

describe("deriveUnclaimed — เรื่องที่ยังไม่มีคนรับ (กองงานรอรับ)", () => {
  const unclaimedSettings = normalizeTaskSettings({ unclaimedWarnDays: 3, unclaimedAlertDays: 4, defaultSlaDays: 7 });

  it("ค้าง 6 วัน → แดง + isStale; 3 วัน → amber; 1 วัน → เทา", () => {
    const six = deriveUnclaimed({ complaint: { createdAt: bkk10("08-25") }, settings: unclaimedSettings, now: NOW });
    expect(six.daysUnclaimed).toBe(6);
    expect(six.isStale).toBe(true);
    expect(six.agingTone).toBe("overdue");

    const three = deriveUnclaimed({ complaint: { createdAt: bkk10("08-28") }, settings: unclaimedSettings, now: NOW });
    expect(three.isStale).toBe(false);
    expect(three.agingTone).toBe("due");

    const one = deriveUnclaimed({ complaint: { createdAt: bkk10("08-30") }, settings: unclaimedSettings, now: NOW });
    expect(one.agingTone).toBe("neutral");
  });

  it("เลย SLA ทั้งที่ยังไม่มีคนรับ → isUrgent (ปุ่ม 'รับงานด่วน')", () => {
    const urgent = deriveUnclaimed({ complaint: { createdAt: bkk10("08-20"), category: "ขยะ" }, settings: unclaimedSettings, now: NOW });
    expect(urgent.dueDate).toBe("2026-08-27T03:00:00.000Z");
    expect(urgent.daysToDue).toBe(-4);
    expect(urgent.isUrgent).toBe(true);
    const fresh = deriveUnclaimed({ complaint: { createdAt: bkk10("08-30") }, settings: unclaimedSettings, now: NOW });
    expect(fresh.isUrgent).toBe(false);
  });

  it("ไม่มี createdAt → daysUnclaimed null, ไม่ stale, ไม่ urgent", () => {
    const d = deriveUnclaimed({ complaint: {}, settings: unclaimedSettings, now: NOW });
    expect(d.daysUnclaimed).toBeNull();
    expect(d.isStale).toBe(false);
    expect(d.isUrgent).toBe(false);
    expect(d.agingTone).toBe("neutral");
  });
});
