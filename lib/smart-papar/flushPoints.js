// ทะเบียนหัวโบล์ (จุดที่ใช้โบตะกอน) — logic ล้วน ใช้ได้ทั้งสคริปต์นำเข้า, API และหน้าเว็บ
// ข้อมูลตั้งต้นมาจากแอป Glide เดิม (ส่งออกเป็น KMZ ผ่าน Google Earth) — ดู scripts/import-flush-points.mjs

export const FLUSH_POINT_KIND_LABELS = {
  tee_large: "ตัวทีใหญ่",
  tee_medium: "ตัวทีกลาง",
  tee_small: "ตัวทีเล็ก",
  garland: "พวงมาลัย",
  unknown: "ไม่ระบุชนิด",
};

const KIND_BY_THAI = Object.fromEntries(
  Object.entries(FLUSH_POINT_KIND_LABELS).map(([k, v]) => [v, k])
);

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'" };
const decode = (s) => String(s ?? "").replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m]).trim();

// "24/1/2568 11:10:13" (ปี พ.ศ., เวลาไทย) → Date · ไม่มีเวลา = เที่ยงคืนเวลาไทย
export function parseThaiDateTime(text) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(text || "").trim());
  if (!m) return null;
  const [, d, mo, by, h = "0", mi = "0", s = "0"] = m;
  return new Date(Date.UTC(Number(by) - 543, Number(mo) - 1, Number(d), Number(h) - 7, Number(mi), Number(s)));
}

// อ่าน KML ที่ส่งออกจาก Google Earth (ExtendedData/SimpleData) → รายการหัวโบล์
// ชื่อ field เป็นชื่อที่ Google Earth แปลงจากหัวคอลัมน์ไทย (สระ/วรรณยุกต์กลายเป็น "_")
// พิกัดใช้ <coordinates> ที่ละเอียด ไม่ใช้คอลัมน์ lat/lng ที่ถูกปัดเหลือ 3–4 ตำแหน่ง
export function parseFlushPointsKml(kmlText) {
  const out = [];
  const placemarks = String(kmlText).match(/<Placemark[\s\S]*?<\/Placemark>/g) || [];
  for (const pm of placemarks) {
    const f = {};
    for (const m of pm.matchAll(/<SimpleData name="([^"]+)">([\s\S]*?)<\/SimpleData>/g)) f[m[1]] = decode(m[2]);
    const coord = /<coordinates>\s*([-\d.]+),([-\d.]+)/.exec(pm);
    const code = f["รห_สห_วโบล_"] || "";
    if (!coord || !code) continue;
    out.push({
      code,
      typeCode: f.type_head_bor || "",
      kind: KIND_BY_THAI[f["ชน_ดห_วโบล_"]] || "unknown",
      roadName: f["ถนน_ซอย"] || "",
      name: f["ช__อห_วโบล_"] || "",
      location: { type: "Point", coordinates: [Number(coord[1]), Number(coord[2])] },
      photoSourceUrl: f["ภาพสถานท__"] || "",
      legacy: {
        system: "glide",
        rowId: f.___Row_ID || "",
        surveyedAt: parseThaiDateTime(f["ว_นท__สร_างข_อม_ล"]),
        surveyedBy: f["ผ__บ_นท_กข_อม_ล"] || "",
      },
    });
  }
  return out;
}

export function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// หัวโบล์ที่ใกล้ตำแหน่งปัจจุบันที่สุด — ทำฝั่ง client ได้เพราะทั้งระบบมีแค่หลักร้อยจุด
export function nearestFlushPoints(points, lat, lng, { limit = 3, maxM = 150 } = {}) {
  if (lat == null || lng == null) return [];
  return (points || [])
    .filter((p) => Array.isArray(p.location?.coordinates))
    .map((p) => ({
      point: p,
      distanceM: Math.round(distanceM(lat, lng, p.location.coordinates[1], p.location.coordinates[0])),
    }))
    .filter((x) => x.distanceM <= maxM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

export function flushPointLabel(p) {
  if (!p) return "";
  return [p.name || p.roadName, `(${p.code})`].filter(Boolean).join(" ");
}
