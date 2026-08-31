// เทสต์ค่าคงที่สถานะเรื่อง + ขั้นของ stepper (รับเรื่อง → ลงพื้นที่ → ประสานงาน → รอตรวจรับ → ปิดเรื่อง)
import { describe, it, expect } from "vitest";
import {
  COMPLAINT_STATUS,
  OPEN_STATUSES,
  STAGES,
  STAGE_LABELS,
  isClosedStatus,
  stageIndex,
  normalizeStage,
  stageTransition,
  statusForStage,
} from "../status";

describe("COMPLAINT_STATUS — ข้อความสถานะต้องตรงกับที่ระบบเดิมใช้", () => {
  it("คงค่าเดิม 2 ตัว + เพิ่ม 'รอประสานหน่วยงานภายนอก' ตาม README", () => {
    expect(COMPLAINT_STATUS.IN_PROGRESS).toBe("อยู่ระหว่างดำเนินการ");
    expect(COMPLAINT_STATUS.DONE).toBe("ดำเนินการเสร็จสิ้น");
    expect(COMPLAINT_STATUS.COORDINATING).toBe("รอประสานหน่วยงานภายนอก");
    expect(OPEN_STATUSES).toEqual(["อยู่ระหว่างดำเนินการ", "รอประสานหน่วยงานภายนอก"]);
  });

  it("isClosedStatus เฉพาะ 'ดำเนินการเสร็จสิ้น' (สถานะเก่าแปลก ๆ ถือว่ายังเปิด)", () => {
    expect(isClosedStatus("ดำเนินการเสร็จสิ้น")).toBe(true);
    expect(isClosedStatus("อยู่ระหว่างดำเนินการ")).toBe(false);
    expect(isClosedStatus("รอการตรวจสอบ")).toBe(false);
    expect(isClosedStatus(undefined)).toBe(false);
  });
});

describe("STAGES — 5 ขั้นเรียงตามดีไซน์", () => {
  it("ลำดับและป้ายภาษาไทย", () => {
    expect(STAGES).toEqual(["received", "site_visit", "coordinating", "awaiting_review", "closed"]);
    expect(STAGES.map((s) => STAGE_LABELS[s])).toEqual([
      "รับเรื่อง",
      "ลงพื้นที่",
      "ประสานงาน",
      "รอตรวจรับ",
      "ปิดเรื่อง",
    ]);
  });

  it("stageIndex คืนตำแหน่ง / -1 เมื่อไม่รู้จัก", () => {
    expect(stageIndex("received")).toBe(0);
    expect(stageIndex("closed")).toBe(4);
    expect(stageIndex("nope")).toBe(-1);
    expect(stageIndex(undefined)).toBe(-1);
  });
});

describe("normalizeStage — เอกสารเก่าไม่มี stage", () => {
  it("ไม่มี stage → 'received'; แต่ถ้าเสร็จแล้ว (completedAt) → 'closed'", () => {
    expect(normalizeStage(undefined)).toBe("received");
    expect(normalizeStage("garbage")).toBe("received");
    expect(normalizeStage(undefined, { completed: true })).toBe("closed");
    expect(normalizeStage("site_visit", { completed: true })).toBe("closed");
  });
  it("stage ที่ถูกต้องคงเดิม", () => {
    expect(normalizeStage("coordinating")).toBe("coordinating");
  });
});

describe("stageTransition — เดินหน้าได้ทีละขั้น ถอยหลังต้องมีเหตุผล", () => {
  it("ขั้นถัดไป 1 ขั้น → ok ไม่ต้องใส่เหตุผล", () => {
    expect(stageTransition("received", "site_visit")).toEqual({
      ok: true,
      direction: "forward",
      needsReason: false,
    });
  });
  it("ข้ามขั้น → ไม่ ok พร้อมข้อความ", () => {
    const t = stageTransition("received", "coordinating");
    expect(t.ok).toBe(false);
    expect(t.direction).toBe("forward");
    expect(t.reason).toMatch(/ข้ามขั้น/);
  });
  it("ถอยหลัง (กี่ขั้นก็ได้) → ok แต่ needsReason", () => {
    expect(stageTransition("awaiting_review", "site_visit")).toEqual({
      ok: true,
      direction: "backward",
      needsReason: true,
    });
  });
  it("ขั้นเดิม / ขั้นที่ไม่รู้จัก → ไม่ ok", () => {
    expect(stageTransition("received", "received").ok).toBe(false);
    expect(stageTransition("received", "nope").ok).toBe(false);
    expect(stageTransition("nope", "received").ok).toBe(false);
  });
});

describe("statusForStage — stage ของ assignment → status ของเรื่อง", () => {
  it("closed → เสร็จสิ้น, coordinating → รอประสานฯ, ที่เหลือ → อยู่ระหว่างดำเนินการ", () => {
    expect(statusForStage("closed")).toBe("ดำเนินการเสร็จสิ้น");
    expect(statusForStage("coordinating")).toBe("รอประสานหน่วยงานภายนอก");
    expect(statusForStage("received")).toBe("อยู่ระหว่างดำเนินการ");
    expect(statusForStage("awaiting_review")).toBe("อยู่ระหว่างดำเนินการ");
  });
});
