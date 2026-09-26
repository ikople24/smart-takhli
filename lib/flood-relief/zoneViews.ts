// lib/flood-relief/zoneViews.ts (server-only) — รูปข้อมูลโซนที่ API ส่งออก + audit (ใช้ร่วม index/[id])
import { logAuditEvent } from "@/lib/auditLogger";
import { openRequestIdsByZone } from "@/lib/flood-relief/reassignZones";

type ZoneDoc = {
  _id: unknown;
  name: string;
  communityName?: string | null;
  level: string;
  geometry: unknown;
  active?: boolean;
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: Date;
};

export async function zoneViews(zones: ZoneDoc[]) {
  const counts = await openRequestIdsByZone(zones);
  return zones.map((z) => ({
    id: String(z._id),
    name: z.name,
    communityName: z.communityName ?? null,
    level: z.level,
    geometry: z.geometry,
    active: z.active !== false,
    openCount: counts.get(String(z._id))?.length ?? 0,
    createdBy: z.createdBy ?? "",
    updatedBy: z.updatedBy ?? "",
    updatedAt: z.updatedAt ?? null,
  }));
}

export function auditZone(actorClerkId: string, actorName: string, zoneId: string, description: string) {
  logAuditEvent({
    actorClerkId,
    actorName,
    action: "flood_zone_changed",
    resourceType: "system",
    resourceId: zoneId,
    description: `โซนน้ำท่วม: ${description}`,
  });
}
