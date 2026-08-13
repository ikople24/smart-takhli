import type { NextApiRequest, NextApiResponse } from "next";
import { settings as settingsCol } from "@/lib/garbage/db";
import { garbageSettingsInputSchema } from "@/lib/garbage/validators";
import { requireGarbageAdmin } from "./_auth";

const SETTINGS_KEY = "default";

/** GET เปิดสาธารณะ (หน้าประชาชนต้องอ่านเบอร์ไปแสดง) · PUT ต้องล็อกอินและมีสิทธิ์หน้า /admin/garbage */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const col = await settingsCol();

  if (req.method === "GET") {
    try {
      const doc = await col.findOne({ key: SETTINGS_KEY });
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({
        contactPhone: doc?.contactPhone ?? null,
        contactNote: doc?.contactNote ?? null,
      });
    } catch (err) {
      console.error("[garbage/settings] GET", err);
      return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
    }
  }

  if (req.method === "PUT") {
    const auth = await requireGarbageAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

    const parsed = garbageSettingsInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    }

    try {
      const now = new Date();
      await col.updateOne(
        { key: SETTINGS_KEY },
        {
          $set: { ...parsed.data, updatedBy: auth.userId, updatedAt: now },
          $setOnInsert: { key: SETTINGS_KEY, createdAt: now },
        },
        { upsert: true }
      );
      return res.status(200).json({ contactPhone: parsed.data.contactPhone, contactNote: parsed.data.contactNote });
    } catch (err) {
      console.error("[garbage/settings] PUT", err);
      return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "รองรับเฉพาะ GET และ PUT" });
}
