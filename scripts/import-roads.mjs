#!/usr/bin/env node
/**
 * นำเข้าชั้นข้อมูลถนนจาก GeoJSON (WGS84) เข้า MongoDB collection `roads`
 *
 * ใช้งาน (อ่าน MONGO_URI จาก .env.local):
 *   node --env-file=.env.local scripts/import-roads.mjs public/road_takhli.geojson
 *   node scripts/import-roads.mjs public/road_takhli.geojson --dry-run
 *
 * คุณสมบัติ:
 *   - idempotent: รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ upsert ด้วย roadId
 *   - ไม่ลบข้อมูล: เส้นที่หายไปจากไฟล์จะถูกตั้ง active=false ไม่ใช่ลบทิ้ง
 *     (ป้องกันสายรถขยะที่อ้างถึงถนนนั้นอยู่พัง)
 *   - สร้าง aliases อัตโนมัติเพื่อให้ประชาชนค้นหาเจอแม้สะกดต่างกัน
 *   - สร้าง index ที่จำเป็นให้เอง
 *
 * ต้องติดตั้ง: npm i mongodb
 */

import { readFileSync } from "node:fs";
// mongodb ถูก import แบบ dynamic ด้านล่าง เพื่อให้ --dry-run ใช้ได้โดยไม่ต้องติดตั้ง

const COLLECTION = "roads";
const SOURCE = "takhli-road-shapefile-2569";

// ─────────────────────────────────────────────────────────────
// ชื่อและ alias
// ─────────────────────────────────────────────────────────────

/** ตัดคำนำหน้า ถ./ถนน/ซ./ซอย ออก */
function stripPrefix(s) {
  return s.replace(/^(ถนน|ถ\.\s*|ซอย|ซ\.\s*)/u, "").trim();
}

/** คีย์สำหรับเทียบชื่อ: ตัดคำนำหน้า ช่องว่าง ไม้ทัณฑฆาต และ - ออก */
function normalizeName(s) {
  return stripPrefix(String(s ?? "").normalize("NFC").trim())
    .replace(/[\s\-–]/gu, "")
    .replace(/\u0E4C/gu, "") // ์
    .toLowerCase();
}

/**
 * สร้างรายการชื่อพ้องสำหรับการค้นหา
 * "ถ.ตาคลีพัฒนา" → ["ถ.ตาคลีพัฒนา", "ตาคลีพัฒนา", "ถนนตาคลีพัฒนา", "ตาคลีพัฒนา"]
 * "ซ.ทวีชัย5"    → เพิ่ม "ซอยทวีชัย5", "ทวีชัย 5", "ทวีชัย5"
 */
function buildAliases(name) {
  if (!name) return [];
  const out = new Set();
  const raw = name.normalize("NFC").trim();
  const bare = stripPrefix(raw);
  out.add(raw);
  out.add(bare);

  // สลับรูปแบบคำนำหน้าย่อ/เต็ม
  if (/^ถ\./u.test(raw)) out.add("ถนน" + bare);
  if (/^ถนน/u.test(raw)) out.add("ถ." + bare);
  if (/^ซ\./u.test(raw)) out.add("ซอย" + bare);
  if (/^ซอย/u.test(raw)) out.add("ซ." + bare);

  // ชั้นข้อมูลหลายเส้นไม่มีคำนำหน้า (เช่น "ดอกไม้แดง") แต่โปสเตอร์เขียน "ถ.ดอกไม้แดง"
  // ใส่ทั้งสองคำนำหน้าไว้เพื่อการค้นหา ไม่ได้ระบุชนิดถนนจริง
  if (bare === raw) {
    for (const p of ["ถ.", "ถนน", "ซ.", "ซอย"]) out.add(p + bare);
  }

  // เว้นวรรคก่อนเลขซอย และแบบติดกัน
  const spaced = bare.replace(/([\u0E00-\u0E7F])(\d)/u, "$1 $2");
  const tight = bare.replace(/\s+(\d)/u, "$1");
  out.add(spaced);
  out.add(tight);

  // ตัดไม้ทัณฑฆาต (สารนิธิ์ ↔ สารนิธิ)
  out.add(bare.replace(/\u0E4C/gu, ""));

  return [...out].map((s) => s.trim()).filter((s) => s && s !== raw);
}

// ─────────────────────────────────────────────────────────────
// เรขาคณิต
// ─────────────────────────────────────────────────────────────

function haversineM([lng1, lat1], [lng2, lat2]) {
  const R = 6371008.8;
  const p = Math.PI / 180;
  const dLat = (lat2 - lat1) * p;
  const dLng = (lng2 - lng1) * p;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function lineLengthM(coords) {
  let sum = 0;
  for (let i = 0; i < coords.length - 1; i++) sum += haversineM(coords[i], coords[i + 1]);
  return Math.round(sum * 10) / 10;
}

function centroid(coords) {
  const n = coords.length;
  return [
    coords.reduce((s, c) => s + c[0], 0) / n,
    coords.reduce((s, c) => s + c[1], 0) / n,
  ];
}

// ─────────────────────────────────────────────────────────────
// ตรวจความถูกต้องของไฟล์
// ─────────────────────────────────────────────────────────────

function validate(features) {
  const errors = [];
  const seen = new Set();

  for (const [i, f] of features.entries()) {
    const p = f.properties ?? {};
    const g = f.geometry ?? {};
    const at = `feature #${i} (roadId=${p.roadId ?? "—"})`;

    if (!p.roadId) errors.push(`${at}: ไม่มี roadId`);
    else if (seen.has(p.roadId)) errors.push(`${at}: roadId ซ้ำ`);
    else seen.add(p.roadId);

    if (g.type !== "LineString") errors.push(`${at}: geometry ไม่ใช่ LineString (${g.type})`);
    else if (!Array.isArray(g.coordinates) || g.coordinates.length < 2)
      errors.push(`${at}: พิกัดน้อยกว่า 2 จุด`);
    else {
      // ป้องกันการ import ข้อมูลที่ยังเป็น UTM หรือแปลง datum ผิด
      const [lng, lat] = g.coordinates[0];
      if (Math.abs(lng) > 180 || Math.abs(lat) > 90)
        errors.push(`${at}: พิกัดไม่ใช่ WGS84 — ยังเป็น UTM อยู่หรือเปล่า`);
      else if (lng < 97 || lng > 106 || lat < 5 || lat > 21)
        errors.push(`${at}: พิกัดอยู่นอกประเทศไทย (${lat.toFixed(4)}, ${lng.toFixed(4)}) — ตรวจ datum: ต้องแปลงจาก EPSG:24047 ไม่ใช่ EPSG:32647`);
    }
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────

async function main() {
  const [, , file, ...flags] = process.argv;
  const dryRun = flags.includes("--dry-run");
  const forceRetire = flags.includes("--force-retire");

  if (!file) {
    console.error("ใช้: node import-roads.mjs <road_takhli.geojson> [--dry-run]");
    process.exit(1);
  }
  const uri = process.env.MONGO_URI;
  if (!uri && !dryRun) {
    console.error("ต้องตั้ง MONGO_URI");
    process.exit(1);
  }

  const gj = JSON.parse(readFileSync(file, "utf8"));
  const features = gj.features ?? [];
  console.log(`อ่านไฟล์ได้ ${features.length} เส้น`);

  const errors = validate(features);
  if (errors.length) {
    console.error(`\nพบข้อผิดพลาด ${errors.length} รายการ — ยกเลิกการนำเข้า\n`);
    errors.slice(0, 20).forEach((e) => console.error("  " + e));
    if (errors.length > 20) console.error(`  … และอีก ${errors.length - 20} รายการ`);
    process.exit(1);
  }

  const now = new Date();
  const docs = features.map((f) => {
    const p = f.properties;
    const coords = f.geometry.coordinates;
    const name = p.name?.trim() || null;
    return {
      roadId: p.roadId,
      name,
      aliases: buildAliases(name),
      nameStatus: name ? "ok" : "missing",
      roadType: p.roadType?.trim() || null,
      lengthM: lineLengthM(coords),
      geometry: { type: "LineString", coordinates: coords },
      centroid: { type: "Point", coordinates: centroid(coords) },
      active: p.nameStatus === "retired" ? false : true,
      source: SOURCE,
      updatedAt: now,
    };
  });

  const named = docs.filter((d) => d.name).length;
  const totalKm = (docs.reduce((s, d) => s + d.lengthM, 0) / 1000).toFixed(1);
  console.log(`มีชื่อ ${named}/${docs.length} เส้น • ความยาวรวม ${totalKm} กม.`);

  if (dryRun) {
    console.log("\n--dry-run: ไม่เขียนฐานข้อมูล ตัวอย่าง 3 รายการแรก:");
    console.log(JSON.stringify(docs.slice(0, 3).map((d) => ({ ...d, geometry: "…" })), null, 2));
    return;
  }

  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  await client.connect();
  // ใช้ db ตาม URI ให้ตรงกับส่วนอื่นของแอป (lib/dbConnect.js ก็ใช้ db จาก MONGO_URI)
  const col = client.db(process.env.MONGODB_DB || undefined).collection(COLLECTION);

  await col.createIndex({ roadId: 1 }, { unique: true });
  await col.createIndex({ geometry: "2dsphere" });
  await col.createIndex({ centroid: "2dsphere" });
  await col.createIndex({ name: "text", aliases: "text" }, { default_language: "none" });
  await col.createIndex({ active: 1, nameStatus: 1 });

  const res = await col.bulkWrite(
    docs.map((d) => ({
      updateOne: {
        filter: { roadId: d.roadId },
        // เส้นที่กลับเข้ามาในไฟล์ = active อีกครั้ง — ล้าง retiredAt ค้างด้วย
        update: { $set: d, $unset: { retiredAt: "" }, $setOnInsert: { createdAt: now } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
  console.log(`เพิ่มใหม่ ${res.upsertedCount} • อัปเดต ${res.modifiedCount}`);

  // เส้นที่หายไปจากไฟล์ → ปิดการใช้งาน ไม่ลบ
  const ids = docs.map((d) => d.roadId);
  const wouldRetire = await col.countDocuments({ roadId: { $nin: ids }, active: true });
  const activeTotal = await col.countDocuments({ active: true });
  // กันพลาด: ถ้าไฟล์มีเส้นน้อยกว่า 80% ของที่ active อยู่ น่าจะเป็นไฟล์บางส่วน — ไม่ retire ให้เอง
  if (wouldRetire > 0 && docs.length < activeTotal * 0.8 && !forceRetire) {
    console.warn(
      `จะปิดการใช้งาน ${wouldRetire} เส้นที่ไม่อยู่ในไฟล์ (ไฟล์มี ${docs.length}/${activeTotal} เส้นที่ active) — ` +
        `ถ้าตั้งใจใช้ไฟล์บางส่วน ให้รันด้วย --force-retire · ข้ามขั้นตอน retire`
    );
  } else if (wouldRetire > 0) {
    const retired = await col.updateMany(
      { roadId: { $nin: ids }, active: true },
      { $set: { active: false, retiredAt: now } }
    );
    console.log(`ปิดการใช้งาน ${retired.modifiedCount} เส้นที่ไม่มีในไฟล์แล้ว (ไม่ได้ลบ)`);
  }

  const missing = await col.countDocuments({ active: true, nameStatus: "missing" });
  if (missing) console.log(`\nยังไม่มีชื่อ ${missing} เส้น`);

  await client.close();
  console.log("เสร็จเรียบร้อย");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
