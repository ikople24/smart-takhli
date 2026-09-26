import { describe, it, expect } from "vitest";
import {
  citizenStepIndex,
  defaultUrgencyForType,
  isClosedStatus,
  OPEN_STATUSES,
  statusTransition,
  urgencyRank,
} from "../status";

describe("defaultUrgencyForType", () => {
  it("อพยพผู้ป่วย = ด่วนมาก, อื่น ๆ = ด่วน", () => {
    expect(defaultUrgencyForType("evac")).toBe("critical");
    expect(defaultUrgencyForType("drain")).toBe("urgent");
    expect(defaultUrgencyForType("sand")).toBe("urgent");
    expect(defaultUrgencyForType("other")).toBe("urgent");
    expect(defaultUrgencyForType(undefined)).toBe("urgent");
  });
});

describe("urgencyRank", () => {
  it("critical < urgent < normal < ค่าไม่รู้จัก", () => {
    expect(urgencyRank("critical")).toBeLessThan(urgencyRank("urgent"));
    expect(urgencyRank("urgent")).toBeLessThan(urgencyRank("normal"));
    expect(urgencyRank("normal")).toBeLessThan(urgencyRank("??"));
  });
});

describe("open/closed", () => {
  it("done และ cancelled คือปิดแล้ว ที่เหลือยังเปิด", () => {
    expect(isClosedStatus("done")).toBe(true);
    expect(isClosedStatus("cancelled")).toBe(true);
    expect(OPEN_STATUSES).toEqual(["received", "assigning", "dispatched", "on_site"]);
  });
});

describe("statusTransition", () => {
  it("เดินหน้าได้ทีละขั้น", () => {
    expect(statusTransition("received", "assigning").ok).toBe(true);
    expect(statusTransition("on_site", "done").ok).toBe(true);
  });

  it("ห้ามข้ามขั้น", () => {
    const r = statusTransition("received", "on_site");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/ข้ามขั้น/);
  });

  it("ถอยหลังได้เฉพาะหัวหน้ากอง/superadmin", () => {
    expect(statusTransition("on_site", "dispatched").ok).toBe(false);
    expect(statusTransition("on_site", "dispatched", { canRewind: true }).ok).toBe(true);
    expect(statusTransition("done", "on_site", { canRewind: true }).direction).toBe("backward");
  });

  it("ยกเลิกได้จากสถานะที่ยังเปิด แต่ไม่ใช่จากที่ปิดแล้ว", () => {
    expect(statusTransition("dispatched", "cancelled").ok).toBe(true);
    expect(statusTransition("done", "cancelled").ok).toBe(false);
  });

  it("เปิดคำขอที่ยกเลิกกลับมาต้องมีสิทธิ์ย้อน", () => {
    expect(statusTransition("cancelled", "received").ok).toBe(false);
    expect(statusTransition("cancelled", "received", { canRewind: true }).ok).toBe(true);
  });

  it("สถานะไม่รู้จัก / เดิม = ไม่ผ่าน", () => {
    expect(statusTransition("received", "xxx").direction).toBe("invalid");
    expect(statusTransition("received", "received").direction).toBe("same");
  });
});

describe("citizenStepIndex", () => {
  it("assigning กับ dispatched รวมเป็นขั้นกำลังจัดทีม", () => {
    expect(citizenStepIndex("received")).toBe(0);
    expect(citizenStepIndex("assigning")).toBe(1);
    expect(citizenStepIndex("dispatched")).toBe(1);
    expect(citizenStepIndex("on_site")).toBe(2);
    expect(citizenStepIndex("done")).toBe(3);
    expect(citizenStepIndex("cancelled")).toBe(-1);
  });
});
