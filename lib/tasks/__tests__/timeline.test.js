// เทสต์ logic หน้าจอ 3 (README): ไทม์ไลน์การดำเนินงาน, เงื่อนไขปิดเรื่อง, แผนเปลี่ยนขั้น stepper, พัก/เลิกพัก SLA
import { describe, it, expect, beforeAll } from "vitest";
import { buildTimeline, closeChecklist, stageChangePlan, blockedUpdate } from "../timeline";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const bkk10 = (d) => `2026-${d}T03:00:00Z`;
const NOW = new Date("2026-08-31T05:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const derived = (over = {}) => ({
  isCompleted: false,
  needsCoordination: false,
  agencyName: null,
  coordinationWaitDays: null,
  isBlocked: false,
  blockedDays: null,
  stage: "received",
  ...over,
});

describe("buildTimeline — เอกสารเก่าไม่มี timeline", () => {
  it("รับเรื่อง → มอบหมาย (สังเคราะห์จาก assignedAt) → รายการรออยู่ท้ายสุด", () => {
    const t = buildTimeline({
      complaint: { createdAt: bkk10("08-20") },
      assignment: { assignedAt: bkk10("08-21") },
      derived: derived(),
      officerName: "สมชาย ใจดี",
    });
    expect(t.map((e) => e.key)).toEqual(["received", "assigned", "pending"]);
    expect(t[0]).toMatchObject({ title: "รับเรื่องเข้าระบบ", tone: "done", at: "2026-08-20T03:00:00.000Z", pending: false });
    expect(t[1]).toMatchObject({ title: "มอบหมายให้ สมชาย ใจดี", tone: "done", at: "2026-08-21T03:00:00.000Z" });
    expect(t[2]).toMatchObject({ pending: true, tone: "neutral" });
    expect(t[2].title).toContain("รับเรื่อง"); // ขั้นปัจจุบัน
  });

  it("note/solution แบบเก่า + completedAt → มีบันทึกการดำเนินงานก่อน 'ปิดเรื่อง' และไม่มีรายการรออยู่", () => {
    const t = buildTimeline({
      complaint: { createdAt: bkk10("08-20") },
      assignment: { assignedAt: bkk10("08-21"), completedAt: bkk10("08-25"), note: "เปลี่ยนโคมไฟแล้ว", solution: ["เปลี่ยนอุปกรณ์"], solutionImages: ["a.jpg"] },
      derived: derived({ isCompleted: true, stage: "closed" }),
      officerName: "สมชาย",
    });
    expect(t.map((e) => e.key)).toEqual(["received", "assigned", "legacy-note", "closed"]);
    expect(t[2].title).toBe("บันทึกการดำเนินงาน");
    expect(t[2].detail).toContain("เปลี่ยนโคมไฟแล้ว");
    expect(t[2].detail).toContain("เปลี่ยนอุปกรณ์");
    expect(t[2].images).toEqual(["a.jpg"]);
    expect(t[3]).toMatchObject({ title: "ปิดเรื่อง", tone: "done", at: "2026-08-25T03:00:00.000Z" });
    expect(t.some((e) => e.pending)).toBe(false);
  });
});

describe("buildTimeline — จาก assignment.timeline", () => {
  const timeline = [
    { _id: "t1", at: bkk10("08-21"), kind: "created", text: "มอบหมายงานให้เจ้าหน้าที่", byName: "หัวหน้า" },
    { _id: "t2", at: bkk10("08-22"), kind: "note", text: "ลงพื้นที่ตรวจสอบ", images: ["1.jpg", "2.jpg"], byName: "สมชาย" },
    { _id: "t3", at: bkk10("08-22"), kind: "stage", stage: "site_visit", text: "", byName: "สมชาย" },
    { _id: "t4", at: bkk10("08-25"), kind: "coordination", text: "ประสาน กฟภ. — หนังสือเลขที่ ทต.ตค 0417/2569", byName: "สมชาย" },
    { _id: "t5", at: bkk10("08-23"), kind: "transfer", text: "โอนงานจาก ก ให้ ข — เหตุผล: ลา", byName: "ก" },
  ];

  it("ไม่สังเคราะห์ 'มอบหมาย' ซ้ำ, เรียงตามเวลา, map kind → tone, ส่งรูป/ผู้บันทึกต่อ", () => {
    const t = buildTimeline({
      complaint: { createdAt: bkk10("08-20") },
      assignment: { assignedAt: bkk10("08-21"), timeline },
      derived: derived({ needsCoordination: true, agencyName: "กฟภ.", coordinationWaitDays: 6, stage: "coordinating" }),
      officerName: "สมชาย",
    });
    expect(t.map((e) => e.key)).toEqual(["received", "t1", "t2", "t3", "t5", "t4", "pending"]);
    expect(t.find((e) => e.key === "t2")).toMatchObject({ tone: "done", images: ["1.jpg", "2.jpg"], by: "สมชาย", title: "ลงพื้นที่ตรวจสอบ" });
    expect(t.find((e) => e.key === "t3").title).toBe('เลื่อนขั้นเป็น "ลงพื้นที่"');
    expect(t.find((e) => e.key === "t4").tone).toBe("coord");
    expect(t.find((e) => e.key === "t5").tone).toBe("neutral");
  });

  it("รอประสานหน่วยงาน → รายการรออยู่สีแดง 'รอตอบกลับจาก กฟภ. — 6 วัน'", () => {
    const t = buildTimeline({
      complaint: { createdAt: bkk10("08-20") },
      assignment: { assignedAt: bkk10("08-21"), timeline },
      derived: derived({ needsCoordination: true, agencyName: "กฟภ.", coordinationWaitDays: 6, stage: "coordinating" }),
    });
    expect(t.at(-1)).toMatchObject({ pending: true, tone: "overdue", title: "รอตอบกลับจาก กฟภ. — 6 วัน" });
  });

  it("รอวัสดุ → รายการรออยู่สีม่วง; มี kind 'closed' ใน timeline → ไม่สังเคราะห์ปิดเรื่องซ้ำ", () => {
    const blocked = buildTimeline({
      complaint: { createdAt: bkk10("08-20") },
      assignment: { assignedAt: bkk10("08-21"), timeline: [{ _id: "b", at: bkk10("08-28"), kind: "blocked", text: "รอโคมไฟ LED 24 ชุด" }] },
      derived: derived({ isBlocked: true, blockedDays: 3 }),
    });
    expect(blocked.at(-1)).toMatchObject({ pending: true, tone: "blocked", title: "รอวัสดุ / งบประมาณ — พัก SLA 3 วัน" });
    expect(blocked.find((e) => e.key === "b").tone).toBe("blocked");

    const closed = buildTimeline({
      complaint: { createdAt: bkk10("08-20") },
      assignment: { assignedAt: bkk10("08-21"), completedAt: bkk10("08-25"), timeline: [{ _id: "c", at: bkk10("08-25"), kind: "closed", text: "ปิดเรื่อง — เปลี่ยนโคมไฟแล้ว" }] },
      derived: derived({ isCompleted: true, stage: "closed" }),
    });
    expect(closed.filter((e) => e.kind === "closed")).toHaveLength(1);
    expect(closed.at(-1).key).toBe("c");
  });
});

describe("closeChecklist — สรุปบังคับเสมอ · ภาพ ≥1 หรือติ๊กยืนยันปิดโดยไม่มีภาพ", () => {
  it("ไม่มีภาพ+ไม่ติ๊ก+สรุปว่าง → 2 ข้อความ", () => {
    const bad = closeChecklist({ note: "  ", images: [] });
    expect(bad.ok).toBe(false);
    expect(bad.errors).toHaveLength(2);
    expect(bad.errors.join(" ")).toMatch(/ภาพ/);
  });

  it("มีภาพ + สรุป → ok โดยไม่ต้องติ๊ก (พฤติกรรมเดิม)", () => {
    expect(closeChecklist({ note: "เปลี่ยนโคมไฟแล้ว", images: ["a.jpg"] })).toEqual({ ok: true, errors: [] });
  });

  it("ไม่มีภาพ + ติ๊กยืนยัน + สรุป → ok (เช่น เรื่องสอบถามข้อมูล)", () => {
    expect(closeChecklist({ note: "ตอบข้อสอบถามแล้ว", images: [], confirmNoImages: true })).toEqual({ ok: true, errors: [] });
  });

  it("ไม่มีภาพ+ไม่ติ๊ก+มีสรุป → error ภาพอย่างเดียว · ติ๊กแต่สรุปว่าง → error สรุปอย่างเดียว", () => {
    const noImg = closeChecklist({ note: "ทำแล้ว", images: [] });
    expect(noImg.ok).toBe(false);
    expect(noImg.errors).toHaveLength(1);
    expect(noImg.errors[0]).toMatch(/ติ๊กยืนยัน/);

    const noNote = closeChecklist({ note: "", images: [], confirmNoImages: true });
    expect(noNote.errors).toEqual(["ต้องเขียนบันทึกสรุปการดำเนินงาน"]);
  });
});

describe("stageChangePlan — กด stepper แล้วต้องเกิดอะไร", () => {
  it("เดินหน้า 1 ขั้น → ok, status เรื่องตามขั้น; ไป coordinating → รอประสานฯ; ไป closed → closes", () => {
    expect(stageChangePlan("received", "site_visit")).toEqual({ ok: true, needsReason: false, closes: false, complaintStatus: "อยู่ระหว่างดำเนินการ" });
    expect(stageChangePlan("site_visit", "coordinating").complaintStatus).toBe("รอประสานหน่วยงานภายนอก");
    expect(stageChangePlan("awaiting_review", "closed")).toMatchObject({ ok: true, closes: true, complaintStatus: "ดำเนินการเสร็จสิ้น" });
  });
  it("ถอยหลัง → needsReason; ข้ามขั้น → ไม่ ok พร้อมเหตุผล", () => {
    expect(stageChangePlan("coordinating", "received")).toMatchObject({ ok: true, needsReason: true, complaintStatus: "อยู่ระหว่างดำเนินการ" });
    const skip = stageChangePlan("received", "closed");
    expect(skip.ok).toBe(false);
    expect(skip.reason).toMatch(/ข้ามขั้น/);
  });
});

describe("blockedUpdate — เปิด/ปิด 'รอวัสดุ / งบประมาณ' และการนับพัก SLA", () => {
  it("เปิด: ตั้ง blocked + since + slaPausedAt = now, timeline kind blocked", () => {
    const u = blockedUpdate({ slaPausedAt: null, slaPausedMs: 0 }, { on: true, itemName: "โคมไฟ LED 24 ชุด", purchaseRefNo: "PO-20", expectedAt: "2026-09-05", reason: "รอของ", now: NOW });
    expect(u.set.blocked).toMatchObject({ isBlocked: true, itemName: "โคมไฟ LED 24 ชุด", purchaseRefNo: "PO-20", reason: "รอของ" });
    expect(u.set.blocked.expectedAt.toISOString()).toBe("2026-09-05T00:00:00.000Z");
    expect(u.set.blocked.since).toBe(NOW);
    expect(u.set.slaPausedAt).toBe(NOW);
    expect(u.set.slaPausedMs).toBe(0);
    expect(u.timelineEntry).toMatchObject({ kind: "blocked" });
    expect(u.timelineEntry.text).toContain("โคมไฟ LED 24 ชุด");
  });
  it("เปิดซ้ำตอนพักอยู่แล้ว → คง slaPausedAt เดิม", () => {
    const paused = new Date("2026-08-28T03:00:00Z");
    const u = blockedUpdate({ slaPausedAt: paused, slaPausedMs: 0 }, { on: true, itemName: "x", now: NOW });
    expect(u.set.slaPausedAt).toBe(paused);
  });
  it("ปิด: รวมเวลาพักเข้า slaPausedMs, ล้าง slaPausedAt, isBlocked false, timeline บอกจำนวนวันที่พัก", () => {
    const u = blockedUpdate({ slaPausedAt: new Date("2026-08-28T05:00:00Z"), slaPausedMs: DAY, blocked: { isBlocked: true, itemName: "โคมไฟ" } }, { on: false, now: NOW });
    expect(u.set.slaPausedAt).toBeNull();
    expect(u.set.slaPausedMs).toBe(4 * DAY);
    expect(u.set.blocked).toMatchObject({ isBlocked: false, since: null, itemName: "โคมไฟ" });
    expect(u.timelineEntry).toMatchObject({ kind: "unblocked" });
    expect(u.timelineEntry.text).toContain("3 วัน");
  });
  it("ปิดตอนไม่ได้พัก → slaPausedMs ไม่เปลี่ยน", () => {
    const u = blockedUpdate({ slaPausedAt: null, slaPausedMs: 2 * DAY }, { on: false, now: NOW });
    expect(u.set.slaPausedMs).toBe(2 * DAY);
  });
});

describe("buildTimeline — ข้อมูลเก่าที่เวลาเพี้ยน (completedAt เป็นวันที่ล้วน 00:00 ก่อน assignedAt/createdAt)", () => {
  it("ยังเรียงเชิงตรรกะ: รับเรื่อง → มอบหมาย → บันทึก → ปิดเรื่อง เสมอ", () => {
    const t = buildTimeline({
      complaint: { createdAt: "2026-08-30T09:00:00Z" },
      assignment: { assignedAt: "2026-08-30T09:30:00Z", completedAt: "2026-08-30T00:00:00Z", note: "ซ่อมแล้ว" },
      derived: derived({ isCompleted: true, stage: "closed" }),
      officerName: "สมชาย",
    });
    expect(t.map((e) => e.key)).toEqual(["received", "assigned", "legacy-note", "closed"]);
  });
  it("timeline ใหม่: 'created' มาก่อนรายการอื่นแม้เวลาเท่ากัน และ 'closed' อยู่ท้ายสุดเสมอ", () => {
    const t = buildTimeline({
      complaint: { createdAt: bkk10("08-20") },
      assignment: {
        assignedAt: bkk10("08-21"),
        completedAt: bkk10("08-21"),
        timeline: [
          { _id: "n", at: bkk10("08-21"), kind: "note", text: "ทำเสร็จทันที" },
          { _id: "c", at: bkk10("08-21"), kind: "created", text: "มอบหมาย" },
          { _id: "x", at: bkk10("08-21"), kind: "closed", text: "ปิดเรื่อง" },
        ],
      },
      derived: derived({ isCompleted: true, stage: "closed" }),
    });
    expect(t.map((e) => e.key)).toEqual(["received", "c", "n", "x"]);
  });
});
