/**
 * คำนวณเนื้อที่ (rai/ngan/wa/sqm) ใหม่ให้ transaction/record ที่มี SUBWA (เศษวา) ไม่เท่ากับ 0
 *
 * root cause: parseArea เดิมคำนวณเศษวาเป็นส่วนร้อย (/100) — ที่ถูกคือส่วนสิบ (/10)
 * เพราะ SUBWA เป็นเลขหลักเดียวเสมอในข้อมูลจริง (0-9) ยืนยันกับเว็บกรมที่ดินแล้ว
 * (โฉนดเลขที่ 81145 เลขที่ดิน 1100: WA=53 SUBWA=6 → เนื้อที่จริง 53.6 ตร.ว. ไม่ใช่ 53.06)
 * ดู lib/m10-ingest/normalize/area.ts — แก้สูตรแล้ว สคริปต์นี้ backfill ข้อมูลเก่าที่นำเข้าไปแล้ว
 *
 *   node --env-file=.env.local --import tsx scripts/m10-fix-subwa-area.ts         # ดูผลอย่างเดียว
 *   node --env-file=.env.local --import tsx scripts/m10-fix-subwa-area.ts --yes   # เขียนจริง
 */
import mongoose from "mongoose";
import { parseArea } from "../lib/m10-ingest/normalize/area";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { M10Transaction, M10Record } = require("../models/m10-ingest");

const APPLY = process.argv.includes("--yes");

async function main() {
  await mongoose.connect(process.env.MONGO_URI as string);

  const txns = await M10Transaction.find({
    "payloadRaw.SUBWA": { $exists: true, $nin: ["", "0", "00", null] },
  }).select("_id recordKey payloadRaw area").lean();

  console.log(`transaction ที่มีเศษวา ≠ 0: ${txns.length} แถว`);

  let txnChanged = 0;
  const fixedByTxnId = new Map<string, { rai: number; ngan: number; wa: number; sqm: number }>();

  for (const t of txns) {
    const raw = t.payloadRaw as Record<string, string>;
    const fixed = parseArea(raw.RAI ?? "", raw.NGAN ?? "", raw.WA ?? "", raw.SUBWA ?? "");
    const before = t.area as { rai: number; ngan: number; wa: number; sqm: number } | null;
    if (before && Math.abs(before.wa - fixed.wa) < 1e-9) continue; // ไม่เปลี่ยน

    txnChanged++;
    fixedByTxnId.set(String(t._id), fixed);
    if (txnChanged <= 10) {
      console.log(`  ${t.recordKey}: wa ${before?.wa} → ${fixed.wa}`);
    }
    if (APPLY) {
      await M10Transaction.updateOne({ _id: t._id }, { $set: { area: fixed } });
    }
  }
  console.log(`${APPLY ? "แก้แล้ว" : "จะแก้"} m10_transactions.area: ${txnChanged} แถว`);

  // m10_records.area เป็นสำเนาจาก txn.area ตอน confirm — ต้องอัปเดตตามถ้า lastTxnId ชี้ txn ที่แก้
  const records = await M10Record.find({ lastTxnId: { $in: [...fixedByTxnId.keys()].map((id) => new mongoose.Types.ObjectId(id)) } })
    .select("_id recordKey area lastTxnId").lean();

  let recChanged = 0;
  for (const r of records) {
    const fixed = fixedByTxnId.get(String(r.lastTxnId));
    if (!fixed) continue;
    const before = r.area as { rai: number; ngan: number; wa: number; sqm: number } | null;
    if (before && Math.abs(before.wa - fixed.wa) < 1e-9) continue;

    recChanged++;
    if (recChanged <= 10) {
      console.log(`  record ${r.recordKey}: wa ${before?.wa} → ${fixed.wa}`);
    }
    if (APPLY) {
      await M10Record.updateOne({ _id: r._id }, { $set: { area: fixed } });
    }
  }
  console.log(`${APPLY ? "แก้แล้ว" : "จะแก้"} m10_records.area: ${recChanged} แถว`);

  if (!APPLY) console.log("\n(ยังไม่ได้เขียนอะไรลงฐาน — ใส่ --yes เพื่อทำจริง)");

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
