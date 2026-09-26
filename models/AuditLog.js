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
      'permissions_bulk_updated',
      'app_id_assigned',
      // User repair (หน้า superadmin)
      'user_repaired',
      'user_doc_deleted',
      // Assignment
      'assignment_created',
      'assignment_completed',
      // Notification
      'notification_sent',
      // Smart Waste
      'waste_daily_updated',
      // Garbage schedule
      'garbage_assignment_created',
      'garbage_assignment_updated',
      'garbage_assignment_deleted',
      'garbage_route_updated',
      'garbage_schedule_imported',
      'garbage_communities_mapped',
      // Officer tasks
      'task_settings_updated',
      'assignment_follow_up',
      'assignment_unclaimed',
      'complaint_department_set',
      'assignment_transfer_requested',
      'department_head_set',
      'complaint_deleted',
      // Flood relief
      'flood_settings_updated',
      'flood_zone_changed',
      // General
      'data_exported',
      'login',
    ],
    index: true,
  },

  /** resource ที่ถูกกระทำ */
  resourceType: {
    type: String,
    enum: ['complaint', 'assignment', 'user', 'notification', 'system', 'garbage_assignment', 'garbage_route'],
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
