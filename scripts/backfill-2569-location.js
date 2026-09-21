// One-time: ปีงบ 2569 — คืนพิกัดบ้านจริงให้ "รายเก่าที่ที่อยู่ไม่เปลี่ยน"
//
// ที่มา: พิกัดปี 2569 ถูกเก็บจาก GPS ของเครื่องตอนกรอก (LocationConfirm ไม่มีหมุดลากเอง)
// ปีนี้กรอกที่เดียวกันเกือบทั้งหมด → พิกัดเป็นจุดเดียวกันทุกราย ไม่ใช่บ้านจริง
// ใบปี 2568 มีพิกัดบ้านจริงครบ 238/238 → คัดลอกมาใช้กับคนเดิมที่ยังอยู่ที่อยู่เดิม
//
// เกณฑ์ (เข้มไว้ก่อน): มีใบปี 2568 ของ applicantRef เดียวกัน + address ตรงกันหลัง normalize
//   + ใบ 2568 มีพิกัด → set location ของใบ 2569 = ของใบ 2568
// ไม่แตะ: รายใหม่ (ไม่มีใบ 2568) และรายที่ย้ายที่อยู่ → เจ้าหน้าที่สำรวจเอง
//
// idempotent: รันซ้ำได้ (รายที่พิกัดตรงแล้วจะถูกข้าม)
//
// วิธีรัน:
//   NODE_PATH=./node_modules node --env-file=.env.local scripts/backfill-2569-location.js --dry-run
//   NODE_PATH=./node_modules node --env-file=.env.local scripts/backfill-2569-location.js

const mongoose = require("mongoose");

const YEAR = 2569;
const PREV_YEAR = 2568;

// เดียวกับ householdKeyOf: ตัดช่องว่างทั้งหมด + lowercase
const normAddr = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();

// ระยะห่างโดยประมาณ (เมตร) — ใช้รายงานเฉย ๆ
const distanceM = (a, b) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.collection("school_applications");

  const current = await col.find({ surveyYear: YEAR }).toArray();
  const targets = [];
  let skipNew = 0, skipMoved = 0, skipNoPrevLoc = 0, already = 0;

  for (const cur of current) {
    const prev = await col.findOne({ applicantRef: cur.applicantRef, surveyYear: PREV_YEAR });
    if (!prev) { skipNew++; continue; }                                   // รายใหม่
    if (normAddr(cur.address) !== normAddr(prev.address)) { skipMoved++; continue; } // ย้ายที่อยู่
    if (!prev.location || prev.location.lat == null || prev.location.lng == null) { skipNoPrevLoc++; continue; }
    if (cur.location && cur.location.lat === prev.location.lat && cur.location.lng === prev.location.lng) {
      already++; continue;                                               // ตรงแล้ว (รันซ้ำ)
    }
    targets.push({
      _id: cur._id,
      applicationId: cur.applicationId,
      to: { lat: prev.location.lat, lng: prev.location.lng },
      movedM: cur.location?.lat != null ? distanceM(cur.location, prev.location) : null,
    });
  }

  console.log(`${dryRun ? "[DRY-RUN] " : ""}ปีงบ ${YEAR}: ${current.length} ใบ`);
  console.log(`  รายใหม่ (ไม่มีใบ ${PREV_YEAR})        : ${skipNew}  → ไม่แตะ (เจ้าหน้าที่สำรวจ)`);
  console.log(`  รายเก่า ย้ายที่อยู่                  : ${skipMoved}  → ไม่แตะ (เจ้าหน้าที่สำรวจ)`);
  console.log(`  รายเก่า ใบ ${PREV_YEAR} ไม่มีพิกัด      : ${skipNoPrevLoc}  → ไม่แตะ`);
  console.log(`  รายเก่า ที่อยู่เดิม พิกัดตรงแล้ว      : ${already}  → ข้าม`);
  console.log(`  รายเก่า ที่อยู่เดิม ${dryRun ? "จะคืนพิกัด" : "คืนพิกัด"}       : ${targets.length}`);

  if (targets.length) {
    console.log("\nรายการ:");
    for (const t of targets) {
      console.log(`  ${t.applicationId}  → ${t.to.lat.toFixed(5)}, ${t.to.lng.toFixed(5)}${t.movedM != null ? `  (เดิมห่าง ${t.movedM} m)` : ""}`);
    }
  }

  if (!dryRun && targets.length) {
    for (const t of targets) {
      await col.updateOne({ _id: t._id }, { $set: { location: t.to } });
    }
    console.log(`\n✔ อัปเดตแล้ว ${targets.length} ใบ`);
    // ยืนยันหลังรัน: ยังเหลือรายเก่าที่อยู่เดิมที่พิกัดไม่ตรงไหม
    let mismatch = 0;
    for (const cur of await col.find({ surveyYear: YEAR }).toArray()) {
      const prev = await col.findOne({ applicantRef: cur.applicantRef, surveyYear: PREV_YEAR });
      if (!prev || normAddr(cur.address) !== normAddr(prev.address)) continue;
      if (!prev.location?.lat) continue;
      if (cur.location?.lat !== prev.location.lat || cur.location?.lng !== prev.location.lng) mismatch++;
    }
    console.log(`ยืนยัน: รายเก่าที่อยู่เดิมที่พิกัดยังไม่ตรง = ${mismatch} (ควรเป็น 0)`);
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
