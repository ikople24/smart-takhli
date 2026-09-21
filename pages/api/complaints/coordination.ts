// pages/api/complaints/coordination.ts
// POST — จัดการการประสานหน่วยงานภายนอกของ assignment หนึ่งรายการ (README § Data/API "POST /api/complaints/coordination")
//   action: 'set'         { agencyName, documentNo?, sentAt?, nextFollowUpAt?, coordinatorOrgId? } สร้าง/แก้ข้อมูลการประสาน
//   action: 'follow_up'   { channel: phone|document|line|site|other, note?, nextFollowUpAt? } บันทึกการติดตาม
//                          (ไม่ส่ง nextFollowUpAt → ระบบตั้งให้ = วันนี้ + followUpEveryDays)
//   action: 'notify_line' ส่งข้อความสรุปเข้า LINE กลุ่มเจ้าหน้าที่ (⚠️ นับโควตา LINE ตามจำนวนสมาชิกกลุ่ม)
// สิทธิ์: เจ้าของงาน หรือ superadmin
import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import Assignment from '@/models/Assignment';
import '@/models/Complaint';
import { logAuditEvent } from '@/lib/auditLogger';
import { lineNotifyAdminGroup } from '@/lib/lineMessaging';
import { getTaskSettings } from '@/lib/tasks/loadSettings';
import { deriveAssignment } from '@/lib/tasks/derived';
import { toDate, formatThaiDate, summarizeText, DAY_MS } from '@/lib/tasks/format';
import { getOfficer } from '@/pages/api/tasks/_auth';

const CHANNELS = ['phone', 'document', 'line', 'site', 'other'] as const;
type Channel = (typeof CHANNELS)[number];
const CHANNEL_LABEL: Record<Channel, string> = {
  phone: 'โทรศัพท์',
  document: 'หนังสือราชการ',
  line: 'LINE',
  site: 'ลงพื้นที่',
  other: 'ช่องทางอื่น',
};

const str = (v: unknown) => String(v ?? '').trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const auth = await getOfficer(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });
  const { officer } = auth;

  const body = req.body ?? {};
  const { assignmentId } = body;
  const action = str(body.action);
  if (!mongoose.isValidObjectId(assignmentId)) return res.status(400).json({ success: false, error: 'ข้อมูลไม่ถูกต้อง' });
  if (!['set', 'follow_up', 'notify_line'].includes(action)) {
    return res.status(400).json({ success: false, error: 'action ไม่ถูกต้อง' });
  }

  try {
    const assignment = await Assignment.findById(assignmentId).populate({
      path: 'complaintId',
      model: 'SubmittedReport',
      select: 'complaintId detail category community createdAt status',
    });
    if (!assignment) return res.status(404).json({ success: false, error: 'ไม่พบงานนี้' });
    if (assignment.completedAt) return res.status(400).json({ success: false, error: 'งานนี้ปิดแล้ว' });
    const isOwner = String(assignment.userId) === String(officer._id);
    if (!isOwner && !auth.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'จัดการได้เฉพาะงานของตัวเอง' });
    }

    const now = new Date();
    const byName = officer.name || '';
    const complaint = assignment.complaintId as unknown as {
      _id: mongoose.Types.ObjectId;
      complaintId?: string;
      detail?: string;
      category?: string;
      community?: string;
    } | null;

    if (action === 'set') {
      const agencyName = str(body.agencyName);
      if (!agencyName) return res.status(400).json({ success: false, error: 'กรุณาระบุหน่วยงานผู้ดำเนินการ' });
      const coordinatorOrgId = body.coordinatorOrgId && mongoose.isValidObjectId(body.coordinatorOrgId) ? body.coordinatorOrgId : null;
      assignment.coordination.agencyName = agencyName;
      assignment.coordination.documentNo = str(body.documentNo);
      assignment.coordination.sentAt = toDate(body.sentAt);
      assignment.coordination.nextFollowUpAt = toDate(body.nextFollowUpAt);
      if (coordinatorOrgId) assignment.coordination.coordinatorOrgId = coordinatorOrgId;
      assignment.timeline.push({
        at: now,
        kind: 'coordination',
        text: `ประสาน ${agencyName}${assignment.coordination.documentNo ? ` — หนังสือเลขที่ ${assignment.coordination.documentNo}` : ''}`,
        byUserId: officer._id,
        byName,
      });
      await assignment.save();
      return res.status(200).json({ success: true, coordination: assignment.coordination });
    }

    const agency = str(assignment.coordination?.agencyName);
    if (!agency) return res.status(400).json({ success: false, error: 'งานนี้ยังไม่มีการประสานหน่วยงานภายนอก' });

    if (action === 'follow_up') {
      const channel: Channel = (CHANNELS as readonly string[]).includes(body.channel) ? body.channel : 'phone';
      const note = str(body.note);
      const settings = await getTaskSettings();
      const next = toDate(body.nextFollowUpAt) ?? new Date(now.getTime() + settings.followUpEveryDays * DAY_MS);
      assignment.coordination.followUps.push({ at: now, channel, note, byUserId: officer._id, byName });
      assignment.coordination.nextFollowUpAt = next;
      assignment.timeline.push({
        at: now,
        kind: 'follow_up',
        text: `ติดตาม ${agency} ทาง${CHANNEL_LABEL[channel]}${note ? ` — ${note}` : ''} · ติดตามครั้งถัดไป ${formatThaiDate(next)}`,
        byUserId: officer._id,
        byName,
      });
      await assignment.save();
      logAuditEvent({
        actorClerkId: auth.clerkUserId,
        actorName: byName || 'admin',
        action: 'assignment_follow_up',
        resourceType: 'assignment',
        resourceId: String(assignment._id),
        description: `บันทึกการติดตาม ${agency} (${CHANNEL_LABEL[channel]})${note ? `: ${note}` : ''}`,
        meta: { complaintId: String(assignment.complaintId?._id ?? assignment.complaintId) },
      });
      return res.status(200).json({
        success: true,
        coordination: assignment.coordination,
        followUpCount: assignment.coordination.followUps.length,
        nextFollowUpAt: next.toISOString(),
      });
    }

    // notify_line
    const settings = await getTaskSettings();
    const derived = deriveAssignment({ assignment: assignment.toObject(), complaint: complaint ?? {}, settings, now });
    const code = complaint?.complaintId || String(complaint?._id ?? '').slice(-8);
    const title = summarizeText(complaint?.detail, 80) || complaint?.category || '(ไม่ระบุรายละเอียด)';
    const lines = [
      `📣 ติดตามการประสานหน่วยงานภายนอก`,
      `เรื่อง ${code} — ${title}`,
      complaint?.community ? `ชุมชน: ${complaint.community}` : null,
      `หน่วยงานผู้ดำเนินการ: ${agency}`,
      assignment.coordination.documentNo ? `หนังสือเลขที่: ${assignment.coordination.documentNo}` : null,
      derived.coordinationWaitDays !== null ? `รอตอบกลับมาแล้ว ${derived.coordinationWaitDays} วัน` : null,
      assignment.coordination.nextFollowUpAt ? `ติดตามครั้งถัดไป: ${formatThaiDate(assignment.coordination.nextFollowUpAt)}` : null,
      `ผู้ประสาน: ${byName || 'เจ้าหน้าที่'}${officer.department ? ` (${officer.department})` : ''}`,
    ].filter(Boolean) as string[];

    const sent = await lineNotifyAdminGroup([{ type: 'text', text: lines.join('\n') }]);
    if (!sent) {
      return res.status(502).json({ success: false, error: 'ส่ง LINE ไม่สำเร็จ — ยังไม่ตั้ง groupId หรือโควตาข้อความเต็ม' });
    }
    assignment.timeline.push({ at: now, kind: 'coordination', text: `แจ้ง LINE กลุ่มเจ้าหน้าที่เรื่องการประสาน ${agency}`, byUserId: officer._id, byName });
    await assignment.save();
    logAuditEvent({
      actorClerkId: auth.clerkUserId,
      actorName: byName || 'admin',
      action: 'notification_sent',
      resourceType: 'assignment',
      resourceId: String(assignment._id),
      description: `แจ้ง LINE กลุ่มเจ้าหน้าที่ — ติดตามการประสาน ${agency} (เรื่อง ${code})`,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[tasks] coordination failed:', err);
    return res.status(500).json({ success: false, error: 'บันทึกไม่สำเร็จ' });
  }
}
