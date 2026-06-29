// รัน: npm run m10:load-basemap -- public/parcel.shp.geojson
const fs = require("node:fs");

async function main() {
  const file = process.argv[2] || "public/parcel.shp.geojson";
  const mongoose = require("mongoose");
  const { M10Basemap } = require("../models/m10-ingest");
  const { featureToBasemapDoc } = await import("../lib/m10-ingest/basemap/load.ts");

  const gj = JSON.parse(fs.readFileSync(file, "utf8"));
  await mongoose.connect(process.env.MONGO_URI);
  await M10Basemap.collection.drop().catch(() => {}); // idempotent: เคลียร์ก่อนโหลดใหม่
  // สร้าง 2dsphere บน collection ว่างก่อน → MongoDB จะ validate geometry ทุก doc ตอน insert
  // (S2 เข้มกว่า turf booleanValid: จับ self-intersect ที่ turf พลาด) — ตัวเสียถูก reject รายตัว
  await M10Basemap.createIndexes();

  let preSkip = 0, inserted = 0, geoReject = 0;
  let buf = [];
  async function flush() {
    if (!buf.length) return;
    try {
      const res = await M10Basemap.collection.insertMany(buf, { ordered: false });
      inserted += res.insertedCount;
    } catch (e) {
      inserted += e.result?.insertedCount ?? e.insertedCount ?? 0;
      geoReject += e.writeErrors?.length ?? 0;
    }
    buf = [];
  }
  for (const f of gj.features) {
    const d = featureToBasemapDoc(f);
    if (!d) { preSkip++; continue; } // ไม่มี PARCEL_COD หรือ turf ว่า invalid
    buf.push(d);
    if (buf.length >= 1000) await flush();
  }
  await flush();
  console.log(`basemap loaded: ${inserted}, pre-skip(no-code/turf-invalid): ${preSkip}, geo-reject(S2): ${geoReject}`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
