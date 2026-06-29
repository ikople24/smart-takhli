import { area as turfArea, intersect, feature as turfFeature, featureCollection } from "@turf/turf";
import type { Polygon, MultiPolygon } from "geojson";

type Geom = Polygon | MultiPolygon;

export interface BasemapCandidate { basemapId: string; parcelCode: string; deedNo: string | null; geometry: Geom | null; }
export interface MatchInput { deedNo: string | null; landNo: string | null; survey: string | null; geometry: Geom | null; }
export interface MatchResolvers {
  byDeed: (deedNo: string) => Promise<BasemapCandidate[]>;
  byLandSurvey: (landNo: string, survey: string) => Promise<BasemapCandidate[]>;
  byGeom: (geometry: Geom) => Promise<BasemapCandidate[]>;
}
export interface MatchCandidate { parcelCode: string; basemapId: string; deedNo: string | null; overlapPct: number; }
export interface MatchResult {
  status: "matched" | "ambiguous" | "unmatched";
  method: "deed" | "deed+geom" | "land+survey" | "land+survey+geom" | "geom" | null;
  confidence: "high" | "medium" | "low" | null;
  parcelCode: string | null; basemapId: string | null; candidates: MatchCandidate[];
}

const IOU_THRESHOLD = 0.5;

// IoU ระหว่างโพลิกอน m10 กับ basemap (0..1); คืน 0 ถ้าคำนวณไม่ได้
function iou(a: Geom, b: Geom): number {
  try {
    const inter = intersect(featureCollection([turfFeature(a), turfFeature(b)]));
    if (!inter) return 0;
    const ai = turfArea(inter);
    const denom = turfArea(turfFeature(a)) + turfArea(turfFeature(b)) - ai;
    return denom > 0 ? ai / denom : 0;
  } catch { return 0; }
}

// ถ้า candidate ทุกตัวเป็น parcelCode เดียวกัน = แปลงเดียวที่ basemap เก็บเป็นหลาย fragment
// → ไม่ใช่ ambiguous จริง (รหัสตรงกันหมด) คืน candidate ตัวแรกให้ตัดสินเป็น matched
function singleCode(cands: BasemapCandidate[]): BasemapCandidate | null {
  if (cands.length === 0) return null;
  return cands.every((c) => c.parcelCode === cands[0].parcelCode) ? cands[0] : null;
}

function rank(geom: Geom | null, cands: BasemapCandidate[]): MatchCandidate[] {
  return cands
    .map((c) => ({ parcelCode: c.parcelCode, basemapId: c.basemapId, deedNo: c.deedNo,
      overlapPct: geom && c.geometry ? iou(geom, c.geometry) : 0 }))
    .sort((x, y) => y.overlapPct - x.overlapPct);
}

const matched = (method: MatchResult["method"], confidence: MatchResult["confidence"], c: BasemapCandidate, candidates: MatchCandidate[] = []): MatchResult =>
  ({ status: "matched", method, confidence, parcelCode: c.parcelCode, basemapId: c.basemapId, candidates });
const ambiguous = (method: MatchResult["method"], candidates: MatchCandidate[]): MatchResult =>
  ({ status: "ambiguous", method, confidence: "low", parcelCode: null, basemapId: null, candidates });

export async function matchParcel(input: MatchInput, r: MatchResolvers): Promise<MatchResult> {
  // ชั้น 1: โฉนด
  if (input.deedNo) {
    const ds = await r.byDeed(input.deedNo);
    if (ds.length === 1) return matched("deed", "high", ds[0]);
    if (ds.length > 1) {
      const same = singleCode(ds);
      if (same) return matched("deed", "high", same, rank(input.geometry, ds));
      const ranked = rank(input.geometry, ds);
      if (input.geometry && ranked[0].overlapPct >= IOU_THRESHOLD) {
        const top = ds.find((c) => c.basemapId === ranked[0].basemapId)!;
        return matched("deed+geom", "high", top, ranked);
      }
      return ambiguous("deed", ranked);
    }
  }
  // ชั้น 2: เลขที่ดิน + หน้าสำรวจ
  if (input.landNo && input.survey) {
    const ls = await r.byLandSurvey(input.landNo, input.survey);
    if (ls.length === 1) return matched("land+survey", "medium", ls[0]);
    if (ls.length > 1) {
      const same = singleCode(ls);
      if (same) return matched("land+survey", "medium", same, rank(input.geometry, ls));
      const ranked = rank(input.geometry, ls);
      if (input.geometry && ranked[0].overlapPct >= IOU_THRESHOLD) {
        const top = ls.find((c) => c.basemapId === ranked[0].basemapId)!;
        return matched("land+survey+geom", "medium", top, ranked);
      }
      return ambiguous("land+survey", ranked);
    }
  }
  // ชั้น 3: geometry overlap
  if (input.geometry) {
    const gs = await r.byGeom(input.geometry);
    const ranked = rank(input.geometry, gs).filter((c) => c.overlapPct > 0);
    if (ranked.length > 0) {
      if (ranked[0].overlapPct >= IOU_THRESHOLD) {
        const top = gs.find((c) => c.basemapId === ranked[0].basemapId)!;
        return matched("geom", "medium", top, ranked);
      }
      // หลาย candidate ที่ทับ แต่เป็นรหัสเดียวกันหมด → matched (fragment) ไม่ใช่ ambiguous
      if (ranked.length > 1 && ranked.every((c) => c.parcelCode === ranked[0].parcelCode)) {
        const top = gs.find((c) => c.basemapId === ranked[0].basemapId)!;
        return matched("geom", "low", top, ranked);
      }
      return ambiguous("geom", ranked);
    }
  }
  return { status: "unmatched", method: null, confidence: null, parcelCode: null, basemapId: null, candidates: [] };
}
