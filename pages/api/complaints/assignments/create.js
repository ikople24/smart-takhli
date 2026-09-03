import dbConnect from '@/lib/dbConnect';
import Assignment from '@/models/Assignment';
import Complaint from '@/models/Complaint';
import mongoose from 'mongoose';
import { logAuditEvent } from '@/lib/auditLogger';
import { getTaskSettings } from '@/lib/tasks/loadSettings';
import { dueDateFor } from '@/lib/tasks/derived';
import { canClaim, taskPermissions } from '@/lib/tasks/roles';
import { normalizeDepartment, defaultDepartmentForCategory } from '@/lib/tasks/departments';
import { getOfficer } from '@/pages/api/tasks/_auth';

// POST /api/complaints/assignments/create
// body: { complaintId, userId, officerName?, role?: 'assignee' | 'coordinator', ... }
// ตั้งแต่รอบ officer-task-management: บันทึก dueDate (วันที่แจ้ง + SLA ของประเภทจาก task_settings),
// stage เริ่มที่ 'received' และเปิดไทม์ไลน์ด้วยรายการ 'created'
// กติกา (2026-09-02, lib/tasks/roles.js — บังคับที่นี่ให้ครอบทุก UI ทั้งกองงานรอรับและหน้าการร้องเรียน):
//   รับเอง (userId = ตัวเอง) → เรื่องต้องอยู่กองเดียวกัน (canClaim) · มอบหมายให้คนอื่น → หัวหน้ากอง/superadmin เท่านั้น
//   เรื่องที่มีผู้รับผิดชอบอยู่แล้ว (assignment เปิดค้าง) → 409 กันกดรับพร้อมกัน
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const { complaintId, userId, solutionDetails, solutionImages, completedAt, remarks, officerName, role } = req.body;

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

    // กติกากอง/มอบหมาย
    const taskDepartment = normalizeDepartment(complaint?.department) ?? defaultDepartmentForCategory(complaint?.category);
    const selfClaim = String(userId) === String(officer._id);
    if (selfClaim) {
      if (!canClaim({ isSuperAdmin, user: officer, taskDepartment })) {
        return res.status(403).json({
          error: `เรื่องนี้อยู่ในความรับผิดชอบของ${taskDepartment} — รับได้เฉพาะเจ้าหน้าที่กองนั้น หรือให้หัวหน้ากองมอบหมาย`,
        });
      }
    } else if (!taskPermissions({ isSuperAdmin, user: officer }).canAssign) {
      return res.status(403).json({ error: 'มอบหมายงานให้คนอื่นได้เฉพาะหัวหน้ากอง/superadmin' });
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
      completedAt,
      remarks,
      timeline: [
        {
          at: now,
          kind: 'created',
          text: assignmentRole === 'coordinator' ? 'รับเป็นผู้ประสานงาน' : 'มอบหมายงานให้เจ้าหน้าที่',
          byUserId: new mongoose.Types.ObjectId(userId),
          byName: officerName || '',
        },
      ],
    });

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

    res.status(201).json({ message: 'Assignment created successfully', assignment: newAssignment });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
