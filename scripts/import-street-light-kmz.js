// One-time seed: นำเข้าเสาไฟจาก KMZ (MapMarker export) → collection street_light_poles
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local scripts/import-street-light-kmz.js --dry-run
//   node --env-file=.env.local scripts/import-street-light-kmz.js
//
// Idempotent: เช็คซ้ำรายจุดด้วยคีย์ (source, group, name, lat, lng) — รันซ้ำไม่สร้างซ้ำ
// (ต้องมีพิกัดในคีย์ เพราะไฟล์ต้นทางมีชื่อ marker ซ้ำในกลุ่มเดียวกัน 2 คู่ที่เป็นเสาคนละต้นจริง)
// และไม่ทับข้อมูลที่เจ้าหน้าที่แก้ไปแล้ว (ข้ามจุดที่มีอยู่)
// รหัสเสา TK-LED-ปปดด##### เลขต้นวิ่งต่อจากเลขสูงสุดใน DB

const { execFileSync } = require("child_process");
const path = require("path");
const mongoose = require("mongoose");

const KMZ_PATH = path.join(
  __dirname,
  "..",
  "public",
  "point_of_ligth",
  "export_2025_03_27-00_14_07.kmz"
);
const PREFIX = "TK-LED";

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

// doc.kml จาก MapMarker โครงสร้างสม่ำเสมอ — แกะ Folder/Placemark ด้วย regex ได้
function parseKml(xml) {
  const folders = [];
  const chunks = xml.split(/<Folder[^>]*>/).slice(1);
  for (const chunk of chunks) {
    const body = chunk.split("</Folder>")[0];
    const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/);
    const group = nameMatch ? decodeXml(nameMatch[1].trim()) : "ไม่ระบุกลุ่ม";
    const points = [];
    const placemarkRe = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/g;
    let m;
    while ((m = placemarkRe.exec(body))) {
      const pm = m[1];
      const pName = pm.match(/<name>([\s\S]*?)<\/name>/);
      const coord = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
      if (!coord) continue;
      const [lng, lat] = coord[1].trim().split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      points.push({ name: pName ? decodeXml(pName[1].trim()) : "", lat, lng });
    }
    folders.push({ group, points });
  }
  return folders;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  }

  const xml = execFileSync("unzip", ["-p", KMZ_PATH, "doc.kml"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const folders = parseKml(xml);
  const totalPoints = folders.reduce((sum, f) => sum + f.points.length, 0);
  console.log(`อ่าน KMZ: ${folders.length} กลุ่ม / ${totalPoints} จุด`);
  if (folders.length === 0 || totalPoints === 0) {
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

  let inserted = 0;
  let skipped = 0;
  for (const folder of folders) {
    for (const pt of folder.points) {
      const key = { source: "kmz-import", group: folder.group, name: pt.name, lat: pt.lat, lng: pt.lng };
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
          lampType: "unknown",
          status: "unknown",
          photoUrl: "",
          note: "",
          lastSurveyedAt: null,
          lastSurveyedBy: "",
          surveys: [],
        });
      }
      inserted += 1;
    }
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
