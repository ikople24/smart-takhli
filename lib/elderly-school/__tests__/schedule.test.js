import { describe, it, expect } from "vitest";
import { normalizeSessions, normalizeDefaults, effectiveSessions, formatTimeRange, cleanPhone, scheduleContact, outOfOrderVisits, resolveCheckinYear } from "../schedule";

describe("normalizeSessions", () => {
  it("กรองครั้ง/วันที่ผิด, ครั้งซ้ำใช้ตัวหลัง, วันซ้ำใช้ตัวแรก", () => {
    const out = normalizeSessions([
      { visitNo: 2, dateISO: "2026-10-02" },
      { visitNo: 1, dateISO: "2026-10-01", note: "  เปิดภาค ", startTime: "9:00", prepare: "บัตร" },
      { visitNo: 2, dateISO: "2026-10-03", startTime: "13:30" },
      { visitNo: 3, dateISO: "2026-10-03" },
      { visitNo: 17, dateISO: "2026-10-04" },
      { visitNo: 4, dateISO: "bad" },
    ]);
    expect(out.map((s) => [s.visitNo, s.dateISO])).toEqual([
      [1, "2026-10-01"],
      [2, "2026-10-03"],
    ]);
    expect(out[0]).toMatchObject({ note: "เปิดภาค", startTime: null, prepare: "บัตร" });
    expect(out[1].startTime).toBe("13:30");
  });
});

describe("effectiveSessions", () => {
  it("ใช้ค่าเริ่มต้นเมื่อรายครั้งว่าง", () => {
    const out = effectiveSessions({
      defaults: { startTime: "09:00", endTime: "12:00", location: " ศาลาประชาคม " },
      sessions: [
        { visitNo: 1, dateISO: "2026-10-01" },
        { visitNo: 2, dateISO: "2026-10-08", startTime: "13:00", location: "รพ.สต." },
      ],
    });
    expect(out[0]).toMatchObject({ startTime: "09:00", endTime: "12:00", location: "ศาลาประชาคม" });
    expect(out[1]).toMatchObject({ startTime: "13:00", endTime: "12:00", location: "รพ.สต." });
  });
  it("ไม่มีค่าเริ่มต้น", () => {
    expect(normalizeDefaults(undefined)).toEqual({ startTime: null, endTime: null, location: null, contactName: null, contactPhone: null });
    expect(effectiveSessions(null)).toEqual([]);
  });
});

describe("formatTimeRange", () => {
  it("แสดงช่วงเวลา", () => {
    expect(formatTimeRange("09:00", "12:00")).toBe("09:00–12:00 น.");
    expect(formatTimeRange("09:00", null)).toBe("09:00 น.");
    expect(formatTimeRange(null, null)).toBe("");
  });
});

describe("ผู้ติดต่อ", () => {
  it("cleanPhone รับเบอร์ไทย 9–10 หลัก", () => {
    expect(cleanPhone("056-261-000")).toBe("056-261-000");
    expect(cleanPhone(" 081 234 5678 ")).toBe("081 234 5678");
    expect(cleanPhone("โทร 0812345678")).toBe("0812345678");
    expect(cleanPhone("123")).toBeNull();
  });
  it("scheduleContact คืน tel สำหรับลิงก์โทร", () => {
    expect(scheduleContact({ defaults: { contactName: " คุณเอ ", contactPhone: "081-234-5678" } })).toEqual({ name: "คุณเอ", phone: "081-234-5678", tel: "0812345678" });
    expect(scheduleContact({ defaults: { contactName: "คุณเอ" } })).toBeNull();
  });
});

describe("outOfOrderVisits", () => {
  it("พบครั้งที่วันที่ย้อนกว่าครั้งก่อน", () => {
    const r = outOfOrderVisits([
      { visitNo: 11, dateISO: "2026-05-06" },
      { visitNo: 12, dateISO: "2026-06-10" },
      { visitNo: 13, dateISO: "2026-05-20" },
      { visitNo: 14, dateISO: "2026-06-17" },
    ]);
    expect(r).toEqual([{ visitNo: 13, prevVisitNo: 12 }]);
  });
  it("เรียงถูก/ว่าง/วันที่ไม่ครบ → ไม่เตือน", () => {
    expect(outOfOrderVisits([{ visitNo: 1, dateISO: "2026-01-01" }, { visitNo: 2, dateISO: "" }, { visitNo: 3, dateISO: "2026-01-15" }])).toEqual([]);
    expect(outOfOrderVisits(null)).toEqual([]);
  });
});

describe("resolveCheckinYear", () => {
  const s2570 = { yearBE: 2570, sessions: [{ dateISO: "2026-11-25" }, { dateISO: "2026-11-18" }] };
  it("ปีใหม่ยังไม่เริ่ม → ใช้ปีบนบัตร", () => {
    expect(resolveCheckinYear(2569, [s2570], "2026-11-17")).toBe(2569);
  });
  it("ปีใหม่เริ่มแล้ว (วันเรียนครั้งแรก) → ใช้ปีใหม่", () => {
    expect(resolveCheckinYear(2569, [s2570], "2026-11-18")).toBe(2570);
  });
  it("ไม่ย้อนไปปีเก่า และไม่สนปีที่ไม่มีวันเรียน", () => {
    expect(resolveCheckinYear(2570, [{ yearBE: 2569, sessions: [{ dateISO: "2025-11-19" }] }], "2026-12-01")).toBe(2570);
    expect(resolveCheckinYear(2569, [{ yearBE: 2571, sessions: [] }], "2028-01-01")).toBe(2569);
  });
});
