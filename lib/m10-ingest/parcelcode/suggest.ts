import { parseParcelCode, nextBlockSeq, nextSuffix } from "./parcelCode";

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export interface BasemapLite { parcelCode: string; deedNo?: string | null; landNo?: string | null; survey?: string | null; geometry?: unknown; }

export interface SuggestResolvers {
  byDeed: (deedNo: string) => Promise<BasemapLite[]>;
  byGeomOverlap: (geometry: Geom) => Promise<BasemapLite[]>; // เรียง overlap มาก→น้อย
  childrenOfParent: (parentCode: string) => Promise<string[]>;
  codesInBlock: (zoneBlock: string) => Promise<string[]>;
}

export interface SuggestInput {
  changeType: string; deedNo: string | null; landNo: string | null; survey: string | null; geometry: Geom | null;
}

export interface SuggestResult {
  method: "deed-reuse" | "block-seq" | "split-suffix" | "merge-min" | "none";
  suggestedCode: string | null;
  confidence: "high" | "medium" | "low";
  parent: string | null;
  candidates: BasemapLite[];
  warnings: string[];
}

const NONE = (warnings: string[]): SuggestResult => ({ method: "none", suggestedCode: null, confidence: "low", parent: null, candidates: [], warnings });

export async function suggestForRecord(input: SuggestInput, res: SuggestResolvers): Promise<SuggestResult> {
  const { changeType, deedNo, geometry } = input;

  if (changeType === "NEW") {
    // 1) โฉนดตรง basemap → ใช้รหัสเดิม
    if (deedNo) {
      const byDeed = await res.byDeed(deedNo);
      if (byDeed.length) {
        const warnings: string[] = [];
        const m = byDeed[0];
        if (input.landNo && m.landNo && String(input.landNo) !== String(m.landNo)) warnings.push("เลขที่ดินไม่ตรงกับ basemap");
        if (input.survey && m.survey && String(input.survey) !== String(m.survey)) warnings.push("หน้าสำรวจไม่ตรงกับ basemap");
        return { method: "deed-reuse", suggestedCode: m.parcelCode, confidence: warnings.length ? "medium" : "high", parent: null, candidates: byDeed, warnings };
      }
    }
    // 2) block seq ถัดไปจากแปลงที่รูปทับ
    if (geometry) {
      const ov = await res.byGeomOverlap(geometry);
      if (ov.length) {
        const p = parseParcelCode(ov[0].parcelCode);
        if (p) {
          const zoneBlock = p.zone + p.block;
          const codes = await res.codesInBlock(zoneBlock);
          return { method: "block-seq", suggestedCode: nextBlockSeq(zoneBlock, codes), confidence: "low", parent: null, candidates: ov, warnings: ["แปลงใหม่ — เดาบล็อกจากแปลงข้างเคียง ตรวจรหัสก่อนยืนยัน"] };
        }
      }
    }
    return NONE(["หาแปลงข้างเคียงไม่ได้ — ระบุรหัสเอง"]);
  }

  if (changeType === "SPLIT" || changeType === "SPLIT_PUBLIC") {
    if (geometry) {
      const ov = await res.byGeomOverlap(geometry);
      if (ov.length) {
        const parent = ov[0].parcelCode;
        const children = await res.childrenOfParent(parent);
        return { method: "split-suffix", suggestedCode: nextSuffix(parent, children), confidence: "medium", parent, candidates: ov, warnings: changeType === "SPLIT_PUBLIC" ? ["แบ่งเป็นที่สาธารณะ — ตรวจว่าควรเป็นที่หลวงไหม"] : [] };
      }
    }
    return NONE(["หาแปลงแม่ไม่ได้ (รูปไม่ทับ basemap) — ระบุรหัสเอง"]);
  }

  if (changeType === "MERGE") {
    if (geometry) {
      const ov = await res.byGeomOverlap(geometry);
      if (ov.length) {
        const min = ov.map((c) => c.parcelCode).filter(Boolean).sort()[0];
        return { method: "merge-min", suggestedCode: min, confidence: ov.length > 1 ? "high" : "medium", parent: null, candidates: ov, warnings: ov.length < 2 ? ["พบแปลงที่ทับ < 2 — ตรวจว่าครบที่รวมไหม"] : [] };
      }
    }
    return NONE(["หาแปลงที่รวมไม่ได้ — ระบุรหัสเอง"]);
  }

  return NONE([`changeType ${changeType} ไม่รองรับการแนะรหัส`]);
}
