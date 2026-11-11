// เทสต์สรุปเรื่องค้างไม่มีคนรับรายกอง → แจ้งเตือนในระบบถึงหัวหน้ากอง (cron ตอนเช้า — ไม่ใช้ LINE เพราะโควตา)
import { describe, it, expect } from "vitest";
import { buildStaleDigest, digestRecipients, transferRequestRecipients, buildStaleLineText } from "../digest";

const item = (over) => ({ _id: over.code, code: over.code, isStale: true, isUrgent: false, daysUnclaimed: 5, department: null, ...over });

describe("buildStaleDigest — หนึ่งรายการต่อกอง (เฉพาะกองที่มีเรื่องค้างเกินเกณฑ์)", () => {
  const items = [
    item({ code: "A", department: "กองช่าง", daysUnclaimed: 7 }),
    item({ code: "B", department: "กองช่าง", daysUnclaimed: 5, isUrgent: true }),
    item({ code: "C", department: null, daysUnclaimed: 19, isUrgent: true }),
    item({ code: "D", department: "กองคลัง", isStale: false, daysUnclaimed: 1 }),
  ];
  const digest = buildStaleDigest(items, { unclaimedAlertHours: 24, dateKey: "2026-09-02" });

  it("จัดกลุ่มตามกอง เรียงจำนวนมากก่อน, 'ยังไม่ระบุกอง' รวมเป็นรายการของตัวเอง, กองที่ไม่ค้างไม่ปรากฏ", () => {
    expect(digest.map((d) => [d.department, d.count, d.maxDays, d.urgentCount])).toEqual([
      ["กองช่าง", 2, 7, 1],
      [null, 1, 19, 1],
    ]);
  });
  it("มี title/message ภาษาไทย + relatedId กันส่งซ้ำวันเดียวกัน + ลิงก์ไปกองงานรอรับแบบกรองค้าง", () => {
    expect(digest[0].title).toBe("เรื่องค้างไม่มีคนรับ 2 เรื่อง — กองช่าง");
    expect(digest[0].message).toContain("รอเกิน 24 ชม.");
    expect(digest[0].message).toContain("ค้างนานสุด 7 วัน");
    expect(digest[0].message).toContain("เลย SLA 1 เรื่อง");
    expect(digest[0].relatedId).toBe("stale-digest:2026-09-02:กองช่าง");
    expect(digest[0].actionUrl).toBe("/admin/task-pool?stale=1");
    expect(digest[1].title).toBe("เรื่องค้างไม่มีคนรับ 1 เรื่อง — ยังไม่ระบุกอง");
    expect(digest[1].relatedId).toBe("stale-digest:2026-09-02:__unassigned__");
  });
  it("ไม่มีเรื่องค้าง → []", () => {
    expect(buildStaleDigest([item({ code: "X", isStale: false })], { unclaimedAlertHours: 24, dateKey: "2026-09-02" })).toEqual([]);
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

describe("transferRequestRecipients — คำขอโอนงาน (รับผิด) ส่งถึงแอดมินกลาง = superadmin + หัวหน้ากอง", () => {
  const users = [
    { _id: "1", clerkId: "head-chang", department: "กองช่าง", position: "ผู้อำนวยการกองช่าง", role: "admin" },
    { _id: "2", clerkId: "head-health", department: "กองสาธารณสุขฯ", isDepartmentHead: true, role: "admin" },
    { _id: "3", clerkId: "super", department: "สำนักปลัดฯ", role: "superadmin" },
    { _id: "4", clerkId: "officer", department: "กองช่าง", role: "admin" },
    { _id: "6", clerkId: "super-off", role: "superadmin", isActive: false },
  ];
  it("กองที่มีหัวหน้า → หัวหน้ากองนั้น + superadmin ทุกคน (ข้ามคนถูกระงับ)", () => {
    expect(transferRequestRecipients(users, "กองช่าง")).toEqual(["head-chang", "super"]);
  });
  it("กองที่ไม่มีหัวหน้า / ไม่ระบุกอง → หัวหน้าทุกกอง + superadmin", () => {
    expect(transferRequestRecipients(users, "กองคลัง")).toEqual(["head-chang", "head-health", "super"]);
    expect(transferRequestRecipients(users, null)).toEqual(["head-chang", "head-health", "super"]);
  });
});

describe("buildStaleLineText — ข้อความ LINE กลุ่มเรื่องค้าง (ปุ่มแจ้งเตือน + cron ตอนเช้า)", () => {
  it("ไม่มีเรื่องค้างเกินเกณฑ์ → null (ไม่ส่ง)", () => {
    expect(buildStaleLineText([item({ code: "A", isStale: false })])).toBeNull();
  });
  const list = Array.from({ length: 8 }, (_, n) =>
    item({
      code: `TKC-${n}`,
      daysUnclaimed: n + 5,
      category: "ถนน/ทางเท้า",
      problems: n === 7 ? ["ขอความอนุเคราะห์"] : ["กิ่งไม้ล้ำถนน"],
      title: n === 7 ? "ประปามาทำท่อแล้วไม่ปิดหลุม" : "x",
      community: "สามล",
      department: "กองช่าง",
      isUrgent: n >= 6,
    })
  );
  it("หัวข้ออ่านง่าย ไม่มีคำ SLA ไม่โชว์กองที่ระบบเดา เรียงรอนานก่อน ตัดที่ 6 เรื่อง", () => {
    const text = buildStaleLineText(list, { unclaimedAlertHours: 24, footer: "(สรุปอัตโนมัติทุกเช้า)", siteUrl: "https://example.app/" });
    expect(text).not.toMatch(/SLA|กองช่าง/);
    const lines = text.split("\n");
    expect(lines[0]).toBe("📋 เรื่องร้องเรียนที่ยังไม่มีเจ้าหน้าที่รับ");
    expect(lines[1]).toBe("รวม 8 เรื่อง (รอเกิน 24 ชม.)");
    expect(lines[2]).toBe("⚠️ เลยกำหนดแก้ไขแล้ว 2 เรื่อง");
    expect(text).toContain("1) TKC-7 — รอ 12 วัน\n    ประปามาทำท่อแล้วไม่ปิดหลุม · ชุมชนสามล"); // ประเภทกว้าง → ใช้รายละเอียดย่อ
    expect(text).toContain("2) TKC-6 — รอ 11 วัน\n    กิ่งไม้ล้ำถนน · ชุมชนสามล");
    expect(text).not.toContain("TKC-1 ");
    expect(text).toContain("…และอีก 2 เรื่อง");
    expect(text).toContain("https://example.app/admin/task-pool");
    expect(lines.at(-1)).toBe("(สรุปอัตโนมัติทุกเช้า)");
  });
  it("ไม่มี siteUrl แบบ https → บอกชื่อเมนูแทนลิงก์ · ค้างทุกเรื่องเลยกำหนด → ข้อความรวม", () => {
    const text = buildStaleLineText([item({ code: "A", isUrgent: true })], { siteUrl: "http://localhost:3000" });
    expect(text).toContain("⚠️ ทุกเรื่องเลยกำหนดแก้ไขแล้ว");
    expect(text).toContain('ที่เมนู "กองงานรอรับ"');
    expect(text).not.toContain("http");
  });
  it("ค่าเริ่มต้นเกณฑ์ = 24 ชม. · ยังไม่ข้ามวัน → 'รอ N ชม.' · ข้ามวันแล้ว → 'รอ N วัน'", () => {
    const text = buildStaleLineText([
      item({ code: "H", daysUnclaimed: 0, hoursUnclaimed: 20 }),
      item({ code: "D", daysUnclaimed: 2, hoursUnclaimed: 40 }),
    ]);
    expect(text.split("\n")[1]).toBe("รวม 2 เรื่อง (รอเกิน 24 ชม.)");
    expect(text).toContain("1) D — รอ 2 วัน");
    expect(text).toContain("2) H — รอ 20 ชม.");
  });
});
