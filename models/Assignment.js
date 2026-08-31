import mongoose from 'mongoose';

// การมอบหมายงานเรื่องร้องเรียนให้เจ้าหน้าที่ — collection `assignments` (ชื่อเปล่าเป็นของโมดูลร้องเรียน)
// ขยายรอบ officer-task-management (2026-08-31): role / stage / SLA / ประสานหน่วยงานภายนอก / รอวัสดุ / timeline
// เอกสารเก่าไม่มีฟิลด์ใหม่ — ทุกตัวอ่านผ่าน lib/tasks/derived.js ที่รองรับค่าว่างแล้ว ไม่ต้อง migrate
//
// ⚠️ ห้ามกำหนด/ปิดงานด้วยการแก้ status ของเรื่องอย่างเดียว — ค่าที่ UI ใหม่อ่านคือ stage + completedAt ที่นี่

const FollowUpSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    /** ช่องทางที่ติดตาม */
    channel: { type: String, enum: ['phone', 'document', 'line', 'site', 'other'], default: 'phone' },
    note: { type: String, default: '' },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byName: { type: String, default: '' },
  },
  { _id: true }
);

const TimelineEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    kind: {
      type: String,
      enum: ['created', 'note', 'stage', 'coordination', 'follow_up', 'blocked', 'unblocked', 'transfer', 'closed'],
      default: 'note',
    },
    text: { type: String, default: '' },
    images: { type: [String], default: [] },
    /** stage ปลายทาง (เฉพาะ kind: 'stage') */
    stage: { type: String, default: null },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byName: { type: String, default: '' },
  },
  { _id: true }
);

const AssignmentSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** assignee = ผู้ดำเนินการ · coordinator = ผู้ประสานงาน (หน่วยงานภายนอกเป็นผู้ดำเนินการ) */
    role: { type: String, enum: ['assignee', 'coordinator'], default: 'assignee' },
    /** ขั้นของ stepper — ค่า/กฎอยู่ที่ lib/tasks/status.js */
    stage: {
      type: String,
      enum: ['received', 'site_visit', 'coordinating', 'awaiting_review', 'closed'],
      default: 'received',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    /** วันครบกำหนด (snapshot ตอนมอบหมาย = วันที่แจ้ง + SLA ของประเภท) — ว่างได้ derived.js จะคำนวณให้ */
    dueDate: { type: Date, default: null },
    /** พัก SLA อยู่ตั้งแต่เมื่อไร (รอวัสดุ/งบ) — null = ไม่ได้พัก */
    slaPausedAt: { type: Date, default: null },
    /** รวมเวลา (ms) ของช่วงพักที่จบไปแล้ว — ใช้เลื่อนวันครบกำหนด */
    slaPausedMs: { type: Number, default: 0 },
    solution: {
      type: [String],
      default: [],
    },
    solutionImages: {
      type: [String],
      default: [],
    },
    completedAt: {
      type: Date,
    },
    note: {
      type: String,
      default: '',
    },
    /** ประสานหน่วยงานภายนอก — agencyName ไม่ว่าง = "ต้องประสาน" */
    coordination: {
      /** หน่วยงานภายนอกผู้ดำเนินการ เช่น การไฟฟ้าส่วนภูมิภาค สาขาตาคลี */
      agencyName: { type: String, default: '' },
      /** กองที่เป็นผู้ประสาน (ref Organization) */
      coordinatorOrgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
      documentNo: { type: String, default: '' },
      sentAt: { type: Date, default: null },
      nextFollowUpAt: { type: Date, default: null },
      followUps: { type: [FollowUpSchema], default: [] },
    },
    /** รอวัสดุ / งบประมาณ — เปิดแล้วต้องตั้ง slaPausedAt คู่กัน */
    blocked: {
      isBlocked: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      itemName: { type: String, default: '' },
      purchaseRefNo: { type: String, default: '' },
      expectedAt: { type: Date, default: null },
      since: { type: Date, default: null },
    },
    /** ไทม์ไลน์การดำเนินงาน (หน้าจอ 3) — ล่าสุดอยู่ท้าย array */
    timeline: { type: [TimelineEntrySchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);
