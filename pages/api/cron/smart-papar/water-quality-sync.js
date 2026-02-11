import dbConnect from "@/lib/dbConnect";
import WaterQualityDaily from "@/models/smart-papar/WaterQualityDaily";
import {
  inferWaterQualitySheetIndices,
  parseWaterQualitySheetRow,
} from "@/lib/smartPaparWaterQualitySheet";
import { google } from "googleapis";
import Papa from "papaparse";

function requireCronSecret(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return { ok: false, status: 500, message: "Server misconfigured: CRON_SECRET is missing" };
  }
  const provided = req.headers["x-cron-secret"] || req.query?.secret || "";
  if (String(provided) !== String(expected)) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  return { ok: true };
}

function normalizeSpreadsheetId(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m?.[1]) return m[1];
  return raw;
}

function hasServiceAccountCreds() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  return Boolean(email && keyRaw);
}

function getSheetsClient({ readonly = true } = {}) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const key = keyRaw ? String(keyRaw).replace(/\\n/g, "\n") : null;
  if (!email || !key) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  }

  const scopes = readonly
    ? ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    : ["https://www.googleapis.com/auth/spreadsheets"];

  const auth = new google.auth.JWT({ email, key, scopes });
  return google.sheets({ version: "v4", auth });
}

function getPublicCsvUrl({ spreadsheetId, sheetName }) {
  const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq`;
  const params = new URLSearchParams();
  params.set("tqx", "out:csv");
  if (sheetName) params.set("sheet", sheetName);
  return `${base}?${params.toString()}`;
}

async function fetchPublicSheetValues({ spreadsheetId, sheetName }) {
  const url = getPublicCsvUrl({ spreadsheetId, sheetName });
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  const r = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(t));
  if (!r.ok) throw new Error(`Fetch public sheet failed (${r.status})`);
  const csv = await r.text();
  const parsed = Papa.parse(csv, { skipEmptyLines: true });
  if (parsed?.errors?.length) throw new Error(parsed.errors[0]?.message || "CSV parse error");
  return Array.isArray(parsed?.data) ? parsed.data : [];
}

function clampNullable(n, { min = 0, max } = {}) {
  if (n === null || n === undefined) return null;
  if (!Number.isFinite(n)) return null;
  let v = n;
  if (Number.isFinite(min)) v = Math.max(min, v);
  if (Number.isFinite(max)) v = Math.min(max, v);
  return v;
}

function validateAndNormalizeDoc({ recordDate, raw, tap }) {
  return {
    recordDate,
    raw: {
      turbidityNtu: clampNullable(raw?.turbidityNtu, { min: 0, max: 999 }),
      ph: clampNullable(raw?.ph, { min: 0, max: 14 }),
      tdsMgL: clampNullable(raw?.tdsMgL, { min: 0, max: 500 }),
    },
    tap: {
      turbidityNtu: clampNullable(tap?.turbidityNtu, { min: 0, max: 999 }),
      ph: clampNullable(tap?.ph, { min: 0, max: 14 }),
      tdsMgL: clampNullable(tap?.tdsMgL, { min: 0, max: 500 }),
      freeChlorineSourceMgL: clampNullable(tap?.freeChlorineSourceMgL, { min: 0, max: 10 }),
      freeChlorineEndMgL: clampNullable(tap?.freeChlorineEndMgL, { min: 0, max: 10 }),
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const sec = requireCronSecret(req);
  if (!sec.ok) {
    return res.status(sec.status).json({ success: false, message: sec.message });
  }

  const spreadsheetId = normalizeSpreadsheetId(process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
  const range = process.env.GOOGLE_SHEETS_RANGE || "Form_Responses 1!A:K";
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || "Form_Responses";
  const maxRows = Number(req.query?.maxRows || 0) || 200;

  if (!spreadsheetId) {
    return res.status(500).json({ success: false, message: "Missing GOOGLE_SHEETS_SPREADSHEET_ID" });
  }

  try {
    let values = [];
    if (hasServiceAccountCreds()) {
      const sheets = getSheetsClient({ readonly: true });
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "SERIAL_NUMBER",
      });
      values = resp?.data?.values || [];
    } else {
      values = await fetchPublicSheetValues({ spreadsheetId, sheetName });
    }

    if (!Array.isArray(values) || values.length < 2) {
      return res.status(200).json({ success: true, message: "No rows", stats: { processed: 0 } });
    }

    const headers = values[0];
    const rowsAll = values.slice(1);
    const rows = maxRows > 0 ? rowsAll.slice(Math.max(0, rowsAll.length - maxRows)) : rowsAll;
    const indices = inferWaterQualitySheetIndices(headers);

    const byDate = new Map();
    for (const row of rows) {
      const parsed = parseWaterQualitySheetRow({ row, indices });
      if (parsed.skip) continue;
      if (!byDate.has(parsed.recordDate)) byDate.set(parsed.recordDate, []);
      byDate.get(parsed.recordDate).push(parsed);
    }

    await dbConnect();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let processed = 0;
    const rowErrors = [];

    for (const [recordDate, dayRows] of byDate.entries()) {
      processed++;
      if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(recordDate))) {
        skipped++;
        continue;
      }

      try {
        const sorted = (dayRows || [])
          .slice()
          .sort((a, b) => (a.measuredAtMs ?? 0) - (b.measuredAtMs ?? 0));
        const latest = sorted.length ? sorted[sorted.length - 1] : null;
        if (!latest) {
          skipped++;
          continue;
        }

        const existing = await WaterQualityDaily.findOne({ recordDate }).lean();
        const existingMeasurements = Array.isArray(existing?.measurements) ? existing.measurements : [];
        const seen = new Set(
          existingMeasurements
            .map((m) => (m?.sourceTimestamp ? String(m.sourceTimestamp) : null))
            .filter(Boolean)
        );

        const newMeasurements = [];
        for (const r of sorted) {
          const key = r.sourceTimestamp ? String(r.sourceTimestamp) : (r.measuredAtIso ? String(r.measuredAtIso) : "");
          if (key && seen.has(key)) continue;

          const normalized = validateAndNormalizeDoc(r);
          newMeasurements.push({
            measuredAt: r.measuredAtIso ? new Date(r.measuredAtIso) : null,
            sourceTimestamp: key,
            village: typeof r.note === "string" ? r.note : "",
            raw: normalized.raw,
            tap: normalized.tap,
            note: typeof r.note === "string" ? r.note : "",
          });
          if (key) seen.add(key);
        }

        const latestNormalized = validateAndNormalizeDoc(latest);
        const update = {
          raw: latestNormalized.raw,
          tap: latestNormalized.tap,
          note: typeof latest.note === "string" ? latest.note : "",
          latestMeasuredAt: latest.measuredAtIso ? new Date(latest.measuredAtIso) : null,
          updatedByClerkId: "cron",
          updatedByName: "cron",
        };
        const setOnInsert = {
          createdByClerkId: "cron",
          createdByName: "cron",
        };

        const op = { $set: update, $setOnInsert: setOnInsert };
        if (newMeasurements.length > 0) {
          op.$push = { measurements: { $each: newMeasurements } };
        }

        const result = await WaterQualityDaily.updateOne({ recordDate }, op, {
          upsert: true,
          runValidators: true,
        });

        if (result?.upsertedCount && result.upsertedCount > 0) inserted++;
        else updated++;
      } catch (e) {
        skipped++;
        rowErrors.push({ recordDate, error: e?.message || "Upsert failed" });
      }
    }

    return res.status(200).json({
      success: true,
      stats: { processed, inserted, updated, skipped, errors: rowErrors.length },
      errors: rowErrors.slice(0, 20),
      meta: {
        mode: hasServiceAccountCreds() ? "service-account" : "public-csv",
        maxRows,
        spreadsheetId,
      },
    });
  } catch (e) {
    console.error("cron water-quality-sync error:", e);
    return res.status(500).json({ success: false, message: e?.message || "Server error" });
  }
}

