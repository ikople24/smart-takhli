#!/usr/bin/env node
/**
 * นำเข้าข้อมูลตั้งต้นของตารางรถขยะ + ติดตั้ง index
 *   node --env-file=.env.local scripts/seed-garbage.mjs
 *   node scripts/seed-garbage.mjs --dry-run
 *
 * insert-only: เอกสารที่มีอยู่แล้วจะไม่ถูกแตะ เพราะ **ข้อมูลจริงแก้จาก /admin/garbage**
 * (ตั้งแต่ M6 UI เป็นแหล่งความจริง ไฟล์ JSON นี้จะ drift จาก DB เป็นเรื่องปกติ)
 *
 * รันบน DB ที่มีข้อมูลอยู่แล้วปลอดภัย — ของเดิมไม่ถูกทับ มีแต่รายการที่ยังไม่มีเท่านั้นที่ถูกเพิ่ม
 * และนี่คือวิธีติดตั้ง index ชุดใหม่บน deployment ที่ใช้งานอยู่ (createIndex เรียกซ้ำได้)
 * จะรายงานว่าเพิ่มไปกี่รายการและข้ามไปกี่รายการ
 */
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

// path เทียบกับตัวสคริปต์เอง รันจาก cwd ไหนก็ได้
const FILE = new URL("../data/garbage/schedule-seed.json", import.meta.url);
const dryRun = process.argv.includes("--dry-run");
const uri = process.env.MONGO_URI;

const seed = JSON.parse(readFileSync(FILE, "utf8"));

// ตรวจความสอดคล้องก่อนเขียน
const errors = [];
const routeCodes = new Set(seed.routes.map((r) => r.code));
const truckNumbers = new Set(seed.trucks.map((t) => t.number));
const communityNames = new Set(seed.communities.map((c) => c.name));

for (const r of seed.routes) {
  const seqs = r.stops.map((s) => s.seq);
  if (new Set(seqs).size !== seqs.length) errors.push(`${r.code}: seq ของจุดเก็บซ้ำ`);
  if (seqs.some((s, i) => s !== i + 1)) errors.push(`${r.code}: seq ไม่เรียง 1..n`);
  for (const c of r.communityNames) {
    if (!communityNames.has(c)) errors.push(`${r.code}: ไม่รู้จักชุมชน "${c}"`);
  }
}
for (const a of seed.assignments) {
  const at = `รถ ${a.truckNumber} วัน ${a.weekday} รอบ ${a.shiftNo}`;
  if (!truckNumbers.has(a.truckNumber)) errors.push(`${at}: ไม่รู้จักรถ`);
  if (a.routeCode && !routeCodes.has(a.routeCode)) errors.push(`${at}: ไม่รู้จักสาย ${a.routeCode}`);
  if (a.coverForRouteCode && !routeCodes.has(a.coverForRouteCode))
    errors.push(`${at}: ไม่รู้จักสายที่แทนเบอร์ ${a.coverForRouteCode}`);
  if ((a.startMin == null) !== (a.endMin == null))
    errors.push(`${at}: startMin กับ endMin ต้องมาคู่กัน (มีอันเดียวไม่ได้ — เช็คเวลาทับกันจะไม่ทำงาน)`);
  if (a.startMin != null && a.endMin != null && a.endMin < a.startMin)
    errors.push(`${at}: เวลาสิ้นสุดก่อนเวลาเริ่ม`);
  const route = seed.routes.find((r) => r.code === a.routeCode);
  if (route) {
    for (const st of a.stopTimes) {
      if (!route.stops.some((s) => s.seq === st.seq))
        errors.push(`${at}: stopTimes อ้าง seq ${st.seq} ที่ไม่มีในสาย ${a.routeCode}`);
    }
  }
  for (const w of a.communityWindows) {
    for (const c of w.communityNames) {
      if (!communityNames.has(c)) errors.push(`${at}: ไม่รู้จักชุมชน "${c}"`);
    }
  }
}
// รถคันเดียวกันในวันเดียวกัน เวลาต้องไม่ทับกัน
const byTruckDay = new Map();
for (const a of seed.assignments) {
  if (a.startMin == null) continue;
  const k = `${a.weekday}-${a.truckNumber}`;
  if (!byTruckDay.has(k)) byTruckDay.set(k, []);
  byTruckDay.get(k).push(a);
}
for (const [k, list] of byTruckDay) {
  list.sort((x, y) => x.startMin - y.startMin);
  for (let i = 1; i < list.length; i++) {
    if (list[i].startMin < list[i - 1].endMin)
      errors.push(`${k}: รอบ ${list[i - 1].shiftNo} กับ ${list[i].shiftNo} เวลาทับกัน`);
  }
}

if (errors.length) {
  console.error(`พบข้อผิดพลาด ${errors.length} รายการ — ยกเลิก\n`);
  errors.forEach((e) => console.error("  " + e));
  process.exit(1);
}
console.log("ตรวจความสอดคล้องผ่าน");

if (dryRun) {
  console.log("--dry-run: ไม่เขียนฐานข้อมูล");
  process.exit(0);
}
if (!uri) {
  console.error("ต้องตั้งค่า MONGO_URI (รันด้วย node --env-file=.env.local)");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB || undefined);
const now = new Date();
// คัดลอกมาจาก lib/garbage/constants.ts#BASELINE_EFFECTIVE_FROM (.mjs import .ts ไม่ได้)
// — แก้ที่นี่ต้องแก้ที่นั่นด้วย ไม่งั้นงานที่ seed กับงานที่สร้างจากหน้าแอดมินจะมีวันเริ่มมีผลคนละค่า
const effectiveFrom = new Date("2026-01-01T00:00:00+07:00");

// index ชุดเดียวกับ lib/garbage/db.ts#ensureIndexes — แก้ที่ไหนต้องแก้อีกที่ด้วย
await db.collection("garbage_trucks").createIndex({ number: 1 }, { unique: true });
await db.collection("garbage_routes").createIndex({ code: 1 }, { unique: true });
await db.collection("garbage_routes").createIndex({ "stops.name": 1 });
await db.collection("garbage_communities").createIndex({ name: 1 }, { unique: true });
await db.collection("garbage_communities").createIndex({ name: "text", aliases: "text" }, { default_language: "none" });
await db.collection("garbage_assignments").createIndex({ weekday: 1, effectiveFrom: -1 });
// คีย์ธรรมชาติของงานมอบหมาย — unique เพื่อกันเพิ่มซ้ำจากหน้าแอดมิน (M6)
await db
  .collection("garbage_assignments")
  .createIndex({ weekday: 1, truckNumber: 1, shiftNo: 1 }, { unique: true, name: "natural_key" });
await db.collection("garbage_assignments").createIndex({ routeCode: 1 });
await db.collection("garbage_settings").createIndex({ key: 1 }, { unique: true });

// insert-only: ใช้ $setOnInsert ทุกฟิลด์ เอกสารที่มีอยู่แล้วจึงไม่ถูกทับ
// (ก่อน M6 ใช้ $set ซึ่งจะล้างค่าที่เจ้าหน้าที่แก้จากหน้าแอดมิน)
const up = (filter, doc) => ({
  updateOne: {
    filter,
    update: { $setOnInsert: { ...doc, createdAt: now, updatedAt: now } },
    upsert: true,
  },
});

const r1 = await db.collection("garbage_trucks").bulkWrite(
  seed.trucks.map((t) => up({ number: t.number }, t))
);
const r2 = await db.collection("garbage_communities").bulkWrite(
  seed.communities.map((c) => up({ name: c.name }, { aliases: [], ...c, active: true }))
);
const r3 = await db.collection("garbage_routes").bulkWrite(
  seed.routes.map((r) => up({ code: r.code }, { ...r, active: true }))
);
const r4 = await db.collection("garbage_assignments").bulkWrite(
  seed.assignments.map((a) =>
    up({ weekday: a.weekday, truckNumber: a.truckNumber, shiftNo: a.shiftNo }, {
      ...a,
      effectiveFrom,
      effectiveTo: null,
    })
  )
);

const report = (label, res, total) => {
  const added = res.upsertedCount;
  const skipped = total - added;
  console.log(`${label} +${added} เพิ่มใหม่ · ข้าม ${skipped} (มีอยู่แล้ว ไม่ถูกทับ)`);
};
report("garbage_trucks", r1, seed.trucks.length);
report("garbage_communities", r2, seed.communities.length);
report("garbage_routes", r3, seed.routes.length);
report("garbage_assignments", r4, seed.assignments.length);
console.log("(insert-only — ข้อมูลจริงแก้จาก /admin/garbage)");

// เตือนถ้ามีเอกสารใน DB มากกว่าใน seed (seed ไม่ลบของเก่า)
for (const [colName, arr] of [
  ["garbage_trucks", seed.trucks],
  ["garbage_communities", seed.communities],
  ["garbage_routes", seed.routes],
  ["garbage_assignments", seed.assignments],
]) {
  const count = await db.collection(colName).countDocuments();
  if (count > arr.length)
    console.warn(`เตือน: ${colName} มี ${count} เอกสาร มากกว่าใน seed (${arr.length}) — ปกติถ้าเพิ่มงานจากหน้าแอดมิน`);
}

await client.close();
console.log("เสร็จเรียบร้อย");
