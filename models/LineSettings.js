// models/LineSettings.js
// การตั้งค่า LINE OA — singleton doc (key: 'line')
// adminGroupId ตั้งผ่านหน้า /admin/superadmin/line-settings
// ถ้าไม่ตั้ง ระบบ fallback ไปใช้ env LINE_ADMIN_GROUP_ID (ดู lib/lineSettings.js)

import mongoose from 'mongoose';

const LineSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'line', unique: true },
    // groupId ของกลุ่มเจ้าหน้าที่ (ขึ้นต้น C... / รองรับ roomId R... ด้วย)
    adminGroupId: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'line_settings' }
);

export default mongoose.models.LineSettings ||
  mongoose.model('LineSettings', LineSettingsSchema);
