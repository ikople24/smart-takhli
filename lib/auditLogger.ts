// lib/auditLogger.ts
// Utility สำหรับบันทึก audit log จากภายใน API handlers
// import และเรียกใช้จาก API ที่ต้องการ track การเปลี่ยนแปลง

import dbConnect from '@/lib/dbConnect';
import AuditLog from '@/models/AuditLog';

type AuditAction =
  | 'complaint_status_changed'
  | 'complaint_assigned'
  | 'complaint_reassigned'
  | 'complaint_completed'
  | 'permissions_updated'
  | 'app_id_assigned'
  | 'assignment_created'
  | 'assignment_completed'
  | 'notification_sent'
  | 'data_exported'
  | 'login';

type ResourceType = 'complaint' | 'assignment' | 'user' | 'notification' | 'system';

interface AuditParams {
  actorClerkId: string;
  actorName?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  description: string;
  meta?: Record<string, unknown>;
}

/**
 * บันทึก audit event ลง MongoDB
 * — ควรเรียกหลังจาก operation สำเร็จเท่านั้น
 * — ถ้าเกิด error ใน audit log จะไม่โยน exception กลับ (fire-and-forget)
 */
export async function logAuditEvent(params: AuditParams): Promise<void> {
  try {
    await dbConnect();
    await AuditLog.create(params);
  } catch (err) {
    // ไม่ interrupt flow หลัก — แค่ log ลง console
    console.error('[AuditLogger] Failed to write audit log:', err);
  }
}
