import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractBatch } from "./zip";

const ZIP = readFileSync(join(process.cwd(), "public/60070001_60010000.zip"));

describe("extractBatch", () => {
  it("finds the 4 inputs by glob and reads optId/optName from geometry", () => {
    const b = extractBatch(ZIP);
    expect(b.parcelCsv).toContain("สถานะดำเนินการ");
    expect(b.ns3aCsv).toContain("เลขที่นส3ก");
    expect(b.constructionCsv).toContain("ประเภทสิ่งปลูกสร้าง");
    expect(b.geometryGeoJSON).toContain("LocationGeospatial");
    expect(b.optId).toBe("4600701");
    expect(b.optName).toContain("ตาคลี");
  });
  it("ignores junk (shapefile parts, pdf, _ogr_tmp)", () => {
    const b = extractBatch(ZIP);
    expect(b.parcelCsv).not.toContain("ogr_tmp");
  });
});
