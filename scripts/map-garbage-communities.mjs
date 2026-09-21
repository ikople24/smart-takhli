#!/usr/bin/env node
/**
 * เติมชื่อชุมชนให้จุดเก็บจากพิกัดจริง
 *   node --env-file=.env.local scripts/map-garbage-communities.mjs        (dry-run)
 *   node --env-file=.env.local scripts/map-garbage-communities.mjs --yes  (เขียนจริง)
 *
 * วิธี: ชื่อจุด → หาถนนใน roads (ชื่อหรือ alias) → centroid ของถนน → $geoIntersects กับ
 * polygon ใน geojsonfeatures → ได้ชื่อชุมชน
 *
 * ชื่อซอยไม่สัมพันธ์กับชื่อชุมชน (เช่น "ซ.มาลัย2" อยู่ในชุมชนรจนา) จึงห้ามเดาจากชื่อ
 * geojsonfeatures เป็นของแอปอื่น (appId app_b) — อ่านอย่างเดียว ห้ามเขียน/สร้าง index
 * ห้ามทับจุดที่ communitySource === "manual" — งานที่เจ้าหน้าที่ยืนยันแล้วชนะเสมอ
 */
import { MongoClient } from "mongodb";

const PREFIX_RE = /^(ถนน|ถ\.\s*|ซอย|ซ\.\s*|ชุมชน)\s*/u;
// สำเนากฎจาก lib/garbage/community.ts — .mjs import .ts ไม่ได้ แก้ที่ไหนต้องแก้อีกที่
const norm = (s) =>
  String(s ?? "").normalize("NFC").trim().replace(PREFIX_RE, "").replace(/\s/gu, "").toLowerCase();

const confirmed = process.argv.includes("--yes");
const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("ต้องตั้งค่า MONGO_URI (รันด้วย node --env-file=.env.local)");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB || undefined);

const roads = await db.collection("roads")
  .find({ active: true, centroid: { $exists: true } })
  .project({ roadId: 1, name: 1, aliases: 1, centroid: 1 })
  .toArray();

// ดัชนีชื่อ→ถนน · ชื่อซ้ำให้ตัวแรกชนะแบบกำหนดแน่นอน (เรียงตาม roadId ก่อน)
roads.sort((a, b) => String(a.roadId).localeCompare(String(b.roadId)));
const roadIdx = new Map();
for (const r of roads) {
  for (const n of [r.name, ...(r.aliases ?? [])]) {
    const k = norm(n);
    if (k && !roadIdx.has(k)) roadIdx.set(k, r);
  }
}

const geo = db.collection("geojsonfeatures");
const routes = await db.collection("garbage_routes").find({}).toArray();

let filled = 0, kept = 0, noRoad = 0, noPolygon = 0;
const unresolved = [];
const updates = [];

for (const route of routes) {
  const nextStops = [];
  let changed = false;
  for (const s of route.stops) {
    if (s.communitySource === "manual") {
      kept++;
      nextStops.push(s);
      continue;
    }
    const road = roadIdx.get(norm(s.name));
    if (!road) {
      noRoad++;
      unresolved.push(`${route.code} · ${s.name} (ไม่พบถนนชื่อนี้)`);
      nextStops.push(s);
      continue;
    }
    const hits = await geo
      .find({ active: true, geometry: { $geoIntersects: { $geometry: road.centroid } } })
      .project({ name: 1 })
      .toArray();
    if (hits.length === 0) {
      noPolygon++;
      unresolved.push(`${route.code} · ${s.name} (ถนน ${road.name} ไม่ตกในชุมชนใด)`);
      nextStops.push({ ...s, roadId: road.roadId });
      changed = true;
      continue;
    }
    const name = hits.map((h) => h.name).sort((a, b) => a.localeCompare(b, "th"))[0];
    nextStops.push({ ...s, roadId: road.roadId, communityName: name, communitySource: "auto" });
    filled++;
    changed = true;
  }
  if (changed) updates.push({ code: route.code, stops: nextStops });
}

console.log(`เติมชุมชนได้ ${filled} จุด · คงค่าที่เจ้าหน้าที่ยืนยันไว้ ${kept} จุด`);
console.log(`เติมไม่ได้ ${noRoad + noPolygon} จุด (ไม่พบถนน ${noRoad} · ถนนไม่ตกในชุมชน ${noPolygon})`);
console.log(`\nจุดที่ต้องให้เจ้าหน้าที่เลือกเอง ${unresolved.length} รายการ:`);
unresolved.slice(0, 25).forEach((u) => console.log("  " + u));
if (unresolved.length > 25) console.log(`  … และอีก ${unresolved.length - 25} รายการ`);

if (!confirmed) {
  console.log("\ndry-run: ยังไม่เขียนฐานข้อมูล (ใส่ --yes เพื่อเขียนจริง)");
  await client.close();
  process.exit(0);
}

const now = new Date();
for (const u of updates) {
  await db.collection("garbage_routes").updateOne(
    { code: u.code },
    { $set: { stops: u.stops, updatedAt: now } }
  );
}
await db.collection("auditlogs").insertOne({
  actorClerkId: "script",
  actorName: "map-garbage-communities.mjs",
  action: "garbage_communities_mapped",
  resourceType: "system",
  resourceId: "garbage_routes",
  description: `ผูกชุมชนให้จุดเก็บ ${filled} จุด (คงค่าที่ยืนยันแล้ว ${kept} จุด · เติมไม่ได้ ${unresolved.length} จุด)`,
  meta: { filled, kept, unresolved: unresolved.length },
  createdAt: now,
  updatedAt: now,
});

console.log(`\nเขียนแล้ว: แก้ ${updates.length} สาย · เติมชุมชน ${filled} จุด`);
await client.close();
