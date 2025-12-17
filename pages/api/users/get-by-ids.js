import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";

export default async function handler(req, res) {
  const { method } = req;

  await dbConnect();

  if (method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { userIds } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ success: false, error: "User IDs array is required" });
  }

  try {
    // สร้าง User model โดยตรง
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
      },
      { collection: "users", timestamps: true }
    );

    const User = mongoose.models.User || mongoose.model("User", UserSchema);
    
    // กรอง userIds ที่ไม่ถูกต้องออก
    const validUserIds = userIds.filter(id => {
      try {
        return mongoose.Types.ObjectId.isValid(id);
      } catch {
        return false;
      }
    });

    // ดึงข้อมูลผู้ใช้ทั้งหมดในครั้งเดียว
    const users = await User.find({ _id: { $in: validUserIds } }).lean();
    
    // แปลงเป็น object โดยใช้ userId เป็น key
    const usersMap = {};
    users.forEach(user => {
      usersMap[user._id.toString()] = user;
    });

    res.status(200).json({ success: true, users: usersMap });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

