// scripts/backfill-household-key.js
// เติม householdKey (จาก address) ให้ใบสมัครเดิมที่ยังไม่มี (record ปี 68 ที่ migrate มา)
//   node --env-file=.env.local scripts/backfill-household-key.js --dry-run
//   node --env-file=.env.local scripts/backfill-household-key.js
const mongoose = require("mongoose");

const householdKeyOf = (address) => {
  const k = String(address || "").replace(/\s+/g, "").toLowerCase();
  return k.length >= 6 ? k : null;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection("school_applications");
  const docs = await col.find({ $or: [{ householdKey: { $exists: false } }, { householdKey: null }] })
    .project({ address: 1 }).toArray();
  let updated = 0;
  for (const d of docs) {
    const key = householdKeyOf(d.address);
    if (!key) continue;
    if (!dryRun) await col.updateOne({ _id: d._id }, { $set: { householdKey: key } });
    updated++;
  }
  console.log(`จะเติม householdKey ${updated} / ${docs.length} รายการ${dryRun ? " (--dry-run)" : ""}`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
