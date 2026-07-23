// One-time seed (รอบ 2): นำเข้าเสาไฟจากไฟล์ ไฟสาธารณะ700.kml → collection street_light_poles
//
// ที่มา: ข้อมูลสำรวจชุดใหม่ 698 จุด (เลเยอร์เดียว ไม่มีชื่อกลุ่มในไฟล์) — ตั้งกลุ่ม "ไฟสาธารณะ 700"
// ผู้สำรวจ/นำเข้า: Wasupol Chankin — หลอด LED ทั้งหมด สถานะใช้งานได้ (normal)
// จึงบันทึกเป็น survey แรกของเสาแต่ละต้นด้วย (lastSurveyedBy + surveys[])
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/import-street-light-700-kml.js --dry-run
//   node --env-file=.env.local scripts/import-street-light-700-kml.js
//
// Idempotent: เช็คซ้ำรายจุดด้วยคีย์ (source, group, name, lat, lng) — รันซ้ำไม่สร้างซ้ำ
// รหัสเสา TK-LED-ปปดด##### เลขต้นวิ่งต่อจากเลขสูงสุดใน DB (แบบเดียวกับ import-street-light-kmz.js)

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const KML_PATH = path.join(
  __dirname,
  "..",
  "public",
  "point_of_ligth",
  "ไฟสาธารณะ700.kml"
);
const PREFIX = "TK-LED";
const GROUP_NAME = "ไฟสาธารณะ 700";
const SURVEYED_BY = "Wasupol Chankin";
const SURVEYED_BY_CLERK_ID = "user_3GOERVnJjQX68PWxWJiXw1BuVdu";

function buddhistYearMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year").value) + 543;
  const month = parts.find((p) => p.type === "month").value;
  return `${String(year % 100).padStart(2, "0")}${month}`;
}

function decodeXml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ไฟล์นี้ไม่มี Folder — แกะทุก Placemark ในเอกสารตรง ๆ (name = เลขจุด, description = ซอย ถ้ามี)
function parseKml(xml) {
  const points = [];
  const placemarkRe = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/g;
  let m;
  while ((m = placemarkRe.exec(xml))) {
    const pm = m[1];
    const pName = pm.match(/<name>([\s\S]*?)<\/name>/);
    const pDesc = pm.match(/<description>([\s\S]*?)<\/description>/);
    const coord = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!coord) continue;
    const [lng, lat] = coord[1].trim().split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    points.push({
      name: pName ? decodeXml(pName[1].trim()) : "",
      note: pDesc ? decodeXml(pDesc[1].trim()) : "",
      lat,
      lng,
    });
  }
  return points;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }

  const xml = fs.readFileSync(KML_PATH, "utf8");
  const points = parseKml(xml);
  console.log(`อ่าน KML: ${points.length} จุด → กลุ่ม "${GROUP_NAME}"`);
  if (points.length === 0) {
    throw new Error("parse KML ไม่ได้ผลลัพธ์ — ยกเลิก ไม่เขียนข้อมูล");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const Pole =
    mongoose.models.StreetLightPole ||
    mongoose.model(
      "StreetLightPole",
      new mongoose.Schema({}, { strict: false, collection: "street_light_poles", timestamps: true })
    );

  // เลขต้นวิ่งต่อจากเลขสูงสุดใน DB (sort code แบบ string ได้ตัวสูงสุด เพราะเลขต้นไม่รีเซ็ต)
  const last = await Pole.findOne({ code: new RegExp(`^${PREFIX}-\\d{9}$`) })
    .sort({ code: -1 })
    .select("code")
    .lean();
  let running = last ? Number(last.code.slice(-5)) : 0;
  const yymm = buddhistYearMonth();
  const now = new Date();

  let inserted = 0;
  let skipped = 0;
  for (const pt of points) {
    const key = { source: "kmz-import", group: GROUP_NAME, name: pt.name, lat: pt.lat, lng: pt.lng };
    const exists = await Pole.findOne(key).select("_id").lean();
    if (exists) {
      skipped += 1;
      continue;
    }
    running += 1;
    if (!dryRun) {
      await Pole.create({
        ...key,
        code: `${PREFIX}-${yymm}${String(running).padStart(5, "0")}`,
        lampType: "led",
        status: "normal",
        photoUrl: "",
        note: pt.note,
        lastSurveyedAt: now,
        lastSurveyedBy: SURVEYED_BY,
        surveys: [
          {
            status: "normal",
            photoUrl: "",
            note: "นำเข้าจากไฟล์ ไฟสาธารณะ700.kml (LED ใช้งานได้ทั้งหมด)",
            surveyedAt: now,
            surveyedBy: SURVEYED_BY,
            surveyedByClerkId: SURVEYED_BY_CLERK_ID,
          },
        ],
      });
    }
    inserted += 1;
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}เพิ่มใหม่ ${inserted} ต้น | ข้าม (มีอยู่แล้ว) ${skipped} ต้น`
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
