import dbConnect from '@/lib/dbConnect';
import Assignment from '@/models/Assignment';
import Complaint from '@/models/Complaint';
import mongoose from 'mongoose';
import { logAuditEvent } from '@/lib/auditLogger';
import { getTaskSettings } from '@/lib/tasks/loadSettings';
import { dueDateFor } from '@/lib/tasks/derived';
import { departmentAfterClaim, taskPermissions } from '@/lib/tasks/roles';
import { normalizeDepartment, defaultDepartmentForCategory } from '@/lib/tasks/departments';
import { getOfficer, userModel } from '@/pages/api/tasks/_auth';

// POST /api/complaints/assignments/create
// body: { complaintId, userId, officerName?, role?: 'assignee' | 'coordinator', ... }
// ตั้งแต่รอบ officer-task-management: บันทึก dueDate (วันที่แจ้ง + SLA ของประเภทจาก task_settings),
// stage เริ่มที่ 'received' และเปิดไทม์ไลน์ด้วยรายการ 'created'
// กติกา (lib/tasks/roles.js — บังคับที่นี่ให้ครอบทุก UI ทั้งกองงานรอรับและหน้าการร้องเรียน):
//   รับเอง (userId = ตัวเอง) → ได้ทุกเรื่องทุกกอง (2026-11-09 — เดิมจำกัดกองเดียวกัน แต่ระบบเดากองผิดบ่อยจนงานค้าง)
//   · มอบหมายให้คนอื่น → หัวหน้ากอง/superadmin เท่านั้น
//   · ผู้รับ (assignee) อยู่กองอื่น → ย้าย complaint.department เข้ากองผู้รับ (departmentAfterClaim) + ลงประวัติ
//   · รับผิด → เจ้าของงาน "ขอโอนงาน" แจ้ง superadmin + หัวหน้ากอง (transfer-request.ts)
//   เรื่องที่มีผู้รับผิดชอบอยู่แล้ว (assignment เปิดค้าง) → 409 กันกดรับพร้อมกัน
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    // completedAt เลิกรับจาก client (2026-09-11) — flow เก่าเคยส่งเป็น date-only ทำให้เวลาเสร็จ
    // กลายเป็นเที่ยงคืน UTC (07:00 ไทย) บางเรื่องถึงขั้น "เสร็จก่อนรับงาน"; ปิดเรื่องต้องผ่าน
    // PATCH /api/tasks/[assignmentId] หรือ update-status เท่านั้น ซึ่งใช้เวลาจริงฝั่ง server
    const { complaintId, userId, solutionDetails, solutionImages, remarks, officerName, role } = req.body;

    // ต้องล็อกอิน (เดิมไม่บังคับ — ปิดช่องโหว่ 2026-09-02) + ใช้ตัวตนจริงตัดสินสิทธิ์
    const auth = await getOfficer(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
    const { officer, isSuperAdmin } = auth;
    const actorClerkId = auth.clerkUserId;

    if (!complaintId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!mongoose.isValidObjectId(complaintId) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const assignmentRole = role === 'coordinator' ? 'coordinator' : 'assignee';

    // วันครบกำหนด: นับจากวันที่ประชาชนแจ้ง (คำมั่นต่อประชาชน) — ไม่พบเรื่องก็ยังสร้างได้ (พฤติกรรมเดิม)
    // แล้ว derived.js จะถอยไปใช้ assignedAt + SLA ให้เอง
    const [complaint, settings] = await Promise.all([
      Complaint.findById(complaintId).select('createdAt category department').lean(),
      getTaskSettings(),
    ]);

    // กันรับซ้ำ: เรื่องนี้มี assignment ที่ยังเปิดอยู่แล้ว → 409 (กดรับพร้อมกัน / รับจากสองหน้า)
    const existing = await Assignment.findOne({ complaintId, completedAt: null }).select('_id userId').lean();
    if (existing) {
      return res.status(409).json({ error: 'เรื่องนี้มีผู้รับผิดชอบอยู่แล้ว — รีเฟรชหน้าเพื่ออัปเดตรายการ' });
    }

    // กติกามอบหมาย — รับเองได้ทุกเรื่อง
    const taskDepartment = normalizeDepartment(complaint?.department) ?? defaultDepartmentForCategory(complaint?.category);
    const selfClaim = String(userId) === String(officer._id);
    if (!selfClaim && !taskPermissions({ isSuperAdmin, user: officer }).canAssign) {
      return res.status(403).json({ error: 'มอบหมายงานให้คนอื่นได้เฉพาะหัวหน้ากอง/superadmin' });
    }

    // กองของเรื่องย้ายตามผู้รับ (เฉพาะผู้รับผิดชอบหลัก — ผู้ประสานงานไม่ย้ายกอง)
    let movedTo = null;
    if (complaint && assignmentRole === 'assignee') {
      const assignee = selfClaim ? officer : await userModel().findById(userId).select('department').lean();
      movedTo = departmentAfterClaim({ claimerDepartment: assignee?.department, taskDepartment });
    }
    const now = new Date();
    const { dueDate } = dueDateFor({
      complaintCreatedAt: complaint?.createdAt,
      assignedAt: now,
      category: complaint?.category,
      settings,
    });

    const newAssignment = await Assignment.create({
      complaintId: new mongoose.Types.ObjectId(complaintId),
      userId: new mongoose.Types.ObjectId(userId),
      role: assignmentRole,
      stage: 'received',
      assignedAt: now,
      dueDate,
      solutionDetails,
      solutionImages,
      remarks,
      timeline: [
        {
          at: now,
          kind: 'created',
          text: assignmentRole === 'coordinator' ? 'รับเป็นผู้ประสานงาน' : 'มอบหมายงานให้เจ้าหน้าที่',
          byUserId: new mongoose.Types.ObjectId(userId),
          byName: officerName || '',
        },
        ...(movedTo
          ? [{ at: now, kind: 'note', text: `ย้ายเรื่องเข้า${movedTo} (เดิม ${taskDepartment || 'ยังไม่ระบุกอง'})`, byUserId: officer._id, byName: officer.name || officerName || '' }]
          : []),
      ],
    });

    if (movedTo) {
      await Complaint.updateOne({ _id: complaintId }, { $set: { department: movedTo } });
      logAuditEvent({
        actorClerkId,
        actorName: officer.name || officerName || 'admin',
        action: 'complaint_department_set',
        resourceType: 'complaint',
        resourceId: String(complaintId),
        description: `รับงานข้ามกอง — ย้ายเรื่อง ${String(complaintId).slice(-8)}: "${taskDepartment || '-'}" → "${movedTo}"`,
        before: { department: complaint?.department ?? '' },
        after: { department: movedTo },
      });
    }

    // Audit log (fire-and-forget)
    {
      logAuditEvent({
        actorClerkId,
        actorName: officerName || 'admin',
        action: 'assignment_created',
        resourceType: 'assignment',
        resourceId: String(newAssignment._id),
        description: `มอบหมายงานเรื่องร้องเรียน ${String(complaintId).slice(-8)} ให้ ${officerName || userId}${
          assignmentRole === 'coordinator' ? ' (ผู้ประสานงาน)' : ''
        }`,
      });
    }

    // movedFrom = complaint.department เดิม (ดิบ) — ให้ปุ่ม "เลิกทำ" คืนกองเดิมผ่าน set-department ได้
    res.status(201).json({
      message: 'Assignment created successfully',
      assignment: newAssignment,
      ...(movedTo ? { movedTo, movedFrom: complaint?.department ?? '' } : {}),
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
