// models/flood-relief/FloodSettings.js
// ค่าตั้งศูนย์ฯ — singleton doc (key: 'default') collection flood_settings
// อ่านแล้ว normalize ผ่าน lib/flood-relief/settings.ts เสมอ · ไม่มีเอกสาร = DEFAULT_FLOOD_SETTINGS (ศูนย์ฯ ปิด)
import mongoose from "mongoose";

const FloodSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    centerOpen: { type: Boolean, default: false },
    hotline: { type: String, default: "056-261-500" },
    callbackSlaMin: { type: Number, default: 15 },
    announcement: { type: String, default: "" },
    // ระดับสถานการณ์บนบล็อกหน้าแรก: auto = ตามโซนสี · normal|watch|danger|critical = ประกาศทับ
    situationOverride: { type: String, default: "auto" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "flood_settings" }
);

export default mongoose.models.FloodSettings || mongoose.model("FloodSettings", FloodSettingsSchema, "flood_settings");
