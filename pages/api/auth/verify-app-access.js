import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";
import { getAuth, clerkClient } from "@clerk/nextjs/server";

/**
 * API สำหรับตรวจสอบว่า user มีสิทธิ์เข้าถึง app นี้หรือไม่
 * 
 * ลำดับการตรวจสอบ:
 * 1. ตรวจสอบ allowedApps จาก Clerk publicMetadata (ถ้ามี)
 * 2. ตรวจสอบ appId จาก MongoDB (fallback)
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      hasAccess: false,
      message: "Unauthorized - No user ID" 
    });
  }

  const currentAppId = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";

  try {
    // ขั้นตอนที่ 1: ตรวจสอบจาก Clerk publicMetadata ก่อน
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const clerkAllowedApps = clerkUser.publicMetadata?.allowedApps || [];
    const clerkRole = clerkUser.publicMetadata?.role || "";

    // Super Admin เข้าได้ทุก app
    if (clerkRole === "superadmin") {
      console.log(`✅ SuperAdmin ${clerkUser.firstName} has access to all apps`);
      return res.status(200).json({
        success: true,
        hasAccess: true,
        source: "clerk_superadmin",
        user: {
          clerkId: userId,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
          role: clerkRole,
          allowedApps: ["*"], // ทุก app
        }
      });
    }

    // ถ้ามี allowedApps ใน Clerk → ใช้ Clerk เป็นหลัก
    if (Array.isArray(clerkAllowedApps) && clerkAllowedApps.length > 0) {
      const hasClerkAccess = clerkAllowedApps.includes(currentAppId) || clerkAllowedApps.includes("*");
      
      if (hasClerkAccess) {
        console.log(`✅ User ${clerkUser.firstName} has Clerk access to ${currentAppId}`);
        
        // ดึง allowedPages จาก MongoDB (ถ้ามี)
        await dbConnect();
        const UserSchema = new mongoose.Schema(
          {
            name: String, clerkId: String, allowedPages: { type: [String], default: [] },
          },
          { collection: "users", timestamps: true }
        );
        const User = mongoose.models.User || mongoose.model("User", UserSchema);
        const mongoUser = await User.findOne({ clerkId: userId }).lean();

        return res.status(200).json({
          success: true,
          hasAccess: true,
          source: "clerk",
          user: {
            _id: mongoUser?._id,
            clerkId: userId,
            name: mongoUser?.name || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
            role: clerkRole,
            allowedApps: clerkAllowedApps,
            allowedPages: mongoUser?.allowedPages || [],
          }
        });
      } else {
        console.log(`❌ User ${clerkUser.firstName} not in allowedApps for ${currentAppId}`);
        return res.status(200).json({
          success: true,
          hasAccess: false,
          source: "clerk",
          reason: "app_mismatch",
          message: `คุณไม่มีสิทธิ์เข้าถึงแอปนี้ (${currentAppId})`
        });
      }
    }

    // ขั้นตอนที่ 2: Fallback ไปตรวจสอบจาก MongoDB
    await dbConnect();
    const UserSchema = new mongoose.Schema(
      {
        name: String,
        position: String,
        department: String,
        role: String,
        phone: String,
        profileImage: String,
        profileUrl: String,
        assignedTask: String,
        clerkId: String,
        appId: { type: String, default: "" },
        isActive: { type: Boolean, default: true },
        isArchived: { type: Boolean, default: false },
        exitDate: { type: Date, default: null },
        exitNote: { type: String, default: "" },
        allowedPages: { type: [String], default: [] },
      },
      { collection: "users", timestamps: true }
    );

    const User = mongoose.models.User || mongoose.model("User", UserSchema);
    const user = await User.findOne({ clerkId: userId }).lean();

    // ถ้าไม่พบ user ใน MongoDB = ไม่มีสิทธิ์
    if (!user) {
      console.log(`❌ User ${userId} not found in MongoDB and no Clerk allowedApps`);
      return res.status(200).json({
        success: true,
        hasAccess: false,
        reason: "user_not_registered",
        message: "ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาลงทะเบียนก่อนใช้งาน"
      });
    }

    const userAppId = user.appId || "";

    // ถ้า user ยังไม่มี appId = ไม่อนุญาต
    if (!userAppId) {
      console.log(`❌ User ${user.name} has no appId assigned (MongoDB)`);
      return res.status(200).json({
        success: true,
        hasAccess: false,
        source: "mongodb",
        reason: "no_app_assigned",
        message: "บัญชีของคุณยังไม่ได้รับการกำหนด App กรุณาติดต่อผู้ดูแลระบบ"
      });
    }

    // ถ้า appId ตรงกัน = อนุญาต
    if (userAppId === currentAppId) {
      console.log(`✅ User ${user.name} has MongoDB access to ${currentAppId}`);
      return res.status(200).json({
        success: true,
        hasAccess: true,
        source: "mongodb",
        user: {
          _id: user._id,
          name: user.name,
          role: user.role,
          appId: user.appId,
          allowedPages: user.allowedPages,
          isActive: user.isActive,
        }
      });
    }

    // appId ไม่ตรง = ไม่มีสิทธิ์
    console.log(`❌ User ${user.name} appId (${userAppId}) doesn't match ${currentAppId}`);
    return res.status(200).json({
      success: true,
      hasAccess: false,
      source: "mongodb",
      reason: "app_mismatch",
      message: `คุณไม่มีสิทธิ์เข้าถึงแอปนี้ (${currentAppId})`
    });

  } catch (error) {
    console.error("❌ Error verifying app access:", error);
    return res.status(500).json({
      success: false,
      hasAccess: false,
      message: error.message
    });
  }
}

