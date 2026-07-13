// GET /api/permissions/clerk-unregistered
// ลิสต์ user ที่มีบัญชี Clerk แล้ว แต่ "ยังไม่มี document ใน Mongo" (= ยังใช้งานระบบไม่ได้)
//
// ทำไมต้องมี: พนักงานใหม่ที่ล็อกอิน Clerk ได้แล้วจะยังไม่มี Mongo doc →
//   1) verify-app-access ตอบ "user_not_registered" → ถูกบล็อกทุกหน้า /admin/*
//   2) API โมดูลตอบ 403 "User not registered"
//   3) ไม่โผล่ในรายการหน้า superadmin (ซึ่งดึงจาก Mongo) → กำหนดสิทธิ์ให้ไม่ได้
// = ไก่กับไข่ ไม่มีทางลงทะเบียนได้เลยถ้าไม่มีคนสร้าง doc ให้ก่อน
//
// endpoint นี้ทำให้ superadmin เห็นพนักงานใหม่ แล้วกด "เพิ่มเข้าระบบ" (→ /api/users/create) ได้

import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const client = await clerkClient();
    const caller = await client.users.getUser(userId);
    if (caller.publicMetadata?.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "เฉพาะ superadmin เท่านั้น" });
    }

    await dbConnect();
    const User =
      mongoose.models.User ||
      mongoose.model(
        "User",
        new mongoose.Schema({ clerkId: String }, { collection: "users", strict: false })
      );

    // clerkId ทั้งหมดที่มี doc อยู่แล้ว
    const existing = await User.find({}).select("clerkId").lean();
    const registered = new Set(existing.map((u) => u.clerkId).filter(Boolean));

    // ดึง Clerk users แล้วคัดเฉพาะคนที่ยังไม่มี doc
    const { data: clerkUsers } = await client.users.getUserList({ limit: 200 });
    const unregistered = clerkUsers
      .filter((u) => !registered.has(u.id))
      .map((u) => ({
        clerkId: u.id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        email: u.emailAddresses?.[0]?.emailAddress || "",
        imageUrl: u.imageUrl || "",
        role: u.publicMetadata?.role || "",
        allowedApps: u.publicMetadata?.allowedApps || [],
        createdAt: u.createdAt,
      }));

    return res.status(200).json({ success: true, users: unregistered });
  } catch (error) {
    console.error("❌ clerk-unregistered error:", error?.message);
    return res.status(500).json({ success: false, message: error?.message });
  }
}
