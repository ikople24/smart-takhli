import type { NextApiRequest, NextApiResponse } from "next";
import { settings as settingsCol } from "@/lib/garbage/db";
import { garbageSettingsInputSchema } from "@/lib/garbage/validators";
import { requireGarbageAdmin, type GarbageAdminResult } from "./_auth";

const SETTINGS_KEY = "default";

/** GET เปิดสาธารณะ (หน้าประชาชนต้องอ่านเบอร์ไปแสดง) · PUT ต้องล็อกอินและมีสิทธิ์หน้า /admin/garbage */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // เปิดคอนเนกชันในแต่ละ try เท่านั้น — ถ้าเปิดไว้หัว handler แล้ว Mongo ล่ม จะ throw นอก try
  // ทำให้ตอบ 500 เปล่าของ Next แทน { error } ตามสัญญาของโมดูล และ branch 405 ก็ไม่ต้องแตะ DB เลย
  if (req.method === "GET") {
    try {
      const col = await settingsCol();
      const doc = await col.findOne({ key: SETTINGS_KEY });
      // สั้นกว่า week/schedule (300 วิ) เพราะเบอร์ติดต่อเปลี่ยนไม่บ่อยแต่ต้องถูกทันทีหลังแอดมินแก้ —
      // ถ้าแคช 5 นาที ประชาชนอาจโทรไปเบอร์เก่าหลังเทศบาลเปลี่ยนเบอร์แล้ว
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
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
    // requireGarbageAdmin ยิง Clerk และเรียก dbConnect() — ถ้า Clerk 5xx หรือ Mongo ล่ม
    // ต้องตอบ { error } ตามสัญญาของโมดูล ไม่ใช่ 500 เปล่าของ Next
    // (แยก try ออกจากท่อนเขียนข้อมูล เพื่อให้ข้อความ error ตรงกับขั้นที่พังจริง
    //  และให้ auth 401/403 กับ zod 400 ยังตอบสถานะเดิม ไม่ถูกกลืนเป็น 500)
    let auth: GarbageAdminResult;
    try {
      auth = await requireGarbageAdmin(req);
    } catch (err) {
      console.error("[garbage/settings] auth", err);
      return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
    }
    if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

    const parsed = garbageSettingsInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    }

    try {
      const col = await settingsCol();
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
