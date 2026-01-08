import Papa from "papaparse";

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

function pickFirstNonEmptyFromIndices(rowArr, indices) {
  for (const idx of indices || []) {
    const v = rowArr?.[idx];
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return null;
}

function pickNthIndex(indices, n1) {
  if (!Array.isArray(indices)) return null;
  const idx = indices[n1 - 1];
  return Number.isInteger(idx) ? idx : null;
}

function pickByVisit({ baseIndices, visitIndices }, rowArr, visit) {
  // baseIndices: indices that are not part of the 16-visit repetitions (e.g. baseline weight)
  // visitIndices: indices corresponding to visit 1..N in order of appearance
  if (visit === "latest") {
    // pick last non-empty among visitIndices; fallback to base
    for (let i = (visitIndices || []).length - 1; i >= 0; i--) {
      const v = rowArr?.[visitIndices[i]];
      if (v !== null && v !== undefined && String(v).trim() !== "") return v;
    }
    return pickFirstNonEmptyFromIndices(rowArr, baseIndices);
  }

  const n = typeof visit === "number" ? visit : null;
  if (n && n >= 1) {
    const idx = pickNthIndex(visitIndices, n);
    if (idx !== null) return rowArr?.[idx] ?? null;
    return pickFirstNonEmptyFromIndices(rowArr, baseIndices);
  }

  // no visit specified → previous behavior (first non-empty overall)
  return pickFirstNonEmptyFromIndices(rowArr, [...(baseIndices || []), ...(visitIndices || [])]);
}

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  // handle "120/80" style by taking first number only when caller wants it explicitly
  const cleaned = s.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseThaiOrIsoDateToISODate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // If looks like ISO date or ISO datetime
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;

  // Remove time if exists
  const noTime = raw.split(" ")[0].trim();

  // Try DD/MM/YYYY (most common in TH)
  const dmy = noTime.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let d = Number(dmy[1]);
    let m = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    if (y >= 2400) y -= 543; // Buddhist year → CE
    if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return null;
}

export function computeBMI(weightKg, heightCmOrM) {
  const w = toNumber(weightKg);
  const hRaw = toNumber(heightCmOrM);
  if (!w || !hRaw) return null;
  const hM = hRaw > 3 ? hRaw / 100 : hRaw;
  if (hM <= 0) return null;
  const bmi = w / (hM * hM);
  return Number.isFinite(bmi) ? bmi : null;
}

export function bmiCategoryThai(bmi) {
  if (bmi === null || bmi === undefined) return "unknown";
  if (bmi < 18.5) return "underweight";
  if (bmi < 23) return "normal";
  if (bmi < 25) return "overweight";
  if (bmi < 30) return "obese1";
  return "obese2";
}

export function bpCategory(sys, dia) {
  const s = toNumber(sys);
  const d = toNumber(dia);
  if (!s || !d) return "unknown";
  if (s < 120 && d < 80) return "normal";
  if (s >= 140 || d >= 90) return "high";
  // includes elevated + stage1
  return "risk";
}

export async function fetchAndParseSheetCSV(csvUrl, { timeoutMs = 15000 } = {}) {
  if (!csvUrl) {
    throw new Error("Missing ELDERLY_SCHOOL_SHEET_CSV_URL");
  }

  // If user pasted the "edit" URL, try converting to a CSV endpoint automatically.
  // Note: This still requires the sheet to be published/public for CSV access.
  let effectiveUrl = csvUrl;
  try {
    const u = new URL(csvUrl);
    const isGoogleSheet = /docs\.google\.com$/.test(u.hostname) && u.pathname.includes("/spreadsheets/");
    const isEditUrl = isGoogleSheet && u.pathname.includes("/edit");
    if (isEditUrl) {
      const m = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
      const sheetId = m?.[1];
      const gid = u.searchParams.get("gid") || (u.hash.match(/gid=(\d+)/)?.[1] ?? "");
      if (sheetId) {
        const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
        effectiveUrl = gid ? `${base}&gid=${gid}` : base;
      }
    }
  } catch {
    // ignore URL parse issues; fallback to provided string
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(effectiveUrl, { signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to fetch sheet CSV (status ${res.status})`);
    }
    // Heuristic: Google login/consent pages are HTML, not CSV.
    if (text.trim().startsWith("<!DOCTYPE html") || /<html/i.test(text.slice(0, 300))) {
      throw new Error(
        "Sheet is not publicly accessible as CSV. Please publish the sheet to the web (CSV) and set ELDERLY_SCHOOL_SHEET_CSV_URL to a URL that returns CSV (ends with output=csv), not the /edit link."
      );
    }

    // Parse as a table (header row + rows array) to support duplicate column names.
    const parsed = Papa.parse(text, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (parsed.errors?.length) {
      const e = parsed.errors[0];
      throw new Error(`CSV parse error: ${e.message}`);
    }

    const data = Array.isArray(parsed.data) ? parsed.data : [];
    if (!data.length) return { headers: [], rows: [] };

    const headers = (data[0] || []).map((h) => String(h || "").trim());
    const rows = data.slice(1);
    return { headers, rows };
  } finally {
    clearTimeout(t);
  }
}

function maskCitizenId(id) {
  const s = String(id || "").replace(/\D/g, "");
  if (s.length < 4) return s || "";
  return `*********${s.slice(-4)}`;
}

export function summarizeElderlySchoolRows(input, { dateISO, columnMap = {}, countMode = "unique" } = {}) {
  const candidates = {
    date: [
      columnMap.date,
      "date",
      "วันที่",
      "วันที่มาเรียน",
      "วันที่เข้าร่วม",
      "วัน/เดือน/ปี",
      "timestamp",
      "เวลาบันทึก",
      "วันที่บันทึก",
      "ประทับเวลา",
    ].filter(Boolean),
    weight: [
      columnMap.weight,
      "weight",
      "น้ำหนัก",
      "weight(kg)",
      "น้ำหนัก(กก.)",
      "น้ำหนัก (kg)",
      "น้ำหนัก (กิโลกรัม)",
    ].filter(Boolean),
    height: [
      columnMap.height,
      "height",
      "ส่วนสูง",
      "height(cm)",
      "ส่วนสูง(ซม.)",
      "ส่วนสูง (cm)",
      "ส่วนสูง (เซนติเมตร)",
    ].filter(Boolean),
    bp1: [columnMap.bp1, "การวัดความดันโลหิต ครั้งที่ 1"].filter(Boolean),
    bp2: [columnMap.bp2, "การวัดความดันโลหิต ครั้งที่ 2"].filter(Boolean),
    systolic: [columnMap.systolic, "systolic", "sys", "ความดันตัวบน", "SBP", "ความดันบน"].filter(Boolean),
    diastolic: [columnMap.diastolic, "diastolic", "dia", "ความดันตัวล่าง", "DBP", "ความดันล่าง"].filter(Boolean),
    bp: [columnMap.bp, "bp", "ความดัน", "BP"].filter(Boolean),
    citizenId: [
      columnMap.citizenId,
      columnMap.id,
      "citizenId",
      "เลขประจำตัวประชาชน",
      "เลขบัตรประชาชน",
    ].filter(Boolean),
    fullName: ["ชื่อ-นามสกุล", "ชื่อ-สกุล", "fullName", "ชื่อ"].filter(Boolean),
  };

  const headers = input?.headers || [];
  const rows = input?.rows || [];
  const indices = {
    date: getAllMatchingIndices(headers, candidates.date),
    weight: getAllMatchingIndices(headers, candidates.weight),
    height: getAllMatchingIndices(headers, candidates.height),
    bp1: getAllMatchingIndices(headers, candidates.bp1),
    bp2: getAllMatchingIndices(headers, candidates.bp2),
    systolic: getAllMatchingIndices(headers, candidates.systolic),
    diastolic: getAllMatchingIndices(headers, candidates.diastolic),
    bp: getAllMatchingIndices(headers, candidates.bp),
    citizenId: getAllMatchingIndices(headers, candidates.citizenId),
    fullName: getAllMatchingIndices(headers, candidates.fullName),
  };

  // Visit handling:
  // This sheet often has baseline weight/height, then repeated groups for visits (up to 16).
  // We treat the first "น้ำหนัก" as baseline, and subsequent occurrences as visit 1..N.
  const baseWeightIndices = indices.weight.slice(0, 1);
  const visitWeightIndices = indices.weight.slice(1);

  const baseBp1Indices = []; // BP fields typically belong to visit groups (after baseline)
  const visitBp1Indices = indices.bp1;
  const baseBp2Indices = [];
  const visitBp2Indices = indices.bp2;

  const filtered = [];
  for (const r of rows || []) {
    const rawDate = pickFirstNonEmptyFromIndices(r, indices.date);
    const rowDateISO = parseThaiOrIsoDateToISODate(rawDate);
    if (dateISO && rowDateISO !== dateISO) continue;
    filtered.push({ row: r, rowDateISO });
  }

  const seen = new Set();
  const people = [];
  const peopleDetails = [];
  const visit =
    typeof columnMap.visit === "number"
      ? columnMap.visit
      : columnMap.visit === "latest"
        ? "latest"
        : null;

  for (let idx = 0; idx < filtered.length; idx++) {
    const r = filtered[idx].row;

    const weight = pickByVisit(
      { baseIndices: baseWeightIndices, visitIndices: visitWeightIndices },
      r,
      visit
    );
    const height = pickFirstNonEmptyFromIndices(r, indices.height); // height usually constant

    const bp1 = pickByVisit(
      { baseIndices: baseBp1Indices, visitIndices: visitBp1Indices },
      r,
      visit
    );
    const bp2 = pickByVisit(
      { baseIndices: baseBp2Indices, visitIndices: visitBp2Indices },
      r,
      visit
    );
    const bp = bp1 || bp2 || pickFirstNonEmptyFromIndices(r, indices.bp);

    // BP sometimes stored as "120/80" in single field
    let sys = pickFirstNonEmptyFromIndices(r, indices.systolic);
    let dia = pickFirstNonEmptyFromIndices(r, indices.diastolic);
    if ((!sys || !dia) && bp) {
      const m = String(bp).trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})/);
      if (m) {
        sys = m[1];
        dia = m[2];
      }
    }

    const bmi = computeBMI(weight, height);
    const bmiCat = bmiCategoryThai(bmi);
    const bpCat = bpCategory(sys, dia);

    const citizenIdRaw = pickFirstNonEmptyFromIndices(r, indices.citizenId);
    const fullNameRaw = pickFirstNonEmptyFromIndices(r, indices.fullName);
    const idVal = citizenIdRaw
      ? String(citizenIdRaw).trim()
      : fullNameRaw
        ? String(fullNameRaw).trim()
        : "";
    const uniqueKey = idVal || `row:${idx}`;

    if (countMode === "unique") {
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
    }

    people.push({ bmi, bmiCat, bpCat });

    const bmiRisk = bmiCat !== "unknown" && bmiCat !== "normal";
    const bpRisk = bpCat === "risk" || bpCat === "high";

    peopleDetails.push({
      fullName: fullNameRaw ? String(fullNameRaw).trim() : "",
      citizenIdMasked: citizenIdRaw ? maskCitizenId(citizenIdRaw) : "",
      bmi: bmi ?? null,
      bmiCategory: bmiCat,
      bmiRisk,
      bp: {
        systolic: sys ? Number(String(sys).trim()) || null : null,
        diastolic: dia ? Number(String(dia).trim()) || null : null,
        category: bpCat,
        risk: bpRisk,
      },
      overallRisk: bmiRisk || bpRisk,
    });
  }

  const init = { normal: 0, risk: 0, high: 0, unknown: 0 };
  const bmiCounts = { ...init };
  const bpCounts = { ...init };

  for (const p of people) {
    // BMI: normal vs risk (everything else) + unknown
    if (p.bmiCat === "unknown") bmiCounts.unknown++;
    else if (p.bmiCat === "normal") bmiCounts.normal++;
    else bmiCounts.risk++;

    // BP: normal / risk / high / unknown
    if (p.bpCat === "unknown") bpCounts.unknown++;
    else if (p.bpCat === "normal") bpCounts.normal++;
    else if (p.bpCat === "high") bpCounts.high++;
    else bpCounts.risk++;
  }

  // For convenience: riskTotal includes high for BP
  const bpRiskTotal = bpCounts.risk + bpCounts.high;

  return {
    dateISO: dateISO || null,
    visit: visit || null,
    detectedColumns: {
      headersMatched: {
        date: indices.date.map((i) => headers[i]),
        weight: indices.weight.map((i) => headers[i]),
        height: indices.height.map((i) => headers[i]),
        bp1: indices.bp1.map((i) => headers[i]),
        bp2: indices.bp2.map((i) => headers[i]),
        systolic: indices.systolic.map((i) => headers[i]),
        diastolic: indices.diastolic.map((i) => headers[i]),
        bp: indices.bp.map((i) => headers[i]),
        citizenId: indices.citizenId.map((i) => headers[i]),
        fullName: indices.fullName.map((i) => headers[i]),
      },
      occurrences: {
        weight: indices.weight,
        bp1: indices.bp1,
        bp2: indices.bp2,
      },
    },
    totals: {
      rowsMatchedDate: filtered.length,
      peopleCounted: people.length,
      countMode,
    },
    bmi: {
      normal: bmiCounts.normal,
      risk: bmiCounts.risk,
      unknown: bmiCounts.unknown,
    },
    bp: {
      normal: bpCounts.normal,
      risk: bpCounts.risk,
      high: bpCounts.high,
      riskTotal: bpRiskTotal,
      unknown: bpCounts.unknown,
    },
    people: peopleDetails,
  };
}


