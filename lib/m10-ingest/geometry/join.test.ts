import { describe, it, expect } from "vitest";
import { prepareGeometry, joinGeometry } from "./join";
import type { RawGeometry } from "../types";

const g: RawGeometry = { recordKey: "5039|2|4682|07|1000|58",
  geometry: { type: "Polygon", coordinates: [[[647023, 1683144], [647073, 1683144], [647073, 1683194], [647023, 1683194], [647023, 1683144]]] } };

describe("prepareGeometry", () => {
  it("reprojects + validates (ok)", () => {
    const out = prepareGeometry(g);
    expect(out.ok).toBe(true);
    if (out.ok) expect((out.geometry.coordinates as number[][][])[0][0][0]).toBeGreaterThan(100);
  });
  it("invalid polygon -> ok:false", () => {
    expect(prepareGeometry({ recordKey: "x", geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0]]] } }).ok).toBe(false);
  });
});
describe("joinGeometry", () => {
  it("matches by recordKey, reports leftovers", () => {
    const r = joinGeometry(["5039|2|4682|07|1000|58", "9|9|9|99|1000|1"], [g]);
    expect(r.matched.size).toBe(1);
    expect(r.unmatchedGeometry).toEqual([]);
    expect(r.recordsWithoutGeometry).toEqual(["9|9|9|99|1000|1"]);
  });
});
