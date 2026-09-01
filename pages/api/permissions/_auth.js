// pages/api/permissions/_auth.js
// Guard ใช้ร่วมของ API จัดการ user/สิทธิ์: อนุญาตเฉพาะ superadmin (เช็คจาก Clerk publicMetadata)
// รูปแบบเดียวกับ pages/api/pm25/_auth.js — คืน result object ไม่แตะ res เอง:
//   ไม่ผ่าน: { ok: false, status, message }  →  caller ตอบ res.status(status).json({ success: false, message })
//   ผ่าน:   { ok: true, userId, client, actorName }
// หมายเหตุ: ไม่ try/catch ในนี้ (เหมือน pm25) — caller ต้องเรียกภายใน try block ของตัวเอง

import { getAuth, clerkClient } from "@clerk/nextjs/server";

export async function requireSuperadmin(req) {
  const { userId } = getAuth(req);
  if (!userId) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  const client = await clerkClient();
  const caller = await client.users.getUser(userId);
  if (caller.publicMetadata?.role !== "superadmin") {
    return { ok: false, status: 403, message: "เฉพาะ superadmin เท่านั้น" };
  }
  const actorName = `${caller.firstName || ""} ${caller.lastName || ""}`.trim();
  return { ok: true, userId, client, actorName };
}
