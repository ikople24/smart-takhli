import AdmZip from "adm-zip";

export interface ExtractedBatch {
  parcelCsv?: string;
  ns3aCsv?: string;
  constructionCsv?: string;
  geometryGeoJSON?: string;
  optId?: string;
  optName?: string;
  fileNames: string[];
}

// หาไฟล์ด้วย pattern (ชื่อ optId เปลี่ยนทุกเดือน) — ข้าม _ogr_tmp / shapefile / pdf
function findEntry(zip: AdmZip, test: (name: string) => boolean): string | undefined {
  const e = zip.getEntries().find((x) => !x.isDirectory && test(x.entryName.split("/").pop() || ""));
  return e ? e.getData().toString("utf8") : undefined;
}

export function extractBatch(buffer: Buffer): ExtractedBatch {
  const zip = new AdmZip(buffer);
  const base = (n: string) => /^parcel_.*\.csv$/i.test(n) && !/ogr_tmp/i.test(n);
  const parcelCsv = findEntry(zip, base);
  const ns3aCsv = findEntry(zip, (n) => /^ns3a_.*\.csv$/i.test(n));
  const constructionCsv = findEntry(zip, (n) => /^construction_.*\.csv$/i.test(n));
  const geometryGeoJSON = findEntry(zip, (n) => /_MAP_LAND_GIS_.*\.geojson$/i.test(n));

  let optId: string | undefined, optName: string | undefined;
  if (geometryGeoJSON) {
    try {
      const fc = JSON.parse(geometryGeoJSON).LocationGeospatial;
      const p = fc?.features?.[0]?.properties ?? {};
      optId = p.OptID ? String(p.OptID) : undefined;
      optName = p.OptName ? String(p.OptName) : undefined;
    } catch { /* ปล่อยให้ ingest จัดการ geometry เสียทีหลัง */ }
  }
  return {
    parcelCsv, ns3aCsv, constructionCsv, geometryGeoJSON, optId, optName,
    fileNames: zip.getEntries().map((e) => e.entryName),
  };
}
