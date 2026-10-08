import { describe, it, expect } from "vitest";
import {
  parseFlushPointsKml,
  parseThaiDateTime,
  distanceM,
  nearestFlushPoints,
  FLUSH_POINT_KIND_LABELS,
} from "../flushPoints";

const placemark = (fields, coord = "100.3596292,15.22705209999999,0") => `
  <Placemark>
    <ExtendedData><SchemaData schemaUrl="#S">
      ${Object.entries(fields)
        .map(([k, v]) => `<SimpleData name="${k}">${v}</SimpleData>`)
        .join("\n")}
    </SchemaData></ExtendedData>
    <Point><coordinates>${coord}</coordinates></Point>
  </Placemark>`;

const row = (over = {}) => ({
  ___Row_ID: "qLDh",
  type_head_bor: "BP",
  year: "25",
  "รห_สห_วโบล_": "AT25002",
  "ถนน_ซอย": "ถนนประชาตาคลี",
  "ช__อห_วโบล_": "หมู่บ้านนภาลัย &amp; ซอย 1",
  "ชน_ดห_วโบล_": "พวงมาลัย",
  lat: "15.2271",
  lng: "100.36",
  "ว_นท__สร_างข_อม_ล": "24/1/2568 11:10:13",
  "ผ__บ_นท_กข_อม_ล": "พนักงานทีม 2",
  "ภาพสถานท__": "https://storage.googleapis.com/glide/a.jpg",
  ...over,
});

const kml = (...pms) => `<?xml version="1.0"?><kml><Document>${pms.join("")}</Document></kml>`;

describe("parseFlushPointsKml", () => {
  it("แปลง placemark → ข้อมูลหัวโบล์ ใช้พิกัดละเอียดจาก <coordinates>", () => {
    const [p] = parseFlushPointsKml(kml(placemark(row())));
    expect(p).toEqual({
      code: "AT25002",
      typeCode: "BP",
      kind: "garland",
      roadName: "ถนนประชาตาคลี",
      name: "หมู่บ้านนภาลัย & ซอย 1",
      location: { type: "Point", coordinates: [100.3596292, 15.22705209999999] },
      photoSourceUrl: "https://storage.googleapis.com/glide/a.jpg",
      legacy: {
        system: "glide",
        rowId: "qLDh",
        surveyedAt: new Date("2025-01-24T04:10:13.000Z"),
        surveyedBy: "พนักงานทีม 2",
      },
    });
  });

  it("แปลงชนิดหัวโบล์ทุกแบบ + ว่าง = unknown", () => {
    const kinds = ["ตัวทีใหญ่", "ตัวทีกลาง", "ตัวทีเล็ก", "พวงมาลัย", ""].map(
      (k) => parseFlushPointsKml(kml(placemark(row({ "ชน_ดห_วโบล_": k }))))[0].kind
    );
    expect(kinds).toEqual(["tee_large", "tee_medium", "tee_small", "garland", "unknown"]);
    expect(Object.keys(FLUSH_POINT_KIND_LABELS)).toEqual(
      expect.arrayContaining(["tee_large", "tee_medium", "tee_small", "garland", "unknown"])
    );
  });

  it("ไม่มีพิกัด/รหัส → ข้าม", () => {
    const out = parseFlushPointsKml(
      kml(placemark(row(), ""), placemark(row({ "รห_สห_วโบล_": "" })), placemark(row({ "รห_สห_วโบล_": "X1" })))
    );
    expect(out.map((p) => p.code)).toEqual(["X1"]);
  });
});

describe("parseThaiDateTime", () => {
  it("วัน/เดือน/ปี พ.ศ. เวลาไทย → Date UTC", () => {
    expect(parseThaiDateTime("24/1/2568 11:10:13").toISOString()).toBe("2025-01-24T04:10:13.000Z");
    expect(parseThaiDateTime("3/2/2568").toISOString()).toBe("2025-02-02T17:00:00.000Z");
  });
  it("รูปแบบผิด → null", () => {
    expect(parseThaiDateTime("")).toBeNull();
    expect(parseThaiDateTime("2025-01-24")).toBeNull();
  });
});

describe("distanceM / nearestFlushPoints", () => {
  const pt = (code, lat, lng) => ({ _id: code, code, location: { coordinates: [lng, lat] } });
  const points = [pt("A", 15.2605, 100.3555), pt("B", 15.2610, 100.3555), pt("C", 15.2700, 100.3555), pt("D", 15.2606, 100.3555)];

  it("ระยะทางประมาณถูก (0.001° lat ≈ 111 ม.)", () => {
    expect(Math.round(distanceM(15.26, 100.35, 15.261, 100.35))).toBeGreaterThan(108);
    expect(Math.round(distanceM(15.26, 100.35, 15.261, 100.35))).toBeLessThan(114);
  });

  it("เรียงใกล้สุดก่อน ตัดเกินรัศมี จำกัดจำนวน", () => {
    const r = nearestFlushPoints(points, 15.2605, 100.3555, { limit: 2, maxM: 150 });
    expect(r.map((x) => x.point.code)).toEqual(["A", "D"]);
    expect(r[0].distanceM).toBe(0);
    const all = nearestFlushPoints(points, 15.2605, 100.3555, { limit: 5, maxM: 150 });
    expect(all.map((x) => x.point.code)).toEqual(["A", "D", "B"]);
  });

  it("ไม่มีพิกัดผู้ใช้ → []", () => {
    expect(nearestFlushPoints(points, null, null)).toEqual([]);
  });
});
