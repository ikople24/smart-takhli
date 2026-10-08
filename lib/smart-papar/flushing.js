// logic ล้วนของระบบบันทึกโบตะกอน — ใช้ทั้งฝั่ง API (ตรวจข้อมูลจริง) และฝั่งหน้าเว็บ (label/สรุป)
// ห้าม import อะไรที่ผูกกับเซิร์ฟเวอร์ (Clerk/Mongo) ในไฟล์นี้

export const FLUSHING_RESULTS = ["clear", "still_turbid"];
export const FLUSHING_RESULT_LABELS = { clear: "ใสแล้ว", still_turbid: "ยังขุ่น" };
export const MAX_PHOTOS_PER_SLOT = 3;
export const EDIT_WINDOW_DAYS = 7;

const CLOUDINARY_PREFIX = "https://res.cloudinary.com/";
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function isBlank(v) {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

function toNumber(v) {
  if (isBlank(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function photoList(v) {
  return Array.isArray(v) ? v : [];
}

// คืน { ok, value, errors } — errors เป็นข้อความภาษาไทยรายช่อง (key ตรงกับช่องในฟอร์ม)
export function validateFlushingInput(body, now = new Date()) {
  const b = body || {};
  const errors = {};

  const flushedAt = new Date(b.flushedAt);
  if (isBlank(b.flushedAt) || Number.isNaN(flushedAt.getTime())) {
    errors.flushedAt = "กรุณาระบุวันเวลาที่โบตะกอน";
  } else if (flushedAt.getTime() > now.getTime() + 60 * 60 * 1000) {
    errors.flushedAt = "วันเวลาเป็นอนาคตไม่ได้";
  }

  const lat = toNumber(b.lat);
  const lng = toNumber(b.lng);
  if (lat === null || lng === null) {
    errors.location = "กรุณากดปุ่มใช้ตำแหน่งปัจจุบัน";
  } else if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) {
    errors.location = "พิกัดไม่ถูกต้อง";
  }

  const locationName = typeof b.locationName === "string" ? b.locationName.trim() : "";
  if (!locationName) errors.locationName = "กรุณาระบุชื่อจุดหรือถนน";
  else if (locationName.length > 200) errors.locationName = "ชื่อจุดยาวเกิน 200 ตัวอักษร";

  const durationMin = toNumber(b.durationMin);
  if (durationMin === null) errors.durationMin = "กรุณาระบุระยะเวลา (นาที)";
  else if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 600) {
    errors.durationMin = "ระยะเวลาต้องเป็นจำนวนเต็ม 1–600 นาที";
  }

  const ntu = {};
  for (const key of ["turbidityBeforeNtu", "turbidityAfterNtu"]) {
    const n = toNumber(b[key]);
    if (n !== null && !(n >= 0 && n <= 1000)) errors[key] = "ค่าความขุ่นต้องอยู่ระหว่าง 0–1000 NTU";
    ntu[key] = n;
  }

  if (!FLUSHING_RESULTS.includes(b.result)) errors.result = "กรุณาเลือกผล: ใสแล้ว หรือ ยังขุ่น";

  const photosBefore = photoList(b.photosBefore);
  const photosAfter = photoList(b.photosAfter);
  const allPhotos = [...photosBefore, ...photosAfter];
  if (photosBefore.length > MAX_PHOTOS_PER_SLOT || photosAfter.length > MAX_PHOTOS_PER_SLOT) {
    errors.photos = `แนบรูปได้ช่องละไม่เกิน ${MAX_PHOTOS_PER_SLOT} รูป`;
  } else if (allPhotos.some((u) => typeof u !== "string" || !u.startsWith(CLOUDINARY_PREFIX))) {
    errors.photos = "ไฟล์รูปไม่ถูกต้อง กรุณาอัปโหลดใหม่";
  } else if (allPhotos.length === 0) {
    errors.photos = "กรุณาแนบรูปอย่างน้อย 1 รูป";
  }

  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (note.length > 1000) errors.note = "หมายเหตุยาวเกิน 1000 ตัวอักษร";

  // หัวโบล์จากทะเบียน (ไม่บังคับ) — ตรวจแค่รูปแบบที่นี่ ฝั่ง API ต้องเช็คว่ามีอยู่จริงด้วย attachFlushPoint
  const flushPointId = isBlank(b.flushPointId) ? null : String(b.flushPointId);
  if (flushPointId && !/^[a-f0-9]{24}$/i.test(flushPointId)) errors.flushPointId = "หัวโบล์ที่เลือกไม่ถูกต้อง";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      flushedAt,
      location: { type: "Point", coordinates: [lng, lat] },
      locationName,
      durationMin,
      turbidityBeforeNtu: ntu.turbidityBeforeNtu,
      turbidityAfterNtu: ntu.turbidityAfterNtu,
      result: b.result,
      photosBefore,
      photosAfter,
      note,
      flushPointId,
    },
  };
}

// YYYY-MM-DD ตามปฏิทินไทย
export function bangkokYmd(date) {
  return new Date(new Date(date).getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

function ymdToUtcMs(ymd) {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  return Date.UTC(y, m - 1, d);
}

// เจ้าของแก้/ลบได้ภายใน 7 วัน (ปฏิทินไทย) นับจากวันที่บันทึก (createdAt — แก้ไม่ได้ จึงยืดเวลาเองไม่ได้)
// · superadmin ได้เสมอ
export function canModifyFlushingLog(log, actor, now = new Date()) {
  if (actor?.isSuperAdmin) return true;
  if (!log || !actor?.userId || log.createdByClerkId !== actor.userId) return false;
  const diffDays = Math.floor(
    (ymdToUtcMs(bangkokYmd(now)) - ymdToUtcMs(bangkokYmd(log.createdAt))) / 86400000
  );
  return diffDays >= 0 && diffDays <= EDIT_WINDOW_DAYS;
}

export function summarizeFlushing(logs) {
  const list = Array.isArray(logs) ? logs : [];
  const clear = list.filter((l) => l.result === "clear").length;
  const stillTurbid = list.filter((l) => l.result === "still_turbid").length;
  return { total: list.length, clear, stillTurbid };
}

// ช่วงวันไทย [from, to] (รวมทั้งวัน to) → ขอบเวลา UTC { start, end } แบบ start <= t < end
export function bangkokDayRange(from, to) {
  if (!YMD_RE.test(String(from || "")) || !YMD_RE.test(String(to || ""))) return null;
  const start = ymdToUtcMs(from) - BANGKOK_OFFSET_MS;
  const end = ymdToUtcMs(to) + 86400000 - BANGKOK_OFFSET_MS;
  if (!(end > start)) return null;
  return { start: new Date(start), end: new Date(end) };
}

// % ความขุ่นที่ลดลงหลังโบ (ปัดเป็นจำนวนเต็ม; ติดลบ = ขุ่นขึ้น) · ข้อมูลไม่ครบ/ก่อนโบเป็น 0 → null
export function ntuChangePct(before, after) {
  const toNum = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  const b = toNum(before);
  const a = toNum(after);
  if (!Number.isFinite(b) || !Number.isFinite(a) || b <= 0) return null;
  return Math.round(((b - a) / b) * 100);
}
