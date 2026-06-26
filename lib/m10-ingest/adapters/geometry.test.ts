import { describe, it, expect } from "vitest";
import { parseGeometryGeoJSON } from "./geometry";

const WRAPPED = JSON.stringify({
  LocationGeospatial: {
    crs: { type: "name", properties: { name: "EPSG:24047" } },
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { LandUTM1: "5039", LandUTM2: 2, LandUTM3: "4682", LandUTM4: "07", LandUTMScale: 1000, LandNumber: "58" },
      geometry: { type: "Polygon", coordinates: [[[647023.24, 1683144.48], [647011.6, 1683134.9], [647058.7, 1683084.2], [647023.24, 1683144.48]]] },
    }],
  },
});

describe("parseGeometryGeoJSON", () => {
  it("unwraps LocationGeospatial and keys by parcelRecordKey (numbers coerced)", () => {
    const out = parseGeometryGeoJSON(WRAPPED);
    expect(out).toHaveLength(1);
    expect(out[0].recordKey).toBe("5039|2|4682|07|1000|58");
    expect(out[0].geometry.type).toBe("Polygon");
  });
  it("throws geometry_invalid for non-JSON / missing FeatureCollection", () => {
    expect(() => parseGeometryGeoJSON("{}")).toThrowError();
  });
});
