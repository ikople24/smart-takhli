// lib/superadmin/bulkGrant.ts
// คัดกรองรายชื่อก่อนทำ bulk grant/revoke สิทธิ์หน้า (เรียกจาก POST /api/permissions/bulk-grant)
//
// กติกาสำคัญ: user ที่ allowedPages "ว่าง" ใช้ DEFAULT_PERMISSIONS[role] อยู่ —
// การ $addToSet 1 หน้าเข้าลิสต์ว่างจะ override default ทั้งชุดหายเงียบ จึงต้อง "ข้าม" เสมอ

import type { MongoUserDoc } from './usersOverview';

export interface BulkGrantPlan {
  applyIds: string[]; // แก้ได้
  skippedDefault: string[]; // ข้าม: ใช้ค่า default (ลิสต์ว่าง)
  skippedWouldEmpty: string[]; // ข้าม: revoke แล้วลิสต์จะว่าง → เด้งกลับไปใช้ default (อาจ "ได้" สิทธิ์เพิ่ม)
  crossApp: string[]; // ปฏิเสธ: ไม่ใช่ user ของแอปปัจจุบัน
  notFound: string[]; // ปฏิเสธ: หา doc ไม่เจอ
}

export function planBulkGrant(
  docs: MongoUserDoc[],
  userIds: string[],
  currentAppId: string,
  { mode = 'grant', pagePath = '' }: { mode?: 'grant' | 'revoke'; pagePath?: string } = {}
): BulkGrantPlan {
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const plan: BulkGrantPlan = {
    applyIds: [],
    skippedDefault: [],
    skippedWouldEmpty: [],
    crossApp: [],
    notFound: [],
  };

  for (const id of userIds) {
    const d = byId.get(String(id));
    if (!d) {
      plan.notFound.push(id);
    } else if ((d.appId || '') !== currentAppId) {
      plan.crossApp.push(id);
    } else if (!Array.isArray(d.allowedPages) || d.allowedPages.length === 0) {
      plan.skippedDefault.push(id);
    } else if (
      mode === 'revoke' &&
      (d.allowedPages as string[]).filter((p) => p !== pagePath).length === 0
    ) {
      plan.skippedWouldEmpty.push(id);
    } else {
      plan.applyIds.push(id);
    }
  }
  return plan;
}
