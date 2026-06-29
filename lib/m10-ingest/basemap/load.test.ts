import { describe, it, expect } from "vitest";
import { featureToBasemapDoc } from "./load";
import type { Feature } from "geojson";

function feat(props: Record<string, unknown>, coords: number[][][]): Feature {
  return { type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: coords } };
}
const SQUARE3D = [[[100, 15, -35], [100.001, 15, -35], [100.001, 15.001, -35], [100, 15.001, -35], [100, 15, -35]]];

describe("featureToBasemapDoc", () => {
  it("maps fields + strips Z + keeps 2D geometry", () => {
    const d = featureToBasemapDoc(feat(
      { PARCEL_COD: "07B034/081", ZONE_ID: "07", BLOCK_ID: "07B", LOT: "034/081",
        Chanod_no: 58181, LAND_NO: "711", SURVEY: "23173", land_type: "โฉนด",
        rai: 0, ngan: 1, wa: 12.4, area: 437.42 }, SQUARE3D))!;
    expect(d.parcelCode).toBe("07B034/081");
    expect(d.deedNo).toBe("58181"); // number → string
    expect(d.landNo).toBe("711");
    expect(d.survey).toBe("23173");
    expect(d.area.sqm).toBe(437.42);
    const ring = (d.geometry as GeoJSON.Polygon).coordinates[0];
    expect(ring.every((c) => c.length === 2)).toBe(true);
  });

  it("returns null when PARCEL_COD missing", () => {
    expect(featureToBasemapDoc(feat({ Chanod_no: 1 }, SQUARE3D))).toBeNull();
  });

  it("returns null for invalid (degenerate) polygon", () => {
    // ring 3 จุด (พื้นที่เป็นศูนย์) — turf booleanValid ปฏิเสธ → ข้ามไม่ให้ 2dsphere พัง
    const degenerate = [[[0, 0], [1, 0], [0, 0]]];
    expect(featureToBasemapDoc(feat({ PARCEL_COD: "X1" }, degenerate))).toBeNull();
  });
});
