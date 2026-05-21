import dbConnect from "@/lib/dbConnect";
import Pm25Settings from "@/models/Pm25Settings";
import { requirePm25Admin } from "@/pages/api/pm25/_auth";
import {
  getDustboyConfig,
  getPm25DashboardPayload,
  loadSheetPm25Data,
  loadDustboyPm25Data,
  PM25_SHEET_REALTIME_URL,
  PM25_SHEET_DAILY_URL,
} from "@/lib/pm25Data";

const MODES = ["sheet_with_api_fallback", "sheet_only", "api_only"];

async function getSettingsDoc() {
  await dbConnect();
  let doc = await Pm25Settings.findOne({ key: "default" });
  if (!doc) {
    doc = await Pm25Settings.create({
      key: "default",
      dataMode: process.env.PM25_DATA_MODE || "sheet_with_api_fallback",
    });
  }
  return doc;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const auth = await requirePm25Admin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    try {
      const doc = await getSettingsDoc();
      const dustboy = getDustboyConfig();
      return res.status(200).json({
        success: true,
        settings: {
          dataMode: doc.dataMode,
          updatedAt: doc.updatedAt,
          updatedBy: doc.updatedBy,
        },
        config: {
          hasDustboyApiKey: Boolean(dustboy.apiKey),
          stationId: dustboy.stationId,
          sheetRealtimeUrl: PM25_SHEET_REALTIME_URL,
          sheetDailyUrl: PM25_SHEET_DAILY_URL,
        },
      });
    } catch (error) {
      console.error("pm25 settings GET error:", error);
      return res.status(500).json({ success: false, message: error?.message });
    }
  }

  if (req.method === "PUT") {
    const auth = await requirePm25Admin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { dataMode } = req.body || {};
    if (!MODES.includes(dataMode)) {
      return res.status(400).json({ success: false, message: "Invalid dataMode" });
    }

    try {
      await dbConnect();
      const doc = await Pm25Settings.findOneAndUpdate(
        { key: "default" },
        { dataMode, updatedBy: auth.userId },
        { upsert: true, new: true }
      );
      return res.status(200).json({
        success: true,
        settings: {
          dataMode: doc.dataMode,
          updatedAt: doc.updatedAt,
          updatedBy: doc.updatedBy,
        },
      });
    } catch (error) {
      console.error("pm25 settings PUT error:", error);
      return res.status(500).json({ success: false, message: error?.message });
    }
  }

  if (req.method === "POST" && req.query.action === "test") {
    const auth = await requirePm25Admin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const target = typeof req.body?.target === "string" ? req.body.target : "both";

    try {
      const results = {};

      if (target === "sheet" || target === "both") {
        try {
          const sheet = await loadSheetPm25Data();
          results.sheet = {
            ok: sheet.sheetOk,
            pm25: sheet.latest?.pm25,
            time: sheet.latest?.Time,
            date: sheet.latest?.date_select,
          };
        } catch (err) {
          results.sheet = { ok: false, error: err?.message };
        }
      }

      if (target === "dustboy" || target === "both") {
        try {
          const dust = await loadDustboyPm25Data();
          results.dustboy = {
            ok: true,
            pm25: dust.latest?.pm25,
            time: dust.latest?.Time,
            date: dust.latest?.date_select,
            station: dust.station?.dustboy_name,
          };
        } catch (err) {
          results.dustboy = { ok: false, error: err?.message };
        }
      }

      if (target === "dashboard" || target === "both") {
        const doc = await getSettingsDoc();
        const dash = await getPm25DashboardPayload(doc.dataMode);
        results.dashboard = {
          ok: dash.success,
          source: dash.source,
          fallback: dash.fallback,
          pm25: dash.latest?.pm25,
          error: dash.error,
        };
      }

      return res.status(200).json({ success: true, results });
    } catch (error) {
      console.error("pm25 test error:", error);
      return res.status(500).json({ success: false, message: error?.message });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
