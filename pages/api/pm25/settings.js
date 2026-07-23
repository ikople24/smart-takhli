import dbConnect from "@/lib/dbConnect";
import Pm25Settings from "@/models/Pm25Settings";
import Pm25Monthly from "@/models/Pm25Monthly";
import { requirePm25Admin } from "@/pages/api/pm25/_auth";
import {
  getDustboyConfig,
  getPm25DashboardPayload,
  loadSheetPm25Data,
  fetchDustboyStationLatest,
  normalizeDustboyLatest,
  PM25_SHEET_REALTIME_URL,
  PM25_SHEET_DAILY_URL,
} from "@/lib/pm25Data";
import { getPm25FromCache, syncPm25Hourly, syncPm25Daily, syncPm25Monthly } from "@/lib/pm25Sync";
import Pm25SyncLog from "@/models/Pm25SyncLog";

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
      const cache = await getPm25FromCache();
      const monthsTotal = await Pm25Monthly.countDocuments();
      const recentLogs = await Pm25SyncLog.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

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
        monthsTotal,
        cache: cache
          ? {
              pm25: cache.latest?.pm25,
              syncedAt: cache.syncedAt,
              dailySyncedAt: cache.dailySyncedAt,
              monthlySyncedAt: cache.monthlySyncedAt,
              stale: cache.stale,
              daysCount: cache.dailyAverages?.length || 0,
              monthsCount: cache.monthlyAverages?.length || 0,
            }
          : null,
        recentLogs: recentLogs.map((l) => ({
          job: l.job,
          success: l.success,
          message: l.message,
          at: l.createdAt,
        })),
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

  if (req.method === "POST" && req.query.action === "sync") {
    const auth = await requirePm25Admin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const job = typeof req.body?.job === "string" ? req.body.job : "";
    const runners = {
      hourly: syncPm25Hourly,
      daily: syncPm25Daily,
      monthly: syncPm25Monthly,
    };
    const run = runners[job];
    if (!run) {
      return res.status(400).json({ success: false, message: "Invalid job (hourly|daily|monthly)" });
    }

    try {
      const result = await run();
      return res.status(result.success ? 200 : 502).json({ success: result.success, job, ...result });
    } catch (error) {
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
          const station = await fetchDustboyStationLatest();
          const latest = normalizeDustboyLatest(station);
          results.dustboy = {
            ok: true,
            pm25: latest?.pm25,
            time: latest?.Time,
            date: latest?.date_select,
            station: station?.dustboy_name,
          };
        } catch (err) {
          results.dustboy = { ok: false, error: err?.message };
        }
      }

      if (target === "cache" || target === "both") {
        const cache = await getPm25FromCache();
        results.cache = cache
          ? { ok: true, pm25: cache.latest?.pm25, syncedAt: cache.syncedAt, stale: cache.stale }
          : { ok: false, error: "ยังไม่มี cache" };
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
