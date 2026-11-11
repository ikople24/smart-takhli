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
// ส.ค. 2569: 14 ศ. · 17 จ. · 20 พฤ. · 21 ศ. · 24 จ. · 28 ศ. · 29–30 ส.อา. · 31 จ. — SLA นับวันทำการ (จ.–ศ.)
// 10:00 น. เวลาไทยของวันที่กำหนด (03:00Z)
const bkk10 = (d) => `2026-${d}T03:00:00Z`;
// สิ้นวันไทย (23:59:59.999 +07:00) = เส้นตายที่คำนวณจาก SLA
const eod = (d) => `2026-${d}T16:59:59.999Z`;
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
  it("ไม่มีค่าเก็บ → วันที่แจ้ง + SLA ของประเภท (วันทำการ: แจ้งพฤ. 20 → ศ.21 จ.24 อ.25)", () => {
    const r = dueDateFor({ complaintCreatedAt: bkk10("08-20"), category: "ไฟฟ้าส่องสว่าง", settings });
    expect(r.dueDate.toISOString()).toBe(eod("08-25"));
    expect(r.basis).toBe("complaint");
  });
  it("ไม่มีวันที่แจ้ง → วันที่รับงาน + SLA default", () => {
    const r = dueDateFor({ assignedAt: bkk10("08-20"), category: "ขยะ", settings });
    expect(r.dueDate.toISOString()).toBe(eod("08-31"));
    expect(r.basis).toBe("assignment");
    expect(r.slaDays).toBe(7);
  });
  it("ไม่มีอะไรเลย → null", () => {
    expect(dueDateFor({ settings })).toEqual({ dueDate: null, basis: null, slaDays: 7, workType: "general" });
  });
  it("ส่ง complaint มา → SLA ตามชนิดงาน: กิ่งไม้ 15 วัน แม้อยู่หมวดไฟฟ้า, งานทั่วไป 3 วัน (ค่า default)", () => {
    const tree = dueDateFor({ complaint: { createdAt: bkk10("08-20"), category: "ไฟฟ้าส่องสว่าง", problems: ["กิ่งไม้ล้ำถนน"] } });
    expect(tree).toMatchObject({ slaDays: 15, workType: "tree", basis: "complaint" });
    expect(tree.dueDate.toISOString()).toBe("2026-09-10T16:59:59.999Z");
    const general = dueDateFor({ complaint: { createdAt: bkk10("08-20"), category: "ขยะ", detail: "ขยะล้นถัง" } });
    expect(general).toMatchObject({ slaDays: 3, workType: "general" });
    expect(general.dueDate.toISOString()).toBe(eod("08-25"));
  });
  it("ข้ามวันหยุดใน settings.holidays", () => {
    const withHoliday = normalizeTaskSettings({ ...settings, holidays: [{ date: "2026-08-24", name: "ทดสอบ" }] });
    const r = dueDateFor({ complaintCreatedAt: bkk10("08-20"), category: "ไฟฟ้าส่องสว่าง", settings: withHoliday });
    expect(r.dueDate.toISOString()).toBe(eod("08-26"));
  });
  it("รับ Mongoose document (มี toObject) ได้ — แปลงก่อน spread ไม่งั้น problems หายกลายเป็นงานทั่วไป", () => {
    // จำลอง hydrated doc: ฟิลด์อยู่หลัง getter บน prototype — spread ตรง ๆ จะไม่ได้ problems
    const data = { createdAt: bkk10("08-20"), category: "ไฟฟ้าส่องสว่าง", problems: ["กิ่งไม้ล้ำถนน"] };
    const doc = Object.create({ toObject: () => ({ ...data }), get problems() { return data.problems; } });
    expect({ ...doc }.problems).toBeUndefined();
    expect(dueDateFor({ complaint: doc })).toMatchObject({ slaDays: 15, workType: "tree" });
    expect(deriveAssignment({ assignment: { assignedAt: bkk10("08-21") }, complaint: doc, now: NOW })).toMatchObject({ workType: "tree", slaDays: 15 });
  });
  it("complaint.workType ที่เจ้าหน้าที่เลือกเองชนะการตรวจอัตโนมัติ", () => {
    const r = dueDateFor({ complaintCreatedAt: bkk10("08-20"), complaint: { workType: "road_patch", problems: ["กิ่งไม้ล้ำถนน"] } });
    expect(r).toMatchObject({ slaDays: 30, workType: "road_patch" });
  });
});

describe("effectiveDueDate — เลื่อนตามช่วงพัก SLA เป็นวันทำการ (ยึดสิ้นวันไทย)", () => {
  const due = new Date(eod("08-25")); // อ. 25 ส.ค.
  it("ไม่มีช่วงพัก → ค่าเดิม · ค่าเพี้ยน → null", () => {
    expect(effectiveDueDate(due, { now: NOW }).toISOString()).toBe(eod("08-25"));
    // ค่าเก่าที่บันทึกกลางวันไม่ถูกยึดสิ้นวันถ้าไม่มีการเลื่อน
    expect(effectiveDueDate(bkk10("08-25"), { now: NOW }).toISOString()).toBe("2026-08-25T03:00:00.000Z");
    expect(effectiveDueDate(null, { now: NOW })).toBeNull();
  });
  it("ช่วงพักที่จบแล้ว slaPausedBusinessDays = 2 → พฤ. 27 · ข้ามวันหยุด → ศ. 28", () => {
    expect(effectiveDueDate(due, { slaPausedBusinessDays: 2, now: NOW }).toISOString()).toBe(eod("08-27"));
    expect(effectiveDueDate(due, { slaPausedBusinessDays: 2, holidays: ["2026-08-26"], now: NOW }).toISOString()).toBe(eod("08-28"));
    // ค่าเก่าเวลากลางวัน + เลื่อน → ยึดสิ้นวันไทย
    expect(effectiveDueDate(bkk10("08-25"), { slaPausedBusinessDays: 1, now: NOW }).toISOString()).toBe(eod("08-26"));
  });
  it("ข้อมูลเก่ามีแต่ slaPausedMs → floor(ms/วัน) วันทำการ · มี slaPausedBusinessDays แล้วไม่ดู ms", () => {
    expect(effectiveDueDate(due, { slaPausedMs: 2.9 * DAY, now: NOW }).toISOString()).toBe(eod("08-27"));
    expect(effectiveDueDate(due, { slaPausedMs: 5 * DAY, slaPausedBusinessDays: 0, now: NOW }).toISOString()).toBe(eod("08-25"));
  });
  it("พักอยู่ 1 นาที (วันเดียวกัน) → ไม่เลื่อน", () => {
    const now = new Date("2026-08-31T05:01:00Z");
    expect(effectiveDueDate(due, { slaPausedAt: "2026-08-31T05:00:00Z", now }).toISOString()).toBe(eod("08-25"));
  });
  it("พักศุกร์ 17:00 → ตอนนี้จันทร์ 09:00 = 1 วันทำการ (จันทร์นับ · เสาร์อาทิตย์ไม่นับ)", () => {
    const pausedAt = new Date("2026-08-28T10:00:00Z"); // ศ. 17:00 ไทย
    const now = new Date("2026-08-31T02:00:00Z"); // จ. 09:00 ไทย
    expect(effectiveDueDate(due, { slaPausedAt: pausedAt, now }).toISOString()).toBe(eod("08-26"));
  });
  it("รวมช่วงที่จบแล้ว + ช่วงที่ยังพัก", () => {
    // พักอยู่ตั้งแต่ ศ. 28 → จ. 31 (1) + เดิม 2 = 3 → ศ. 28
    expect(effectiveDueDate(due, { slaPausedBusinessDays: 2, slaPausedAt: bkk10("08-28"), now: NOW }).toISOString()).toBe(eod("08-28"));
  });
});

describe("deriveAssignment — เกินกำหนด / ใกล้ครบกำหนด", () => {
  const base = { assignedAt: bkk10("08-21") };

  it("แจ้ง 14 ส.ค. SLA 7 วันทำการ → ครบ 25 ส.ค. → วันนี้ 31 ส.ค. เกิน 4 วันทำการ (26 27 28 31)", () => {
    const d = deriveAssignment({ assignment: base, complaint: { createdAt: bkk10("08-14"), category: "ขยะ" }, settings, now: NOW });
    expect(d.slaDays).toBe(7);
    expect(d.dueDate).toBe(eod("08-25"));
    expect(d.daysToDue).toBe(-4);
    expect(d.isOverdue).toBe(true);
    expect(d.overdueDays).toBe(4);
    expect(d.isDueSoon).toBe(false);
    expect(d.severity).toBe("overdue");
    expect(d.alertKinds).toEqual(["overdue"]);
  });

  it("วันหยุดเลื่อนวันครบกำหนด และไม่นับในวันที่เกิน", () => {
    const hol = normalizeTaskSettings({ ...settings, holidays: [{ date: "2026-08-17" }, { date: "2026-08-27" }] });
    const d = deriveAssignment({ assignment: base, complaint: { createdAt: bkk10("08-14") }, settings: hol, now: NOW });
    expect(d.dueDate).toBe(eod("08-26"));
    expect(d.daysToDue).toBe(-2); // 28 31 (27 หยุด)
    expect(d.overdueDays).toBe(2);
  });

  it("ครบศุกร์ 28 ส.ค. ตอนนี้จันทร์ 31 → เกิน 1 วันทำการ (เสาร์อาทิตย์ไม่นับ)", () => {
    const d = deriveAssignment({ assignment: base, complaint: { createdAt: bkk10("08-19") }, settings, now: NOW });
    expect(d.dueDate).toBe(eod("08-28"));
    expect(d.overdueDays).toBe(1);
    const sat = deriveAssignment({ assignment: base, complaint: { createdAt: bkk10("08-19") }, settings, now: new Date("2026-08-29T05:00:00Z") });
    expect(sat.isOverdue).toBe(true);
    expect(sat.overdueDays).toBe(1);
  });

  it("ครบกำหนดใน 2 วัน → ใกล้ครบกำหนด; 5 วัน → ปกติ; ครบวันนี้ → ใกล้ครบ ไม่ใช่เกิน", () => {
    // แจ้ง จ. 24 → ครบ พ. 2 ก.ย. = เหลือ 2 วันทำการ
    const in2 = deriveAssignment({ assignment: base, complaint: { createdAt: bkk10("08-24") }, settings, now: NOW });
    expect(in2.daysToDue).toBe(2);
    expect(in2.isDueSoon).toBe(true);
    expect(in2.severity).toBe("due_soon");

    // แจ้ง พฤ. 27 → ครบ จ. 7 ก.ย. = เหลือ 5 วันทำการ
    const in5 = deriveAssignment({ assignment: base, complaint: { createdAt: bkk10("08-27") }, settings, now: NOW });
    expect(in5.daysToDue).toBe(5);
    expect(in5.isDueSoon).toBe(false);
    expect(in5.severity).toBe("normal");
    expect(in5.alertKinds).toEqual([]);

    // แจ้ง พฤ. 20 → ครบสิ้นวัน 31 ส.ค. = วันนี้
    const today = deriveAssignment({ assignment: base, complaint: { createdAt: bkk10("08-20") }, settings, now: NOW });
    expect(today.daysToDue).toBe(0);
    expect(today.isOverdue).toBe(false);
    expect(today.isDueSoon).toBe(true);

    // ค่าเก่าที่บันทึกไว้ 31 ส.ค. 10:00 ไทย แต่ตอนนี้ 12:00 — ยังนับว่า "ครบวันนี้" (เส้นตาย = สิ้นวันไทย)
    const stored = deriveAssignment({ assignment: { ...base, dueDate: bkk10("08-31") }, complaint: {}, settings, now: NOW });
    expect(stored.daysToDue).toBe(0);
    expect(stored.isOverdue).toBe(false);
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
  it("รอวัสดุ → isSiteIssue false, siteIssueLabel null", () => {
    const d = deriveAssignment({
      assignment: { assignedAt: bkk10("08-21"), slaPausedAt: bkk10("08-28"), blocked: { isBlocked: true, kind: "materials" } },
      complaint: { createdAt: bkk10("08-20") },
      settings,
      now: NOW,
    });
    expect(d.isSiteIssue).toBe(false);
    expect(d.siteIssueLabel).toBeNull();
  });
  it("พบปัญหาหน้างาน → พัก SLA เหมือนกัน แต่ alertKinds 'site_issue' แทน 'blocked' + label ของเหตุผล", () => {
    const d = deriveAssignment({
      assignment: {
        assignedAt: bkk10("08-21"),
        slaPausedAt: bkk10("08-28"),
        blocked: { isBlocked: true, kind: "site_issue", siteIssueCode: "private_property", since: bkk10("08-28") },
      },
      complaint: { createdAt: bkk10("08-20") },
      settings,
      now: NOW,
    });
    expect(d.isPaused).toBe(true);
    expect(d.isBlocked).toBe(true);
    expect(d.isOverdue).toBe(false);
    expect(d.isSiteIssue).toBe(true);
    expect(d.siteIssueLabel).toBe("อยู่ในพื้นที่ส่วนบุคคล");
    expect(d.severity).toBe("blocked");
    expect(d.alertKinds).toEqual(["site_issue"]);
  });
  it("พบปัญหาหน้างาน code ไม่รู้จัก → label สำรอง · งานปิดแล้ว → ไม่ใช่ site issue", () => {
    const base = { assignedAt: bkk10("08-21"), slaPausedAt: bkk10("08-28"), blocked: { isBlocked: true, kind: "site_issue", siteIssueCode: "zzz" } };
    expect(deriveAssignment({ assignment: base, complaint: {}, settings, now: NOW }).siteIssueLabel).toBe("พบปัญหาหน้างาน");
    const done = deriveAssignment({ assignment: { ...base, completedAt: bkk10("08-30") }, complaint: {}, settings, now: NOW });
    expect(done.isSiteIssue).toBe(false);
    expect(done.alertKinds).toEqual([]);
  });

  it("เคยพักแล้วกลับมาทำต่อ (slaPausedMs 3 วัน) → วันครบกำหนดเลื่อนออกไป 3 วัน", () => {
    const d = deriveAssignment({
      assignment: { assignedAt: bkk10("08-21"), slaPausedMs: 3 * DAY },
      complaint: { createdAt: bkk10("08-14") },
      settings,
      now: NOW,
    });
    // ครบเดิมสิ้นวัน 25 ส.ค. + พัก 3 วัน (ms ตรง ๆ) = สิ้นวัน 28 ส.ค. (ศ.) → จันทร์ 31 เกิน 1 วันทำการ
    expect(d.dueDate).toBe(eod("08-28"));
    expect(d.overdueDays).toBe(1);
    expect(d.isPaused).toBe(false);
  });
});

describe("deriveAssignment — งานเสร็จขณะยังพัก SLA", () => {
  it("ช่วงพักคิดถึง completedAt ไม่ใช่ตอนนี้", () => {
    // แจ้ง 14 ส.ค. ครบ 25 ส.ค. · พักตั้งแต่ อ. 25 · เสร็จ พฤ. 27 → พัก 2 วันทำการ → ครบ พฤ. 27 → ทัน
    const d = deriveAssignment({
      assignment: { assignedAt: bkk10("08-21"), slaPausedAt: bkk10("08-25"), completedAt: bkk10("08-27") },
      complaint: { createdAt: bkk10("08-14") },
      settings,
      now: NOW,
    });
    expect(d.dueDate).toBe(eod("08-27"));
    expect(d.completedLate).toBe(false);
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
      complaint: { createdAt: bkk10("08-14") },
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
      // แจ้ง 14 ส.ค. ครบสิ้นวัน 25 ส.ค. — เสร็จวันครบกำหนดพอดี = ทัน
      assignment: { assignedAt: bkk10("08-21"), completedAt: bkk10("08-25") },
      complaint: { createdAt: bkk10("08-14"), status: "ดำเนินการเสร็จสิ้น" },
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
      assignment: { assignedAt: bkk10("08-21"), completedAt: bkk10("08-26") },
      complaint: { createdAt: bkk10("08-14") },
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
    expect(d.slaDays).toBe(3);
    expect(d.isOverdue).toBe(false);
  });

  it("คืน workType/workTypeLabel ของเรื่อง", () => {
    const d = deriveAssignment({
      assignment: { assignedAt: bkk10("08-25") },
      complaint: { createdAt: bkk10("08-24"), problems: ["กิ่งไม้ล้ำถนน"] },
      now: NOW,
    });
    expect(d.workType).toBe("tree");
    expect(d.workTypeLabel).toBe("กิ่งไม้/ต้นไม้");
    expect(d.slaDays).toBe(15);
  });

  it("claimHours = ชม.เต็มจากวันแจ้ง → วันรับ (null เมื่อไม่รู้วันแจ้ง)", () => {
    const base = Date.parse(bkk10("08-25"));
    const at = (h) => deriveAssignment({ assignment: { assignedAt: new Date(base + h) }, complaint: { createdAt: bkk10("08-25") }, now: NOW }).claimHours;
    expect(at(24 * 3600e3)).toBe(24);
    expect(at(25 * 3600e3 - 1)).toBe(24);
    expect(at(25 * 3600e3)).toBe(25);
    const ms = deriveAssignment({ assignment: { assignedAt: new Date(base + 24.5 * 3600e3) }, complaint: { createdAt: bkk10("08-25") }, now: NOW }).claimMs;
    expect(ms).toBe(24.5 * 3600e3);
    expect(deriveAssignment({ assignment: { assignedAt: bkk10("08-25") }, complaint: {}, now: NOW }).claimHours).toBeNull();
  });
});

describe("deriveUnclaimed — เรื่องที่ยังไม่มีคนรับ (กองงานรอรับ)", () => {
  const unclaimedSettings = normalizeTaskSettings({ unclaimedWarnHours: 12, unclaimedAlertHours: 24, defaultSlaDays: 7 });
  const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600e3).toISOString();

  it("นับเป็นชั่วโมง: รอ 24 ชม. พอดียังไม่ stale (amber), 25 ชม. → แดง + isStale", () => {
    const h24 = deriveUnclaimed({ complaint: { createdAt: hoursAgo(24) }, settings: unclaimedSettings, now: NOW });
    expect(h24.hoursUnclaimed).toBe(24);
    expect(h24.isStale).toBe(false);
    expect(h24.agingTone).toBe("due");

    const h25 = deriveUnclaimed({ complaint: { createdAt: hoursAgo(25) }, settings: unclaimedSettings, now: NOW });
    expect(h25.hoursUnclaimed).toBe(25);
    expect(h25.isStale).toBe(true);
    expect(h25.agingTone).toBe("overdue");
  });

  it("ตัดสินด้วย ms ไม่ปัดเศษ: 24 ชม. 30 นาที → stale (แม้ hoursUnclaimed แสดง 24) · 24 ชม. 1 วินาที → stale", () => {
    const h2430 = deriveUnclaimed({ complaint: { createdAt: hoursAgo(24.5) }, settings: unclaimedSettings, now: NOW });
    expect(h2430.hoursUnclaimed).toBe(24);
    expect(h2430.isStale).toBe(true);
    expect(h2430.agingTone).toBe("overdue");
    expect(deriveUnclaimed({ complaint: { createdAt: new Date(NOW.getTime() - 24 * 3600e3 - 1000) }, settings: unclaimedSettings, now: NOW }).isStale).toBe(true);
    // amber ตัดสินด้วย ms เช่นกัน: 11 ชม. 59 นาที ยังเทา
    expect(deriveUnclaimed({ complaint: { createdAt: hoursAgo(11.99) }, settings: unclaimedSettings, now: NOW }).agingTone).toBe("neutral");
  });

  it("amber ตั้งแต่ unclaimedWarnHours (12 ชม.) · น้อยกว่านั้นเทา · daysUnclaimed ยังเป็นวันตามปฏิทินไทย", () => {
    expect(deriveUnclaimed({ complaint: { createdAt: hoursAgo(12) }, settings: unclaimedSettings, now: NOW }).agingTone).toBe("due");
    const h11 = deriveUnclaimed({ complaint: { createdAt: hoursAgo(11.5) }, settings: unclaimedSettings, now: NOW });
    expect(h11.hoursUnclaimed).toBe(11);
    expect(h11.agingTone).toBe("neutral");
    expect(h11.daysUnclaimed).toBe(0);
    const six = deriveUnclaimed({ complaint: { createdAt: bkk10("08-25") }, settings: unclaimedSettings, now: NOW });
    expect(six.daysUnclaimed).toBe(6);
    expect(six.isStale).toBe(true);
  });

  it("เกณฑ์วันแบบเดิมไม่มีผลแล้ว — ตั้ง unclaimedAlertDays สูง ๆ ก็ยัง stale ที่ 25 ชม.", () => {
    const s = normalizeTaskSettings({ unclaimedAlertDays: 30 });
    expect(deriveUnclaimed({ complaint: { createdAt: hoursAgo(25) }, settings: s, now: NOW }).isStale).toBe(true);
  });

  it("คืน workType/workTypeLabel ของเรื่อง", () => {
    const d = deriveUnclaimed({ complaint: { createdAt: hoursAgo(1), problems: ["ผิวจราจรเป็นหลุม"] }, now: NOW });
    expect(d).toMatchObject({ workType: "road_patch", workTypeLabel: "ปะถนน (ยางมะตอย)", slaDays: 30 });
  });

  it("เลย SLA ทั้งที่ยังไม่มีคนรับ → isUrgent (ปุ่ม 'รับงานด่วน')", () => {
    const urgent = deriveUnclaimed({ complaint: { createdAt: bkk10("08-14"), category: "ขยะ" }, settings: unclaimedSettings, now: NOW });
    expect(urgent.dueDate).toBe(eod("08-25"));
    expect(urgent.daysToDue).toBe(-4);
    expect(urgent.isUrgent).toBe(true);
    const fresh = deriveUnclaimed({ complaint: { createdAt: bkk10("08-30") }, settings: unclaimedSettings, now: NOW });
    expect(fresh.isUrgent).toBe(false);
  });

  it("ไม่มี createdAt → daysUnclaimed null, ไม่ stale, ไม่ urgent", () => {
    const d = deriveUnclaimed({ complaint: {}, settings: unclaimedSettings, now: NOW });
    expect(d.daysUnclaimed).toBeNull();
    expect(d.hoursUnclaimed).toBeNull();
    expect(d.isStale).toBe(false);
    expect(d.isUrgent).toBe(false);
    expect(d.agingTone).toBe("neutral");
  });
});

describe("deriveAssignment — รอบแนบภาพความคืบหน้า (progressEveryDays · งานปะถนน 7 วันทำการ)", () => {
  // จ. 31 ส.ค. 12:00 ไทย — รับงาน พฤ. 20 → (20, 31] = ศ.21 จ.24–ศ.28 จ.31 = 7 วันทำการ
  const road = { createdAt: bkk10("08-20"), workType: "road_patch", category: "ถนน/ทางเท้า" };
  const assignment = (over = {}) => ({ assignedAt: bkk10("08-20"), timeline: [], ...over });

  it("ไม่เคยแนบภาพ 7 วันทำการหลังรับงาน → progressDue + needs_update (severity ไม่เปลี่ยน)", () => {
    const d = deriveAssignment({ assignment: assignment(), complaint: road, settings, now: NOW });
    expect(d.workType).toBe("road_patch");
    expect(d.progressEveryDays).toBe(7);
    expect(d.lastProgressAt).toBe(new Date(bkk10("08-20")).toISOString());
    expect(d.daysSinceProgress).toBe(7);
    expect(d.progressDue).toBe(true);
    expect(d.alertKinds).toContain("needs_update");
    expect(d.severity).toBe("normal");
  });

  it("รับงาน ศ. 21 → 6 วันทำการ ยังไม่ถึงรอบ", () => {
    const d = deriveAssignment({ assignment: assignment({ assignedAt: bkk10("08-21") }), complaint: road, settings, now: NOW });
    expect(d.daysSinceProgress).toBe(6);
    expect(d.progressDue).toBe(false);
    expect(d.alertKinds).not.toContain("needs_update");
  });

  it("แนบภาพเมื่อ พฤ. 27 (2 วันทำการก่อน) → ไม่ถึงรอบ · lastProgressAt = เวลาภาพนั้น", () => {
    const timeline = [{ at: bkk10("08-27"), kind: "note", text: "ประเมินจุด", images: ["https://res.cloudinary.com/x/a.jpg"] }];
    const d = deriveAssignment({ assignment: assignment({ timeline }), complaint: road, settings, now: NOW });
    expect(d.lastProgressAt).toBe(new Date(bkk10("08-27")).toISOString());
    expect(d.daysSinceProgress).toBe(2);
    expect(d.progressDue).toBe(false);
  });

  it("บันทึกที่ไม่มีภาพ / รายการชนิดอื่นที่มีภาพ ไม่นับ", () => {
    const timeline = [
      { at: bkk10("08-28"), kind: "note", text: "โทรนัดผู้รับเหมา", images: [] },
      { at: bkk10("08-28"), kind: "note", text: "x", images: [""] },
      { at: bkk10("08-28"), kind: "coordination", text: "ส่งหนังสือ", images: ["https://res.cloudinary.com/x/doc.jpg"] },
    ];
    const d = deriveAssignment({ assignment: assignment({ timeline }), complaint: road, settings, now: NOW });
    expect(d.lastProgressAt).toBe(new Date(bkk10("08-20")).toISOString());
    expect(d.progressDue).toBe(true);
  });

  it("ภาพในรายการเลื่อนขั้น (stage) นับได้", () => {
    const timeline = [{ at: bkk10("08-28"), kind: "stage", stage: "site_visit", images: ["https://res.cloudinary.com/x/b.jpg"] }];
    const d = deriveAssignment({ assignment: assignment({ timeline }), complaint: road, settings, now: NOW });
    expect(d.daysSinceProgress).toBe(1);
    expect(d.progressDue).toBe(false);
  });

  it("ข้ามวันหยุดใน settings.holidays (จ. 24 หยุด → 6 วันทำการ)", () => {
    const hol = normalizeTaskSettings({ ...settings, holidays: [{ date: "2026-08-24", name: "ทดสอบ" }] });
    const d = deriveAssignment({ assignment: assignment(), complaint: road, settings: hol, now: NOW });
    expect(d.daysSinceProgress).toBe(6);
    expect(d.progressDue).toBe(false);
  });

  it("พัก SLA อยู่ → ไม่เตือน", () => {
    const d = deriveAssignment({ assignment: assignment({ slaPausedAt: bkk10("08-28") }), complaint: road, settings, now: NOW });
    expect(d.isPaused).toBe(true);
    expect(d.progressDue).toBe(false);
    expect(d.alertKinds).not.toContain("needs_update");
  });

  it("เลิกพัก SLA (timeline unblocked) → รอบเริ่มใหม่จากเวลาเลิกพัก", () => {
    const timeline = [
      { at: bkk10("08-21"), kind: "blocked", text: "รอยางมะตอย" },
      { at: bkk10("08-28"), kind: "unblocked", text: "กลับมาดำเนินการต่อ" },
    ];
    const d = deriveAssignment({ assignment: assignment({ timeline }), complaint: road, settings, now: NOW });
    expect(d.lastProgressAt).toBe(new Date(bkk10("08-28")).toISOString());
    expect(d.daysSinceProgress).toBe(1);
    expect(d.progressDue).toBe(false);
    // ภาพหลังเลิกพักใหม่กว่า → ใช้ภาพ
    const later = [...timeline, { at: bkk10("08-31"), kind: "note", images: ["https://res.cloudinary.com/x/c.jpg"] }];
    expect(deriveAssignment({ assignment: assignment({ timeline: later }), complaint: road, settings, now: NOW }).daysSinceProgress).toBe(0);
  });

  it("ปิดแล้ว → progressDue false · lastProgressAt/daysSinceProgress null", () => {
    const d = deriveAssignment({ assignment: assignment({ completedAt: bkk10("08-31") }), complaint: road, settings, now: NOW });
    expect(d.progressDue).toBe(false);
    expect(d.lastProgressAt).toBeNull();
    expect(d.daysSinceProgress).toBeNull();
    expect(d.alertKinds).toEqual([]);
  });

  it("ชนิดงานอื่นไม่บังคับ → progressEveryDays null · progressDue false", () => {
    const d = deriveAssignment({ assignment: assignment(), complaint: { createdAt: bkk10("08-20"), category: "ไฟฟ้าส่องสว่าง" }, settings, now: NOW });
    expect(d.progressEveryDays).toBeNull();
    expect(d.lastProgressAt).toBeNull();
    expect(d.daysSinceProgress).toBeNull();
    expect(d.progressDue).toBe(false);
    expect(d.alertKinds).not.toContain("needs_update");
  });
});
