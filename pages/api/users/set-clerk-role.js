// POST /api/users/set-clerk-role
// ตั้ง Clerk publicMetadata.role ให้ user
//
// สำคัญ 2 ข้อ:
// 1) ใช้ updateUserMetadata (merge) ไม่ใช่ updateUser({ publicMetadata }) ซึ่ง "ทับ" ทั้ง object
//    → ถ้าทับ allowedApps จะหาย = user หลุดสิทธิ์เข้าแอปทันที
// 2) ต้องมี auth: superadmin ตั้ง role ให้ใครก็ได้ / user ทั่วไปตั้งได้เฉพาะของตัวเอง
//    และห้ามยกระดับตัวเองเป็น superadmin

import { getAuth, clerkClient } from "@clerk/nextjs/server";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userId: callerId } = getAuth(req);
  if (!callerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { clerkId, role } = req.body;
  if (!clerkId || !role) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const client = await clerkClient();
    const caller = await client.users.getUser(callerId);
    const isSuperAdmin = caller.publicMetadata?.role === "superadmin";

    if (!isSuperAdmin) {
      // user ทั่วไป: ตั้ง role ได้เฉพาะของตัวเอง และห้ามเป็น superadmin
      if (clerkId !== callerId) {
        return res.status(403).json({ message: "ตั้ง role ให้ผู้ใช้อื่นได้เฉพาะ superadmin" });
      }
      if (role === "superadmin") {
        return res.status(403).json({ message: "ยกระดับตัวเองเป็น superadmin ไม่ได้" });
      }
    }

    // กันอุบัติเหตุ: ฟอร์ม /admin/register-user ส่ง role ที่เติมมาจาก "Mongo role" (มักเป็น "admin")
    // ถ้า superadmin กดบันทึกโปรไฟล์ตัวเอง จะถูกลดขั้นเป็น admin ทันทีและกู้คืนเองไม่ได้
    // → ห้ามลดขั้น superadmin ผ่าน endpoint นี้ (ถ้าตั้งใจลดจริง ใช้ script/Clerk dashboard)
    const target = clerkId === callerId ? caller : await client.users.getUser(clerkId);
    if (target.publicMetadata?.role === "superadmin" && role !== "superadmin") {
      return res.status(403).json({
        message: "ลดขั้น superadmin ผ่าน endpoint นี้ไม่ได้ (กันการลดขั้นตัวเองโดยไม่ตั้งใจ)",
      });
    }

    // merge เฉพาะคีย์ role — คีย์อื่นใน publicMetadata (เช่น allowedApps) คงเดิม
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: { role },
    });

    res.status(200).json({ message: "Clerk role updated" });
  } catch (error) {
    console.error("❌ Clerk error:", error?.message);
    res.status(500).json({ message: "Failed to update Clerk metadata", error: error?.message });
  }
}
