// เทสต์สรุปเรื่องค้างไม่มีคนรับรายกอง → แจ้งเตือนในระบบถึงหัวหน้ากอง (cron ตอนเช้า — ไม่ใช้ LINE เพราะโควตา)
import { describe, it, expect } from "vitest";
import { buildStaleDigest, digestRecipients } from "../digest";

const item = (over) => ({ _id: over.code, code: over.code, isStale: true, isUrgent: false, daysUnclaimed: 5, department: null, ...over });

describe("buildStaleDigest — หนึ่งรายการต่อกอง (เฉพาะกองที่มีเรื่องค้างเกินเกณฑ์)", () => {
  const items = [
    item({ code: "A", department: "กองช่าง", daysUnclaimed: 7 }),
    item({ code: "B", department: "กองช่าง", daysUnclaimed: 5, isUrgent: true }),
    item({ code: "C", department: null, daysUnclaimed: 19, isUrgent: true }),
    item({ code: "D", department: "กองคลัง", isStale: false, daysUnclaimed: 1 }),
  ];
  const digest = buildStaleDigest(items, { unclaimedAlertDays: 4, dateKey: "2026-09-02" });

  it("จัดกลุ่มตามกอง เรียงจำนวนมากก่อน, 'ยังไม่ระบุกอง' รวมเป็นรายการของตัวเอง, กองที่ไม่ค้างไม่ปรากฏ", () => {
    expect(digest.map((d) => [d.department, d.count, d.maxDays, d.urgentCount])).toEqual([
      ["กองช่าง", 2, 7, 1],
      [null, 1, 19, 1],
    ]);
  });
  it("มี title/message ภาษาไทย + relatedId กันส่งซ้ำวันเดียวกัน + ลิงก์ไปกองงานรอรับแบบกรองค้าง", () => {
    expect(digest[0].title).toBe("เรื่องค้างไม่มีคนรับ 2 เรื่อง — กองช่าง");
    expect(digest[0].message).toContain("ค้างเกิน 4 วัน");
    expect(digest[0].message).toContain("ค้างนานสุด 7 วัน");
    expect(digest[0].message).toContain("เลย SLA 1 เรื่อง");
    expect(digest[0].relatedId).toBe("stale-digest:2026-09-02:กองช่าง");
    expect(digest[0].actionUrl).toBe("/admin/task-pool?stale=1");
    expect(digest[1].title).toBe("เรื่องค้างไม่มีคนรับ 1 เรื่อง — ยังไม่ระบุกอง");
    expect(digest[1].relatedId).toBe("stale-digest:2026-09-02:__unassigned__");
  });
  it("ไม่มีเรื่องค้าง → []", () => {
    expect(buildStaleDigest([item({ code: "X", isStale: false })], { unclaimedAlertDays: 4, dateKey: "2026-09-02" })).toEqual([]);
  });
});

describe("digestRecipients — clerkId ของคนที่ควรได้รับแจ้ง", () => {
  const users = [
    { _id: "1", clerkId: "head-chang", department: "กองช่าง", position: "ผู้อำนวยการกองช่าง", role: "admin" },
    { _id: "2", clerkId: "head-health", department: "กองสาธารณสุขฯ", isDepartmentHead: true, role: "admin" },
    { _id: "3", clerkId: "super", department: "สำนักปลัดฯ", role: "superadmin" },
    { _id: "4", clerkId: "officer", department: "กองช่าง", role: "admin" },
    { _id: "5", clerkId: "", department: "กองช่าง", isDepartmentHead: true, role: "admin" },
  ];
  it("กองที่มีหัวหน้า → หัวหน้ากองนั้น (ข้ามคนไม่มี clerkId)", () => {
    expect(digestRecipients(users, "กองช่าง")).toEqual(["head-chang"]);
  });
  it("กองที่ไม่มีหัวหน้า หรือยังไม่ระบุกอง → หัวหน้าทุกกอง + superadmin (ไม่ซ้ำ)", () => {
    expect(digestRecipients(users, "กองคลัง")).toEqual(["head-chang", "head-health", "super"]);
    expect(digestRecipients(users, null)).toEqual(["head-chang", "head-health", "super"]);
  });
  it("ไม่มีใครเลย → []", () => {
    expect(digestRecipients([{ _id: "9", clerkId: "x", department: "กองช่าง", role: "admin" }], "กองช่าง")).toEqual([]);
  });
});
