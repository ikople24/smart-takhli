// เทสต์ logic หน้ามือถือ (README § หน้าจอมือถือ): ระยะทาง "ใกล้ฉัน", จัดอันดับงานด่วนสำหรับ FAB, ตัวนับ chip กองงานรอรับ
import { describe, it, expect } from "vitest";
import { haversineKm, formatDistanceLabel, withDistance, topUrgent, poolChipCounts } from "../mobile";

// ตาคลี ≈ 15.2612, 100.3428
const TAKHLI = { lat: 15.2612, lng: 100.3428 };

describe("haversineKm — ระยะทางบนผิวโลก", () => {
  it("จุดเดียวกัน = 0, ห่างกัน 1 องศาละติจูด ≈ 111 กม.", () => {
    expect(haversineKm(TAKHLI, TAKHLI)).toBe(0);
    expect(haversineKm({ lat: 15, lng: 100 }, { lat: 16, lng: 100 })).toBeCloseTo(111.2, 0);
  });
  it("พิกัดเพี้ยน/ไม่มี → null", () => {
    expect(haversineKm(null, TAKHLI)).toBeNull();
    expect(haversineKm({ lat: "x", lng: 100 }, TAKHLI)).toBeNull();
  });
});

describe("formatDistanceLabel — '1.2 กม. จากคุณ' / '850 ม. จากคุณ'", () => {
  it("ต่ำกว่า 1 กม. เป็นเมตร (ปัด 10 ม.), ตั้งแต่ 1 กม. ทศนิยม 1 ตำแหน่ง, ไกลมากปัดเป็นจำนวนเต็ม", () => {
    expect(formatDistanceLabel(0.847)).toBe("850 ม. จากคุณ");
    expect(formatDistanceLabel(1.234)).toBe("1.2 กม. จากคุณ");
    expect(formatDistanceLabel(12.34)).toBe("12 กม. จากคุณ");
    expect(formatDistanceLabel(null)).toBeNull();
  });
});

describe("withDistance — เติม distanceKm/distanceLabel และเรียงใกล้ก่อน (ไม่มีพิกัดไปท้าย)", () => {
  const items = [
    { _id: "far", location: { lat: 15.4, lng: 100.35 } },
    { _id: "none", location: null },
    { _id: "near", location: { lat: 15.2615, lng: 100.343 } },
  ];
  it("เรียง near → far → none และมี label", () => {
    const out = withDistance(items, TAKHLI);
    expect(out.map((i) => i._id)).toEqual(["near", "far", "none"]);
    expect(out[0].distanceKm).toBeLessThan(0.1);
    expect(out[0].distanceLabel).toMatch(/ม\. จากคุณ$/);
    expect(out[2].distanceKm).toBeNull();
    expect(out[2].distanceLabel).toBeNull();
  });
  it("ไม่มีตำแหน่งผู้ใช้ → คืนรายการเดิม (ลำดับเดิม) ไม่มี distance", () => {
    const out = withDistance(items, null);
    expect(out.map((i) => i._id)).toEqual(["far", "none", "near"]);
    expect(out[0].distanceKm).toBeNull();
  });
});

describe("topUrgent — งานที่ควรอัปเดตก่อน (FAB 'อัปเดตงานด่วน')", () => {
  const t = (id, over) => ({ _id: id, isCompleted: false, severity: "normal", daysToDue: 9, daysSinceUpdate: 0, ...over });
  const tasks = [
    t("a", { severity: "normal", daysToDue: 9 }),
    t("b", { severity: "overdue", daysToDue: -4 }),
    t("c", { severity: "due_soon", daysToDue: 1 }),
    t("d", { severity: "coordinating", daysToDue: 5 }),
    t("e", { severity: "done", isCompleted: true }),
    t("f", { severity: "overdue", daysToDue: -1 }),
    t("g", { severity: "normal", daysToDue: 3, daysSinceUpdate: 6 }),
  ];
  it("ตัดงานที่เสร็จออก, เรียง severity → ใกล้ครบกำหนด → ไม่ได้อัปเดตนาน, จำกัดจำนวน", () => {
    expect(topUrgent(tasks, 5).map((x) => x._id)).toEqual(["b", "f", "c", "d", "g"]);
    expect(topUrgent(tasks, 2).map((x) => x._id)).toEqual(["b", "f"]);
    expect(topUrgent([], 3)).toEqual([]);
  });
});

describe("poolChipCounts — ตัวเลขบน chip กองของฉัน / ค้างนาน / ทั้งหมด", () => {
  const items = [
    { _id: "1", department: "กองช่าง", isStale: true },
    { _id: "2", department: "กองช่าง", isStale: false },
    { _id: "3", department: null, isStale: true },
    { _id: "4", department: "กองคลัง", isStale: false },
  ];
  it("นับตามกองของเจ้าหน้าที่ (ไม่มีกอง = ทุกเรื่อง)", () => {
    expect(poolChipCounts(items, { officerDepartment: "กองช่าง" })).toEqual({ mine: 2, stale: 2, all: 4 });
    expect(poolChipCounts(items, { officerDepartment: null })).toEqual({ mine: 4, stale: 2, all: 4 });
  });
});
