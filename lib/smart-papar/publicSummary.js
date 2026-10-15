// สรุปคุณภาพน้ำประปาสำหรับหน้าประชาชน (/papar) — logic ล้วน (เทสต์: __tests__/publicSummary.test.js)
// ใช้เฉพาะค่าน้ำประปาจ่ายออก (tap) — ไม่แสดงน้ำดิบ เพราะขุ่นเป็นปกติ ประชาชนอาจเข้าใจผิด

// เกณฑ์น้ำประปาดื่มได้ กรมอนามัย — เจ้าของยืนยันตัวเลข 2026-10-15
export const WATER_STANDARDS = { ntuMax: 5, phMin: 6.5, phMax: 8.5, tdsMax: 600 };

const num = (v) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

// true = อยู่ในเกณฑ์ · false = เกินเกณฑ์ · null = ไม่มีค่า
export function ntuWithin(v) {
  const n = num(v);
  return n === null ? null : n <= WATER_STANDARDS.ntuMax;
}
export function phWithin(v) {
  const n = num(v);
  return n === null ? null : n >= WATER_STANDARDS.phMin && n <= WATER_STANDARDS.phMax;
}
export function tdsWithin(v) {
  const n = num(v);
  return n === null ? null : n <= WATER_STANDARDS.tdsMax;
}

// แถวตารางรายวัน — status: ok (ทุกค่าที่มีอยู่ในเกณฑ์) · over (เกินอย่างน้อย 1 ค่า) · none (ไม่มีค่าเลย)
export function dailyRow(doc) {
  const tap = doc?.tap || {};
  const ntu = num(tap.turbidityNtu);
  const ph = num(tap.ph);
  const tds = num(tap.tdsMgL);
  const checks = [ntuWithin(ntu), phWithin(ph), tdsWithin(tds)].filter((c) => c !== null);
  const status = checks.length === 0 ? "none" : checks.every(Boolean) ? "ok" : "over";
  return { recordDate: doc?.recordDate, ntu, ph, tds, status };
}

// งานโบตะกอนรายวัน (รับผลรวมรายวันไทยจาก API) → ใหม่สุดก่อน + % ใสแล้ว · วันที่ไม่มีงานไม่นับ
export function flushingDaily(days) {
  return (days || [])
    .filter((d) => d && d.total > 0)
    .map((d) => ({ date: d.date, total: d.total, clear: d.clear, clearPct: Math.round((d.clear / d.total) * 100) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
