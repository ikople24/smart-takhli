import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";

// API สำหรับอัปเดตหน้าที่อนุญาตให้ user เข้าถึง (เก็บใน MongoDB)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { userId, allowedPages } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "userId is required" 
      });
    }

    // เชื่อมต่อ MongoDB
    await dbConnect();

    // สร้าง User model โดยตรง (รวม allowedPages field)
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
        isActive: { type: Boolean, default: true },
        isArchived: { type: Boolean, default: false },
        exitDate: { type: Date, default: null },
        exitNote: { type: String, default: "" },
        allowedPages: { type: [String], default: [] },
      },
      { collection: "users", timestamps: true }
    );

    const User = mongoose.models.User || mongoose.model("User", UserSchema);

    // อัปเดต allowedPages ใน MongoDB โดยตรง
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { allowedPages: allowedPages || [] },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log(`✅ Updated allowed pages for user ${userId}:`, allowedPages?.length || 0, "pages");

    return res.status(200).json({ 
      success: true, 
      message: "Allowed pages updated successfully",
      user: updatedUser
    });
  } catch (e) {
    console.error("❌ Failed to update allowed pages:", e.message);
    return res.status(500).json({ 
      success: false, 
      message: e.message 
    });
  }
}
