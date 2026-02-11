function normalizeHeader(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getFirstMatchingIndex(headers, candidates) {
  const normalized = (headers || []).map(normalizeHeader);
  for (const c of candidates || []) {
    const needle = normalizeHeader(c);
    const idx = normalized.findIndex((h) => h === needle);
    if (idx >= 0) return idx;
  }
  return -1;
}

function findIndexByIncludes(headers, predicates) {
  const normalized = (headers || []).map(normalizeHeader);
  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i];
    const ok = (predicates || []).every((p) => (typeof p === "string" ? h.includes(p) : p.test(h)));
    if (ok) return i;
  }
  return -1;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function getBangkokYMD(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

function dateFromGoogleSerialBangkok(serial) {
  // Google Sheets serial date uses the same epoch as Excel (1899-12-30).
  // serial may include fractional day for time.
  // Interpret serial as Bangkok local time (UTC+7) to avoid day rollovers.
  const ms = Math.round((Number(serial) - 25569) * 86400000) - 7 * 3600000;
  return new Date(ms);
}

export function bangkokDateTimeFromTimestampCell(cell) {
  if (cell === null || cell === undefined || cell === "") return null;

  if (typeof cell === "number" && Number.isFinite(cell)) {
    const d = dateFromGoogleSerialBangkok(cell);
    return { ymd: getBangkokYMD(d), ms: d.getTime(), iso: d.toISOString(), source: String(cell) };
  }

  const s = String(cell).trim();
  if (!s) return null;

  // Parse "D/M/YYYY[, ]HH:mm:ss" first (Thai-friendly).
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    const hh = m[4] ? parseInt(m[4], 10) : 0;
    const mm = m[5] ? parseInt(m[5], 10) : 0;
    const ss = m[6] ? parseInt(m[6], 10) : 0;

    let day = a;
    let month = b;
    if (a <= 12 && b > 12) {
      month = a;
      day = b;
    }

    if (!Number.isFinite(y) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    // Interpret given time as Bangkok local time (UTC+7)
    const ms = Date.UTC(y, month - 1, day, hh - 7, mm, ss);
    const d = new Date(ms);
    return { ymd: `${y}-${pad2(month)}-${pad2(day)}`, ms, iso: d.toISOString(), source: s };
  }

  // Try native parse for non-slash formats (e.g. ISO)
  const d1 = new Date(s);
  if (!Number.isNaN(d1.getTime())) {
    return { ymd: getBangkokYMD(d1), ms: d1.getTime(), iso: d1.toISOString(), source: s };
  }

  return null;
}

export function bangkokYmdFromTimestampCell(cell) {
  if (cell === null || cell === undefined || cell === "") return null;

  // Preferred: numeric serial (when Sheets API is called with dateTimeRenderOption: "SERIAL_NUMBER")
  if (typeof cell === "number" && Number.isFinite(cell)) {
    return getBangkokYMD(dateFromGoogleSerialBangkok(cell));
  }

  const s = String(cell).trim();
  if (!s) return null;

  // IMPORTANT: Avoid native Date parsing for slash-based dates (ambiguous MM/DD vs DD/MM).
  // Parse "D/M/YYYY[, ]HH:mm:ss" first with Thai-friendly heuristic.
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);

    // Heuristic: Thai users usually use D/M/YYYY. If ambiguous, prefer D/M/YYYY.
    let day = a;
    let month = b;
    // If clearly MM/DD (e.g. 2/30/2026), swap
    if (a <= 12 && b > 12) {
      month = a;
      day = b;
    }

    if (!Number.isFinite(y) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return `${y}-${pad2(month)}-${pad2(day)}`;
  }

  // Try native parse for non-slash formats (e.g. ISO)
  const d1 = new Date(s);
  if (!Number.isNaN(d1.getTime())) {
    return getBangkokYMD(d1);
  }

  return null;
}

export function toNullableNumber(cell) {
  if (cell === null || cell === undefined || cell === "") return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  const s = String(cell).trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function toNullableInt(cell) {
  const n = toNullableNumber(cell);
  return n === null ? null : Math.trunc(n);
}

export function inferWaterQualitySheetIndices(headers) {
  const pick = (...vals) => {
    for (const v of vals) if (typeof v === "number" && v >= 0) return v;
    return -1;
  };

  // Prefer exact matches; fall back to "includes" heuristics to tolerate small text changes
  const idx = {
    timestamp: pick(
      getFirstMatchingIndex(headers, ["ประทับเวลา", "timestamp"]),
      findIndexByIncludes(headers, ["ประทับเวลา"])
    ),

    village: pick(
      getFirstMatchingIndex(headers, ["พื้นที่", "หมู่บ้าน", "หมู่บ้าน/พื้นที่", "หมู่บ้าน / พื้นที่"]),
      findIndexByIncludes(headers, ["หมู่บ้าน"]),
      findIndexByIncludes(headers, ["พื้นที่"])
    ),

    rawTurbidityNtu: pick(
      getFirstMatchingIndex(headers, ["ค่าความขุ่น (NTU) น้ำดิบ"]),
      findIndexByIncludes(headers, ["ความขุ่น", "ntu", "น้ำดิบ"])
    ),

    rawPh: pick(
      getFirstMatchingIndex(headers, ["ค่า ph น้ำดิบ", "ค่า pH น้ำดิบ"]),
      findIndexByIncludes(headers, [/ค่า\s*p?h/, "น้ำดิบ"])
    ),

    rawTdsMgL: pick(
      getFirstMatchingIndex(headers, ["ค่า tds น้ำดิบ (mg/ลิตร)", "ค่า tds น้ำดิบ"]),
      findIndexByIncludes(headers, ["tds", "น้ำดิบ"])
    ),

    tapTurbidityNtu: pick(
      findIndexByIncludes(headers, ["ความขุ่น", "ntu", "น้ำจ่าย"]),
      getFirstMatchingIndex(headers, ["ค่าความขุ่น (NTU) น้ำจ่าย"])
    ),

    tapPh: pick(
      findIndexByIncludes(headers, [/ค่า\s*p?h/, "น้ำจ่าย"]),
      getFirstMatchingIndex(headers, ["ค่า ph น้ำจ่าย", "ค่า pH น้ำจ่าย"])
    ),

    tapTdsMgL: pick(
      findIndexByIncludes(headers, ["tds", "น้ำจ่าย"]),
      getFirstMatchingIndex(headers, ["ค่า tds น้ำจ่าย (mg/ลิตร)", "ค่า tds น้ำจ่าย"])
    ),

    freeChlorineSourceMgL: pick(
      findIndexByIncludes(headers, ["คลอรีน", "ต้นทาง"]),
      findIndexByIncludes(headers, ["คลอรี", "ต้นทาง"])
    ),

    freeChlorineEndMgL: pick(
      findIndexByIncludes(headers, ["คลอรีน", "ปลายทาง"]),
      findIndexByIncludes(headers, ["คลอรี", "ปลายทาง"])
    ),
  };

  // Fixed-column fallback for the exact sheet shown in screenshot:
  // A timestamp, B village/พื้นที่, C raw NTU, D raw pH, E raw TDS, F tap NTU, G tap pH, H tap TDS, I chlorine source, J chlorine end
  const fallback = {
    timestamp: 0,
    village: 1,
    rawTurbidityNtu: 2,
    rawPh: 3,
    rawTdsMgL: 4,
    tapTurbidityNtu: 5,
    tapPh: 6,
    tapTdsMgL: 7,
    freeChlorineSourceMgL: 8,
    freeChlorineEndMgL: 9,
  };

  const out = {};
  for (const k of Object.keys(fallback)) {
    const v = idx[k];
    out[k] = typeof v === "number" && v >= 0 ? v : fallback[k];
  }
  return out;
}

export function parseWaterQualitySheetRow({ row, indices }) {
  const ts = bangkokDateTimeFromTimestampCell(row?.[indices.timestamp]);
  if (!ts?.ymd) return { skip: true, reason: "missing timestamp/recordDate" };

  const villageRaw = row?.[indices.village];
  const village = villageRaw === null || villageRaw === undefined ? "" : String(villageRaw).trim();

  const raw = {
    turbidityNtu: toNullableNumber(row?.[indices.rawTurbidityNtu]),
    ph: toNullableNumber(row?.[indices.rawPh]),
    tdsMgL: toNullableInt(row?.[indices.rawTdsMgL]),
  };

  const tap = {
    turbidityNtu: toNullableNumber(row?.[indices.tapTurbidityNtu]),
    ph: toNullableNumber(row?.[indices.tapPh]),
    tdsMgL: toNullableInt(row?.[indices.tapTdsMgL]),
    freeChlorineSourceMgL: toNullableNumber(row?.[indices.freeChlorineSourceMgL]),
    freeChlorineEndMgL: toNullableNumber(row?.[indices.freeChlorineEndMgL]),
  };

  return {
    skip: false,
    recordDate: ts.ymd,
    raw,
    tap,
    note: village,
    measuredAtMs: ts.ms ?? null,
    measuredAtIso: ts.iso ?? null,
    sourceTimestamp: ts.source ?? "",
  };
}

