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

/** ไฟล์จากกรมที่ดินส่วนใหญ่ใส่รหัสไว้ — แยกเป็น error ชนิดเดียวเพื่อให้ API ตอบ 400 พร้อมข้อความที่เจ้าหน้าที่เข้าใจ */
export class ZipPasswordError extends Error {
  constructor(public readonly kind: "required" | "wrong" | "unsupported_encryption") {
    super(
      kind === "required"
        ? "ไฟล์ ZIP นี้ใส่รหัสไว้ — กรุณากรอกรหัสเปิดไฟล์"
        : kind === "wrong"
          ? "รหัสเปิดไฟล์ไม่ถูกต้อง"
          : "ไฟล์ ZIP เข้ารหัสแบบ AES ซึ่งระบบยังอ่านไม่ได้ — ให้แตกไฟล์ด้วยรหัสแล้วบีบใหม่โดยไม่ใส่รหัส (ห้ามแก้ชื่อหัวคอลัมน์)"
    );
    this.name = "ZipPasswordError";
  }
}

// adm-zip ถอดรหัสได้เฉพาะ ZipCrypto ไม่รองรับ AES (method 99)
const AES_METHOD = 99;

function readEntry(entry: AdmZip.IZipEntry, password?: string): string {
  // @types/adm-zip ไม่มี field encrypted (มีจริงใน runtime) จึงต้อง cast
  const encrypted = (entry.header as unknown as { encrypted?: boolean }).encrypted === true;
  if (encrypted && entry.header.method === AES_METHOD) throw new ZipPasswordError("unsupported_encryption");
  if (encrypted && !password) throw new ZipPasswordError("required");
  try {
    return entry.getData(password).toString("utf8");
  } catch (e) {
    // adm-zip: "Wrong Password" (ตรวจ 1 ไบต์) หรือ "BAD_CRC" (รหัสผ่านด่านแรกแต่ข้อมูลเพี้ยน)
    const msg = e instanceof Error ? e.message : String(e);
    if (encrypted && /password|crc/i.test(msg)) throw new ZipPasswordError("wrong");
    throw e;
  }
}

// หาไฟล์ด้วย pattern (ชื่อ optId เปลี่ยนทุกเดือน) — ข้าม _ogr_tmp / shapefile / pdf
function findEntry(zip: AdmZip, test: (name: string) => boolean, password?: string): string | undefined {
  const e = zip.getEntries().find((x) => !x.isDirectory && test(x.entryName.split("/").pop() || ""));
  return e ? readEntry(e, password) : undefined;
}

export function extractBatch(buffer: Buffer, password?: string): ExtractedBatch {
  const zip = new AdmZip(buffer);
  const base = (n: string) => /^parcel_.*\.csv$/i.test(n) && !/ogr_tmp/i.test(n);
  const parcelCsv = findEntry(zip, base, password);
  const ns3aCsv = findEntry(zip, (n) => /^ns3a_.*\.csv$/i.test(n), password);
  const constructionCsv = findEntry(zip, (n) => /^construction_.*\.csv$/i.test(n), password);
  const geometryGeoJSON = findEntry(zip, (n) => /_MAP_LAND_GIS_.*\.geojson$/i.test(n), password);

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
