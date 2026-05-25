import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import Assignment from '@/models/Assignment';
import Complaint from '@/models/Complaint';
import Satisfaction from '@/models/Satisfaction';
import ElderlyVisit from '@/models/ElderlyVisit';
import ElderlyPerson from '@/models/ElderlyPerson';

interface Task {
  _id: string;
  title: string;
  description?: string;
  type: 'complaint' | 'feedback' | 'elderly_visit';
  status: 'pending' | 'overdue' | 'in_progress';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedAt: Date;
  dueDate?: Date;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const tasks: Task[] = [];

    // Fetch pending complaint assignments
    const pendingAssignments = await Assignment.find({
      userId,
      completedAt: { $exists: false },
    })
      .populate({
        path: 'complaintId',
        model: 'SubmittedReport',
        select: 'fullName detail category location assignedAt',
      })
      .lean();

    // Process complaint assignments
    for (const assignment of pendingAssignments) {
      const complaint = assignment.complaintId;
      if (complaint) {
        const daysAssigned = Math.floor(
          (Date.now() - new Date(assignment.assignedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        const isOverdue = daysAssigned > 7; // 7 day threshold

        tasks.push({
          _id: assignment._id,
          title: `ร้องเรียนจาก ${complaint.fullName}`,
          description: complaint.detail?.substring(0, 100),
          type: 'complaint',
          status: isOverdue ? 'overdue' : 'pending',
          priority: isOverdue ? 'high' : 'medium',
          assignedAt: assignment.assignedAt,
          dueDate: new Date(new Date(assignment.assignedAt).getTime() + 7 * 24 * 60 * 60 * 1000),
          actionUrl: `/admin/manage-complaints?complaintId=${complaint._id}`,
          metadata: {
            complaintId: complaint._id,
          },
        });
      }
    }

    // Fetch unresolved satisfaction feedback
    const unresolvedComplaints = await Complaint.find({
      officer: userId,
      status: { $in: ['รอการตรวจสอบ', 'กำลังดำเนิน', 'รอการอนุมัติ'] },
    }).select('_id');

    const unresolvedFeedback = await Satisfaction.find({
      complaintId: { $in: unresolvedComplaints },
    })
      .populate({
        path: 'complaintId',
        model: 'SubmittedReport',
        select: 'fullName',
      })
      .lean();

    // Add feedback tasks
    for (const feedback of unresolvedFeedback) {
      const complaint = feedback.complaintId;
      tasks.push({
        _id: `feedback-${feedback._id}`,
        title: `ตอบกลับความเห็นจาก ${complaint?.fullName || 'ผู้ใช้'}`,
        description: 'มีการประเมินความพึงพอใจที่รอการตอบกลับ',
        type: 'feedback',
        status: 'pending',
        priority: 'low',
        assignedAt: feedback.createdAt,
        actionUrl: `/admin/feedback-analysis`,
        metadata: {
          complaintId: complaint?._id,
        },
      });
    }

    // Fetch pending elderly visits (optional - if user manages elderly health)
    const elderlyPersons = await ElderlyPerson.find({ assignedOfficer: userId }).select('_id');

    if (elderlyPersons.length > 0) {
      const currentYear = new Date().getFullYear();
      const currentYearBE = currentYear + 543;

      const pendingVisits = await ElderlyVisit.find({
        personId: { $in: elderlyPersons },
        yearBE: currentYearBE,
        measuredAt: { $exists: false },
      })
        .populate({
          path: 'personId',
          model: 'ElderlyPerson',
          select: 'fullName',
        })
        .lean();

      // Add elderly visit tasks
      for (const visit of pendingVisits) {
        const person = visit.personId;
        tasks.push({
          _id: `elderly-${visit._id}`,
          title: `เยี่ยมผู้สูงอายุ - ${person?.fullName || 'ผู้ป่วย'}`,
          description: `ต้องทำการวัดสุขภาพครั้งที่ ${visit.visitNo}`,
          type: 'elderly_visit',
          status: 'pending',
          priority: 'medium',
          assignedAt: new Date(), // Use current date
          actionUrl: `/admin/elderly-cards`,
          metadata: {
            personName: person?.fullName,
            visitNo: visit.visitNo,
          },
        });
      }
    }

    // Sort by priority and due date
    tasks.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const statusOrder = { overdue: 0, in_progress: 1, pending: 2 };

      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }

      return new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime();
    });

    res.status(200).json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error('Error fetching pending tasks:', error);
    res.status(500).json({ error: 'Failed to fetch pending tasks' });
  }
}
