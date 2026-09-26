// lib/flood-relief/adminView.ts
// รูปข้อมูลคำขอที่ API แอดมินส่งออก — whitelist ฟิลด์ + derived fields (logic ล้วน)
// ไม่ส่ง accessKey / clientIp / lineUserId (แค่บอกว่าเชื่อม LINE ไว้หรือไม่)

import { deriveRequest } from "./derive";
import { fromGeoPoint } from "./geo";

/** projection ของ list — ไม่มี notes/timeline/detail/images (หนัก ดึงตอนเปิดรายละเอียด) */
export const ADMIN_LIST_PROJECTION = {
  ticket: 1, type: 1, urgency: 1, status: 1, location: 1, accuracyM: 1, landmark: 1, peopleCount: 1,
  reporterName: 1, phone: 1, communityName: 1, zoneId: 1, zoneName: 1, zoneLevel: 1, assignedTeamId: 1,
  assignedAt: 1, dispatchedAt: 1, onSiteAt: 1, doneAt: 1, cancelledAt: 1, source: 1, createdAt: 1, updatedAt: 1,
} as const;

type Doc = Record<string, unknown> & { _id?: unknown; location?: { type?: unknown; coordinates?: unknown } };

export function adminListItem(doc: Doc, now: Date = new Date()) {
  const point = fromGeoPoint(doc.location);
  const { _id, location: _loc, lineUserId, accessKey: _k, clientIp: _ip, ...rest } = doc as Doc & {
    lineUserId?: unknown;
    accessKey?: unknown;
    clientIp?: unknown;
  };
  void _loc;
  void _k;
  void _ip;
  return {
    ...deriveRequest(rest as Parameters<typeof deriveRequest>[0], now),
    id: String(_id),
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    zoneId: doc.zoneId ? String(doc.zoneId) : null,
    assignedTeamId: doc.assignedTeamId ? String(doc.assignedTeamId) : null,
    lineLinked: Boolean(lineUserId),
  };
}
