import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";

export default async function handler(req, res) {
  const {
    query: { userId },
    method,
  } = req;

  await dbConnect();

  if (method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (!userId) {
    return res.status(400).json({ success: false, error: "User ID is required" });
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
    
    const user = await User.findById(userId).lean();
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
} 