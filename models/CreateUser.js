import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    position: String,
    department: String,
    role: String,
    phone: String,
    profileImage: String,
    assignedTask: String,
    clerkId: String,
    appId: { type: String, default: "" }, // ระบุว่า user นี้อยู่ใน app ไหน (เช่น "smart-takhli", "app_b")
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    exitDate: { type: Date, default: null },
    exitNote: { type: String, default: "" },
    allowedPages: { type: [String], default: [] }, // หน้าที่อนุญาตให้เข้าถึง
    /** หัวหน้ากอง — มอบหมาย/โอนงานในกองได้ (โมดูล tasks: lib/tasks/roles.js) · ไม่ตั้ง = ดูจากตำแหน่ง (ผู้อำนวยการ/หัวหน้า/ผอ./ปลัด)
     *  ⚠️ inline User schema ที่ต้องเห็นฟิลด์นี้: pages/api/users/get-all-user.js, pages/api/tasks/_auth.ts (strict:false) */
    isDepartmentHead: { type: Boolean, default: undefined },
  },
  { collection: "users", timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

export async function createUser(data) {
  const user = new User(data);
  return await user.save();
}
