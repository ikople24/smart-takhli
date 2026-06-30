import { describe, it, expect } from "vitest";
import { suggestForRecord, type SuggestResolvers } from "./suggest";

// fake resolvers — คุมผลทุกชั้น
const fake = (over: Partial<SuggestResolvers>): SuggestResolvers => ({
  byDeed: async () => [],
  byGeomOverlap: async () => [],
  childrenOfParent: async () => [],
  codesInBlock: async () => [],
  ...over,
});

const G = { type: "Polygon", coordinates: [[[100, 15], [100.001, 15], [100.001, 15.001], [100, 15.001], [100, 15]]] } as GeoJSON.Polygon;

describe("suggestForRecord — NEW", () => {
  it("โฉนดตรง basemap → ใช้รหัสเดิม (deed-reuse)", async () => {
    const r = await suggestForRecord(
      { changeType: "NEW", deedNo: "555", landNo: "10", survey: "3", geometry: G },
      fake({ byDeed: async () => [{ parcelCode: "09Z001", deedNo: "555", landNo: "10", survey: "3", geometry: G }] })
    );
    expect(r.method).toBe("deed-reuse");
    expect(r.suggestedCode).toBe("09Z001");
  });

  it("โฉนดไม่ตรง → block seq ถัดไปจากแปลงที่ทับ", async () => {
    const r = await suggestForRecord(
      { changeType: "NEW", deedNo: "999", landNo: null, survey: null, geometry: G },
      fake({
        byGeomOverlap: async () => [{ parcelCode: "02B120", deedNo: "1", geometry: G }],
        codesInBlock: async () => ["02B120", "02B118"],
      })
    );
    expect(r.method).toBe("block-seq");
    expect(r.suggestedCode).toBe("02B121");
  });

  it("ไม่มี overlap → null + warning", async () => {
    const r = await suggestForRecord(
      { changeType: "NEW", deedNo: "999", landNo: null, survey: null, geometry: G },
      fake({})
    );
    expect(r.suggestedCode).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("suggestForRecord — SPLIT", () => {
  it("แม่จากรูปที่ทับ → suffix ลูกถัดไป", async () => {
    const r = await suggestForRecord(
      { changeType: "SPLIT", deedNo: "9", landNo: "5", survey: "1", geometry: G },
      fake({
        byGeomOverlap: async () => [{ parcelCode: "01A001", deedNo: "9", geometry: G }],
        childrenOfParent: async () => ["01A001/001"],
      })
    );
    expect(r.method).toBe("split-suffix");
    expect(r.parent).toBe("01A001");
    expect(r.suggestedCode).toBe("01A001/002");
  });
});

describe("suggestForRecord — MERGE", () => {
  it("แนะรหัสน้อยสุดของแปลงที่ทับ", async () => {
    const r = await suggestForRecord(
      { changeType: "MERGE", deedNo: "9", landNo: "5", survey: "1", geometry: G },
      fake({ byGeomOverlap: async () => [
        { parcelCode: "01A005", deedNo: "9", geometry: G },
        { parcelCode: "01A002", deedNo: "8", geometry: G },
      ] })
    );
    expect(r.method).toBe("merge-min");
    expect(r.suggestedCode).toBe("01A002");
    expect(r.candidates.length).toBe(2);
  });
});
