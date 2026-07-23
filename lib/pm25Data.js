import Papa from "papaparse";

export const PM25_SHEET_REALTIME_URL =
  process.env.PM25_SHEET_REALTIME_URL ||
  "https://docs.google.com/spreadsheets/d/19MHYCUTLM8bKGVDALFfrDzK6_Vu52drfZD_-n_bF394/export?format=csv";

export const PM25_SHEET_DAILY_URL =
  process.env.PM25_SHEET_DAILY_URL ||
  "https://docs.google.com/spreadsheets/d/19MHYCUTLM8bKGVDALFfrDzK6_Vu52drfZD_-n_bF394/export?format=csv&gid=1506988263";

export const DUSTBOY_API_BASE =
  process.env.DUSTBOY_API_BASE || "https://open-api.cmuccdc.org";

const DAY_NAMES = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

// data1year ช้าได้ถึง ~102s (วัดจริง 2026-07-23) — 60s เดิมทำให้ cron monthly
// abort ติดต่อกันทั้งเดือน มิ.ย. 2569
const DUSTBOY_FETCH_TIMEOUT_MS = 150000;

export function getDustboyConfig() {
  return {
    apiKey: (process.env.DUSTBOY_API_KEY || "").trim(),
    stationId: (process.env.DUSTBOY_STATION_ID || "3550").trim(),
    baseUrl: DUSTBOY_API_BASE,
  };
}

function parseCsvText(text) {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors?.length) {
          reject(new Error(results.errors[0]?.message || "CSV parse error"));
          return;
        }
        resolve(results.data || []);
      },
      error: (err) => reject(err),
    });
  });
}

export async function fetchSheetCsv(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet HTTP ${res.status}`);
    const text = await res.text();
    if (!text || text.trim().startsWith("<")) {
      throw new Error("Sheet returned HTML (not public or unavailable)");
    }
    return parseCsvText(text);
  } finally {
    clearTimeout(timer);
  }
}

export function getLatestSheetEntry(rows) {
  const reversed = [...(rows || [])].reverse();
  return reversed.find((row) => row?.pm25 && row?.Time) || null;
}

export function isSheetLatestValid(latest) {
  if (!latest?.pm25 || !latest?.Time) return false;
  const pm = parseFloat(latest.pm25);
  return !isNaN(pm) && pm > 0;
}

export function ymdToThaiDmy(ymd) {
  const [y, m, d] = String(ymd).split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
}

export function getDayName(dateStr) {
  const parts = String(dateStr).split("/");
  if (parts.length === 3) {
    let year = parseInt(parts[2], 10);
    if (year > 2400) year -= 543;
    const date = new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    return DAY_NAMES[date.getDay()];
  }
  return dateStr;
}

export function buildDailyAveragesFromSheet(dailyRows) {
  if (!dailyRows?.length) return [];
  return dailyRows
    .filter((row) => row?.date_pm_sensor && row?.pm25_avg)
    .map((row) => ({
      date: row.date_pm_sensor,
      avg: Math.round(parseFloat(row.pm25_avg) || 0),
      dayName: getDayName(row.date_pm_sensor),
    }))
    .filter((row) => row.avg > 0)
    .sort((a, b) => {
      const parseDate = (d) => {
        const parts = d.split("/");
        if (parts.length === 3) {
          let y = parseInt(parts[2], 10);
          if (y > 2400) y -= 543;
          return new Date(y, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
        return new Date(d);
      };
      return parseDate(b.date) - parseDate(a.date);
    })
    .slice(0, 7)
    .reverse();
}

export function buildMonthlyAveragesFromDaily(dailyRows) {
  const monthNames = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  const groupedByMonth = {};

  (dailyRows || [])
    .filter((row) => row?.date_pm_sensor && row?.pm25_avg)
    .forEach((row) => {
      const parts = row.date_pm_sensor.split("/");
      if (parts.length !== 3) return;
      const month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      if (year > 2400) year -= 543;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const avg = parseFloat(row.pm25_avg);
      if (isNaN(avg) || avg <= 0) return;
      if (!groupedByMonth[key]) groupedByMonth[key] = { values: [], month, year };
      groupedByMonth[key].values.push(avg);
    });

  return Object.entries(groupedByMonth)
    .map(([key, data]) => ({
      key,
      month: data.month,
      year: data.year,
      name: monthNames[data.month - 1],
      fullName: `${monthNames[data.month - 1]} ${data.year + 543}`,
      avg: Math.round(data.values.reduce((a, b) => a + b, 0) / data.values.length),
      count: data.values.length,
    }))
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 12);
}

export function aggregateHourlyToDaily(hourlyValues) {
  const byDate = {};
  for (const row of hourlyValues || []) {
    const dt = String(row.log_datetime || "");
    const dateKey = dt.split(" ")[0];
    if (!dateKey) continue;
    const pm = parseFloat(row.pm25);
    if (isNaN(pm)) continue;
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(pm);
  }
  return Object.entries(byDate)
    .map(([ymd, values]) => ({
      date: ymdToThaiDmy(ymd),
      ymd,
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      dayName: getDayName(ymdToThaiDmy(ymd)),
    }))
    .filter((d) => d.avg > 0)
    .sort((a, b) => b.ymd.localeCompare(a.ymd))
    .slice(0, 7)
    .reverse()
    .map(({ date, avg, dayName }) => ({ date, avg, dayName }));
}

export function aggregateHourlyToMonthly(hourlyValues) {
  const monthNames = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  const byMonth = {};
  for (const row of hourlyValues || []) {
    const dt = String(row.log_datetime || "");
    const dateKey = dt.split(" ")[0];
    if (!dateKey) continue;
    const [y, m] = dateKey.split("-").map((n) => parseInt(n, 10));
    const pm = parseFloat(row.pm25);
    if (!y || !m || isNaN(pm)) continue;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { values: [], month: m, year: y };
    byMonth[key].values.push(pm);
  }
  return Object.entries(byMonth)
    .map(([key, data]) => ({
      key,
      month: data.month,
      year: data.year,
      name: monthNames[data.month - 1],
      fullName: `${monthNames[data.month - 1]} ${data.year + 543}`,
      avg: Math.round(data.values.reduce((a, b) => a + b, 0) / data.values.length),
      count: data.values.length,
    }))
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 12);
}

function pickDustboyStation(stations, stationId) {
  return (
    stations.find((s) => String(s.id) === String(stationId)) ||
    stations.find((s) => String(s.dustboy_id) === String(stationId)) ||
    null
  );
}

async function fetchDustboyJson(url, { timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`DustBoy HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ค่าล่าสุดสำหรับหน้าหลัก — GET /api/dustboy/station
 * (จุดที่ลงทะเบียนในบัญชี — apikey ส่วนใหญ่ใช้ endpoint นี้ได้)
 * /stations ดึงทุกจุดในระบบ อาจได้ 401 ถ้าไม่มีสิทธิ์เพิ่ม
 */
export async function fetchDustboyStationLatest() {
  const { apiKey, stationId, baseUrl } = getDustboyConfig();
  if (!apiKey) throw new Error("Missing DUSTBOY_API_KEY");

  const url = `${baseUrl}/api/dustboy/station?apikey=${encodeURIComponent(apiKey)}`;
  const data = await fetchDustboyJson(url);
  if (!Array.isArray(data)) throw new Error("DustBoy station invalid response");

  const station = pickDustboyStation(data, stationId);
  if (!station) throw new Error("DustBoy station not found");
  return station;
}

/** @deprecated alias */
export async function fetchDustboyStations() {
  return fetchDustboyStationLatest();
}

export async function fetchDustboyStation() {
  return fetchDustboyStationLatest();
}

/** สรุปรายวัน 7 วัน — GET /api/dustboy/data30day/{id} */
export async function fetchDustboy30Day() {
  const { apiKey, stationId, baseUrl } = getDustboyConfig();
  if (!apiKey) throw new Error("Missing DUSTBOY_API_KEY");

  const url = `${baseUrl}/api/dustboy/data30day/${encodeURIComponent(stationId)}?apikey=${encodeURIComponent(apiKey)}`;
  return fetchDustboyJson(url, { timeoutMs: 25000 });
}

/** กราฟรายเดือน 12 เดือน — GET /api/dustboy/data1year/{id} */
export async function fetchDustboy1Year() {
  const { apiKey, stationId, baseUrl } = getDustboyConfig();
  if (!apiKey) throw new Error("Missing DUSTBOY_API_KEY");

  const url = `${baseUrl}/api/dustboy/data1year/${encodeURIComponent(stationId)}?apikey=${encodeURIComponent(apiKey)}`;
  return fetchDustboyJson(url, { timeoutMs: DUSTBOY_FETCH_TIMEOUT_MS });
}

export function normalizeDustboyLatest(station) {
  const pm = parseFloat(station.pm25);
  const logDt = String(station.log_datetime || "");
  const [datePart, timePart] = logDt.split(" ");
  const time = timePart ? (timePart.length === 5 ? `${timePart}:00` : timePart) : "";

  return {
    pm25: String(isNaN(pm) ? 0 : Math.round(pm)),
    Time: time,
    date_select: datePart ? ymdToThaiDmy(datePart) : "",
    stationName: station.dustboy_name || station.dustboy_name_en || "",
  };
}

export async function loadSheetPm25Data() {
  const [realtimeRows, dailyRows] = await Promise.all([
    fetchSheetCsv(PM25_SHEET_REALTIME_URL),
    fetchSheetCsv(PM25_SHEET_DAILY_URL).catch(() => []),
  ]);
  const latest = getLatestSheetEntry(realtimeRows);
  return {
    source: "sheet",
    latest,
    dailyAverages: buildDailyAveragesFromSheet(dailyRows),
    monthlyAverages: buildMonthlyAveragesFromDaily(dailyRows),
    sheetOk: isSheetLatestValid(latest),
    dailyRows,
  };
}

export async function loadDustboyPm25Data() {
  const [station, history30, history1y] = await Promise.all([
    fetchDustboyStationLatest(),
    fetchDustboy30Day().catch(() => null),
    fetchDustboy1Year().catch(() => null),
  ]);
  const latest = normalizeDustboyLatest(station);
  const dailyFromApi = aggregateHourlyToDaily(history30?.value || []);
  const monthlyFromApi = aggregateHourlyToMonthly(
    history1y?.value?.length ? history1y.value : history30?.value || []
  );

  return {
    source: "dustboy",
    latest,
    station,
    dailyAverages: dailyFromApi,
    monthlyAverages: monthlyFromApi,
  };
}

async function loadDustboyFromCache() {
  const { getPm25FromCache } = await import("@/lib/pm25Sync");
  return getPm25FromCache();
}

export async function getPm25DashboardPayload(dataMode) {
  const mode = dataMode || "sheet_with_api_fallback";
  let sheetResult = null;
  let cacheResult = null;
  let sheetError = null;

  if (mode !== "api_only") {
    try {
      sheetResult = await loadSheetPm25Data();
    } catch (err) {
      sheetError = err?.message || String(err);
    }
  }

  if (mode === "api_only" || (mode === "sheet_with_api_fallback" && (!sheetResult?.sheetOk || sheetError))) {
    cacheResult = await loadDustboyFromCache();
  }

  if (mode === "sheet_only") {
    if (!sheetResult?.sheetOk) {
      return {
        success: false,
        source: null,
        error: sheetError || "ไม่สามารถเชื่อมต่อ Google Sheet ได้",
        latest: null,
        dailyAverages: sheetResult?.dailyAverages || [],
        monthlyAverages: sheetResult?.monthlyAverages || [],
        dataMode: mode,
      };
    }
    return {
      success: true,
      source: "sheet",
      latest: sheetResult.latest,
      dailyAverages: sheetResult.dailyAverages,
      monthlyAverages: sheetResult.monthlyAverages,
      dataMode: mode,
      sheetError: null,
    };
  }

  if (mode === "api_only") {
    if (!cacheResult) {
      return {
        success: false,
        source: null,
        error: "ยังไม่มีข้อมูลในระบบ — รอ Railway cron sync",
        latest: null,
        dailyAverages: [],
        monthlyAverages: [],
        dataMode: mode,
      };
    }
    return {
      success: true,
      source: "dustboy",
      latest: cacheResult.latest,
      dailyAverages: cacheResult.dailyAverages,
      monthlyAverages: cacheResult.monthlyAverages,
      dataMode: mode,
      cached: true,
      stale: cacheResult.stale,
      syncedAt: cacheResult.syncedAt,
    };
  }

  // sheet_with_api_fallback
  if (sheetResult?.sheetOk) {
    return {
      success: true,
      source: "sheet",
      latest: sheetResult.latest,
      dailyAverages: sheetResult.dailyAverages,
      monthlyAverages: sheetResult.monthlyAverages,
      dataMode: mode,
      sheetError: null,
      dustboyError: null,
    };
  }

  if (cacheResult) {
    const dailyAverages =
      cacheResult.dailyAverages?.length > 0
        ? cacheResult.dailyAverages
        : sheetResult?.dailyAverages || [];
    const monthlyAverages =
      cacheResult.monthlyAverages?.length > 0
        ? cacheResult.monthlyAverages
        : sheetResult?.monthlyAverages || [];

    return {
      success: true,
      source: "dustboy",
      latest: cacheResult.latest,
      dailyAverages,
      monthlyAverages,
      dataMode: mode,
      sheetError: sheetError || null,
      fallback: true,
      cached: true,
      stale: cacheResult.stale,
      syncedAt: cacheResult.syncedAt,
    };
  }

  return {
    success: false,
    source: null,
    error: sheetError || "ไม่สามารถโหลดข้อมูล PM2.5 ได้",
    latest: null,
    dailyAverages: sheetResult?.dailyAverages || [],
    monthlyAverages: sheetResult?.monthlyAverages || [],
    dataMode: mode,
    sheetError,
  };
}
