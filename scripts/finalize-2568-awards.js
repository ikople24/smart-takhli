// One-time: ปีงบ 2568 — ปิดจ๊อบการจัดสรรทุน
//   สำหรับรายที่เจ้าหน้าที่ "จัดลำดับไว้แล้ว" (scholarshipRank != null):
//     - status → "ได้รับทุน"
//     - scholarshipAmount → ตามจำนวนเงินของระดับ
//     - eligibilityChecklist → ติ๊กครบทั้ง 3 (ทะเบียนบ้าน/โรงเรียน/เอกสาร)
//
// - ปี 2568 ทุกระดับจัดลำดับไว้พอดี/ไม่เกินโควตา → ให้ทุนทุกคนที่จัดลำดับ
// - idempotent: รันซ้ำได้ (set ค่าเดิมทับ), --dry-run เพื่อดูก่อน
//
// วิธีรัน:
//   NODE_PATH=./node_modules node --env-file=.env.local scripts/finalize-2568-awards.js --dry-run
//   NODE_PATH=./node_modules node --env-file=.env.local scripts/finalize-2568-awards.js

const mongoose = require("mongoose");

const YEAR = 2568;
const BUCKETS = [
  { key: "อนุบาล", amount: 2000, levels: ["อนุบาล"] },
  { key: "ประถม", amount: 2000, levels: ["ประถม"] },
  { key: "ม.ต้น", amount: 3000, levels: ["มัธยมต้น", "ม.ต้น"] },
  { key: "ม.ปลาย/ปวช.", amount: 5000, levels: ["มัธยมปลาย", "ม.ปลาย", "ปวช", "ปวช."] },
  { key: "ป.ตรี/ปวส.", amount: 8000, levels: ["ปริญญาตรี", "ป.ตรี", "ปวส", "ปวส."] },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.collection("school_applications");

  const baseFilter = { surveyYear: YEAR, scholarshipRank: { $ne: null } };
  const totalRanked = await col.countDocuments(baseFilter);
  const mappedLevels = BUCKETS.flatMap((b) => b.levels);
  const unmapped = await col.countDocuments({ ...baseFilter, educationLevel: { $nin: mappedLevels } });

  console.log(`${dryRun ? "[DRY-RUN] " : ""}ปีงบ ${YEAR}: จัดลำดับไว้ ${totalRanked} ราย${unmapped ? ` (⚠️ แม็ประดับไม่ได้ ${unmapped} — จะข้าม)` : ""}\n`);
  console.log("ระดับ            | เข้าเงื่อนไข | ให้ทุน+ติ๊กเอกสาร");
  console.log("-".repeat(52));

  let grand = 0;
  for (const b of BUCKETS) {
    const filter = { ...baseFilter, educationLevel: { $in: b.levels } };
    const n = await col.countDocuments(filter);
    grand += n;
    if (!dryRun && n > 0) {
      await col.updateMany(filter, {
        $set: {
          status: "ได้รับทุน",
          scholarshipAmount: b.amount,
          "eligibilityChecklist.residencyVerified": true,
          "eligibilityChecklist.schoolVerified": true,
          "eligibilityChecklist.documentsVerified": true,
          statusUpdatedBy: "ระบบ (finalize 2568)",
          statusUpdatedAt: new Date(),
        },
      });
    }
    console.log(`${b.key.padEnd(14)} | ${String(n).padStart(11)} | ${dryRun ? "(dry-run)" : "✔ อัปเดตแล้ว"} (ทุนละ ${b.amount.toLocaleString()})`);
  }

  console.log("-".repeat(52));
  console.log(`รวม ${dryRun ? "จะให้ทุน" : "ให้ทุนแล้ว"}: ${grand} ราย`);
  if (!dryRun) {
    const awarded = await col.countDocuments({ surveyYear: YEAR, status: "ได้รับทุน" });
    console.log(`ยืนยันหลังรัน: status='ได้รับทุน' ปี ${YEAR} = ${awarded} ราย`);
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
