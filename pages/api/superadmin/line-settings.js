// pages/api/superadmin/line-settings.js
// จัดการการตั้งค่า LINE OA — superadmin เท่านั้น (pattern เดียวกับ pages/api/audit)
//
//   GET  → อ่านค่าปัจจุบัน + สถานะ env (masked)
//   PUT  → บันทึก adminGroupId (ค่าว่าง = ล้าง แล้ว fallback ไป env)
//   POST → ส่งข้อความทดสอบเข้ากลุ่ม

import { getAuth, clerkClient } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import LineSettings from '@/models/LineSettings';
import { getAdminGroupId } from '@/lib/lineSettings';
import { lineNotifyAdminGroup } from '@/lib/lineMessaging';
import { logAuditEvent } from '@/lib/auditLogger';

export default async function handler(req, res) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // เฉพาะ superadmin เท่านั้น
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  if (clerkUser.publicMetadata?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden — superadmin only' });
  }

  await dbConnect();

  if (req.method === 'GET') {
    const doc = await LineSettings.findOne({ key: 'line' }).lean();
    const effectiveGroupId = await getAdminGroupId();
    return res.status(200).json({
      success: true,
      adminGroupId: doc?.adminGroupId || '',
      envGroupIdSet: Boolean(process.env.LINE_ADMIN_GROUP_ID),
      tokenSet: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      secretSet: Boolean(process.env.LINE_CHANNEL_SECRET),
      effectiveGroupId,
      updatedAt: doc?.updatedAt || null,
      updatedBy: doc?.updatedBy || '',
    });
  }

  if (req.method === 'PUT') {
    const adminGroupId = String(req.body?.adminGroupId || '').trim();

    // groupId ขึ้นต้น C, roomId ขึ้นต้น R — ค่าว่างอนุญาต (= ล้างค่า ใช้ env fallback)
    if (adminGroupId && !/^[CR][0-9a-f]{32}$/i.test(adminGroupId)) {
      return res.status(400).json({
        success: false,
        error: 'รูปแบบ Group ID ไม่ถูกต้อง — ต้องขึ้นต้นด้วย C (หรือ R) ตามด้วยตัวอักษร 32 ตัว',
      });
    }

    const doc = await LineSettings.findOneAndUpdate(
      { key: 'line' },
      { adminGroupId, updatedBy: userId, updatedAt: new Date() },
      { new: true, upsert: true }
    ).lean();

    logAuditEvent({
      actorClerkId: userId,
      actorName: 'superadmin',
      action: 'line_settings_updated',
      resourceType: 'line_settings',
      resourceId: 'line',
      description: adminGroupId
        ? `ตั้งค่า LINE Group ID เป็น ...${adminGroupId.slice(-6)}`
        : 'ล้างค่า LINE Group ID (fallback ไปใช้ env)',
    });

    return res.status(200).json({ success: true, adminGroupId: doc.adminGroupId });
  }

  if (req.method === 'POST') {
    const ok = await lineNotifyAdminGroup([
      {
        type: 'text',
        text:
          '🔔 ข้อความทดสอบจากระบบ Smart Takhli\n' +
          'ถ้าเห็นข้อความนี้ แปลว่าการแจ้งเตือนเรื่องร้องเรียนเข้ากลุ่มนี้พร้อมใช้งานแล้ว ✅',
      },
    ]);
    if (!ok) {
      return res.status(502).json({
        success: false,
        error: 'ส่งไม่สำเร็จ — ตรวจสอบว่าตั้ง Group ID แล้ว, บอทยังอยู่ในกลุ่ม และ LINE_CHANNEL_ACCESS_TOKEN ถูกต้อง',
      });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
