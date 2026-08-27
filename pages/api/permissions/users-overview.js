// GET /api/permissions/users-overview
// ลิสต์ user "ทุกคน" สำหรับหน้า /admin/superadmin — merge บัญชี Clerk ทั้ง org
// เข้ากับ Mongo `users` แล้วคำนวณสถานะต่อคน (logic อยู่ lib/superadmin/usersOverview)
//
// แทนที่ GET /api/permissions/clerk-unregistered + GET /api/users/get-all-users-local
// สำหรับหน้านี้ — ถ้าดึงลิสต์ Clerk ไม่สำเร็จ (เช่น rate limit) ยังคืนข้อมูลฝั่ง Mongo พร้อม clerkUnavailable: true (ถ้า Clerk ล่มทั้งระบบ auth guard จะ 500 ก่อนถึงจุดนี้)

import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { requireSuperadmin } from "./_auth";
import { buildUsersOverview, toClerkLite } from "@/lib/superadmin/usersOverview";

const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "";

const User =
  mongoose.models.User ||
  mongoose.model("User", new mongoose.Schema({}, { collection: "users", strict: false }));

// ดึง Clerk users ให้ครบทุกคน (org ปัจจุบัน ~92 คน — ห้ามพึ่ง limit ครั้งเดียว)
// เรียงเก่า→ใหม่ กัน user สมัครใหม่ระหว่าง paginate ทำให้หน้าเลื่อนแล้วได้คนซ้ำ
async function fetchAllClerkUsers(client) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, totalCount } = await client.users.getUserList({
      limit: 100,
      offset,
      orderBy: "+created_at",
    });
    out.push(...data);
    offset += data.length;
    if (data.length === 0 || out.length >= totalCount) break;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const auth = await requireSuperadmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    await dbConnect();
    // ดึงทุก doc แล้วค่อยแยก: archived ออกจากลิสต์ แต่เก็บ clerkId ไว้กันบัญชี Clerk
    // ของคนที่ถูก archive โผล่กลับมาเป็นแถว "ยังไม่ลงทะเบียน" (พฤติกรรมเดิมของ clerk-unregistered)
    const allDocs = await User.find({}).lean();
    const mongoDocs = allDocs.filter((d) => !d.isArchived);
    const archivedClerkIds = new Set(
      allDocs.filter((d) => d.isArchived).map((d) => d.clerkId).filter(Boolean)
    );

    let clerkUsers = [];
    let clerkAvailable = true;
    try {
      clerkUsers = (await fetchAllClerkUsers(auth.client))
        .map(toClerkLite)
        .filter((c) => !archivedClerkIds.has(c.clerkId));
    } catch (e) {
      console.error("users-overview: Clerk fetch failed:", e?.message);
      clerkAvailable = false;
    }

    const users = buildUsersOverview(clerkUsers, mongoDocs, CURRENT_APP_ID, { clerkAvailable });
    return res.status(200).json({
      success: true,
      users,
      clerkUnavailable: !clerkAvailable,
      appId: CURRENT_APP_ID,
    });
  } catch (error) {
    console.error("users-overview error:", error?.message);
    return res.status(500).json({ success: false, message: error?.message });
  }
}
