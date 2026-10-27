import { computeBMI, bmiCategoryThai, bpCategory } from "@/lib/health/metrics";

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

const MAX_VISITS = 16;

// ช่วงค่าที่เป็นไปได้ — นอกช่วงยังนำเข้า แต่แจ้งเตือนให้ตรวจว่าพิมพ์ผิดหรือไม่
const RANGES = {
  weightKg: [25, 200, "น้ำหนัก", "กก."],
  waistCm: [40, 200, "รอบเอว", "ซม."],
  pulseBpm: [30, 220, "ชีพจร", "ครั้ง/นาที"],
  heightCm: [100, 220, "ส่วนสูง", "ซม."],
};

function hasText(v) {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

/** ตรวจค่าตัวเลข 1 ช่อง: อ่านไม่ได้ หรือ นอกช่วงที่เป็นไปได้ → ข้อความเตือน (null = ปกติ) */
export function measurementIssue(field, raw, value, visitNo) {
  if (!hasText(raw)) return null;
  const [min, max, label, unit] = RANGES[field];
  const where = visitNo ? `${label}ครั้งที่ ${visitNo}` : label;
  if (value === null) return `${where} อ่านไม่ได้ ("${String(raw).trim()}") — ไม่ได้นำเข้าช่องนี้`;
  if (value < min || value > max) return `${where} ${value} ${unit} ผิดปกติ — ตรวจว่าพิมพ์ถูกหรือไม่`;
  return null;
}

/** ตรวจความดัน 1 ช่อง ("120/80") */
export function bpIssue(raw, parsed, round, visitNo) {
  if (!hasText(raw)) return null;
  const where = `ความดันรอบ ${round} ครั้งที่ ${visitNo}`;
  if (parsed.sys === null || parsed.dia === null) return `${where} อ่านไม่ได้ ("${String(raw).trim()}") — ใช้รูปแบบ 120/80`;
  const { sys, dia } = parsed;
  if (sys < 60 || sys > 260 || dia < 30 || dia > 160 || dia >= sys) {
    return `${where} ${sys}/${dia} ผิดปกติ — ตรวจว่าพิมพ์ถูกหรือไม่`;
  }
  return null;
}

/** ดึงเลขครั้งที่ (1–16) จากหัวคอลัมน์ เช่น "... ครั้งที่ 3" */
function visitNoFromHeader(header) {
  const h = normalizeHeader(header);
  const m = h.match(/ครั้งที่\s*(\d{1,2})\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= MAX_VISITS ? n : null;
}

/**
 * จับคู่คอลัมน์ที่ซ้ำชื่อ (น้ำหนัก/รอบเอว/ชีพจร) ตามเลข "ครั้งที่ N" ใน header
 * ถ้าไม่พบเลขครั้งที่พอ: น้ำหนัก = คอลัมน์แรกเป็น baseline ถัดไปเป็นครั้งที่ 1.. ;
 * รอบเอว/ชีพจร = คอลัมน์ที่ 1..16 ตรงกับครั้งที่ (ไม่แยก baseline)
 */
function buildVisitSlotIndices(headers, matchingIndices, { separateBaseline = false } = {}) {
  const byVisit = {};
  const unassigned = [];
  for (const i of matchingIndices || []) {
    const vn = visitNoFromHeader(headers[i]);
    if (vn != null) byVisit[vn] = i;
    else unassigned.push(i);
  }
  const numberedCount = Object.keys(byVisit).length;
  if (numberedCount >= 4) {
    const baseline =
      separateBaseline && unassigned.length ? [unassigned[0]] : [];
    const visits = Array.from({ length: MAX_VISITS }, (_, k) => byVisit[k + 1] ?? null);
    return { baseline, visits, mode: "numbered" };
  }
  if (separateBaseline) {
    const baseline = (matchingIndices || []).slice(0, 1);
    const rest = (matchingIndices || []).slice(1, 1 + MAX_VISITS);
    const visits = Array.from({ length: MAX_VISITS }, (_, k) => rest[k] ?? null);
    return { baseline, visits, mode: "sequential" };
  }
  const visits = Array.from({ length: MAX_VISITS }, (_, k) => (matchingIndices || [])[k] ?? null);
  return { baseline: [], visits, mode: "sequential" };
}

/**
 * บ้านเลขที่: "บ้านเลขที่" หรือ "เลขที่" — แต่ "เลขที่" คอลัมน์แรกของชีตมักเป็นลำดับแถว
 * จึงใช้เฉพาะ "เลขที่" ที่อยู่หลังคอลัมน์ชื่อ
 */
function houseNoIndices(headers) {
  const explicit = getAllMatchingIndices(headers, ["บ้านเลขที่"]);
  if (explicit.length) return explicit;
  const nameCols = getAllMatchingIndices(headers, ["ชื่อ", "ชื่อ-นามสกุล", "ชื่อ-สกุล"]);
  if (!nameCols.length) return [];
  const firstName = Math.min(...nameCols);
  return getAllMatchingIndices(headers, ["เลขที่"]).filter((i) => i > firstName);
}

/** ช่องที่ไม่มีข้อมูลจริง ("-", "–", ช่องว่าง) = ไม่มีค่า */
function textOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  if (!s || /^[-–—.]+$/.test(s)) return null;
  return s;
}

function pickText(rowArr, indices) {
  for (const idx of indices || []) {
    const s = textOrNull(rowArr?.[idx]);
    if (s) return s;
  }
  return null;
}

/** เบอร์ที่ไม่มีตัวเลขเลย ("-") ไม่ใช่เบอร์ — กันไปทับเบอร์เดิมในระบบ */
function phoneOrNull(v) {
  const s = textOrNull(v);
  return s && /\d/.test(s) ? s : null;
}

function buildIndices(headers) {
  const weightAll = getAllMatchingIndices(headers, ["น้ำหนัก (กิโลกรัม)", "น้ำหนัก"]);
  const waistAll = getAllMatchingIndices(headers, ["รอบเอว (เซนติเมตร)", "รอบเอว"]);
  const pulseAll = getAllMatchingIndices(headers, [
    "การเต้นของชีพจร (ครั้ง/นาที) *ใส่แค่เลขครั้ง",
    "การเต้นของชีพจร",
    "ชีพจร",
  ]);

  const wSlots = buildVisitSlotIndices(headers, weightAll, { separateBaseline: true });
  const waistSlots = buildVisitSlotIndices(headers, waistAll, { separateBaseline: false });
  const pulseSlots = buildVisitSlotIndices(headers, pulseAll, { separateBaseline: false });

  const idx = {
    timestamp: getAllMatchingIndices(headers, ["ประทับเวลา", "timestamp", "เวลาบันทึก"]),
    fullName: getAllMatchingIndices(headers, ["ชื่อ-นามสกุล", "ชื่อ-สกุล", "full name"]),
    // ชีตใบสมัคร (ปี 2570~) แยก "ชื่อ" (มีคำนำหน้าติดมา) กับ "สกุล"
    firstName: getAllMatchingIndices(headers, ["ชื่อ"]),
    lastName: getAllMatchingIndices(headers, ["สกุล", "นามสกุล"]),
    citizenId: getAllMatchingIndices(headers, [
      "เลขประจำตัวประชาชน",
      "เลขบัตรประชาชน",
      "เลขบัตรประจำตัวประชาชน",
      "citizenid",
    ]),
    age: getAllMatchingIndices(headers, ["อายุ (ปี)", "อายุ"]),
    birth: getAllMatchingIndices(headers, ["วัน เดือน ปี เกิด", "วันเดือนปีเกิด", "วัน เดือน ปีเกิด", "วัน/เดือน/ปี เกิด"]),
    birthDay: getAllMatchingIndices(headers, ["วัน", "วันเกิด"]),
    birthMonth: getAllMatchingIndices(headers, ["เดือน", "เดือนเกิด"]),
    birthYear: getAllMatchingIndices(headers, ["ปี", "ปีเกิด"]),
    bloodType: getAllMatchingIndices(headers, ["หมู่เลือด"]),
    address: getAllMatchingIndices(headers, ["ที่อยู่"]),
    houseNo: houseNoIndices(headers),
    road: getAllMatchingIndices(headers, ["ถนน/ซอย", "ถนน", "ซอย"]),
    community: getAllMatchingIndices(headers, ["ชุมชน"]),
    chronicDiseases: getAllMatchingIndices(headers, ["โรคประจำตัว"]),
    phone: getAllMatchingIndices(headers, ["เบอร์โทรศัพท์", "เบอร์โทร", "โทรศัพท์"]),
    occupation: getAllMatchingIndices(headers, ["อาชีพ"]),
    height: getAllMatchingIndices(headers, ["ส่วนสูง (เซนติเมตร)", "ส่วนสูง(เซนติเมตร)", "ส่วนสูง"]),
    weightBaseline: wSlots.baseline,
    weightVisits: wSlots.visits,
    waistVisits: waistSlots.visits,
    pulseVisits: pulseSlots.visits,
    bp1All: getAllMatchingIndices(headers, ["การวัดความดันโลหิต ครั้งที่ 1"]).slice(0, MAX_VISITS),
    bp2All: getAllMatchingIndices(headers, ["การวัดความดันโลหิต ครั้งที่ 2"]).slice(0, MAX_VISITS),
  };

  return idx;
}

function cellAt(row, colIdx) {
  if (colIdx == null || colIdx < 0) return null;
  return row?.[colIdx];
}

export function parseSheetRowToPersonAndVisits({ headers, row, yearBE }) {
  const idx = buildIndices(headers);

  const citizenId = pickFirstNonEmpty(row, idx.citizenId);
  const fullName =
    pickFirstNonEmpty(row, idx.fullName) ||
    textOrNull([pickText(row, idx.firstName), pickText(row, idx.lastName)].filter(Boolean).join(" "));

  // ไม่มีชื่อ = ข้าม; มีชื่อแต่ไม่มีเลขบัตร = รอจับคู่กับผู้เรียนเดิมด้วยชื่อ (lib/elderly-school/nameMatch.js)
  if (!fullName) {
    return {
      skip: true,
      reason: "missing fullName",
      reasonTh: !citizenId ? "ไม่มีเลขบัตรและชื่อ" : "ไม่มีชื่อ-นามสกุล",
      fullName: null,
      citizenId: citizenId || null,
    };
  }
  const needsNameMatch = !citizenId;

  // ข้อความเตือนรายแถว (ยังนำเข้าได้) — แสดงในแท็บนำเข้าข้อมูลให้เจ้าหน้าที่แก้ชีต
  const issues = [];
  const pushIssue = (msg) => {
    if (msg) issues.push(msg);
  };
  if (citizenId && String(citizenId).replace(/\D/g, "").length !== 13) pushIssue("เลขบัตรประชาชนไม่ครบ 13 หลัก");

  const heightRaw = pickFirstNonEmpty(row, idx.height);
  const heightCm = toNumber(heightRaw);
  pushIssue(measurementIssue("heightCm", heightRaw, heightCm, null));
  const baselineWeightKg = toNumber(pickFirstNonEmpty(row, idx.weightBaseline));
  const ageYears = toNumber(pickFirstNonEmpty(row, idx.age));
  // วันเกิดช่องเดียว หรือแยก วัน/เดือน/ปี ("1" "เม.ย." "2502" → "1 เม.ย. 2502"; ไม่รู้วัน → "เม.ย. 2502")
  const birthDateText =
    pickFirstNonEmpty(row, idx.birth) ||
    textOrNull(
      [pickText(row, idx.birthDay), pickText(row, idx.birthMonth), pickText(row, idx.birthYear)]
        .filter(Boolean)
        .join(" ")
    );
  // ที่อยู่ช่องเดียว หรือ บ้านเลขที่ + ถนน/ซอย (ชุมชนเก็บแยกที่ community)
  const address =
    pickFirstNonEmpty(row, idx.address) ||
    textOrNull([pickText(row, idx.houseNo), pickText(row, idx.road)].filter(Boolean).join(" "));

  const person = {
    citizenId: citizenId || null,
    fullName,
    ageYears: ageYears ?? null,
    birthDateText: birthDateText ?? null,
    bloodType: pickFirstNonEmpty(row, idx.bloodType),
    address: address ?? null,
    community: pickText(row, idx.community),
    chronicDiseases: pickText(row, idx.chronicDiseases),
    phone: phoneOrNull(pickFirstNonEmpty(row, idx.phone)),
    occupation: pickFirstNonEmpty(row, idx.occupation),
    heightCm: heightCm ?? null,
    baselineWeightKg: baselineWeightKg ?? null,
    sourceYearFirstSeen: yearBE,
  };

  const visits = [];
  for (let visitNo = 1; visitNo <= MAX_VISITS; visitNo++) {
    const weightRaw = cellAt(row, idx.weightVisits[visitNo - 1]);
    const waistRaw = cellAt(row, idx.waistVisits[visitNo - 1]);
    const pulseRaw = cellAt(row, idx.pulseVisits[visitNo - 1]);
    const weightKg = toNumber(weightRaw);
    const waistCm = toNumber(waistRaw);
    const pulseBpm = toNumber(pulseRaw);

    const bp1Text = cellAt(row, idx.bp1All[visitNo - 1]);
    const bp2Text = cellAt(row, idx.bp2All[visitNo - 1]);
    const bp1 = parseBP(bp1Text);
    const bp2 = parseBP(bp2Text);

    pushIssue(measurementIssue("weightKg", weightRaw, weightKg, visitNo));
    pushIssue(measurementIssue("waistCm", waistRaw, waistCm, visitNo));
    pushIssue(measurementIssue("pulseBpm", pulseRaw, pulseBpm, visitNo));
    pushIssue(bpIssue(bp1Text, bp1, 1, visitNo));
    pushIssue(bpIssue(bp2Text, bp2, 2, visitNo));

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
    needsNameMatch,
    person,
    visits,
    issues,
    latest: {
      visitNo: latestVisitNo,
      bmi,
      bmiCategory: bmiCat,
      bpCategory: bpCat,
    },
  };
}


