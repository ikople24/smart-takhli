import { computeBMI, bmiCategoryThai, bpCategory } from "@/lib/elderlySchoolDashboard";

function normalizeHeader(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getAllMatchingIndices(headers, candidates) {
  const target = new Set((candidates || []).map((c) => normalizeHeader(c)));
  const indices = [];
  for (let i = 0; i < (headers || []).length; i++) {
    if (target.has(normalizeHeader(headers[i]))) indices.push(i);
  }
  return indices;
}

function pickFirstNonEmpty(rowArr, indices) {
  for (const idx of indices || []) {
    const v = rowArr?.[idx];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseBP(bpText) {
  if (!bpText) return { sys: null, dia: null };
  const m = String(bpText).trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!m) return { sys: null, dia: null };
  return { sys: toNumber(m[1]), dia: toNumber(m[2]) };
}

function buildIndices(headers) {
  const idx = {
    timestamp: getAllMatchingIndices(headers, ["ประทับเวลา", "timestamp", "เวลาบันทึก"]),
    fullName: getAllMatchingIndices(headers, ["ชื่อ-นามสกุล", "ชื่อ-สกุล", "full name"]),
    citizenId: getAllMatchingIndices(headers, ["เลขประจำตัวประชาชน", "เลขบัตรประชาชน", "citizenid"]),
    age: getAllMatchingIndices(headers, ["อายุ (ปี)", "อายุ"]),
    birth: getAllMatchingIndices(headers, ["วัน เดือน ปี เกิด", "วันเดือนปีเกิด", "วัน เดือน ปีเกิด", "วัน/เดือน/ปี เกิด"]),
    bloodType: getAllMatchingIndices(headers, ["หมู่เลือด"]),
    address: getAllMatchingIndices(headers, ["ที่อยู่"]),
    phone: getAllMatchingIndices(headers, ["เบอร์โทรศัพท์", "เบอร์โทร", "โทรศัพท์"]),
    occupation: getAllMatchingIndices(headers, ["อาชีพ"]),
    height: getAllMatchingIndices(headers, ["ส่วนสูง (เซนติเมตร)", "ส่วนสูง(เซนติเมตร)", "ส่วนสูง"]),
    // Repeated per-visit columns (Google Form style)
    weightAll: getAllMatchingIndices(headers, ["น้ำหนัก (กิโลกรัม)", "น้ำหนัก"]),
    waistAll: getAllMatchingIndices(headers, ["รอบเอว (เซนติเมตร)", "รอบเอว"]),
    pulseAll: getAllMatchingIndices(headers, ["การเต้นของชีพจร (ครั้ง/นาที) *ใส่แค่เลขครั้ง", "การเต้นของชีพจร", "ชีพจร"]),
    bp1All: getAllMatchingIndices(headers, ["การวัดความดันโลหิต ครั้งที่ 1"]),
    bp2All: getAllMatchingIndices(headers, ["การวัดความดันโลหิต ครั้งที่ 2"]),
  };

  // Heuristic: first weight often belongs to registration area; visits start after that
  idx.weightBaseline = idx.weightAll.slice(0, 1);
  idx.weightVisits = idx.weightAll.slice(1);

  return idx;
}

export function parseSheetRowToPersonAndVisits({ headers, row, yearBE }) {
  const idx = buildIndices(headers);

  const citizenId = pickFirstNonEmpty(row, idx.citizenId);
  const fullName = pickFirstNonEmpty(row, idx.fullName);

  if (!citizenId || !fullName) {
    return { skip: true, reason: "missing citizenId or fullName" };
  }

  const heightCm = toNumber(pickFirstNonEmpty(row, idx.height));
  const baselineWeightKg = toNumber(pickFirstNonEmpty(row, idx.weightBaseline));
  const ageYears = toNumber(pickFirstNonEmpty(row, idx.age));
  const birthDateText = pickFirstNonEmpty(row, idx.birth);

  const person = {
    citizenId,
    fullName,
    ageYears: ageYears ?? null,
    birthDateText: birthDateText ?? null,
    bloodType: pickFirstNonEmpty(row, idx.bloodType),
    address: pickFirstNonEmpty(row, idx.address),
    phone: pickFirstNonEmpty(row, idx.phone),
    occupation: pickFirstNonEmpty(row, idx.occupation),
    heightCm: heightCm ?? null,
    baselineWeightKg: baselineWeightKg ?? null,
    sourceYearFirstSeen: yearBE,
  };

  const visits = [];
  for (let visitNo = 1; visitNo <= 16; visitNo++) {
    const weightKg = toNumber(row[idx.weightVisits[visitNo - 1]]);
    const waistCm = toNumber(row[idx.waistAll[visitNo - 1]]);
    const pulseBpm = toNumber(row[idx.pulseAll[visitNo - 1]]);

    const bp1Text = row[idx.bp1All[visitNo - 1]];
    const bp2Text = row[idx.bp2All[visitNo - 1]];
    const bp1 = parseBP(bp1Text);
    const bp2 = parseBP(bp2Text);

    const hasAny =
      weightKg !== null ||
      waistCm !== null ||
      pulseBpm !== null ||
      bp1.sys !== null ||
      bp1.dia !== null ||
      bp2.sys !== null ||
      bp2.dia !== null;

    if (!hasAny) continue;

    visits.push({
      yearBE,
      visitNo,
      heightCm: heightCm ?? null,
      weightKg,
      waistCm,
      pulseBpm,
      bp1Sys: bp1.sys,
      bp1Dia: bp1.dia,
      bp2Sys: bp2.sys,
      bp2Dia: bp2.dia,
    });
  }

  // Also provide a derived "latest" snapshot for convenience (not stored)
  const latestVisitNo = visits.length ? Math.max(...visits.map((v) => v.visitNo)) : null;
  const latest = latestVisitNo ? visits.find((v) => v.visitNo === latestVisitNo) : null;
  const bmi = latest ? computeBMI(latest.weightKg, latest.heightCm) : null;
  const bmiCat = bmiCategoryThai(bmi);
  const bpCat = latest ? bpCategory(latest.bp1Sys ?? latest.bp2Sys, latest.bp1Dia ?? latest.bp2Dia) : "unknown";

  return {
    skip: false,
    person,
    visits,
    latest: {
      visitNo: latestVisitNo,
      bmi,
      bmiCategory: bmiCat,
      bpCategory: bpCat,
    },
  };
}


