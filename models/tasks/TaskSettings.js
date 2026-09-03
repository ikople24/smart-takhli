// models/tasks/TaskSettings.js
// การตั้งค่า SLA/เกณฑ์เตือนของงานเจ้าหน้าที่ — singleton doc (key: 'default') collection `task_settings`
// อ่าน/เขียนผ่าน lib/tasks/loadSettings.js เท่านั้น (ค่าถูก normalize ด้วย lib/tasks/settings.js ก่อนใช้เสมอ)
// ไม่มีเอกสาร = ใช้ DEFAULT_TASK_SETTINGS (SLA 7 วัน ฯลฯ) — ระบบทำงานได้โดยไม่ต้อง seed
import mongoose from 'mongoose';

const SlaByCategorySchema = new mongoose.Schema(
  {
    /** ชื่อประเภทเรื่อง = Complaint.category (ตรงกับ MenuMain.Prob_name) */
    category: { type: String, required: true },
    slaDays: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const TaskSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    defaultSlaDays: { type: Number, default: 7 },
    warnBeforeDays: { type: Number, default: 2 },
    unclaimedWarnDays: { type: Number, default: 3 },
    unclaimedAlertDays: { type: Number, default: 4 },
    followUpEveryDays: { type: Number, default: 7 },
    slaByCategory: { type: [SlaByCategorySchema], default: [] },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true, collection: 'task_settings' }
);

export default mongoose.models.TaskSettings || mongoose.model('TaskSettings', TaskSettingsSchema, 'task_settings');
