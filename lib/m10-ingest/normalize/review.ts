import type { ChangeType, ReviewStatus } from "../types";

const AUTO_TYPES = new Set<ChangeType>(["ENCUMBRANCE", "NOTE", "ADMIN"]);

// ownership/เนื้อที่ที่มี recordKey → pending (ต้องคนยืนยัน); ที่เหลือ → auto (§4.1)
export function initialReviewStatus(changeType: ChangeType, hasRecordKey: boolean): ReviewStatus {
  if (!hasRecordKey) return "auto";
  if (AUTO_TYPES.has(changeType)) return "auto";
  return "pending";
}
