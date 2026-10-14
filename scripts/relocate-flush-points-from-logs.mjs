// ขยับตำแหน่งหัวโบล์ในทะเบียนไปตาม GPS ที่เจ้าหน้าที่กดตอนโบตะกอนจริง (บันทึกโบที่ผูกหัวโบล์ไว้)
//
//   node --env-file=.env.local scripts/relocate-flush-points-from-logs.mjs          # dry-run (ค่าเริ่มต้น ไม่เขียนอะไร)
//   node --env-file=.env.local scripts/relocate-flush-points-from-logs.mjs --yes    # เขียนจริง
//
// กติกา (เจ้าของตกลง 2026-10-14):
// - ใช้บันทึกโบ "ล่าสุด" ของแต่ละหัว (ไม่นับที่ลบแล้ว) เป็นตำแหน่งที่ยืนยันจากหน้างาน
// - ห่าง ≤ MIN_M → ไม่ขยับ (อยู่ในระยะคลาดเคลื่อนของ GPS มือถือ)
// - ห่าง > MAX_M → ไม่ขยับ รายงานให้คนดู (อาจเลือกหัวผิดตอนบันทึก)
// - หัวที่มีคนย้ายตำแหน่งผ่านหน้าเว็บ "หลัง" วันที่โบ → ไม่ทับ (การแก้ด้วยมือใหม่กว่า)
// - ทุกการขยับลง history รูปแบบเดียวกับหน้าเว็บ (diffFlushPoint) — ย้อนกลับได้จากค่า from
// รันซ้ำได้: หัวที่ขยับแล้วจะห่าง 0 ม. จึงถูกข้าม
import mongoose from "mongoose";
import { distanceM } from "../lib/smart-papar/flushPoints.js";
import FlushPoint from "../models/smart-papar/FlushPoint.js";
import FlushingLog from "../models/smart-papar/FlushingLog.js";

const WRITE = process.argv.includes("--yes");
const MIN_M = 10;
const MAX_M = 100;
const MAX_HISTORY = 30; // ต้องตรงกับ lib/smart-papar/flushPointEdit.js

const fmt = (d) =>
  new Date(d).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ll = ([lng, lat]) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

async function main() {
  // autoIndex ปิด — dry-run ต้องไม่สร้าง index/collection ใด ๆ
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });

  const latest = await FlushingLog.aggregate([
    { $match: { deletedAt: null, flushPointId: { $type: "objectId" } } },
    { $sort: { flushedAt: -1 } },
    { $group: { _id: "$flushPointId", log: { $first: "$$ROOT" } } },
  ]);
  const points = new Map(
    (await FlushPoint.find({ _id: { $in: latest.map((l) => l._id) } }).lean()).map((p) => [String(p._id), p])
  );

  const move = [];
  const skipped = { near: 0, far: [], manual: [], missing: 0 };
  for (const { _id, log } of latest) {
    const p = points.get(String(_id));
    if (!p) {
      skipped.missing += 1;
      continue;
    }
    const [lng1, lat1] = p.location.coordinates;
    const [lng2, lat2] = log.location.coordinates;
    const m = Math.round(distanceM(lat1, lng1, lat2, lng2));
    if (m <= MIN_M) {
      skipped.near += 1;
      continue;
    }
    if (m > MAX_M) {
      skipped.far.push(`${p.code} ห่าง ${m} ม. (โบ ${fmt(log.flushedAt)} โดย ${log.createdByName})`);
      continue;
    }
    const manualAfter = (p.history || []).some(
      (h) => new Date(h.at) > new Date(log.flushedAt) && (h.changes || []).some((c) => c.field === "location")
    );
    if (manualAfter) {
      skipped.manual.push(`${p.code} ห่าง ${m} ม.`);
      continue;
    }
    move.push({ p, log, m });
  }

  move.sort((a, b) => b.m - a.m);
  console.log(`หัวที่มีบันทึกโบ ${latest.length} หัว`);
  console.log(`จะขยับ ${move.length} หัว:`);
  for (const { p, log, m } of move) {
    console.log(`  ${p.code.padEnd(10)} ${String(m).padStart(3)} ม.  ← โบ ${fmt(log.flushedAt)} โดย ${log.createdByName}`);
  }
  console.log(`ไม่ขยับ: ห่าง ≤ ${MIN_M} ม. ${skipped.near} หัว · ไม่พบหัว ${skipped.missing}`);
  if (skipped.manual.length) console.log(`ไม่ทับ (แก้ด้วยมือหลังวันที่โบ): ${skipped.manual.join(", ")}`);
  if (skipped.far.length) console.log(`ห่างเกิน ${MAX_M} ม. ให้คนตรวจ:\n  ${skipped.far.join("\n  ")}`);

  if (!WRITE) {
    console.log("\ndry-run — ยังไม่ได้เขียนอะไร · ใส่ --yes เพื่อขยับจริง");
    await mongoose.disconnect();
    return;
  }

  for (const { p, log, m } of move) {
    await FlushPoint.updateOne(
      { _id: p._id },
      {
        $set: { location: { type: "Point", coordinates: log.location.coordinates } },
        $push: {
          history: {
            $each: [
              {
                at: new Date(),
                byClerkId: "",
                byName: `ยืนยันจากงานโบ ${fmt(log.flushedAt)} · ${log.createdByName || "-"}`,
                action: "update",
                changes: [{ field: "location", from: ll(p.location.coordinates), to: ll(log.location.coordinates), movedM: m }],
              },
            ],
            $slice: -MAX_HISTORY,
          },
        },
      }
    );
  }
  console.log(`\nขยับแล้ว ${move.length} หัว`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("ผิดพลาด:", e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
