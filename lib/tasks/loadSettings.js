// lib/tasks/loadSettings.js
// อ่าน/บันทึกการตั้งค่างานเจ้าหน้าที่จาก Mongo (I/O) — logic การทำความสะอาดค่าอยู่ที่ settings.js
// อ่านพลาด (DB ล่ม) → คืนค่า default แทนการโยน error เพราะ endpoint ที่เรียกอยู่บนทุกหน้าเจ้าหน้าที่
import dbConnect from '@/lib/dbConnect';
import TaskSettings from '@/models/tasks/TaskSettings';
import { normalizeTaskSettings } from './settings';

const KEY = 'default';

export async function getTaskSettings() {
  try {
    await dbConnect();
    const doc = await TaskSettings.findOne({ key: KEY }).lean();
    return normalizeTaskSettings(doc);
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
  await dbConnect();
  const current = await getTaskSettings();
  const next = normalizeTaskSettings({ ...current, ...(patch ?? {}) });
  await TaskSettings.findOneAndUpdate(
    { key: KEY },
    { $set: { ...next, updatedBy } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return next;
}
