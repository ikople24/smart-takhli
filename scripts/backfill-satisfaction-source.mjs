// เติม source: 'public' + lineUserId: null ให้แถวเดิมใน satisfactions ที่ยังไม่มีฟิลด์
// รันครั้งเดียว: node --env-file=.env.local scripts/backfill-satisfaction-source.mjs [--yes]
import mongoose from 'mongoose';

const apply = process.argv.includes('--yes');

await mongoose.connect(process.env.MONGO_URI);
const col = mongoose.connection.db.collection('satisfactions');

const filter = { source: { $exists: false } };
const total = await col.countDocuments({});
const pending = await col.countDocuments(filter);

console.log(`แถวทั้งหมด: ${total}`);
console.log(`แถวที่ยังไม่มี source: ${pending}`);

if (!pending) {
  console.log('ไม่มีอะไรต้องเติม');
} else if (!apply) {
  console.log('DRY RUN — ใส่ --yes เพื่อเขียนจริง');
} else {
  const res = await col.updateMany(filter, { $set: { source: 'public', lineUserId: null } });
  console.log(`อัปเดตแล้ว ${res.modifiedCount} แถว`);
}

await mongoose.disconnect();
