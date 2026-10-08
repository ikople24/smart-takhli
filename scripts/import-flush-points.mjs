// นำเข้าทะเบียนหัวโบล์จาก KMZ (ส่งออกจากแอป Glide เดิมผ่าน Google Earth) → smart_papar_flush_points
//
//   node --env-file=.env.local scripts/import-flush-points.mjs                 # dry-run (ค่าเริ่มต้น ไม่เขียนอะไร)
//   node --env-file=.env.local scripts/import-flush-points.mjs --yes           # เขียนจริง + ย้ายรูปเข้า Cloudinary
//   node --env-file=.env.local scripts/import-flush-points.mjs --yes --skip-photos
//   node --env-file=.env.local scripts/import-flush-points.mjs path/to/file.kmz --yes
//
// - upsert ตาม code รันซ้ำได้ · รูปที่ย้ายแล้ว (photoSourceUrl เดิม) จะไม่อัปโหลดซ้ำ
// - รูปขึ้น Cloudinary ผ่าน unsigned preset (โฟลเดอร์ smart-papar/flush-points) — เพิ่มไฟล์ใหม่อย่างเดียว
//   ไม่ลบอะไรใน Cloudinary (cloud ใช้ร่วมกับแอปพี่น้อง)
// - ไฟล์ KMZ ไม่อยู่ใน git (repo public — มีตำแหน่งอุปกรณ์ประปา) ต้องมีในเครื่องที่รัน
import AdmZip from "adm-zip";
import mongoose from "mongoose";
import { parseFlushPointsKml } from "../lib/smart-papar/flushPoints.js";
import FlushPoint from "../models/smart-papar/FlushPoint.js";

const args = process.argv.slice(2);
const WRITE = args.includes("--yes");
const SKIP_PHOTOS = args.includes("--skip-photos");
const file = args.find((a) => !a.startsWith("--")) || "docs/point-bortagon.csv.kmz";
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const CONCURRENCY = 4;

async function uploadFromUrl(url) {
  const form = new FormData();
  form.append("file", url);
  form.append("upload_preset", PRESET);
  form.append("folder", "smart-papar/flush-points");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.secure_url) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data.secure_url;
}

async function main() {
  const entry = new AdmZip(file).getEntries().find((e) => e.entryName.toLowerCase().endsWith(".kml"));
  if (!entry) throw new Error(`ไม่พบไฟล์ .kml ใน ${file}`);
  const points = parseFlushPointsKml(entry.getData().toString("utf8"));
  const dupCodes = points.map((p) => p.code).filter((c, i, a) => a.indexOf(c) !== i);
  if (dupCodes.length) throw new Error(`รหัสซ้ำในไฟล์: ${[...new Set(dupCodes)].join(", ")}`);

  // autoIndex ปิดไว้ — ไม่งั้นแค่ dry-run ก็สร้าง collection/index แล้ว · ตอนเขียนจริงเรียก syncIndexes เอง
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const existing = new Map(
    (await FlushPoint.find({}).select({ code: 1, photoUrl: 1, photoSourceUrl: 1 }).lean()).map((d) => [d.code, d])
  );
  const toInsert = points.filter((p) => !existing.has(p.code));
  const needPhoto = points.filter((p) => {
    const e = existing.get(p.code);
    return p.photoSourceUrl && !(e?.photoUrl && e.photoSourceUrl === p.photoSourceUrl);
  });

  console.log(`ไฟล์: ${file}`);
  console.log(`หัวโบล์ในไฟล์ ${points.length} · ใหม่ ${toInsert.length} · อัปเดต ${points.length - toInsert.length}`);
  console.log(`รูปที่ต้องย้ายเข้า Cloudinary: ${SKIP_PHOTOS ? "ข้าม (--skip-photos)" : needPhoto.length}`);
  if (!WRITE) {
    console.log("\ndry-run — ยังไม่ได้เขียนอะไร · ใส่ --yes เพื่อนำเข้าจริง");
    await mongoose.disconnect();
    return;
  }

  await FlushPoint.syncIndexes();
  for (const p of points) {
    const { photoSourceUrl, ...fields } = p;
    await FlushPoint.updateOne(
      { code: p.code },
      { $set: fields, $setOnInsert: { active: true, photoUrl: "", photoSourceUrl: "" } },
      { upsert: true }
    );
  }
  console.log(`บันทึกข้อมูลหัวโบล์ ${points.length} จุดแล้ว`);

  if (!SKIP_PHOTOS && needPhoto.length) {
    if (!CLOUD || !PRESET) throw new Error("ไม่มี NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / _UPLOAD_PRESET");
    let done = 0;
    const failed = [];
    const queue = [...needPhoto];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length) {
          const p = queue.shift();
          try {
            const url = await uploadFromUrl(p.photoSourceUrl);
            await FlushPoint.updateOne({ code: p.code }, { $set: { photoUrl: url, photoSourceUrl: p.photoSourceUrl } });
            done += 1;
            if (done % 20 === 0) console.log(`  รูป ${done}/${needPhoto.length}`);
          } catch (e) {
            failed.push(`${p.code}: ${e.message}`);
          }
        }
      })
    );
    console.log(`ย้ายรูปสำเร็จ ${done}/${needPhoto.length}`);
    if (failed.length) console.log(`ไม่สำเร็จ ${failed.length} รูป (รันซ้ำได้):\n  ${failed.join("\n  ")}`);
  }
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("ผิดพลาด:", e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
