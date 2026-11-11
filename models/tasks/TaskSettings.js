// models/tasks/TaskSettings.js
// การตั้งค่า SLA/เกณฑ์เตือนของงานเจ้าหน้าที่ — singleton doc (key: 'default') collection `task_settings`
// อ่าน/เขียนผ่าน lib/tasks/loadSettings.js เท่านั้น (ค่าถูก normalize ด้วย lib/tasks/settings.js ก่อนใช้เสมอ)
// ไม่มีเอกสาร = ใช้ DEFAULT_TASK_SETTINGS (งานทั่วไป 3 วัน, รับภายใน 24 ชม. ฯลฯ) — ระบบทำงานได้โดยไม่ต้อง seed
import mongoose from 'mongoose';

const SlaByCategorySchema = new mongoose.Schema(
  {
    /** ชื่อประเภทเรื่อง = Complaint.category (ตรงกับ MenuMain.Prob_name) */
    category: { type: String, required: true },
    slaDays: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const SlaByWorkTypeSchema = new mongoose.Schema(
  {
    /** key ในทะเบียนชนิดงาน lib/tasks/workTypes.js (เช่น road_patch, tree) */
    workType: { type: String, required: true },
    slaDays: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const HolidaySchema = new mongoose.Schema(
  {
    /** 'YYYY-MM-DD' วันที่ไทย — ไม่นับเป็นวันทำการของกำหนดปิดเรื่อง (lib/tasks/businessDays.js) */
    date: { type: String, required: true },
    name: { type: String, default: '' },
  },
  { _id: false }
);

const GrassScheduleSchema = new mongoose.Schema(
  {
    /** https url ของไฟล์ตารางคิวตัดหญ้า (Cloudinary รูป/PDF) — '' = ยังไม่มี (lib/tasks/grassSchedule.js) */
    url: { type: String, default: '' },
    fileName: { type: String, default: '' },
    /** ประทับฝั่ง server ตอนอัปโหลด/ลบ */
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const TaskSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    defaultSlaDays: { type: Number, default: 3 },
    warnBeforeDays: { type: Number, default: 2 },
    unclaimedWarnDays: { type: Number, default: 3 },
    unclaimedAlertDays: { type: Number, default: 4 }, // เลิกใช้ — แทนด้วย unclaimedAlertHours
    unclaimedWarnHours: { type: Number, default: 12 },
    unclaimedAlertHours: { type: Number, default: 24 },
    followUpEveryDays: { type: Number, default: 7 },
    slaByCategory: { type: [SlaByCategorySchema], default: [] },
    slaByWorkType: { type: [SlaByWorkTypeSchema], default: [] },
    holidays: { type: [HolidaySchema], default: [] },
    grassSchedule: { type: GrassScheduleSchema, default: () => ({}) },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true, collection: 'task_settings' }
);

export default mongoose.models.TaskSettings || mongoose.model('TaskSettings', TaskSettingsSchema, 'task_settings');
