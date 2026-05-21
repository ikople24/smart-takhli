import dbConnect from "@/lib/dbConnect";
import Pm25Settings from "@/models/Pm25Settings";
import { getPm25DashboardPayload } from "@/lib/pm25Data";

async function resolveDataMode(req) {
  const forceMode =
    typeof req.query.mode === "string" ? req.query.mode.trim() : "";
  const allowed = ["sheet_with_api_fallback", "sheet_only", "api_only"];
  if (forceMode && allowed.includes(forceMode)) return forceMode;

  try {
    await dbConnect();
    const doc = await Pm25Settings.findOne({ key: "default" }).lean();
    if (doc?.dataMode && allowed.includes(doc.dataMode)) return doc.dataMode;
  } catch {
    // use default
  }
  return process.env.PM25_DATA_MODE || "sheet_with_api_fallback";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const dataMode = await resolveDataMode(req);
    const payload = await getPm25DashboardPayload(dataMode);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    console.error("pm25 dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to load PM2.5 data",
    });
  }
}
