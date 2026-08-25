import dbConnect from "@/lib/dbConnect";
import Pm25Monthly from "@/models/Pm25Monthly";
import { requirePm25Admin } from "@/pages/api/pm25/_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const auth = await requirePm25Admin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  try {
    await dbConnect();
    const months = await Pm25Monthly.find()
      .sort({ year: 1, month: 1 })
      .select("monthKey month year name fullName avg count syncedAt -_id")
      .lean();
    return res.status(200).json({ success: true, months });
  } catch (error) {
    console.error("pm25 monthly-report GET error:", error);
    return res.status(500).json({ success: false, message: error?.message });
  }
}
