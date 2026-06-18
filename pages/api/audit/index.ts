// GET /api/audit?page=1&limit=50&action=&resourceType=
// ดึง audit logs สำหรับ superadmin เท่านั้น

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import AuditLog from '@/models/AuditLog';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // เฉพาะ superadmin เท่านั้น
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const role = clerkUser.publicMetadata?.role as string;
  if (role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden — superadmin only' });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const skip = (page - 1) * limit;

  // Filters
  const filter: Record<string, string | RegExp> = {};
  if (req.query.action) filter.action = req.query.action as string;
  if (req.query.resourceType) filter.resourceType = req.query.resourceType as string;
  if (req.query.actor) {
    filter.actorName = new RegExp(req.query.actor as string, 'i');
  }

  try {
    await dbConnect();

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}
