export type DocType = "PARCEL" | "NS3A" | "CONSTRUCTION";

export type ChangeType =
  | "TRANSFER" | "TRANSFER_PARTIAL" | "MERGE" | "NEW" | "SPLIT"
  | "SPLIT_PUBLIC" | "BOUNDARY_CHANGE" | "OWNER_CORRECTION"
  | "ENCUMBRANCE" | "NOTE" | "ADMIN" | "RETIRED";

// pending = รอเจ้าหน้าที่ยืนยัน · confirmed = apply เข้า records แล้ว · rejected = ปฏิเสธ · auto = ไม่ต้องยืนยัน (จำนอง/note/admin/construction)
export type ReviewStatus = "pending" | "confirmed" | "rejected" | "auto";

export type RejectReason =
  | "unknown_status" | "area_parse_failed" | "date_parse_failed"
  | "missing_key" | "geometry_invalid" | "geometry_unmatched";

export class NormalizeError extends Error {
  constructor(public reason: RejectReason, message?: string) {
    super(message ?? reason);
    this.name = "NormalizeError";
  }
}

export interface RawRow {
  docType: DocType;
  source: string;
  raw: Record<string, string>;
}

export interface RawGeometry {
  recordKey: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon; // EPSG:24047
}

export interface Area { rai: number; ngan: number; wa: number; sqm: number; }
export interface Owner { title: string; name: string; surname: string; fullName: string; idHash: string | null; }

export interface NormalizedTxn {
  docType: DocType;
  recordKey: string | null;   // null = materialize ไม่ได้ (เช่น construction)
  deedNo: string | null;      // จาก `โฉนด` — เก็บไว้รอบ reconcile
  rawStatus: string;
  changeType: ChangeType;
  taxRelevant: boolean;
  reviewStatus: ReviewStatus;
  txnDate: string;            // ISO "YYYY-MM-DD"
  regAmount: number | null;
  owner: Owner;
  area: Area | null;
  payloadRaw: Record<string, string>;
}

export type NormalizeOutcome =
  | { ok: true; txn: NormalizedTxn }
  | { ok: false; reason: RejectReason };
