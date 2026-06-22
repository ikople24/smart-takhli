import { describe, it, expect } from "vitest";
import { reprojectPoint, reprojectGeometry } from "./reproject";

describe("reprojectPoint (24047 -> 4326)", () => {
  it("golden point lands in Takhli", () => {
    const [lon, lat] = reprojectPoint([647023, 1683144]);
    expect(lat).toBeGreaterThanOrEqual(15.2);
    expect(lat).toBeLessThanOrEqual(15.25);
    expect(lon).toBeGreaterThanOrEqual(100.36);
    expect(lon).toBeLessThanOrEqual(100.37);
  });
});
describe("reprojectGeometry", () => {
  it("reprojects every coordinate, ring stays closed", () => {
    const out = reprojectGeometry({ type: "Polygon",
      coordinates: [[[647023, 1683144], [647073, 1683144], [647073, 1683194], [647023, 1683144]]] });
    const ring = (out.coordinates as number[][][])[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring[0][0]).toBeGreaterThan(100);
    expect(ring[0][1]).toBeGreaterThan(15);
  });
});
