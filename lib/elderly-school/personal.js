// สรุปสุขภาพรายคนสำหรับผู้เรียน (หน้า /elderly/checkin) — ภาษาง่าย ไม่ใช่การวินิจฉัย
// input = visits จาก action "summary" ของ /api/elderly-school/checkin
import { bpCategory, bmiCategoryThai, computeBMI } from "../health/metrics";

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export function visitHasData(v) {
  return ["weightKg", "waistCm", "pulseBpm", "bp1Sys", "bp1Dia", "bp2Sys", "bp2Dia"].some((f) => num(v?.[f]) !== null);
}

/** ความดันของครั้งนั้น: ใช้รอบ 1 ก่อน ถ้าไม่ครบใช้รอบ 2 */
export function visitBp(v) {
  const s1 = num(v?.bp1Sys);
  const d1 = num(v?.bp1Dia);
  if (s1 !== null && d1 !== null) return { sys: s1, dia: d1 };
  const s2 = num(v?.bp2Sys);
  const d2 = num(v?.bp2Dia);
  if (s2 !== null && d2 !== null) return { sys: s2, dia: d2 };
  return null;
}

const BP_TEXT = {
  normal: ["อยู่ในเกณฑ์ดี", "ok"],
  risk: ["สูงกว่าเกณฑ์เล็กน้อย · ควรดูแลเพิ่ม", "care"],
  high: ["สูงกว่าปกติ · ควรพบเจ้าหน้าที่", "see"],
  low: ["ต่ำกว่าปกติ · ควรแจ้งเจ้าหน้าที่", "see"],
};

const BMI_TEXT = {
  normal: ["น้ำหนักอยู่ในเกณฑ์ดี", "ok"],
  underweight: ["น้ำหนักน้อยกว่าเกณฑ์ · ควรดูแลเพิ่ม", "care"],
  overweight: ["น้ำหนักเกินเกณฑ์เล็กน้อย · ควรดูแลเพิ่ม", "care"],
  obese1: ["น้ำหนักเกินเกณฑ์ · ควรดูแลเพิ่ม", "care"],
  obese2: ["น้ำหนักเกินเกณฑ์มาก · ควรพบเจ้าหน้าที่", "see"],
};

function latestWith(sorted, pick) {
  for (let i = sorted.length - 1; i >= 0; i--) {
    const val = pick(sorted[i]);
    if (val !== null && val !== undefined) return { visit: sorted[i], value: val, index: i };
  }
  return null;
}

function previousWith(sorted, beforeIndex, pick) {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const val = pick(sorted[i]);
    if (val !== null && val !== undefined) return val;
  }
  return null;
}

function deltaText(delta, unit) {
  if (delta === null) return "";
  if (Math.abs(delta) < 0.05) return "เท่ากับครั้งก่อน";
  return `${delta < 0 ? "ลดลง" : "เพิ่มขึ้น"} ${Math.abs(round1(delta))} ${unit} จากครั้งก่อน`;
}

/**
 * สรุป 4 ค่า (ความดัน น้ำหนัก รอบเอว ชีพจร) จากค่าล่าสุดของแต่ละอย่าง + ประโยคภาพรวม
 * tone: ok | care | see | none
 */
export function personalSummary(visits, heightCm) {
  const sorted = (Array.isArray(visits) ? visits : []).filter(visitHasData).sort((a, b) => a.visitNo - b.visitNo);
  const h = num(heightCm);
  const metrics = [];

  const bp = latestWith(sorted, visitBp);
  if (bp) {
    const cat = bpCategory(bp.value.sys, bp.value.dia);
    const [status, tone] = BP_TEXT[cat] || ["—", "none"];
    metrics.push({ key: "bp", name: "ความดัน", value: `${bp.value.sys}/${bp.value.dia}`, unit: "มม.ปรอท", status, tone, visitNo: bp.visit.visitNo });
  }

  const w = latestWith(sorted, (v) => num(v?.weightKg));
  if (w) {
    const prev = previousWith(sorted, w.index, (v) => num(v?.weightKg));
    const bmi = computeBMI(w.value, h ?? w.visit?.heightCm);
    const cat = bmiCategoryThai(bmi);
    const [status, tone] = bmi === null ? ["", "none"] : BMI_TEXT[cat] || ["", "none"];
    metrics.push({
      key: "weight",
      name: "น้ำหนัก",
      value: String(w.value),
      unit: "กก.",
      status: status || deltaText(prev === null ? null : w.value - prev, "กก.") || "บันทึกแล้ว",
      sub: status ? deltaText(prev === null ? null : w.value - prev, "กก.") : "",
      tone,
      visitNo: w.visit.visitNo,
    });
  }

  const waist = latestWith(sorted, (v) => num(v?.waistCm));
  if (waist) {
    const whtR = h ? waist.value / h : null;
    metrics.push({
      key: "waist",
      name: "รอบเอว",
      value: String(waist.value),
      unit: "ซม.",
      status: whtR === null ? "บันทึกแล้ว" : whtR >= 0.5 ? "เกินเกณฑ์ · ควรดูแลเพิ่ม" : "อยู่ในเกณฑ์ดี",
      tone: whtR === null ? "none" : whtR >= 0.5 ? "care" : "ok",
      visitNo: waist.visit.visitNo,
    });
  }

  const pulse = latestWith(sorted, (v) => num(v?.pulseBpm));
  if (pulse) {
    const p = pulse.value;
    const bad = p < 50 || p > 100;
    metrics.push({
      key: "pulse",
      name: "ชีพจร",
      value: String(p),
      unit: "ครั้ง/นาที",
      status: bad ? (p > 100 ? "เร็วกว่าปกติ · ควรแจ้งเจ้าหน้าที่" : "ช้ากว่าปกติ · ควรแจ้งเจ้าหน้าที่") : "อยู่ในเกณฑ์ดี",
      tone: bad ? "see" : "ok",
      visitNo: pulse.visit.visitNo,
    });
  }

  const see = metrics.filter((m) => m.tone === "see").length;
  const care = metrics.filter((m) => m.tone === "care").length;
  let headline;
  if (!metrics.length) headline = "ยังไม่มีผลวัดในปีนี้";
  else if (see) headline = `มี ${see} เรื่องที่ควรพบเจ้าหน้าที่`;
  else if (care) headline = `มี ${care} เรื่องที่ควรดูแลเพิ่ม`;
  else headline = "ทุกค่าอยู่ในเกณฑ์ดี";

  return {
    metrics,
    headline,
    // "ส่วนใหญ่อยู่ในเกณฑ์ดี" เฉพาะเมื่อค่าที่ดีมีมากกว่าครึ่งจริง
    lead: (see || care) && metrics.filter((m) => m.tone === "ok").length * 2 > metrics.length ? "ส่วนใหญ่อยู่ในเกณฑ์ดี" : "",
    attended: sorted.length,
    latestVisitNo: sorted.length ? sorted[sorted.length - 1].visitNo : null,
  };
}

/** แนวโน้มรายครั้งของค่าที่เลือก (bp = ตัวบน) */
export function personalTrend(visits, key) {
  const sorted = (Array.isArray(visits) ? visits : []).filter(visitHasData).sort((a, b) => a.visitNo - b.visitNo);
  return sorted
    .map((v) => {
      if (key === "bp") {
        const bp = visitBp(v);
        return bp ? { visitNo: v.visitNo, value: bp.sys, label: `${bp.sys}/${bp.dia}`, tone: bpTone(bp) } : null;
      }
      const field = key === "weight" ? "weightKg" : "waistCm";
      const val = num(v?.[field]);
      return val === null ? null : { visitNo: v.visitNo, value: val, label: String(val), tone: "none" };
    })
    .filter(Boolean);
}

function bpTone(bp) {
  const cat = bpCategory(bp.sys, bp.dia);
  return cat === "normal" ? "ok" : cat === "risk" ? "care" : cat === "high" || cat === "low" ? "see" : "none";
}
