// รัน: npm run m10:reconcile-backfill
async function main() {
  const mongoose = require("mongoose");
  const { M10Record, M10Transaction } = require("../models/m10-ingest");
  const { reconcileRecord } = await import("../lib/m10-ingest/repository/index.ts");

  await mongoose.connect(process.env.MONGO_URI);
  const recs = await M10Record.find({}).lean();
  let done = 0;
  for (const rec of recs) {
    let landNo = rec.landNo ?? null;
    let survey = rec.survey ?? null;
    if (landNo == null || survey == null) {
      // record เดิมไม่มี landNo/survey → ดึงจาก txn ล่าสุด (payloadRaw)
      const t = await M10Transaction.findById(rec.lastTxnId).select("payloadRaw").lean();
      landNo = t?.payloadRaw?.["ที่ดิน"] ?? null;
      survey = t?.payloadRaw?.["ห.สำรวจ"] ?? null;
      await M10Record.updateOne({ _id: rec._id }, { $set: { landNo, survey } });
    }
    await reconcileRecord({ _id: rec._id, recordKey: rec.recordKey, deedNo: rec.deedNo, landNo, survey, geometry: rec.geometry });
    done++;
  }
  console.log(`reconciled ${done} records`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
