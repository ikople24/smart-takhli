import { describe, it, expect } from "vitest";
import { workTypeChange, workTypeOptionsFor, workTypeSourceOf } from "../workTypeChange.js";
import { DEFAULT_TASK_SETTINGS, normalizeTaskSettings } from "../settings.js";
import { DAY_MS } from "../format.js";

const createdAt = new Date("2026-11-01T03:00:00.000Z");
const c = (o) => ({ category: "ไฟฟ้าส่องสว่าง", problems: [], detail: "", createdAt, ...o });

describe("workTypeChange", () => {
  it("เปลี่ยนเป็นกิ่งไม้ → 15 วันนับจากวันแจ้ง + แนะนำกองป้องกันฯ", () => {
    const r = workTypeChange({ complaint: c(), currentDepartment: "กองช่าง", newKey: "tree" });
    expect(r.ok).toBe(true);
    expect(r.workType).toBe("tree");
    expect(r.label).toBe("กิ่งไม้/ต้นไม้");
    expect(r.slaDays).toBe(15);
    expect(r.newDueDate.getTime()).toBe(createdAt.getTime() + 15 * DAY_MS);
    expect(r.suggestedDepartment).toBe("งานป้องกันและบรรเทาสาธารณภัย");
  });

  it("กองตรงกับชนิดงานแล้ว / ชนิดที่ไม่มีกองประจำ → ไม่แนะนำ", () => {
    expect(workTypeChange({ complaint: c(), currentDepartment: "กองช่าง", newKey: "road_patch" }).suggestedDepartment).toBeNull();
    expect(workTypeChange({ complaint: c(), currentDepartment: "กองช่าง", newKey: "grass" }).suggestedDepartment).toBeNull();
  });

  it("key ผิด / ชนิดเดิม", () => {
    expect(workTypeChange({ complaint: c(), newKey: "nope" })).toEqual({ ok: false, reason: "ชนิดงานไม่ถูกต้อง" });
    expect(workTypeChange({ complaint: c(), newKey: "general" })).toEqual({ ok: false, reason: "ชนิดงานเดิม" });
    expect(workTypeChange({ complaint: c({ workType: "tree" }), newKey: "tree" }).reason).toBe("ชนิดงานเดิม");
    // ระบบเดาเป็นกิ่งไม้จากประเภทย่อย — เลือกกิ่งไม้ซ้ำก็ถือว่าเดิม
    expect(workTypeChange({ complaint: c({ problems: ["กิ่งไม้ล้ำถนน"] }), newKey: "tree" }).ok).toBe(false);
  });

  it("เคยตั้งไว้แล้วเปลี่ยนกลับเป็นงานทั่วไป → SLA หมวด (ค่าตั้ง slaByCategory)", () => {
    const settings = normalizeTaskSettings({ slaByCategory: [{ category: "ไฟฟ้าส่องสว่าง", slaDays: 5 }] });
    const r = workTypeChange({ complaint: c({ workType: "tree" }), newKey: "general", settings });
    expect(r.ok).toBe(true);
    expect(r.slaDays).toBe(5);
    expect(r.newDueDate.getTime()).toBe(createdAt.getTime() + 5 * DAY_MS);
  });

  it("ค่าตั้ง slaByWorkType ทับทะเบียน + ไม่มีวันแจ้ง → นับจากวันรับงาน", () => {
    const settings = normalizeTaskSettings({ slaByWorkType: [{ workType: "tree", slaDays: 10 }] });
    const assignedAt = new Date("2026-11-05T00:00:00.000Z");
    const r = workTypeChange({ complaint: c({ createdAt: undefined }), newKey: "tree", settings, assignedAt });
    expect(r.slaDays).toBe(10);
    expect(r.newDueDate.getTime()).toBe(assignedAt.getTime() + 10 * DAY_MS);
  });
});

describe("workTypeOptionsFor / workTypeSourceOf", () => {
  it("SLA ต่อตัวเลือกรวมค่าตั้ง", () => {
    const settings = normalizeTaskSettings({ slaByWorkType: [{ workType: "grass", slaDays: 7 }] });
    const opts = workTypeOptionsFor(c(), settings);
    expect(opts).toHaveLength(8);
    expect(opts.find((o) => o.key === "grass").slaDays).toBe(7);
    expect(opts.find((o) => o.key === "general").slaDays).toBe(DEFAULT_TASK_SETTINGS.defaultSlaDays);
    expect(opts.find((o) => o.key === "road_patch")).toEqual({ key: "road_patch", label: "ปะถนน (ยางมะตอย)", slaDays: 30 });
  });
  it("source", () => {
    expect(workTypeSourceOf(c())).toBe("auto");
    expect(workTypeSourceOf(c({ workType: "" }))).toBe("auto");
    expect(workTypeSourceOf(c({ workType: "bogus" }))).toBe("auto");
    expect(workTypeSourceOf(c({ workType: "tree" }))).toBe("manual");
  });
});
