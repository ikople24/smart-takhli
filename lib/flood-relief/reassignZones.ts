// lib/flood-relief/reassignZones.ts (server-only)
// หลังสร้าง/แก้/ปิด/ลบโซน: จัดโซนให้คำขอที่ยังไม่ปิดใหม่ทั้งหมด (README § Interactions "re-assign โซนให้คำขอที่ยังไม่ปิดทั้งหมด ฝั่ง server")
// คำขอที่ปิดแล้วไม่แตะ — zoneLevel เป็น snapshot ตอนเกิดเหตุ

import dbConnect from "@/lib/dbConnect";
import FloodRequest from "@/models/flood-relief/FloodRequest";
import FloodZone from "@/models/flood-relief/FloodZone";
import { OPEN_STATUSES } from "./status";
import { planZoneUpdates, type ZoneRef } from "./zoneAssign";

type ZoneDoc = { _id: unknown; name: string; level: string; geometry: unknown };
type ReqDoc = { _id: unknown; zoneId?: unknown; zoneName?: string | null; zoneLevel?: string | null };

/** คำขอที่ยังเปิดในแต่ละโซน (ใช้ทั้งจัดโซนและนับบนป้าย) — key = zoneId */
export async function openRequestIdsByZone(zones: readonly ZoneDoc[]): Promise<Map<string, string[]>> {
  await dbConnect();
  const out = new Map<string, string[]>();
  await Promise.all(
    zones.map(async (z) => {
      const hits = (await FloodRequest.find({
        status: { $in: OPEN_STATUSES },
        location: { $geoWithin: { $geometry: z.geometry } },
      })
        .select({ _id: 1 })
        .lean()) as unknown as Array<{ _id: unknown }>;
      out.set(String(z._id), hits.map((h) => String(h._id)));
    })
  );
  return out;
}

/** @returns จำนวนคำขอที่โซนเปลี่ยน */
export async function reassignOpenRequestZones(): Promise<number> {
  await dbConnect();
  const [zones, open] = await Promise.all([
    FloodZone.find({ active: true }).select({ name: 1, level: 1, geometry: 1 }).lean() as unknown as Promise<ZoneDoc[]>,
    FloodRequest.find({ status: { $in: OPEN_STATUSES } })
      .select({ zoneId: 1, zoneName: 1, zoneLevel: 1 })
      .lean() as unknown as Promise<ReqDoc[]>,
  ]);

  const byZone = await openRequestIdsByZone(zones);
  const hits = new Map<string, ZoneRef[]>();
  for (const z of zones) {
    const ref: ZoneRef = { id: String(z._id), name: z.name, level: z.level };
    for (const rid of byZone.get(ref.id) ?? []) hits.set(rid, [...(hits.get(rid) ?? []), ref]);
  }

  const updates = planZoneUpdates(
    open.map((r) => ({
      id: String(r._id),
      zoneId: r.zoneId ? String(r.zoneId) : null,
      zoneName: r.zoneName ?? null,
      zoneLevel: r.zoneLevel ?? null,
    })),
    hits
  );
  if (updates.length) {
    await FloodRequest.bulkWrite(
      updates.map((u) => ({
        updateOne: {
          filter: { _id: u.id },
          update: { $set: { zoneId: u.zoneId, zoneName: u.zoneName, zoneLevel: u.zoneLevel } },
        },
      }))
    );
  }
  return updates.length;
}
