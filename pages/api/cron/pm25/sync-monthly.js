import { requireCronSecret } from "@/lib/pm25CronAuth";
import { syncPm25Monthly } from "@/lib/pm25Sync";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const sec = requireCronSecret(req);
  if (!sec.ok) {
    return res.status(sec.status).json({ success: false, message: sec.message });
  }

  try {
    const result = await syncPm25Monthly();
    const status = result.success ? 200 : 502;
    return res.status(status).json({ success: result.success, job: "monthly", ...result });
  } catch (error) {
    console.error("cron pm25 monthly error:", error);
    return res.status(500).json({
      success: false,
      job: "monthly",
      message: error?.message || "Sync failed",
    });
  }
}
