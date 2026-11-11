// lib/tasks/loadSettings.js
// อ่าน/บันทึกการตั้งค่างานเจ้าหน้าที่จาก Mongo (I/O) — logic การทำความสะอาดค่าอยู่ที่ settings.js
// อ่านพลาด (DB ล่ม) → คืนค่า default แทนการโยน error เพราะ endpoint ที่เรียกอยู่บนทุกหน้าเจ้าหน้าที่
import dbConnect from '@/lib/dbConnect';
import TaskSettings from '@/models/tasks/TaskSettings';
import { normalizeTaskSettings } from './settings';

const KEY = 'default';

/** อ่านแบบเข้มงวด — DB พลาดให้โยน error (ใช้ก่อนเขียน: ห้าม merge กับค่า default แล้วทับวันหยุด/SLA ที่ตั้งไว้) */
async function readTaskSettingsStrict() {
  await dbConnect();
  const doc = await TaskSettings.findOne({ key: KEY }).lean();
  return normalizeTaskSettings(doc);
}

export async function getTaskSettings() {
  try {
    return await readTaskSettingsStrict();
  } catch (err) {
    console.error('[tasks] read task_settings failed:', err);
    return normalizeTaskSettings(null);
  }
}

/**
 * บันทึกแบบ merge กับค่าปัจจุบัน (ส่งมาบางฟิลด์ได้ ฟิลด์ที่ไม่ส่งคงเดิม)
 * @param {object} patch
 * @param {string} [updatedBy] clerkId ของผู้แก้
 */
export async function saveTaskSettings(patch, updatedBy = '') {
  // อ่านแบบเข้มงวด: ถ้าอ่านพลาดแล้วไป merge กับ default จะเขียนทับวันหยุด/ค่าตั้งเดิมทิ้งเงียบ ๆ
  const current = await readTaskSettingsStrict();
  const next = normalizeTaskSettings({ ...current, ...(patch ?? {}) });
  await TaskSettings.findOneAndUpdate(
    { key: KEY },
    { $set: { ...next, updatedBy } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return next;
}
