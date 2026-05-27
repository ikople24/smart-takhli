// models/AuditLog.js
// เก็บ event log ทุกครั้งที่มีการเปลี่ยนแปลงข้อมูลสำคัญ
// ใช้สำหรับ Advanced permissions & audit logging (Phase 2)

import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  /** Clerk userId ของผู้กระทำ */
  actorClerkId: { type: String, required: true, index: true },
  actorName: { type: String, default: '' },

  /** ประเภทของ event */
  action: {
    type: String,
    required: true,
    enum: [
      // Complaint
      'complaint_status_changed',
      'complaint_assigned',
      'complaint_reassigned',
      'complaint_completed',
      // Permissions
      'permissions_updated',
      'app_id_assigned',
      // Assignment
      'assignment_created',
      'assignment_completed',
      // Notification
      'notification_sent',
      // General
      'data_exported',
      'login',
    ],
    index: true,
  },

  /** resource ที่ถูกกระทำ */
  resourceType: {
    type: String,
    enum: ['complaint', 'assignment', 'user', 'notification', 'system'],
    required: true,
  },
  resourceId: { type: String, default: '' },

  /** ข้อมูลก่อนและหลังการเปลี่ยนแปลง (optional) */
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },

  /** ข้อความอธิบายกิจกรรม */
  description: { type: String, required: true },

  /** metadata เพิ่มเติม เช่น IP, userAgent */
  meta: { type: mongoose.Schema.Types.Mixed },

  createdAt: { type: Date, default: Date.now, index: true },
});

// TTL: ลบ log อัตโนมัติหลัง 2 ปี (optional — uncomment เพื่อเปิดใช้)
// AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
