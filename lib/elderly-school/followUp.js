// ตรรกะล้วนของหน้าโรงเรียนผู้สูงอายุ (แท็บ): เหตุผลที่ต้องติดตาม, การ์ดสุขภาพทั้งกลุ่ม, สถานะวันเรียน
// ไม่มี React/DB — ทดสอบได้ใน lib/elderly-school/__tests__/followUp.test.js

/** โทนสีสถานะ — ใช้คู่กับ TONE_STYLES ใน components/elderly-school/elderlyTheme.jsx */
export const TONES = ["ok", "care", "see", "low", "none", "mind"];

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * ต้องติดตามใกล้ชิด = ความดันสูง หรือ NCD 3/3 หรือ 2Q บวก หรือชีพจรผิดปกติ
 * (แคบกว่า overallRisk ของ API ที่รวม BMI/BP เสี่ยงทุกระดับ)
 */
export function needsCloseFollowUp(p) {
  if (!p) return false;
  if (p?.bp?.category === "high") return true;
  if (num(p?.metabolicRiskScore) === 3) return true;
  if (p?.mentalHealth?.q2Positive === true) return true;
  if (p?.pulseCategory === "low" || p?.pulseCategory === "high") return true;
  return false;
}

/** ป้ายเหตุผลที่ต้องติดตามของแต่ละคน เรียงจากเรื่องสำคัญก่อน */
export function followUpFlags(p) {
  if (!p) return [];
  const flags = [];
  const sys = num(p?.bp?.systolic);
  const dia = num(p?.bp?.diastolic);
  if (p?.bp?.category === "high" && sys !== null && dia !== null) {
    flags.push({ key: "bp", label: `ความดัน ${sys}/${dia}`, tone: "see" });
  } else if (p?.bp?.category === "low" && sys !== null && dia !== null) {
    flags.push({ key: "bp", label: `ความดันต่ำ ${sys}/${dia}`, tone: "low" });
  }
  const score = num(p?.metabolicRiskScore);
  if (score !== null && score >= 2) {
    flags.push({ key: "ncd", label: `NCD ${score}/3`, tone: score === 3 ? "see" : "care" });
  }
  if (p?.mentalHealth?.q2Positive === true) {
    flags.push({ key: "2q", label: "2Q บวก", tone: "mind" });
  }
  const pulse = num(p?.pulseBpm);
  if ((p?.pulseCategory === "low" || p?.pulseCategory === "high") && pulse !== null) {
    flags.push({ key: "pulse", label: `ชีพจร ${pulse}`, tone: "see" });
  }
  const wDelta = num(p?.trend?.deltaFromPrevious?.weightKg);
  if (wDelta !== null && wDelta <= -2) {
    flags.push({ key: "weight", label: `น้ำหนักลด ${Math.abs(wDelta)} กก.`, tone: "care" });
  }
  return flags;
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function tile(key, name, hint, ok, care, see, none, careText) {
  const total = ok + care + see + none;
  return { key, name, hint, ok, care, see, none, total, pct: pct(ok, total), careCount: care + see, careText };
}

/** การ์ด 6 ใบ "สุขภาพทั้งกลุ่ม" จาก response ของ /api/elderly-school/dashboard */
export function indicatorTiles(data) {
  const d = data || {};
  const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const bp = d.bp || {};
  const bmi = d.bmiBreakdown || {};
  const ab = d.abdominal || {};
  const meta = d.metabolic || {};
  const pulse = d.pulse || {};
  const mh = d.mentalHealth || {};

  const bpCare = n(bp.risk) + n(bp.low);
  const bmiCare = n(bmi.overweight) + n(bmi.underweight);
  const bmiSee = n(bmi.obese1) + n(bmi.obese2);
  const pulseSee = n(pulse.low) + n(pulse.high);

  return [
    tile("bp", "ความดันโลหิต", "BP · ค่ารอบที่ 1 (ถ้าไม่มีใช้รอบที่ 2)", n(bp.normal), bpCare, n(bp.high), n(bp.unknown),
      `ควรดูแลเพิ่ม ${bpCare + n(bp.high)} คน`),
    tile("bmi", "น้ำหนักตามเกณฑ์", "BMI", n(bmi.normal), bmiCare, bmiSee, n(bmi.unknown),
      `ควรดูแลเพิ่ม ${bmiCare + bmiSee} คน`),
    tile("whtr", "รอบเอว", "WHtR ต่ำกว่า 0.5", n(ab.normal), n(ab.risk), 0, n(ab.unknown),
      `ควรดูแลเพิ่ม ${n(ab.risk)} คน`),
    tile("ncd", "ความเสี่ยงโรคเรื้อรัง", "NCD คะแนน 0–1 จาก 3", n(meta.low), 0, n(meta.high), n(meta.unknown),
      `ควรพบเจ้าหน้าที่ ${n(meta.high)} คน`),
    tile("pulse", "ชีพจร", "ครั้ง/นาที", n(pulse.normal), 0, pulseSee, n(pulse.unknown),
      `ควรดูแลเพิ่ม ${pulseSee} คน`),
    tile("2q", "สุขภาพใจ", "แบบคัดกรอง 2Q", n(mh.ok), 0, n(mh.risk), n(mh.unknown),
      `ควรพูดคุยติดตาม ${n(mh.risk)} คน`),
  ];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * สถานะวันเรียน 16 ครั้ง: done (ผ่านแล้ว) | today | scheduled (ตั้งวันแล้ว ยังไม่ถึง) | unset
 * todayISO = YYYY-MM-DD (Asia/Bangkok)
 */
export function sessionStatuses(sessions, todayISO) {
  const byNo = new Map();
  for (const s of Array.isArray(sessions) ? sessions : []) {
    const no = Number(s?.visitNo);
    const dateISO = String(s?.dateISO || "").trim();
    if (Number.isFinite(no) && no >= 1 && no <= 16 && ISO.test(dateISO)) {
      byNo.set(no, { dateISO, note: s?.note ? String(s.note) : "" });
    }
  }
  const out = [];
  for (let no = 1; no <= 16; no++) {
    const s = byNo.get(no);
    let status = "unset";
    if (s) {
      if (s.dateISO === todayISO) status = "today";
      else if (s.dateISO < todayISO) status = "done";
      else status = "scheduled";
    }
    out.push({ visitNo: no, dateISO: s?.dateISO || "", note: s?.note || "", status });
  }
  return out;
}

/** ครั้งที่ควรเปิดเป็นค่าเริ่มต้น: วันนี้ > ครั้งถัดไปที่ตั้งวันแล้ว > ครั้งล่าสุดที่ผ่านมา > 1 */
export function defaultSessionNo(statuses) {
  const list = Array.isArray(statuses) ? statuses : [];
  const today = list.find((s) => s.status === "today");
  if (today) return today.visitNo;
  const next = list.find((s) => s.status === "scheduled");
  const done = list.filter((s) => s.status === "done");
  if (done.length) return done[done.length - 1].visitNo;
  if (next) return next.visitNo;
  return 1;
}

/** ครั้งถัดไปที่ยังไม่ถึง (รวมวันนี้) หรือ null */
export function nextSession(statuses) {
  const list = Array.isArray(statuses) ? statuses : [];
  return list.find((s) => s.status === "today" || s.status === "scheduled") || null;
}

/** วันนี้ตามเวลาไทย YYYY-MM-DD */
export function bangkokTodayISO(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** ปี พ.ศ. ปัจจุบันตามเวลาไทย */
export function currentYearBE(date = new Date()) {
  const y = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(date)
  );
  return Number.isFinite(y) ? y + 543 : date.getFullYear() + 543;
}

/** YYYY-MM-DD → "21 ต.ค. 2569" */
export function formatThaiDate(dateISO) {
  const raw = String(dateISO || "").trim();
  if (!ISO.test(raw)) return "";
  const [y, m, d] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

// ── ป้ายสถานะรายคน (ตาราง/โปรไฟล์) ───────────────────────────────

const BMI_LABELS = {
  underweight: ["ผอม", "low"],
  normal: ["ปกติ", "ok"],
  overweight: ["ท้วม", "care"],
  obese1: ["อ้วน 1", "care"],
  obese2: ["อ้วน 2", "see"],
};

export function bmiChip(category) {
  const [label, tone] = BMI_LABELS[category] || ["ไม่มีข้อมูล", "none"];
  return { label, tone };
}

export function bpChip(bp) {
  const sys = num(bp?.systolic);
  const dia = num(bp?.diastolic);
  const text = sys !== null && dia !== null ? `${sys}/${dia}` : "—";
  switch (bp?.category) {
    case "normal":
      return { label: text, tone: "ok" };
    case "low":
      return { label: text, tone: "low" };
    case "risk":
      return { label: text, tone: "care" };
    case "high":
      return { label: text, tone: "see" };
    default:
      return { label: "—", tone: "none" };
  }
}

export function ncdChip(score) {
  const s = num(score);
  if (s === null) return { label: "—", tone: "none" };
  return { label: `${s}/3`, tone: s >= 3 ? "see" : s === 2 ? "care" : "ok" };
}

export function mhChip(mh) {
  if (!mh) return { label: "ยังไม่คัดกรอง", tone: "none" };
  if (mh.q2Positive) return { label: "2Q บวก", tone: "mind" };
  return { label: "ปกติ", tone: "ok" };
}

/** สถานะผลวัดรายครั้ง (หน้าการมาเรียน): ค่าผิดปกติที่ควรแจ้งเจ้าหน้าที่ */
export function visitResult({ bpCategory, pulseCategory }) {
  if (bpCategory === "high") return { label: "ความดันสูง", tone: "see" };
  if (pulseCategory === "high") return { label: "ชีพจรสูง", tone: "see" };
  if (pulseCategory === "low") return { label: "ชีพจรต่ำ", tone: "low" };
  if (bpCategory === "low") return { label: "ความดันต่ำ", tone: "low" };
  if (bpCategory === "risk") return { label: "เฝ้าระวัง", tone: "care" };
  if (bpCategory === "normal") return { label: "ปกติ", tone: "ok" };
  return { label: "ยังไม่ครบ", tone: "none" };
}

/** ชีพจร <50 ต่ำ, 50–100 ปกติ, >100 สูง (เกณฑ์เดียวกับ API dashboard) */
export function pulseCategoryOf(pulseBpm) {
  const p = num(pulseBpm);
  if (!p) return "unknown";
  if (p < 50) return "low";
  if (p <= 100) return "normal";
  return "high";
}

/** "120/80" → { sys, dia } ; ผิดรูปแบบ → nulls */
export function parseBpText(text) {
  const m = String(text || "").trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  return m ? { sys: Number(m[1]), dia: Number(m[2]) } : { sys: null, dia: null };
}

/** ช่องตัวเลขจากฟอร์ม: "" → null, ไม่ใช่ตัวเลข → undefined (ให้ผู้เรียกแจ้งเตือน) */
export function parseNumberField(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}
