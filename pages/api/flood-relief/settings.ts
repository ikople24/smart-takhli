import type { NextApiRequest, NextApiResponse } from "next";
import { clerkClient, getAuth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/dbConnect";
import FloodSettings from "@/models/flood-relief/FloodSettings";
import { logAuditEvent } from "@/lib/auditLogger";
import { loadFloodSettings } from "@/lib/flood-relief/loadSettings";
import { normalizeSettings } from "@/lib/flood-relief/settings";

/**
 * GET/PUT /api/flood-relief/settings — superadmin เท่านั้น (pattern เดียวกับ pages/api/superadmin/line-settings.js)
 * เปิด/ปิดศูนย์ฯ (คุมการโชว์บล็อกหน้าแรก + การรับคำขอ) · เบอร์ศูนย์ฯ · SLA โทรกลับ · ประกาศ
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  if (clerkUser.publicMetadata?.role !== "superadmin") {
    return res.status(403).json({ error: "เฉพาะ superadmin" });
  }
  const actorName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    "superadmin";

  try {
    if (req.method === "GET") {
      return res.status(200).json({ settings: await loadFloodSettings() });
    }

    if (req.method === "PUT") {
      await dbConnect();
      const before = await loadFloodSettings();
      // ค่าที่ไม่ส่งมาคงค่าเดิม แล้ว normalize ทั้งก้อน — ค่าผิดรูปแบบถอยเป็น default ไม่ใช่ error
      const next = normalizeSettings({ ...before, ...(req.body ?? {}) });
      await FloodSettings.findOneAndUpdate(
        { key: "default" },
        { $set: { ...next, updatedBy: actorName } },
        { upsert: true }
      );

      const changes: string[] = [];
      if (before.centerOpen !== next.centerOpen) changes.push(next.centerOpen ? "เปิดศูนย์ฯ" : "ปิดศูนย์ฯ");
      if (before.hotline !== next.hotline) changes.push(`เบอร์ ${next.hotline}`);
      if (before.callbackSlaMin !== next.callbackSlaMin) changes.push(`โทรกลับใน ${next.callbackSlaMin} นาที`);
      if (before.announcement !== next.announcement) changes.push("แก้ประกาศ");
      if (before.situationOverride !== next.situationOverride) changes.push(`ระดับสถานการณ์ ${next.situationOverride}`);
      logAuditEvent({
        actorClerkId: userId,
        actorName,
        action: "flood_settings_updated",
        resourceType: "system",
        resourceId: "default",
        description: `ศูนย์ช่วยเหลือน้ำท่วม: ${changes.join(" · ") || "บันทึก (ไม่มีการเปลี่ยนแปลง)"}`,
      });
      return res.status(200).json({ settings: await loadFloodSettings() });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "รองรับเฉพาะ GET/PUT" });
  } catch (err) {
    console.error("[flood-relief/settings]", err);
    return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
  }
}
