import dbConnect from '@/lib/dbConnect';
import Assignment from '@/models/Assignment';
import Complaint from '@/models/Complaint';
import mongoose from 'mongoose';
import { logAuditEvent } from '@/lib/auditLogger';
import { getAuth } from '@clerk/nextjs/server';
import { getTaskSettings } from '@/lib/tasks/loadSettings';
import { dueDateFor } from '@/lib/tasks/derived';

// POST /api/complaints/assignments/create
// body: { complaintId, userId, officerName?, role?: 'assignee' | 'coordinator', ... }
// ตั้งแต่รอบ officer-task-management: บันทึก dueDate (วันที่แจ้ง + SLA ของประเภทจาก task_settings),
// stage เริ่มที่ 'received' และเปิดไทม์ไลน์ด้วยรายการ 'created'
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const { complaintId, userId, solutionDetails, solutionImages, completedAt, remarks, officerName, role } = req.body;
    const { userId: actorClerkId } = getAuth(req);

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
      Complaint.findById(complaintId).select('createdAt category').lean(),
      getTaskSettings(),
    ]);
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
    if (actorClerkId) {
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
