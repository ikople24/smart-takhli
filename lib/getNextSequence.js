// lib/getNextSequence.js
// ออกเลขที่เรื่องร้องเรียนตามปีงบประมาณไทย: TKC-<ปีงบ 2 หลัก><เลขลำดับ 4 หลัก>
// เช่น TKC-690001 (ปีงบประมาณ 2569), ขึ้น 1 ต.ค. → ปีงบใหม่ เลขรีเซ็ตเป็น 0001 อัตโนมัติ
// counter แยกรายปีใน collection `counters` (_id เช่น "complaintId-69")
// หมายเหตุ: เลขเดิมก่อนปีงบ 2569 อยู่ในรูป TKC-68xxxxxx (counter เก่า _id "complaintId" ไม่ถูกแตะ)

import dbConnect from './dbConnect';
import mongoose from 'mongoose';

// ปีงบประมาณ พ.ศ. 2 หลัก อิงเวลา Asia/Bangkok — ตั้งแต่ 1 ต.ค. นับเป็นปีงบประมาณถัดไป
function fiscalYearSuffix() {
  const bkk = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const beYear =
    bkk.getUTCFullYear() + 543 + (bkk.getUTCMonth() >= 9 ? 1 : 0);
  return String(beYear % 100).padStart(2, '0');
}

export default async function getNextSequence(sequenceName) {
  await dbConnect();
  const counters = mongoose.connection.db.collection('counters');

  const suffix = fiscalYearSuffix();
  const result = await counters.findOneAndUpdate(
    { _id: `${sequenceName}-${suffix}` },
    { $inc: { sequence_value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  // mongodb driver v6 คืน doc ตรง ๆ / v4-v5 คืน { value: doc } — รองรับทั้งคู่
  const doc =
    result && typeof result.sequence_value === 'number' ? result : result?.value;
  const value = doc?.sequence_value;

  if (typeof value !== 'number') {
    throw new Error('ไม่สามารถดึงเลขลำดับได้');
  }

  return `TKC-${suffix}${String(value).padStart(4, '0')}`;
}
