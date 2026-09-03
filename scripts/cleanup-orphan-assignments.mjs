// One-time cleanup: ลบ "ซากงาน" — assignment ที่เรื่องต้นทางถูกลบไปแล้ว (เกิดจากปุ่มลบเรื่องเวอร์ชันเก่า
// ที่ลบเฉพาะ SubmittedReport ไม่ลบ assignment — endpoint แก้แล้ว 2026-09-03 จะไม่เกิดใหม่)
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/cleanup-orphan-assignments.mjs            (dry-run — แค่รายงาน)
//   node --env-file=.env.local scripts/cleanup-orphan-assignments.mjs --yes     (ลบจริง)
// รันซ้ำได้ — รอบถัดไปจะไม่พบอะไร

import mongoose from "mongoose";

async function main() {
  const apply = process.argv.includes("--yes");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const assignments = await db.collection("assignments").find({}).project({ complaintId: 1, userId: 1, assignedAt: 1, completedAt: 1 }).toArray();
  const orphans = [];
  for (const a of assignments) {
    if (!a.complaintId) { orphans.push(a); continue; }
    const c = await db.collection("submittedreports").findOne({ _id: a.complaintId }, { projection: { _id: 1 } });
    if (!c) orphans.push(a);
  }
  console.log(`assignment ทั้งหมด ${assignments.length} · ซาก (เรื่องถูกลบ): ${orphans.length}`);
  console.table(orphans.map((a) => ({ assignment: String(a._id).slice(-8), complaint: a.complaintId ? String(a.complaintId).slice(-8) : "-", assigned: a.assignedAt ? String(a.assignedAt).slice(0, 15) : "-", closed: !!a.completedAt })));

  if (!apply) {
    console.log("dry-run: ยังไม่ลบ — ใส่ --yes เพื่อลบจริง");
  } else if (orphans.length) {
    const res = await db.collection("assignments").deleteMany({ _id: { $in: orphans.map((a) => a._id) } });
    console.log(`ลบแล้ว ${res.deletedCount} รายการ`);
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
