// One-time seed: เติมค่าเริ่มต้นให้สถิติการเข้าชมเว็บไซต์ (โมดูล site-stats)
//
// เหตุผล: เพิ่งเริ่มนับจริง แต่อยากให้ตัวเลขสะท้อน "ถ้านับมาตั้งแต่แรก"
//   - total (ยอดรวม): ตั้งขั้นต่ำ 8600 ครั้ง (ใช้ $max — ไม่ลดค่าที่นับจริงไปแล้ว)
//   - month (เดือนนี้): อิงจำนวนเรื่องร้องเรียน "ทั้งหมด" ที่เข้ามาในระบบ (collection submittedreports)
//       เก็บใน daily doc สังเคราะห์ date="YYYY-MM-00" (ไม่ชนวันจริง, ยังตรง regex ^YYYY-MM)
//       → เดือนนี้จะ ≈ ค่านี้ + ยอดวันจริงที่สะสมต่อไป
//   - today (วันนี้): ปล่อยตามจริง ไม่แตะ
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/seed-site-stats.js --dry-run
//   node --env-file=.env.local scripts/seed-site-stats.js
//
// รันซ้ำได้ (idempotent): total ใช้ $max, month ใช้ $set ตามจำนวนเรื่องล่าสุด

const mongoose = require("mongoose");

const BASELINE_TOTAL = 8642; // ≥ 8600 ตามที่ตกลง

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const monthPrefix = ymd.slice(0, 7);
  const startOfMonth = new Date(`${monthPrefix}-01T00:00:00+07:00`);
  const backfillDate = `${monthPrefix}-00`; // bucket สังเคราะห์ของเดือนนี้

  const complaints = db.collection("submittedreports");
  const complaintsThisMonth = await complaints.countDocuments({
    createdAt: { $gte: startOfMonth },
  });
  const complaintsAllTime = await complaints.countDocuments({});

  const existingTotal = await db
    .collection("site_stats_total")
    .findOne({ _id: "total" });

  console.log("Bangkok วันนี้:", ymd);
  console.log("เรื่องร้องเรียน เดือนนี้:", complaintsThisMonth, "| ทั้งหมด:", complaintsAllTime);
  console.log("total เดิม:", existingTotal?.count ?? 0, "→ จะตั้ง $max =", BASELINE_TOTAL);
  console.log(`month backfill (date=${backfillDate}) =`, complaintsAllTime, "(เรื่องทั้งหมด)");

  if (dryRun) {
    console.log("[dry-run] ไม่เขียนข้อมูล");
    await mongoose.disconnect();
    return;
  }

  await db
    .collection("site_stats_total")
    .updateOne({ _id: "total" }, { $max: { count: BASELINE_TOTAL } }, { upsert: true });
  await db
    .collection("site_visit_daily")
    .updateOne({ date: backfillDate }, { $set: { count: complaintsAllTime } }, { upsert: true });

  const totalDoc = await db.collection("site_stats_total").findOne({ _id: "total" });
  const monthAgg = await db
    .collection("site_visit_daily")
    .aggregate([
      { $match: { date: { $regex: `^${monthPrefix}` } } },
      { $group: { _id: null, sum: { $sum: "$count" } } },
    ])
    .toArray();

  console.log("✅ total =", totalDoc.count);
  console.log("✅ month (รวม backfill + วันจริง) =", monthAgg[0]?.sum ?? 0);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
