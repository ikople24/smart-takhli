import dbConnect from "@/lib/dbConnect";
import WaterQualityDaily from "@/models/smart-papar/WaterQualityDaily";
import {
  inferWaterQualitySheetIndices,
  parseWaterQualitySheetRow,
} from "@/lib/smartPaparWaterQualitySheet";
import { requireSmartPaparAdmin } from "./_auth";
import { google } from "googleapis";
import Papa from "papaparse";

function normalizeSpreadsheetId(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  // Accept full Google Sheets URL
  // e.g. https://docs.google.com/spreadsheets/d/<ID>/edit?... or /d/<ID>
  const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m?.[1]) return m[1];

  // Accept just the ID
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

  const auth = new google.auth.JWT({
    email,
    key,
    scopes,
  });
  return google.sheets({ version: "v4", auth });
}

function getPublicCsvUrl({ spreadsheetId, sheetName }) {
  // Works when the sheet is accessible to "anyone with the link"
  const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq`;
  const params = new URLSearchParams();
  params.set("tqx", "out:csv");
  if (sheetName) params.set("sheet", sheetName);
  return `${base}?${params.toString()}`;
}

async function fetchPublicSheetValues({ spreadsheetId, sheetName }) {
  const url = getPublicCsvUrl({ spreadsheetId, sheetName });
  const controller = new AbortController();
  const timeoutMs = 15000;
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const r = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(t));
  if (!r.ok) {
    throw new Error(`Fetch public sheet failed (${r.status})`);
  }
  const csv = await r.text();
  if (!csv || csv.length < 5) {
    throw new Error("Public sheet returned empty content");
  }
  const parsed = Papa.parse(csv, { skipEmptyLines: true });
  if (parsed?.errors?.length) {
    throw new Error(parsed.errors[0]?.message || "CSV parse error");
  }
  const values = parsed?.data;
  if (!Array.isArray(values)) return [];
  return values;
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
  // Keep in sync with existing API validation (same ranges)
  const out = {
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
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const auth = await requireSmartPaparAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  const spreadsheetIdRaw = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const spreadsheetId = normalizeSpreadsheetId(spreadsheetIdRaw);
  const range = process.env.GOOGLE_SHEETS_RANGE || "Form_Responses 1!A:K";
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || "Form_Responses";
  const maxRows = Number(req.query?.maxRows || 0) || 0; // optional: limit rows processed (from bottom)

  if (!spreadsheetId) {
    return res.status(500).json({ success: false, message: "Server misconfigured: GOOGLE_SHEETS_SPREADSHEET_ID is missing" });
  }

  try {
    let values = [];
    if (hasServiceAccountCreds()) {
      const sheets = getSheetsClient({ readonly: true });

      // Use UNFORMATTED_VALUE + SERIAL_NUMBER so timestamp cells become numeric serials (reliable parsing)
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "SERIAL_NUMBER",
      });
      values = resp?.data?.values || [];
    } else {
      // Public access mode: only needs GOOGLE_SHEETS_SPREADSHEET_ID (+ optional GOOGLE_SHEETS_SHEET_NAME)
      values = await fetchPublicSheetValues({ spreadsheetId, sheetName });
    }

    if (!Array.isArray(values) || values.length < 2) {
      return res.status(200).json({
        success: true,
        message: "No rows",
        stats: { processed: 0, upserted: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
      });
    }

    const headers = values[0];
    const rowsAll = values.slice(1);
    const rows = maxRows > 0 ? rowsAll.slice(Math.max(0, rowsAll.length - maxRows)) : rowsAll;

    const indices = inferWaterQualitySheetIndices(headers);

    // Group by recordDate (unique in DB). Keep all measurements per day.
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
        rowErrors.push({ recordDate, error: "Invalid recordDate" });
        continue;
      }

      try {
        // Sort by measuredAtMs (fallback 0). Latest is used as top-level raw/tap/note.
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
          updatedByClerkId: auth.userId,
          updatedByName: auth.name || "",
        };
        const setOnInsert = {
          createdByClerkId: auth.userId,
          createdByName: auth.name || "",
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
      stats: {
        processed,
        upserted: inserted + updated,
        inserted,
        updated,
        skipped,
        errors: rowErrors.length,
      },
      errors: rowErrors.slice(0, 50),
      meta: {
        mode: hasServiceAccountCreds() ? "service-account" : "public-csv",
        range: hasServiceAccountCreds() ? range : null,
        sheetName: hasServiceAccountCreds() ? null : sheetName,
        uniqueDates: byDate.size,
        spreadsheetId,
      },
    });
  } catch (error) {
    console.error("smart-papar water-quality sync-sheet error:", error);
    return res.status(500).json({ success: false, message: error?.message || "Server error" });
  }
}

