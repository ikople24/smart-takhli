// scripts/seed-blocked-schools.js
// seed รายชื่อโรงเรียนไม่ผ่านเกณฑ์เริ่มต้น (เอกชน/นอกเขต) — idempotent (upsert)
//   node --env-file=.env.local scripts/seed-blocked-schools.js
const mongoose = require("mongoose");

// เติมชื่อจริงจากผู้ใช้ (ปล่อยว่างได้ — แอดมินเพิ่มผ่านหน้าเว็บภายหลัง)
const SEED = [
  // { name: "โรงเรียนเอกชน ก", reason: "private" },
];

const normalize = (s) => String(s || "").replace(/\s+/g, " ").trim();

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  if (SEED.length === 0) { console.log("SEED ว่าง — ข้าม (เพิ่มชื่อในไฟล์ก่อน หรือใช้หน้าแอดมิน)"); return; }
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection("school_blocked_schools");
  let n = 0;
  for (const s of SEED) {
    const name = normalize(s.name);
    if (!name) continue;
    await col.updateOne(
      { name },
      { $set: { name, reason: s.reason || "private", note: s.note || "", updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    n++;
  }
  console.log(`seed blocked schools: ${n} รายการ`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
