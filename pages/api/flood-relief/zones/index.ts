import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import FloodZone from "@/models/flood-relief/FloodZone";
import { reassignOpenRequestZones } from "@/lib/flood-relief/reassignZones";
import { findCommunityGeometry } from "@/lib/flood-relief/locate";
import { parseFillInput, parseZoneInput } from "@/lib/flood-relief/zoneInput";
import { nextZoneName, ZONE_META } from "@/lib/flood-relief/zones";
import { requireFloodAdmin } from "../_auth";
import { auditZone, zoneViews } from "@/lib/flood-relief/zoneViews";

/**
 * GET  /api/flood-relief/zones — ทุกคนที่เข้าแดชบอร์ดได้ (โซนทั้งหมด รวมที่ปิดใช้งาน + จำนวนคำขอที่ยังเปิดในโซน)
 * POST /api/flood-relief/zones — **superadmin เท่านั้น** (เจ้าของตกลง 2026-09-26)
 *   { communityName, level } = **เติมสีทั้งชุมชน** (วิธีหลัก) — รูปคัดลอกจาก basemap geojsonfeatures (อ่านอย่างเดียว)
 *     ชุมชนเดิมมีโซนอยู่แล้ว = เปลี่ยนระดับ + เปิดใช้งาน แทนการสร้างซ้ำ
 *   { level, geometry, name? } = โซนที่วาดเอง (UI เลิกใช้แล้ว เก็บไว้ให้ API เข้ากันได้)
 *   ทุกครั้งจัดโซนให้คำขอที่ยังไม่ปิดใหม่ทั้งหมด
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireFloodAdmin(req).catch(() => null);
  if (!auth) return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    await dbConnect();
    if (req.method === "GET") {
      const zones = (await FloodZone.find({}).sort({ active: -1, name: 1 }).lean()) as never[];
      return res.status(200).json({ zones: await zoneViews(zones) });
    }

    if (req.method === "POST") {
      if (!auth.isSuperAdmin) return res.status(403).json({ error: "เติมสีโซนได้เฉพาะ superadmin" });

      if (req.body && typeof req.body === "object" && "communityName" in req.body) {
        const fill = parseFillInput(req.body);
        if (!fill.ok) return res.status(400).json({ error: fill.error });
        const now = new Date();
        const label = ZONE_META[fill.level].label;
        const existing = (await FloodZone.findOne({ communityName: fill.communityName }).select({ _id: 1 }).lean()) as {
          _id: unknown;
        } | null;
        let zoneId: string;
        if (existing) {
          await FloodZone.updateOne(
            { _id: existing._id },
            {
              $set: { level: fill.level, active: true, updatedBy: auth.name },
              $push: { history: { at: now, by: auth.name, byClerkId: auth.userId, action: "update_level", detail: `เติมสี${label}` } },
            }
          );
          zoneId = String(existing._id);
        } else {
          const geometry = await findCommunityGeometry(fill.communityName);
          if (!geometry) return res.status(404).json({ error: `ไม่พบกรอบชุมชน ${fill.communityName}` });
          const created = await FloodZone.create({
            name: fill.communityName,
            communityName: fill.communityName,
            level: fill.level,
            geometry,
            active: true,
            createdBy: auth.name,
            updatedBy: auth.name,
            history: [{ at: now, by: auth.name, byClerkId: auth.userId, action: "create", detail: `เติมสี${label}ทั้งชุมชน` }],
          });
          zoneId = String(created._id);
        }
        const moved = await reassignOpenRequestZones();
        auditZone(auth.userId, auth.name, zoneId, `เติมสีชุมชน${fill.communityName} เป็น${label} · จัดโซนคำขอใหม่ ${moved} รายการ`);
        return res.status(existing ? 200 : 201).json({ id: zoneId, name: fill.communityName, reassigned: moved });
      }

      const parsed = parseZoneInput(req.body, true);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      const v = parsed.value;
      const existing = (await FloodZone.find({}).select({ name: 1 }).lean()) as unknown as Array<{ name: string }>;
      const name = v.name ?? nextZoneName(existing.map((z) => z.name));
      const now = new Date();

      let created;
      try {
        created = await FloodZone.create({
          name,
          level: v.level,
          geometry: v.geometry,
          active: true,
          createdBy: auth.name,
          updatedBy: auth.name,
          history: [{ at: now, by: auth.name, byClerkId: auth.userId, action: "create", detail: `สร้างโซน ${name}` }],
        });
      } catch (err) {
        // 2dsphere ปฏิเสธรูปที่เส้นตัดกันเอง
        if ((err as { code?: number }).code === 16755) return res.status(400).json({ error: "รูปโซนเส้นตัดกันเอง ลองวาดใหม่" });
        throw err;
      }
      const moved = await reassignOpenRequestZones();
      auditZone(auth.userId, auth.name, String(created._id), `สร้างโซน ${name} (${ZONE_META[v.level!].label}) · จัดโซนคำขอใหม่ ${moved} รายการ`);
      return res.status(201).json({ id: String(created._id), name, reassigned: moved });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "รองรับเฉพาะ GET/POST" });
  } catch (err) {
    console.error("[flood-relief/zones]", err);
    return res.status(500).json({ error: "บันทึกโซนไม่สำเร็จ" });
  }
}
