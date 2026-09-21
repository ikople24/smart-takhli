/**
 * รันรายการที่ถูกกัก (reason = unknown_status) ผ่าน dictionary/กฎล่าสุดอีกครั้ง
 *
 * ใช้ทุกครั้งหลังเพิ่มนิติกรรมใหม่ใน normalize/changeType.ts — ไม่ต้องอัปโหลดไฟล์ใหม่
 * และไม่ต้องล้างฐาน เพราะ m10_rejects เก็บแถวดิบ (rawRow) ไว้ครบทั้งแถว
 *
 *   node --env-file=.env.local --import tsx scripts/m10-reprocess-rejects.ts         # ดูผลอย่างเดียว
 *   node --env-file=.env.local --import tsx scripts/m10-reprocess-rejects.ts --yes   # เขียนจริง
 *
 * ข้อจำกัด: reject ของ geometry (source = "geometry") กู้ไม่ได้เพราะเก็บแค่ recordKey
 * ไม่ได้เก็บรูปแปลง — ต้องนำเข้าไฟล์เดิมซ้ำถึงจะได้รูปแปลงกลับมา
 */
import mongoose from "mongoose";
import { normalizeRow } from "../lib/m10-ingest/normalize/index";
import { insertTransactionDedup } from "../lib/m10-ingest/repository/index";
import type { DocType } from "../lib/m10-ingest/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { M10Reject, M10ImportBatch, M10Transaction } = require("../models/m10-ingest");

const APPLY = process.argv.includes("--yes");

async function main() {
  await mongoose.connect(process.env.MONGO_URI as string);

  const batches = await M10ImportBatch.find({}).select("_id period").lean();
  const periodOf = new Map<string, string>(
    batches.map((b: { _id: unknown; period: string }) => [String(b._id), b.period])
  );

  // เรียงตาม _id = ลำดับเดิมในไฟล์ → เจ้าของลำดับ 1 ถูก insert ก่อน คนถัดไปจึงไปอยู่ coOwnerRows ถูกตัว
  const rejects = await M10Reject.find({ reason: "unknown_status" }).sort({ _id: 1 }).lean();
  console.log(`รายการที่ถูกกักด้วย unknown_status: ${rejects.length} แถว`);
  if (rejects.length === 0) { await mongoose.disconnect(); return; }

  const recovered = new Map<string, number>();   // period -> จำนวนที่กู้ได้
  const merged = new Map<string, number>();      // period -> จำนวนที่ไปรวมเป็นเจ้าของร่วม
  const stuck = new Map<string, number>();       // ชื่อนิติกรรม -> จำนวนที่ยังไม่รู้จัก
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const r of rejects) {
    const outcome = normalizeRow({
      docType: r.docType as DocType,
      source: r.source as string,
      raw: (r.rawRow ?? {}) as Record<string, string>,
    });
    const period = periodOf.get(String(r.batchId)) ?? "(ไม่ทราบงวด)";

    if (!outcome.ok) {
      const name = String((r.rawRow as Record<string, string>)?.REG_CODE ?? "(ว่าง)").trim();
      bump(stuck, `${name} [${outcome.reason}]`);
      continue;
    }

    if (!APPLY) { bump(recovered, period); continue; }

    const res = await insertTransactionDedup(r.batchId, outcome.txn);
    bump(res.inserted ? recovered : merged, period);
    await M10Reject.deleteOne({ _id: r._id });
  }

  console.log(`\n=== กู้กลับเป็นรายการ${APPLY ? "" : " (จำลอง — ยังไม่เขียน)"} ===`);
  [...recovered.entries()].sort().forEach(([p, n]) => console.log(`  ${p}  ${n} แถว`));
  if (merged.size > 0) {
    console.log("\n=== ไปรวมเป็นเจ้าของร่วมของรายการเดิม ===");
    [...merged.entries()].sort().forEach(([p, n]) => console.log(`  ${p}  ${n} แถว`));
  }
  if (stuck.size > 0) {
    console.log("\n=== ยังไม่รู้จัก ต้องจัดหมวดเพิ่ม ===");
    [...stuck.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(3)}  ${k}`));
  }

  if (APPLY) {
    // counts.rejects ที่เก็บตอนนำเข้าจะล้าสมัยหลังกู้ — ปรับให้ตรงของจริง
    for (const b of batches) {
      const live = await M10Reject.countDocuments({ batchId: b._id });
      await M10ImportBatch.updateOne({ _id: b._id }, { $set: { "counts.rejects": live } });
    }
    console.log(`\nรวมรายการทั้งหมดในฐานตอนนี้: ${await M10Transaction.countDocuments()}`);
    console.log(`รายการที่ยังถูกกัก: ${await M10Reject.countDocuments()}`);
  } else {
    console.log("\n(ยังไม่ได้เขียนอะไรลงฐาน — ใส่ --yes เพื่อทำจริง)");
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
