import type { NextApiRequest, NextApiResponse } from "next";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import FloodZone from "@/models/flood-relief/FloodZone";
import { reassignOpenRequestZones } from "@/lib/flood-relief/reassignZones";
import { describeZonePatch, parseZoneInput } from "@/lib/flood-relief/zoneInput";
import { requireFloodAdmin } from "../_auth";
import { auditZone } from "@/lib/flood-relief/zoneViews";

/**
 * PATCH  /api/flood-relief/zones/[id] — แก้ชื่อ/ระดับ/รูป/เปิด-ปิด { name?, level?, geometry?, active? }
 * DELETE /api/flood-relief/zones/[id] — ลบถาวร
 * **superadmin เท่านั้นทั้งคู่** · ทุกครั้งต่อท้าย history + audit log และจัดโซนให้คำขอที่ยังไม่ปิดใหม่
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "รองรับเฉพาะ PATCH/DELETE" });
  }
  const auth = await requireFloodAdmin(req).catch(() => null);
  if (!auth) return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  if (!auth.isSuperAdmin) return res.status(403).json({ error: "แก้/ลบโซนได้เฉพาะ superadmin" });

  const id = String(req.query.id ?? "");
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "รหัสโซนไม่ถูกต้อง" });

  try {
    await dbConnect();
    const zone = (await FloodZone.findById(id).select({ name: 1 }).lean()) as { name: string } | null;
    if (!zone) return res.status(404).json({ error: "ไม่พบโซน" });

    if (req.method === "DELETE") {
      await FloodZone.deleteOne({ _id: id });
      const moved = await reassignOpenRequestZones();
      auditZone(auth.userId, auth.name, id, `ลบโซน ${zone.name} · จัดโซนคำขอใหม่ ${moved} รายการ`);
      return res.status(200).json({ ok: true, reassigned: moved });
    }

    const parsed = parseZoneInput(req.body, false);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const detail = describeZonePatch(parsed.value);
    const action = parsed.value.geometry
      ? "update_geometry"
      : parsed.value.level
        ? "update_level"
        : parsed.value.name
          ? "rename"
          : parsed.value.active
            ? "activate"
            : "deactivate";
    try {
      await FloodZone.updateOne(
        { _id: id },
        {
          $set: { ...parsed.value, updatedBy: auth.name },
          $push: { history: { at: new Date(), by: auth.name, byClerkId: auth.userId, action, detail } },
        }
      );
    } catch (err) {
      if ((err as { code?: number }).code === 16755) return res.status(400).json({ error: "รูปโซนเส้นตัดกันเอง ลองแก้ใหม่" });
      throw err;
    }
    const moved = await reassignOpenRequestZones();
    auditZone(auth.userId, auth.name, id, `โซน ${zone.name}: ${detail} · จัดโซนคำขอใหม่ ${moved} รายการ`);
    return res.status(200).json({ ok: true, reassigned: moved });
  } catch (err) {
    console.error("[flood-relief/zones/[id]]", err);
    return res.status(500).json({ error: "บันทึกโซนไม่สำเร็จ" });
  }
}
