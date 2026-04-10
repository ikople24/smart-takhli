import Papa from "papaparse";
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

function pickFirstNonEmptyFromIndices(rowArr, indices) {
  for (const idx of indices || []) {
    const v = rowArr?.[idx];
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return null;
}

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function sugarCategoryMgDl(v) {
  const n = toNumber(v);
  if (n === null) return "unknown";
  if (n < 70) return "low";
  if (n < 100) return "normal";
  if (n < 126) return "risk";
  return "high";
}

export function fetchSheetCSVByGid(editOrCsvUrl, gid, { timeoutMs = 15000 } = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!editOrCsvUrl) throw new Error("Missing sheetUrl");
      const u = new URL(String(editOrCsvUrl));
      const m = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
      const sheetId = m?.[1];
      if (!sheetId) throw new Error("Invalid Google Sheet URL");
      const effectiveUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(
        String(gid)
      )}`;

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(effectiveUrl, { signal: controller.signal });
        const text = await res.text();
        if (!res.ok) throw new Error(`Failed to fetch sheet CSV (status ${res.status})`);
        if (text.trim().startsWith("<!DOCTYPE html") || /<html/i.test(text.slice(0, 300))) {
          throw new Error(
            "Sheet is not publicly accessible as CSV. Please publish the sheet or allow anyone with the link (viewer)."
          );
        }
        const parsed = Papa.parse(text, { header: false, skipEmptyLines: true, dynamicTyping: false });
        if (parsed.errors?.length) {
          const e = parsed.errors[0];
          throw new Error(`CSV parse error: ${e.message}`);
        }
        const data = Array.isArray(parsed.data) ? parsed.data : [];
        const headers = (data[0] || []).map((h) => String(h || "").trim());
        const rows = data.slice(1);
        resolve({ headers, rows, csvUrl: effectiveUrl });
      } finally {
        clearTimeout(t);
      }
    } catch (e) {
      reject(e);
    }
  });
}

export function summarizeEmployeeHealthTable(table, { countMode = "unique", sheetKey = "" } = {}) {
  const headers = table?.headers || [];
  const rows = table?.rows || [];

  const candidates = {
    name: ["name", "ชื่อ", "ชื่อ-นามสกุล", "ชื่อ-สกุล"],
    weight: ["weight", "น้ำหนัก", "น้ำหนัก(กก.)", "น้ำหนัก (กก.)"],
    height: ["height", "ส่วนสูง", "ส่วนสูง(ซม.)", "ส่วนสูง (ซม.)"],
    sys: ["sys", "systolic", "sbp", "ความดันตัวบน", "SYS"],
    dia: ["dia", "diastolic", "dbp", "ความดันตัวล่าง", "DIA"],
    sugar: ["ค่าน้ำตาลในเลือด", "น้ำตาล", "glucose", "fbs", "blood sugar"],
  };

  const idx = {
    name: getAllMatchingIndices(headers, candidates.name),
    weight: getAllMatchingIndices(headers, candidates.weight),
    height: getAllMatchingIndices(headers, candidates.height),
    sys: getAllMatchingIndices(headers, candidates.sys),
    dia: getAllMatchingIndices(headers, candidates.dia),
    sugar: getAllMatchingIndices(headers, candidates.sugar),
  };

  const seen = new Set();
  const people = [];

  const counts = {
    bmi: { normal: 0, risk: 0, unknown: 0 },
    bp: { normal: 0, low: 0, risk: 0, high: 0, unknown: 0 },
    sugar: { normal: 0, low: 0, risk: 0, high: 0, unknown: 0 },
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = pickFirstNonEmptyFromIndices(r, idx.name);
    const uniqueKey = String(name || "").trim() || `row:${i}`;
    if (countMode === "unique") {
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
    }

    const weightKg = toNumber(pickFirstNonEmptyFromIndices(r, idx.weight));
    const heightCm = toNumber(pickFirstNonEmptyFromIndices(r, idx.height));
    const sys = toNumber(pickFirstNonEmptyFromIndices(r, idx.sys));
    const dia = toNumber(pickFirstNonEmptyFromIndices(r, idx.dia));
    const sugar = toNumber(pickFirstNonEmptyFromIndices(r, idx.sugar));

    const bmi = computeBMI(weightKg, heightCm);
    const bmiCat = bmiCategoryThai(bmi);
    const bpCat = bpCategory(sys, dia);
    const sugarCat = sugarCategoryMgDl(sugar);

    // counts
    if (bmiCat === "unknown") counts.bmi.unknown++;
    else if (bmiCat === "normal") counts.bmi.normal++;
    else counts.bmi.risk++;

    if (bpCat === "unknown") counts.bp.unknown++;
    else if (bpCat === "normal") counts.bp.normal++;
    else if (bpCat === "low") counts.bp.low++;
    else if (bpCat === "high") counts.bp.high++;
    else counts.bp.risk++;

    if (sugarCat === "unknown") counts.sugar.unknown++;
    else if (sugarCat === "normal") counts.sugar.normal++;
    else if (sugarCat === "low") counts.sugar.low++;
    else if (sugarCat === "high") counts.sugar.high++;
    else counts.sugar.risk++;

    const bmiRisk = bmiCat !== "unknown" && bmiCat !== "normal";
    const bpRisk = bpCat === "low" || bpCat === "risk" || bpCat === "high";
    const sugarRisk = sugarCat === "risk" || sugarCat === "high" || sugarCat === "low";

    people.push({
      sheetKey,
      rowIndex: i + 2, // header is row 1
      name: name ? String(name).trim() : "",
      weightKg,
      heightCm,
      bmi,
      bmiCategory: bmiCat,
      bmiRisk,
      bp: { systolic: sys, diastolic: dia, category: bpCat, risk: bpRisk },
      sugarMgDl: sugar,
      sugarCategory: sugarCat,
      sugarRisk,
      overallRisk: bmiRisk || bpRisk || sugarRisk,
    });
  }

  const bpRiskTotal = counts.bp.low + counts.bp.risk + counts.bp.high;

  return {
    totals: { peopleCounted: people.length, countMode },
    bmi: counts.bmi,
    bp: { ...counts.bp, riskTotal: bpRiskTotal },
    sugar: counts.sugar,
    people,
    detectedColumns: {
      headersMatched: {
        name: idx.name.map((i) => headers[i]),
        weight: idx.weight.map((i) => headers[i]),
        height: idx.height.map((i) => headers[i]),
        sys: idx.sys.map((i) => headers[i]),
        dia: idx.dia.map((i) => headers[i]),
        sugar: idx.sugar.map((i) => headers[i]),
      },
    },
  };
}

