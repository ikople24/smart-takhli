import { describe, it, expect } from "vitest";
import { latestByPoint, pointInGeometry, communityTurbidStatus } from "../communityStatus";

const log = (id, key, result, at, lng = 100.35, lat = 15.26, extra = {}) => ({
  _id: id,
  flushPointId: key,
  locationName: key,
  result,
  flushedAt: at,
  location: { type: "Point", coordinates: [lng, lat] },
  ...extra,
});

describe("latestByPoint", () => {
  it("ใช้บันทึกล่าสุดของแต่ละจุด + นับจำนวนครั้ง (ไม่ขึ้นกับลำดับที่ส่งมา)", () => {
    const out = latestByPoint([
      log("a1", "A", "still_turbid", "2026-10-12T02:00:00Z"),
      log("a2", "A", "clear", "2026-10-13T02:00:00Z"),
      log("b1", "B", "still_turbid", "2026-10-12T03:00:00Z"),
    ]);
    const byId = Object.fromEntries(out.map((x) => [x.log._id, x.times]));
    expect(byId).toEqual({ a2: 2, b1: 1 });
  });

  it("ไม่ผูกหัวโบล์ → ใช้ชื่อจุดเป็นตัวจับคู่", () => {
    const out = latestByPoint([
      { ...log("x1", null, "clear", "2026-10-12T02:00:00Z"), locationName: "ซอย 1" },
      { ...log("x2", null, "clear", "2026-10-12T03:00:00Z"), locationName: "ซอย 1" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].log._id).toBe("x2");
  });
});

const square = (x0, y0, x1, y1) => ({
  type: "Polygon",
  coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
});

describe("pointInGeometry", () => {
  it("Polygon / MultiPolygon / รูในโพลิกอน", () => {
    const g = square(0, 0, 10, 10);
    expect(pointInGeometry([5, 5], g)).toBe(true);
    expect(pointInGeometry([15, 5], g)).toBe(false);
    const holed = { type: "Polygon", coordinates: [g.coordinates[0], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };
    expect(pointInGeometry([5, 5], holed)).toBe(false);
    const multi = { type: "MultiPolygon", coordinates: [square(0, 0, 1, 1).coordinates, square(5, 5, 6, 6).coordinates] };
    expect(pointInGeometry([5.5, 5.5], multi)).toBe(true);
    expect(pointInGeometry([3, 3], multi)).toBe(false);
    expect(pointInGeometry([1, 1], null)).toBe(false);
  });
});

describe("communityTurbidStatus", () => {
  const features = [
    { type: "Feature", properties: { name: "ชุมชน ก" }, geometry: square(100, 15, 100.5, 15.5) },
    { type: "Feature", properties: { name: "ชุมชน ข" }, geometry: square(101, 15, 101.5, 15.5) },
    { type: "Feature", properties: { name: "ชุมชน ค" }, geometry: square(102, 15, 102.5, 15.5) },
  ];

  it("นับจุดที่ผลล่าสุดยังขุ่น/ใส ต่อชุมชน · ชุมชนไม่มีบันทึก = none", () => {
    const latest = latestByPoint([
      log("1", "P1", "still_turbid", "2026-10-12T02:00:00Z", 100.1, 15.1),
      log("2", "P2", "still_turbid", "2026-10-12T02:00:00Z", 100.2, 15.2),
      log("3", "P3", "clear", "2026-10-12T02:00:00Z", 100.3, 15.3),
      log("4", "P4", "clear", "2026-10-12T02:00:00Z", 101.1, 15.1),
      log("5", "P5", "still_turbid", "2026-10-12T02:00:00Z", 105, 15.1), // นอกทุกชุมชน
    ]);
    const s = communityTurbidStatus(features, latest);
    expect(s.get("ชุมชน ก")).toEqual({ turbid: 2, clear: 1, status: "turbid" });
    expect(s.get("ชุมชน ข")).toEqual({ turbid: 0, clear: 1, status: "clear" });
    expect(s.get("ชุมชน ค")).toEqual({ turbid: 0, clear: 0, status: "none" });
  });

  it("โบซ้ำแล้วใส → ชุมชนกลับเป็นใส", () => {
    const latest = latestByPoint([
      log("1", "P1", "still_turbid", "2026-10-12T02:00:00Z", 100.1, 15.1),
      log("2", "P1", "clear", "2026-10-13T02:00:00Z", 100.1, 15.1),
    ]);
    expect(communityTurbidStatus(features, latest).get("ชุมชน ก").status).toBe("clear");
  });
});
