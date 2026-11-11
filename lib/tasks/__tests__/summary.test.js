// เทสต์ข้อมูลสรุปของหน้าจอ 1: การ์ดเตือน 4 ใบ + right rail 3 การ์ด (README หน้าจอ 1 ② และ ④ ขวา)
import { describe, it, expect } from "vitest";
import { normalizeTaskSettings } from "../settings";
import { alertCards, coordinationRail, blockedRail, dueThisWeekRail } from "../summary";

const settings = normalizeTaskSettings({ warnBeforeDays: 2, followUpEveryDays: 7 });

const task = (over) => ({
  _id: over._id ?? over.code,
  code: over.code,
  title: over.title ?? `เรื่อง ${over.code}`,
  category: "",
  community: "",
  actionUrl: `/x/${over.code}`,
  isCompleted: false,
  isOverdue: false,
  isDueSoon: false,
  needsCoordination: false,
  isBlocked: false,
  agencyName: null,
  coordinationWaitDays: null,
  followUpDue: false,
  role: "assignee",
  daysToDue: null,
  dueDate: null,
  alertKinds: [],
  coordination: null,
  blocked: null,
  ...over,
});

const tasks = [
  task({ code: "A", isOverdue: true, needsCoordination: true, agencyName: "กฟภ.", coordinationWaitDays: 6, followUpDue: true, alertKinds: ["overdue", "coordinating"], daysToDue: -4, dueDate: "2026-08-27T03:00:00.000Z", community: "ตลาดสด",
    coordination: { agencyName: "กฟภ.", coordinatorOrgId: null, documentNo: "ทต.ตค 0417/2569", sentAt: "2026-08-25T03:00:00.000Z", nextFollowUpAt: "2026-08-30T03:00:00.000Z", followUpCount: 0, lastFollowUpAt: null } }),
  task({ code: "B", isDueSoon: true, needsCoordination: true, agencyName: "กฟภ.", coordinationWaitDays: 2, alertKinds: ["due_soon", "coordinating"], daysToDue: 2, dueDate: "2026-09-02T03:00:00.000Z", role: "coordinator",
    coordination: { agencyName: "กฟภ.", coordinatorOrgId: null, documentNo: "", sentAt: "2026-08-29T03:00:00.000Z", nextFollowUpAt: "2026-09-05T03:00:00.000Z", followUpCount: 1, lastFollowUpAt: "2026-08-29T03:00:00.000Z" } }),
  task({ code: "C", needsCoordination: true, agencyName: "กองสาธารณสุขฯ", coordinationWaitDays: null, alertKinds: ["coordinating"], daysToDue: 9, dueDate: "2026-09-09T03:00:00.000Z",
    coordination: { agencyName: "กองสาธารณสุขฯ", coordinatorOrgId: null, documentNo: "", sentAt: null, nextFollowUpAt: "2026-09-02T03:00:00.000Z", followUpCount: 0, lastFollowUpAt: null } }),
  task({ code: "D", isBlocked: true, alertKinds: ["blocked"], daysToDue: 1, dueDate: "2026-09-01T03:00:00.000Z",
    blocked: { isBlocked: true, reason: "", itemName: "โคมไฟ LED 24 ชุด", purchaseRefNo: "PO-20", expectedAt: "2026-09-05T03:00:00.000Z", since: "2026-08-20T03:00:00.000Z" } }),
  task({ code: "E", isDueSoon: true, alertKinds: ["due_soon"], daysToDue: 0, dueDate: "2026-08-31T03:00:00.000Z" }),
  task({ code: "F", daysToDue: 5, dueDate: "2026-09-05T03:00:00.000Z" }),
  task({ code: "G", daysToDue: 12, dueDate: "2026-09-12T03:00:00.000Z" }),
  task({ code: "H", isCompleted: true, isOverdue: false, daysToDue: -20, dueDate: "2026-08-11T03:00:00.000Z" }),
  task({ code: "I", isBlocked: true, alertKinds: ["blocked"], daysToDue: 3, dueDate: "2026-09-03T03:00:00.000Z",
    blocked: { isBlocked: true, reason: "", itemName: "ท่อ PVC", purchaseRefNo: "", expectedAt: null, since: "2026-08-28T03:00:00.000Z" } }),
];

describe("alertCards — การ์ดเตือน 4 ใบ นับจาก alertKinds ของงานที่ยังเปิด", () => {
  const cards = alertCards(tasks, settings);

  it("ลำดับ/โทน/จำนวน", () => {
    expect(cards.map((c) => [c.key, c.tone, c.count])).toEqual([
      ["overdue", "overdue", 1],
      ["due_soon", "due", 2],
      ["coordinating", "coord", 3],
      ["blocked", "blocked", 2],
    ]);
  });

  it("caption ใส่ค่าจาก settings และสรุปหน่วยงานที่รอประสาน", () => {
    expect(cards[0].caption).toBe("ต้องอัปเดตความคืบหน้าวันนี้");
    expect(cards[1].caption).toBe("ครบกำหนดภายใน 2 วันทำการ");
    expect(cards[2].caption).toBe("กฟภ. 2 · กองสาธารณสุขฯ 1");
    expect(cards[3].caption).toBe("พักนับ SLA · ติดตามทุก 7 วัน");
  });

  it("ไม่มีเรื่องรอประสาน → caption บอกว่าไม่มี; หน่วยงานเกิน 2 → +N", () => {
    expect(alertCards([], settings)[2].caption).toBe("ยังไม่มีเรื่องรอประสาน");
    const many = ["ก", "ข", "ค", "ง"].map((a, i) => task({ code: String(i), needsCoordination: true, agencyName: a, alertKinds: ["coordinating"] }));
    expect(alertCards(many, settings)[2].caption).toBe("ก 1 · ข 1 · +2");
  });
});

describe("coordinationRail — รวมตามหน่วยงาน เรียงที่ต้องติดตามก่อน", () => {
  const rail = coordinationRail(tasks, { followUpEveryDays: 7 });

  it("กฟภ. รวม 2 เรื่อง รอนานสุด 6 วัน followUpDue; กองสาธารณสุขฯ 1 เรื่อง", () => {
    expect(rail.map((r) => [r.agencyName, r.count, r.maxWaitDays, r.followUpDue])).toEqual([
      ["กฟภ.", 2, 6, true],
      ["กองสาธารณสุขฯ", 1, null, false],
    ]);
  });

  it("pill รอตอบกลับ + วันส่งหนังสือล่าสุด + วันติดตามที่ใกล้ที่สุด + งานในกลุ่ม", () => {
    const pea = rail[0];
    expect(pea.waitPill).toEqual({ kind: "wait", tone: "coord", label: "รอตอบกลับ 6 วัน" });
    expect(pea.latestSentAt).toBe("2026-08-29T03:00:00.000Z");
    expect(pea.nextFollowUpAt).toBe("2026-08-30T03:00:00.000Z");
    expect(pea.tasks.map((t) => t.code)).toEqual(["A", "B"]);
    expect(pea.asCoordinator).toBe(true); // มีเรื่องที่เรารับเป็นผู้ประสาน
    expect(rail[1].waitPill).toBeNull();
    expect(rail[1].asCoordinator).toBe(false);
  });

  it("เกินรอบติดตาม → pill แดง; งานที่ปิดแล้วไม่นับ", () => {
    const late = coordinationRail([task({ code: "Z", needsCoordination: true, agencyName: "กปภ.", coordinationWaitDays: 9, alertKinds: ["coordinating"] })], { followUpEveryDays: 7 });
    expect(late[0].waitPill.tone).toBe("overdue");
    expect(coordinationRail([task({ code: "Y", isCompleted: true, needsCoordination: true, agencyName: "x" })])).toEqual([]);
  });
});

describe("blockedRail — รายการรอวัสดุ/งบ เรียงวันคาดว่าจะได้รับ (ไม่รู้ไปท้าย)", () => {
  it("คืน itemName/purchaseRefNo/expectedAt/since + ลิงก์", () => {
    const rail = blockedRail(tasks);
    expect(rail.map((r) => r.code)).toEqual(["D", "I"]);
    expect(rail[0]).toMatchObject({ code: "D", itemName: "โคมไฟ LED 24 ชุด", purchaseRefNo: "PO-20", expectedAt: "2026-09-05T03:00:00.000Z", actionUrl: "/x/D" });
    expect(rail[1].expectedAt).toBeNull();
  });
  it("ไม่มีรายละเอียด blocked → itemName ว่าง แต่ยังอยู่ในลิสต์", () => {
    const rail = blockedRail([task({ code: "Q", isBlocked: true, blocked: null })]);
    expect(rail).toHaveLength(1);
    expect(rail[0].itemName).toBe("");
  });
});

describe("dueThisWeekRail — ครบกำหนดภายใน 5 วันทำการข้างหน้า รวมที่เลยกำหนดแล้ว", () => {
  it("เรียงจากเลยกำหนดมากสุด → ครบวันนี้ → ใกล้ครบ; โทน chip ตามสถานะ; งานปิดแล้ว/ไกลกว่า 5 วันทำการไม่รวม", () => {
    const rail = dueThisWeekRail(tasks);
    expect(rail.map((r) => [r.code, r.daysToDue, r.tone])).toEqual([
      ["A", -4, "overdue"],
      ["E", 0, "due"],
      ["D", 1, "neutral"],
      ["B", 2, "due"],
      ["I", 3, "neutral"],
      ["F", 5, "neutral"],
    ]);
  });
  it("caption = ชุมชน ถ้าไม่มีใช้ประเภท", () => {
    const rail = dueThisWeekRail([task({ code: "A", daysToDue: 1, dueDate: "2026-09-01T03:00:00.000Z", community: "ตลาดสด", category: "ไฟฟ้า" }), task({ code: "B", daysToDue: 1, dueDate: "2026-09-01T03:00:00.000Z", category: "ไฟฟ้า" })]);
    expect(rail.map((r) => r.caption)).toEqual(["ตลาดสด", "ไฟฟ้า"]);
  });
  it("ปรับ horizon ได้", () => {
    expect(dueThisWeekRail(tasks, { horizonDays: 1 }).map((r) => r.code)).toEqual(["A", "E", "D"]);
  });
});

describe("alertCards — ใบ 'ต้องอัปเดตความคืบหน้า' (needs_update)", () => {
  it("ไม่มีงานที่บังคับแนบภาพ → ยังเป็น 4 ใบเหมือนเดิม", () => {
    expect(alertCards(tasks, settings).map((c) => c.key)).not.toContain("needs_update");
  });

  it("มีงานปะถนน → ใบที่ 5 นับเฉพาะที่ถึงรอบ + caption บอกชนิดงานและรอบ", () => {
    const list = [
      ...tasks,
      task({ code: "R1", workTypeLabel: "ปะถนน (ยางมะตอย)", progressEveryDays: 7, progressDue: true, alertKinds: ["needs_update"] }),
      task({ code: "R2", workTypeLabel: "ปะถนน (ยางมะตอย)", progressEveryDays: 7, progressDue: false, alertKinds: [] }),
      task({ code: "R3", isCompleted: true, workTypeLabel: "ปะถนน (ยางมะตอย)", progressEveryDays: 7, alertKinds: ["needs_update"] }),
    ];
    const cards = alertCards(list, settings);
    expect(cards).toHaveLength(5);
    expect(cards[4]).toEqual({
      key: "needs_update",
      tone: "due",
      label: "ต้องอัปเดตความคืบหน้า",
      count: 1,
      caption: "งานปะถนน (ยางมะตอย) ต้องแนบภาพทุก 7 วันทำการ",
    });
  });

  it("มีงานบังคับแต่ยังไม่ถึงรอบ → ใบที่ 5 นับ 0 แต่ยังแสดง", () => {
    const cards = alertCards([task({ code: "R2", workTypeLabel: "ปะถนน (ยางมะตอย)", progressEveryDays: 7 })], settings);
    expect(cards[4]).toMatchObject({ key: "needs_update", count: 0, caption: "งานปะถนน (ยางมะตอย) ต้องแนบภาพทุก 7 วันทำการ" });
  });
});

describe("ปัญหาหน้างาน — การ์ดเตือนแยก + ไม่อยู่ในราง 'รอวัสดุ'", () => {
  const list = [
    task({ code: "M1", isBlocked: true, alertKinds: ["blocked"], blocked: { itemName: "โคมไฟ" } }),
    task({ code: "S1", isBlocked: true, isSiteIssue: true, siteIssueLabel: "อยู่ในพื้นที่ส่วนบุคคล", alertKinds: ["site_issue"] }),
    task({ code: "S2", isBlocked: true, isSiteIssue: true, alertKinds: ["site_issue"] }),
    task({ code: "S3", isCompleted: true, isSiteIssue: true, alertKinds: ["site_issue"] }),
  ];
  it("ใบรอวัสดุนับเฉพาะ materials · ใบ site_issue ต่อท้ายรอวัสดุเมื่อมี ≥ 1", () => {
    const cards = alertCards(list, settings);
    expect(cards.map((c) => c.key)).toEqual(["overdue", "due_soon", "coordinating", "blocked", "site_issue"]);
    expect(cards.find((c) => c.key === "blocked").count).toBe(1);
    expect(cards[4]).toEqual({ key: "site_issue", tone: "blocked", label: "พบปัญหาหน้างาน", count: 2, caption: "พัก SLA · รอหัวหน้าพิจารณา" });
  });
  it("ไม่มีปัญหาหน้างาน → ไม่มีใบ site_issue", () => {
    expect(alertCards([list[0]], settings).map((c) => c.key)).not.toContain("site_issue");
  });
  it("blockedRail ไม่รวมปัญหาหน้างาน", () => {
    expect(blockedRail(list).map((r) => r.code)).toEqual(["M1"]);
  });
});
