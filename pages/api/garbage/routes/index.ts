import type { NextApiRequest, NextApiResponse } from "next";
import { routes as routesCol } from "@/lib/garbage/db";
import { requireGarbageAdmin, type GarbageAdminResult } from "../_auth";

/**
 * รายการสายพร้อมจุดเก็บ — ใช้เติม dropdown และตัวตั้งเวลารายจุดในฟอร์มแอดมิน
 * ต้องล็อกอิน: เป็นข้อมูลตั้งต้นของฟอร์ม ไม่ใช่ข้อมูลที่หน้าประชาชนต้องใช้
 * (หน้าประชาชนได้สายมาพร้อม /week และ /search แล้ว)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }

  let auth: GarbageAdminResult;
  try {
    auth = await requireGarbageAdmin(req);
  } catch (err) {
    console.error("[garbage/routes] auth", err);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    const rCol = await routesCol();
    const routes = await rCol.find({ active: true }).sort({ code: 1 }).toArray();
    return res.status(200).json({
      routes: routes.map((r) => ({
        code: r.code,
        name: r.name,
        defaultTruckNumber: r.defaultTruckNumber,
        needsVerification: r.needsVerification ?? false,
        stops: r.stops,
      })),
    });
  } catch (err) {
    console.error("[garbage/routes] GET", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
  }
}
