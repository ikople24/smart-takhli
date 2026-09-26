import { describe, it, expect } from "vitest";
import { planStatusChange } from "../statusChange";

const now = new Date("2026-09-26T05:00:00Z");

describe("planStatusChange", () => {
  it("เดินหน้า = ประทับเวลาของสถานะใหม่", () => {
    const p = planStatusChange("assigning", "dispatched", { canRewind: false, now });
    expect(p).toEqual({ ok: true, set: { status: "dispatched", dispatchedAt: now }, unset: [], event: "ทีมออกเดินทาง" });
    const q = planStatusChange("received", "assigning", { canRewind: false, now });
    expect(q.ok && q.set).toEqual({ status: "assigning" });
  });

  it("ข้ามขั้น/ไม่มีสิทธิ์ย้อน = ไม่ผ่าน", () => {
    expect(planStatusChange("received", "on_site", { canRewind: true, now }).ok).toBe(false);
    expect(planStatusChange("done", "on_site", { canRewind: false, now }).ok).toBe(false);
  });

  it("ย้อนต้องมีเหตุผล และล้างเวลาของขั้นที่ถอยผ่าน", () => {
    expect(planStatusChange("done", "dispatched", { canRewind: true, now }).ok).toBe(false);
    const p = planStatusChange("done", "dispatched", { canRewind: true, now, reason: "กดผิด" });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.set).toEqual({ status: "dispatched", dispatchedAt: now });
    expect(p.unset.sort()).toEqual(["doneAt", "onSiteAt"]);
    expect(p.event).toContain("กดผิด");
  });

  it("ยกเลิก = ประทับ cancelledAt · เปิดกลับ = ล้าง cancelledAt", () => {
    const c = planStatusChange("received", "cancelled", { canRewind: false, now, reason: "ติดต่อไม่ได้" });
    expect(c.ok && c.set).toEqual({ status: "cancelled", cancelledAt: now });
    expect(c.ok && c.event).toContain("ติดต่อไม่ได้");
    const r = planStatusChange("cancelled", "received", { canRewind: true, now, reason: "ผู้แจ้งโทรกลับมา" });
    expect(r.ok && r.unset).toContain("cancelledAt");
  });
});
