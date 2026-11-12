// ประวัติผลวัดย้อนหลัง "ทุกปี" ของผู้เรียน 1 คน — ใช้กรณีต้องแสดงให้แพทย์ดู
// ใช้ทั้ง /api/elderly-school/checkin (action "history" หน้ามือถือ) และ /api/elderly-school/history (แอดมิน พิมพ์สรุป)
// ไม่มี DB/React — ข้อมูลเป็นค่าคัดกรองจากโรงเรียนผู้สูงอายุ ไม่ใช่เวชระเบียน
import { bpCategory, computeBMI } from "../health/metrics";
import { visitBp, visitHasData } from "./personal";

const BP_TONE = { normal: "ok", risk: "care", high: "see", low: "see", unknown: "none" };

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * person = { heightCm }
 * visits = ElderlyVisit ทุกปี
 * schedules = [{ yearBE, sessions: [{ visitNo, dateISO }] }] — ใช้เติมวันที่ให้ผลวัดที่นำเข้าจากชีต (ไม่มี checkinDate)
 * คืน { years: [{ yearBE, rows }], totalVisits, firstYear, lastYear }
 *   rows เรียงใหม่ → เก่า (แพทย์ดูค่าล่าสุดก่อน), years เรียงใหม่ → เก่า
 */
export function buildHealthHistory({ person, visits, schedules }) {
  const dateOf = new Map();
  for (const s of schedules || []) {
    for (const x of s?.sessions || []) {
      if (x?.dateISO) dateOf.set(`${s.yearBE}-${x.visitNo}`, String(x.dateISO));
    }
  }

  const byYear = new Map();
  for (const v of visits || []) {
    if (!visitHasData(v)) continue;
    const yearBE = Number(v.yearBE);
    const bp = visitBp(v);
    const cat = bp ? bpCategory(bp.sys, bp.dia) : "unknown";
    const heightCm = num(v.heightCm) ?? num(person?.heightCm);
    const bmi = computeBMI(v.weightKg, heightCm);
    const row = {
      yearBE,
      visitNo: Number(v.visitNo),
      dateISO: v.checkinDate || dateOf.get(`${yearBE}-${v.visitNo}`) || null,
      bp: bp ? `${bp.sys}/${bp.dia}` : null,
      bpSys: bp?.sys ?? null,
      bpCategory: cat,
      bpTone: BP_TONE[cat] || "none",
      pulseBpm: num(v.pulseBpm),
      weightKg: num(v.weightKg),
      waistCm: num(v.waistCm),
      bmi: bmi != null ? Math.round(bmi * 10) / 10 : null,
    };
    if (!byYear.has(yearBE)) byYear.set(yearBE, []);
    byYear.get(yearBE).push(row);
  }

  const years = [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([yearBE, rows]) => ({ yearBE, rows: rows.sort((a, b) => b.visitNo - a.visitNo) }));

  return {
    years,
    totalVisits: years.reduce((n, y) => n + y.rows.length, 0),
    firstYear: years.length ? years[years.length - 1].yearBE : null,
    lastYear: years.length ? years[0].yearBE : null,
  };
}

/** สรุปความดันรายปี (สำหรับหัวกระดาษพิมพ์): ค่าเฉลี่ยตัวบน + จำนวนครั้งที่สูง (≥140/90) */
export function yearlyBpSummary(history) {
  return (history?.years || []).map(({ yearBE, rows }) => {
    const withBp = rows.filter((r) => r.bpSys != null);
    const avgSys = withBp.length ? Math.round(withBp.reduce((s, r) => s + r.bpSys, 0) / withBp.length) : null;
    return { yearBE, measured: withBp.length, avgSys, highCount: rows.filter((r) => r.bpCategory === "high").length };
  });
}
