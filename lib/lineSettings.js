// lib/lineSettings.js
// อ่านค่า LINE Group ID ของกลุ่มเจ้าหน้าที่
// ลำดับความสำคัญ: Mongo (ตั้งผ่านหน้า superadmin) → env LINE_ADMIN_GROUP_ID

import dbConnect from './dbConnect';
import LineSettings from '@/models/LineSettings';

export async function getAdminGroupId() {
  try {
    await dbConnect();
    const doc = await LineSettings.findOne({ key: 'line' }).lean();
    if (doc?.adminGroupId) return doc.adminGroupId;
  } catch (err) {
    console.error('[LINE] read line_settings failed:', err);
  }
  return process.env.LINE_ADMIN_GROUP_ID || '';
}
