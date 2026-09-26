import { describe, it, expect } from "vitest";
import { nextZoneName, pickZone, situationLevel, zoneLabel } from "../zones";

describe("pickZone — precedence เมื่อจุดตกหลายโซน", () => {
  it("ไม่มีโซน = null", () => {
    expect(pickZone([])).toBeNull();
  });

  it("เอาระดับสูงสุด: วิกฤต > อันตราย > เฝ้าระวัง > ปลอดภัย", () => {
    const z = pickZone([
      { name: "A", level: "safe" },
      { name: "B", level: "watch" },
      { name: "C", level: "critical" },
      { name: "D", level: "danger" },
    ]);
    expect(z?.name).toBe("C");
  });

  it("ระดับเท่ากันเรียงชื่อ — ลำดับที่ DB คืนต้องไม่เปลี่ยนคำตอบ", () => {
    const a = pickZone([{ name: "B", level: "danger" }, { name: "A", level: "danger" }]);
    const b = pickZone([{ name: "A", level: "danger" }, { name: "B", level: "danger" }]);
    expect(a?.name).toBe("A");
    expect(b?.name).toBe("A");
  });

  it("ข้ามโซนที่ปิดใช้งาน และระดับที่ไม่รู้จัก", () => {
    const z = pickZone([
      { name: "A", level: "critical", active: false },
      { name: "B", level: "bogus" },
      { name: "C", level: "watch" },
    ]);
    expect(z?.name).toBe("C");
  });
});

describe("situationLevel", () => {
  it("ไม่มีโซน หรือมีแต่โซนปลอดภัย = ปกติ", () => {
    expect(situationLevel([])).toBe("normal");
    expect(situationLevel([{ level: "safe" }])).toBe("normal");
  });

  it("ระดับโซนสูงสุดที่ยังเปิดใช้งาน", () => {
    expect(situationLevel([{ level: "watch" }, { level: "danger" }])).toBe("danger");
    expect(situationLevel([{ level: "critical", active: false }, { level: "watch" }])).toBe("watch");
    expect(situationLevel([{ level: "watch" }, { level: "critical" }, { level: "danger" }])).toBe("critical");
  });
});

describe("nextZoneName", () => {
  it("เริ่มจาก A แล้วต่อด้วยตัวที่ยังว่าง", () => {
    expect(nextZoneName([])).toBe("A");
    expect(nextZoneName(["A", "B"])).toBe("C");
    expect(nextZoneName(["A", "C"])).toBe("B");
    expect(nextZoneName([" a "])).toBe("B");
  });

  it("เกิน Z ต่อด้วย AA", () => {
    const all = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
    expect(nextZoneName(all)).toBe("AA");
  });
});

describe("zoneLabel", () => {
  it("มีชื่อ = 'โซน X' · ไม่มี = null", () => {
    expect(zoneLabel("A")).toBe("โซน A");
    expect(zoneLabel("")).toBeNull();
    expect(zoneLabel(null)).toBeNull();
  });
});
