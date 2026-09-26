import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import FloodRequest from "@/models/flood-relief/FloodRequest";
import FloodTeam from "@/models/flood-relief/FloodTeam";
import { ADMIN_LIST_PROJECTION, adminListItem } from "@/lib/flood-relief/adminView";
import { sortRequests } from "@/lib/flood-relief/derive";
import { computeKpi } from "@/lib/flood-relief/kpi";
import { loadFloodSettings } from "@/lib/flood-relief/loadSettings";
import { OPEN_STATUSES } from "@/lib/flood-relief/status";
import { requireFloodAdmin } from "../_auth";

/** คำขอที่ปิดแล้วเก่ากว่านี้ไม่โหลดเข้าแดชบอร์ด (ดูย้อนหลังผ่านส่งออก Excel) */
const CLOSED_WINDOW_DAYS = 7;
const MAX_ITEMS = 1000;

/**
 * GET /api/flood-relief/requests — แดชบอร์ดศูนย์ฯ (admin ที่มีสิทธิ์ /admin/flood-relief)
 * คืนคำขอที่ยังเปิดทั้งหมด + ที่ปิดใน 7 วัน เรียงด่วนมากก่อน พร้อม derived fields และ KPI
 * client โพลทุก 30 วิ แล้วกรอง/ค้นหาในเครื่อง (ข้อมูล < 1,000 รายการ)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }
  const auth = await requireFloodAdmin(req).catch((err) => {
    console.error("[flood-relief/requests] auth", err);
    return null;
  });
  if (!auth) return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    await dbConnect();
    const since = new Date(Date.now() - CLOSED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [docs, teams, settings] = await Promise.all([
      FloodRequest.find({ $or: [{ status: { $in: OPEN_STATUSES } }, { updatedAt: { $gte: since } }] })
        .select(ADMIN_LIST_PROJECTION)
        .sort({ createdAt: -1 })
        .limit(MAX_ITEMS)
        .lean(),
      FloodTeam.find({ active: true }).select({ status: 1, active: 1 }).lean(),
      loadFloodSettings(),
    ]);
    const now = new Date();
    const items = sortRequests(docs.map((d) => adminListItem(d as Record<string, unknown>, now)));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      items,
      kpi: computeKpi(items, teams as Array<{ status?: string; active?: boolean }>, now),
      centerOpen: settings.centerOpen,
      serverTime: now.toISOString(),
      me: { name: auth.name, canRewind: auth.canRewind, isSuperAdmin: auth.isSuperAdmin },
    });
  } catch (err) {
    console.error("[flood-relief/requests] GET", err);
    return res.status(500).json({ error: "โหลดรายการไม่สำเร็จ" });
  }
}
