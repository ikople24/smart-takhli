// lib/flood-relief/zoneAssign.ts
// จัดโซนให้คำขอที่ยังไม่ปิดใหม่ทั้งหมดหลังโซนเปลี่ยน (logic ล้วน — ส่วนแตะ DB อยู่ที่ reassignZones.ts)
// คำขอที่ปิดแล้วไม่แตะ: zoneLevel เป็น snapshot ตอนเกิดเหตุ ใช้ดูย้อนหลัง/ส่งออกรายงาน

import { pickZone } from "./zones";

export type ZoneRef = { id: string; name: string; level: string; active?: boolean };
export type RequestZoneState = { id: string; zoneId: string | null; zoneName: string | null; zoneLevel: string | null };
export type ZoneUpdate = { id: string; zoneId: string | null; zoneName: string | null; zoneLevel: string | null };

/**
 * @param requests คำขอที่ยังเปิด (สถานะโซนปัจจุบัน)
 * @param hits requestId → โซนที่จุดนั้นตกอยู่ (active เท่านั้น)
 * @returns เฉพาะคำขอที่โซนเปลี่ยนจริง — ไม่เขียนซ้ำคำขอที่ค่าเดิม
 */
export function planZoneUpdates(requests: readonly RequestZoneState[], hits: ReadonlyMap<string, ZoneRef[]>): ZoneUpdate[] {
  const out: ZoneUpdate[] = [];
  for (const r of requests) {
    const z = pickZone(hits.get(r.id) ?? []);
    const next = { zoneId: z?.id ?? null, zoneName: z?.name ?? null, zoneLevel: z?.level ?? null };
    if (next.zoneId !== r.zoneId || next.zoneName !== r.zoneName || next.zoneLevel !== r.zoneLevel) {
      out.push({ id: r.id, ...next });
    }
  }
  return out;
}
