// ตารางวันเรียน 16 ครั้ง — ตรวจ/ทำความสะอาดข้อมูลก่อนบันทึก และรวมค่าเริ่มต้นเข้ากับรายครั้ง
// ใช้ทั้ง API (schedule, checkin) และหน้าแอดมิน — ไม่มี DB/React

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanText(v, max) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

function cleanTime(v) {
  const s = String(v ?? "").trim();
  return TIME.test(s) ? s : null;
}

/** เบอร์โทร: เก็บเฉพาะตัวเลข + - และช่องว่าง, ต้องมีตัวเลข 9–10 หลัก (เบอร์บ้าน/มือถือไทย) */
export function cleanPhone(v) {
  const s = String(v ?? "").replace(/[^\d\s-]/g, "").replace(/\s+/g, " ").trim();
  const digits = s.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 10 ? s : null;
}

/** ค่าเริ่มต้นทุกครั้ง: เวลาเริ่ม/เลิก + สถานที่ + ผู้ติดต่อ (แสดงให้ผู้เรียนกดโทรจากหน้ามือถือ) */
export function normalizeDefaults(raw) {
  return {
    startTime: cleanTime(raw?.startTime),
    endTime: cleanTime(raw?.endTime),
    location: cleanText(raw?.location, 120),
    contactName: cleanText(raw?.contactName, 80),
    contactPhone: cleanPhone(raw?.contactPhone),
  };
}

/** ผู้ติดต่อของปี (null ถ้าไม่มีเบอร์) */
export function scheduleContact(schedule) {
  const d = normalizeDefaults(schedule?.defaults);
  return d.contactPhone ? { name: d.contactName, phone: d.contactPhone, tel: d.contactPhone.replace(/\D/g, "") } : null;
}

/**
 * ทำความสะอาดรายครั้ง: ครั้งที่ 1–16, วันที่ YYYY-MM-DD, ไม่ซ้ำครั้ง (ใช้ตัวหลัง), ไม่ซ้ำวัน (ใช้ตัวแรก)
 * ฟิลด์เสริม (เวลา/สถานที่/สิ่งที่ควรเตรียม) ว่าง = ใช้ค่าเริ่มต้น
 */
export function normalizeSessions(sessions) {
  const arr = Array.isArray(sessions) ? sessions : [];
  const byVisit = new Map();
  for (const s of arr) {
    const visitNo = Number(s?.visitNo);
    const dateISO = String(s?.dateISO || "").trim();
    if (!Number.isInteger(visitNo) || visitNo < 1 || visitNo > 16 || !ISO.test(dateISO)) continue;
    byVisit.set(visitNo, {
      visitNo,
      dateISO,
      note: cleanText(s?.note, 200),
      startTime: cleanTime(s?.startTime),
      endTime: cleanTime(s?.endTime),
      location: cleanText(s?.location, 120),
      prepare: cleanText(s?.prepare, 300),
    });
  }
  const seenDates = new Set();
  const out = [];
  for (const s of [...byVisit.values()].sort((a, b) => a.visitNo - b.visitNo)) {
    if (seenDates.has(s.dateISO)) continue;
    seenDates.add(s.dateISO);
    out.push(s);
  }
  return out;
}

/** รวมค่าเริ่มต้นเข้ากับรายครั้ง (ใช้แสดงผลให้ผู้เรียน) */
export function effectiveSessions(schedule) {
  const d = normalizeDefaults(schedule?.defaults);
  return normalizeSessions(schedule?.sessions).map((s) => ({
    visitNo: s.visitNo,
    dateISO: s.dateISO,
    note: s.note,
    startTime: s.startTime || d.startTime,
    endTime: s.endTime || d.endTime,
    location: s.location || d.location,
    prepare: s.prepare,
  }));
}

/** "09:00–12:00" / "09:00" / "" */
export function formatTimeRange(startTime, endTime) {
  if (startTime && endTime) return `${startTime}–${endTime} น.`;
  if (startTime) return `${startTime} น.`;
  return "";
}

/**
 * ครั้งที่วันที่ย้อนหลังกว่าครั้งก่อนหน้า (เช่น ครั้งที่ 13 อยู่ก่อนครั้งที่ 12) — มักเป็นวันที่พิมพ์ผิด
 * คืน [{ visitNo, prevVisitNo }] โดย prevVisitNo = ครั้งก่อนหน้าที่มีวันที่ช้าที่สุด
 * ใช้เตือนเท่านั้น ไม่บล็อกการบันทึก (บางปีอาจสลับลำดับจริง)
 */
export function outOfOrderVisits(sessions) {
  const list = (Array.isArray(sessions) ? sessions : [])
    .filter((s) => Number.isInteger(Number(s?.visitNo)) && ISO.test(String(s?.dateISO || "")))
    .map((s) => ({ visitNo: Number(s.visitNo), dateISO: String(s.dateISO) }))
    .sort((a, b) => a.visitNo - b.visitNo);
  const out = [];
  let latest = null;
  for (const s of list) {
    if (latest && s.dateISO < latest.dateISO) out.push({ visitNo: s.visitNo, prevVisitNo: latest.visitNo });
    if (!latest || s.dateISO > latest.dateISO) latest = s;
  }
  return out;
}

/**
 * ปีหลักสูตรที่ใช้เช็คอินจริง — บัตร QR ฝังปีที่พิมพ์ไว้ (เช่น 2569) แต่ผู้เรียนเดิมใช้บัตรใบเดิมต่อในปีถัดไป
 * ถ้ามีหลักสูตรปีที่ใหม่กว่าบัตร และครั้งแรกของปีนั้นเริ่มแล้ว (วันที่ <= วันนี้) → ใช้ปีใหม่ล่าสุดที่เริ่มแล้ว
 * ยังไม่เริ่ม → ใช้ปีบนบัตร (ผู้เรียนยังดูผลปีเก่าได้)
 * schedules = [{ yearBE, sessions: [{ dateISO }] }]
 */
export function resolveCheckinYear(cardYearBE, schedules, todayISO) {
  let year = Number(cardYearBE);
  for (const s of Array.isArray(schedules) ? schedules : []) {
    const y = Number(s?.yearBE);
    if (!Number.isFinite(y) || y <= year) continue;
    const dates = (Array.isArray(s?.sessions) ? s.sessions : []).map((x) => String(x?.dateISO || "")).filter((d) => ISO.test(d));
    if (!dates.length) continue;
    const first = dates.reduce((a, b) => (b < a ? b : a));
    if (first <= todayISO) year = y;
  }
  return year;
}
