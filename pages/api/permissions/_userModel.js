// pages/api/permissions/_userModel.js
// Inline User model ใช้ร่วมของ API โฟลเดอร์นี้ (strict:false — อ่านด้วย .lean() เสมอ)
// หมายเหตุ: mongoose.models.User เป็น first-registration-wins ต่อ process — ดู CLAUDE.md เรื่อง schema drift
import mongoose from "mongoose";

const User =
  mongoose.models.User ||
  mongoose.model("User", new mongoose.Schema({}, { collection: "users", strict: false }));

export default User;
