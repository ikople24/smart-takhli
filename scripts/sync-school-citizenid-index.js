// One-time: สร้าง unique sparse index ของ citizenId ใน school_applicants (โปรดักชัน)
// dev ไม่ต้องรัน — mongoose autoIndex สร้างให้เมื่อ dev server โหลด model ใหม่
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/sync-school-citizenid-index.js
//
// รันซ้ำได้ — createIndex เป็น no-op ถ้า index มีอยู่แล้ว

const mongoose = require("mongoose");

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }
  await mongoose.connect(process.env.MONGO_URI);
  const name = await mongoose.connection
    .collection("school_applicants")
    .createIndex({ citizenId: 1 }, { unique: true, sparse: true });
  console.log("✅ index:", name);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
