// เทสต์การจัดกลุ่ม "กลุ่มงานของฉัน" (ตามประเภทเรื่อง / ตามกอง / ตามความเร่งด่วน) + ตัวกรองป้ายเตือน
import { describe, it, expect } from "vitest";
import { GROUP_BY, SEVERITY_LABELS, groupTasks, filterByAlert } from "../groupBy";

const item = (over) => ({ id: over.id, category: "", department: "", severity: "normal", daysToDue: null, alertKinds: [], ...over });

const items = [
  item({ id: "a", category: "ไฟฟ้าส่องสว่าง", department: "กองช่าง", severity: "overdue", daysToDue: -4, alertKinds: ["overdue", "coordinating"] }),
  item({ id: "b", category: "ไฟฟ้าส่องสว่าง", department: "กองช่าง", severity: "coordinating", daysToDue: 3, alertKinds: ["coordinating"] }),
  item({ id: "c", category: "น้ำประปา", department: "กองช่าง", severity: "due_soon", daysToDue: 1, alertKinds: ["due_soon"] }),
  item({ id: "d", category: "น้ำประปา", department: "กองช่าง", severity: "due_soon", daysToDue: 2, alertKinds: ["due_soon"] }),
  item({ id: "e", category: "", department: "", severity: "normal", daysToDue: 6 }),
  item({ id: "f", category: "ขยะมูลฝอย", department: "กองสาธารณสุขฯ", severity: "blocked", daysToDue: null, alertKinds: ["blocked"] }),
  item({ id: "g", category: "ไฟฟ้าส่องสว่าง", department: "กองช่าง", severity: "done", daysToDue: -10 }),
];

describe("groupTasks — ตามประเภทเรื่อง (default)", () => {
  const groups = groupTasks(items, "category");

  it("กลุ่มเรียงตามความเร่งด่วนสูงสุดในกลุ่ม แล้วจำนวน; ไม่มีประเภท → 'อื่น ๆ'", () => {
    expect(groups.map((g) => g.key)).toEqual(["ไฟฟ้าส่องสว่าง", "น้ำประปา", "ขยะมูลฝอย", "อื่น ๆ"]);
  });

  it("แต่ละกลุ่มมี label/sub/count/counts และ items เรียงเร่งด่วนก่อน → ใกล้ครบก่อน → เสร็จท้ายสุด", () => {
    const g = groups[0];
    expect(g.label).toBe("ไฟฟ้าส่องสว่าง");
    expect(g.sub).toBe("กองช่าง");
    expect(g.count).toBe(3);
    expect(g.counts).toEqual({ overdue: 1, due_soon: 0, coordinating: 1, blocked: 0, normal: 0, done: 1 });
    expect(g.items.map((i) => i.id)).toEqual(["a", "b", "g"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["c", "d"]);
  });

  it("GROUP_BY ทั้งสามค่า และค่าแปลกปลอม → ใช้ category", () => {
    expect(GROUP_BY).toEqual(["category", "organization", "priority"]);
    expect(groupTasks(items, "nope").map((g) => g.key)).toEqual(groups.map((g) => g.key));
    expect(groupTasks(items).map((g) => g.key)).toEqual(groups.map((g) => g.key));
  });
});

describe("groupTasks — ตามกอง", () => {
  it("คีย์เป็นชื่อกอง, ไม่มีกอง → 'ยังไม่ระบุกอง', sub เป็นประเภทในกอง (ไม่เกิน 3)", () => {
    const groups = groupTasks(items, "organization");
    expect(groups.map((g) => g.key)).toEqual(["กองช่าง", "กองสาธารณสุขฯ", "ยังไม่ระบุกอง"]);
    expect(groups[0].sub).toBe("ไฟฟ้าส่องสว่าง · น้ำประปา");
    expect(groups[0].count).toBe(5);
  });
  it("ประเภทเกิน 3 → แสดง 3 แล้วต่อท้าย +N", () => {
    const many = ["ก", "ข", "ค", "ง", "จ"].map((c, i) => item({ id: String(i), category: c, department: "กองช่าง" }));
    expect(groupTasks(many, "organization")[0].sub).toBe("ก · ข · ค · +2");
  });
});

describe("groupTasks — ตามความเร่งด่วน", () => {
  it("กลุ่มตามลำดับ severity คงที่ (เฉพาะที่มีงาน) พร้อมป้ายไทย", () => {
    const groups = groupTasks(items, "priority");
    expect(groups.map((g) => g.key)).toEqual(["overdue", "due_soon", "coordinating", "blocked", "normal", "done"]);
    expect(groups.map((g) => g.label)).toEqual([
      "เกินกำหนด",
      "ใกล้ครบกำหนด",
      "รอประสานหน่วยงาน",
      "รอวัสดุ / งบประมาณ",
      "ปกติ",
      "เสร็จแล้ว",
    ]);
    expect(SEVERITY_LABELS.overdue).toBe("เกินกำหนด");
    expect(groups[1].items.map((i) => i.id)).toEqual(["c", "d"]);
  });
  it("ไม่มีงานเลย → []", () => {
    expect(groupTasks([], "priority")).toEqual([]);
  });
});

describe("filterByAlert — การ์ดเตือนคลิกแล้วกรอง", () => {
  it("null/ไม่ระบุ → ทั้งหมด; ระบุ → เฉพาะที่มีป้ายนั้น (เรื่องเดียวมีหลายป้ายได้)", () => {
    expect(filterByAlert(items, null)).toHaveLength(7);
    expect(filterByAlert(items, "coordinating").map((i) => i.id)).toEqual(["a", "b"]);
    expect(filterByAlert(items, "overdue").map((i) => i.id)).toEqual(["a"]);
    expect(filterByAlert(items, "blocked").map((i) => i.id)).toEqual(["f"]);
    expect(filterByAlert(items, "nope")).toEqual([]);
  });
});
