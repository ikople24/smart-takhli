import { describe, it, expect } from "vitest";
import { computePublicStats } from "../publicStats";

const now = new Date("2026-09-26T05:00:00Z");

describe("computePublicStats — หน้าสถานการณ์สาธารณะ", () => {
  it("นับรอ/กำลังช่วย/เสร็จ และแยกประเภทเฉพาะที่ยังเปิด · ไม่นับยกเลิก", () => {
    const s = computePublicStats(
      [
        { status: "received", type: "evac" },
        { status: "assigning", type: "sand" },
        { status: "dispatched", type: "evac" },
        { status: "on_site", type: "other" },
        { status: "done", type: "drain", doneAt: "2026-09-26T02:00:00Z" },
        { status: "done", type: "drain", doneAt: "2026-09-25T10:00:00Z" },
        { status: "cancelled", type: "evac" },
      ],
      now
    );
    expect(s).toEqual({
      waiting: 2,
      helping: 2,
      doneToday: 1,
      doneTotal: 2,
      openByType: { evac: 2, drain: 0, sand: 1, other: 1 },
    });
  });

  it("ผลลัพธ์มีแต่ตัวเลข — ไม่มีช่องที่ระบุตัวคน", () => {
    const s = computePublicStats([{ status: "received", type: "evac" }], now);
    expect(JSON.stringify(s)).not.toMatch(/phone|landmark|lat|lng|ticket|name/);
  });
});
