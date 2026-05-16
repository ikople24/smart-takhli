import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";

/**
 * API สำหรับอัพเดท appId ของ user
 * ใช้กำหนดว่า user นี้อยู่ใน app ไหน
 */
export default async function handler(req, res) {
  const { method } = req;

  await dbConnect();

  if (method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { userId, appId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    if (!appId) {
      return res.status(400).json({
        success: false,
        message: "appId is required",
      });
    }

    // สร้าง User model
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

    const user = await User.findByIdAndUpdate(
      userId,
      { appId },
      { new: true, runValidators: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log(`✅ Updated appId for user ${user.name}: ${appId}`);

    return res.status(200).json({
      success: true,
      message: "App ID updated successfully",
      user,
    });
  } catch (e) {
    console.error("❌ Failed to update appId:", e.message);
    return res.status(500).json({
      success: false,
      message: e.message,
    });
  }
}

