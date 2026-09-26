import type { NextApiRequest, NextApiResponse } from "next";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import FloodGauge from "@/models/flood-relief/FloodGauge";
import { GAUGE_NAME_MAX, GAUGE_NOTE_MAX } from "@/lib/flood-relief/gauge";
import { requireFloodAdmin } from "../../_auth";

/**
 * PATCH  /api/flood-relief/gauges/[id] — แก้ชื่อ/คำอธิบาย/เปิด-ปิด (admin)
 * DELETE /api/flood-relief/gauges/[id] — ลบจุดพร้อมประวัติรูป (**superadmin เท่านั้น**)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "รองรับเฉพาะ PATCH/DELETE" });
  }
  const auth = await requireFloodAdmin(req).catch(() => null);
  if (!auth) return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  const id = String(req.query.id ?? "");
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "รหัสจุดวัดไม่ถูกต้อง" });

  try {
    await dbConnect();
    if (req.method === "DELETE") {
      if (!auth.isSuperAdmin) return res.status(403).json({ error: "ลบจุดวัดได้เฉพาะ superadmin" });
      const r = await FloodGauge.deleteOne({ _id: id });
      return r.deletedCount ? res.status(200).json({ ok: true }) : res.status(404).json({ error: "ไม่พบจุดวัด" });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const set: Record<string, unknown> = { updatedBy: auth.name };
    if (typeof b.name === "string" && b.name.trim()) set.name = b.name.trim().slice(0, GAUGE_NAME_MAX);
    if (typeof b.note === "string") set.note = b.note.trim().slice(0, GAUGE_NOTE_MAX);
    if (typeof b.active === "boolean") set.active = b.active;
    if (Object.keys(set).length === 1) return res.status(400).json({ error: "ไม่มีข้อมูลที่จะแก้" });
    const r = await FloodGauge.updateOne({ _id: id }, { $set: set });
    return r.matchedCount ? res.status(200).json({ ok: true }) : res.status(404).json({ error: "ไม่พบจุดวัด" });
  } catch (err) {
    console.error("[flood-relief/gauges/[id]]", err);
    return res.status(500).json({ error: "บันทึกจุดวัดไม่สำเร็จ" });
  }
}
